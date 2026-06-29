import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { LANGS, type LangCode } from "./i18n";

// Vorlesen läuft über Server-TTS (ElevenLabs), nicht über die Browser-API.
// Spracheingabe ist bewusst entfernt (Browser-SpeechRecognition ist auf
// macOS zu unzuverlässig). Kommt in Phase 2 über Server-STT, wenn echte
// Kinder das nutzen sollen.

type WikiSourceId = "klexikon" | "grundschulwiki";
type Source = {
  title: string;
  url: string;
  imageUrl?: string;
  wiki?: WikiSourceId;
};

type SourceFlags = {
  klexikon: boolean;
  grundschulwiki: boolean;
  allgemeinwissen: boolean;
};
const DEFAULT_SOURCES: SourceFlags = {
  klexikon: true,
  grundschulwiki: true,
  allgemeinwissen: true,
};


type AssistantMessage = {
  id: string;
  role: "assistant";
  text: string;
  sources: Source[];
  escalated: boolean;
  refused: boolean;
};
type UserMessage = { id: string; role: "user"; text: string };
type Message = UserMessage | AssistantMessage;

type AskResponse = {
  text: string;
  sources: Source[];
  escalated: boolean;
  noAnswer: boolean;
  refused: boolean;
};

const HISTORY_CAP = 6;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function App() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage as LangCode;
  const WIKI_LABEL: Record<WikiSourceId, string> = {
    klexikon: t("sourceKlexikon"),
    grundschulwiki: t("sourceGrundschulwiki"),
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [recState, setRecState] = useState<"idle" | "recording" | "transcribing">(
    "idle",
  );
  const [sourcePrefs, setSourcePrefs] = useState<SourceFlags>(DEFAULT_SOURCES);
  const scrollEnd = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const liveIntervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    // Sanftes Scrollen nur, wenn der Nutzer keine reduzierte Bewegung wünscht.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scrollEnd.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [messages, loading]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  const toggleSpeak = useCallback(
    async (id: string, text: string) => {
      if (speakingId === id) {
        stopAudio();
        return;
      }
      stopAudio();
      setSpeakingId(id);
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Vorlesen ging schief.");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = url;
        audioRef.current.onended = () => stopAudio();
        audioRef.current.onerror = () => stopAudio();
        await audioRef.current.play();
      } catch (err) {
        console.error("TTS failed:", err);
        stopAudio();
      }
    },
    [speakingId, stopAudio],
  );

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  // Audio-Chunks bis hier akkumulieren und an den STT-Endpunkt schicken.
  // Im Live-Modus läuft das parallel zur Aufnahme alle ~3 Sekunden;
  // beim Stop ein letztes Mal mit dem kompletten Audio.
  const transcribeAccumulated = useCallback(
    async (mime: string, isFinal: boolean): Promise<void> => {
      if (inFlightRef.current) return;
      if (chunksRef.current.length === 0) return;
      // WebM ist headerless im 2./3./… Chunk: alle Chunks zusammenkleben
      // ergibt ein gültiges WebM von Anfang an.
      const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
      if (blob.size < 800) return; // zu kurz, lohnt sich nicht
      inFlightRef.current = true;
      try {
        const fd = new FormData();
        fd.append("file", blob, "audio.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        if (!res.ok) return;
        const data = (await res.json()) as { text?: string };
        const txt = (data.text ?? "").trim();
        // Wir ersetzen den Inhalt, weil wir jedes Mal das volle Audio von
        // Aufnahmebeginn schicken. So bleibt der Text konsistent.
        if (txt) setQuestion(txt);
      } catch (err) {
        console.error("transcribe error:", err);
      } finally {
        inFlightRef.current = false;
        if (isFinal) inputRef.current?.focus();
      }
    },
    [],
  );

  const stopRecording = useCallback(async () => {
    if (recState !== "recording") return;
    if (liveIntervalRef.current !== null) {
      window.clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    setRecState("transcribing");
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      // onstop kümmert sich um final-Transkription und Aufräumen
      rec.stop();
    } else {
      // Falls Recorder schon weg ist: direkt aufräumen
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecState("idle");
    }
    recorderRef.current = null;
  }, [recState]);

  const startRecording = useCallback(async () => {
    if (recState !== "idle") return;
    stopAudio();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    streamRef.current = stream;
    const mime = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
    const rec = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (ev: BlobEvent) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = async () => {
      // Letzten Datensatz abwarten und final transkribieren
      await transcribeAccumulated(mime, true);
      chunksRef.current = [];
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecState("idle");
    };
    recorderRef.current = rec;
    // timeslice=1000: alle 1s einen Chunk emittieren, sodass wir alle ~3s
    // zwischendurch transkribieren können.
    rec.start(1000);
    setRecState("recording");
    // Live-Loop alle 3 Sekunden
    liveIntervalRef.current = window.setInterval(() => {
      void transcribeAccumulated(mime, false);
    }, 3000);
  }, [recState, stopAudio, transcribeAccumulated]);

  function resetChat() {
    setMessages([]);
    setError(null);
    setQuestion("");
    stopAudio();
    inputRef.current?.focus();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    const userMsg: UserMessage = { id: uid(), role: "user", text: q };
    const history = messages
      .slice(-HISTORY_CAP)
      .map((m) => ({ role: m.role, content: m.role === "user" ? m.text : m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history,
          sources: sourcePrefs,
          lang,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Etwas ging schief.");
      }
      const data = (await res.json()) as AskResponse;
      const botMsg: AssistantMessage = {
        id: uid(),
        role: "assistant",
        text: data.text,
        sources: data.sources ?? [],
        escalated: !!data.escalated,
        refused: !!data.refused,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ging schief.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit(e as unknown as FormEvent);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">{t("skipToContent")}</a>
      <div className="demo-banner" role="status">{t("banner")}</div>

      <header className="brand">
        <div className="brand-inner">
          <span className="brand-mark" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="18" r="11" fill="#FFC857" />
              <rect x="15" y="28" width="10" height="4" rx="1.5" fill="#2A2D34" />
              <rect x="16" y="33" width="8" height="2" rx="1" fill="#2A2D34" />
            </svg>
          </span>
          <h1>{t("brand")}</h1>
        </div>
        <div className="brand-controls">
          <label className="lang-switch">
            <select
              value={lang}
              aria-label={t("languageLabel")}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </label>
          {messages.length > 0 && (
            <button className="reset" type="button" onClick={resetChat}>
              {t("newConversation")}
            </button>
          )}
        </div>
      </header>

      <div className="sources-bar" role="group" aria-label={t("sources")}>
        <span className="sources-bar-label">{t("sources")}</span>
        {(["klexikon", "grundschulwiki", "allgemeinwissen"] as const).map((k) => {
          const label =
            k === "klexikon"
              ? t("sourceKlexikon")
              : k === "grundschulwiki"
                ? t("sourceGrundschulwiki")
                : t("sourceCommonKnowledge");
          const on = sourcePrefs[k];
          return (
            <button
              key={k}
              type="button"
              className={"source-toggle" + (on ? " on" : " off")}
              aria-pressed={on}
              onClick={() => setSourcePrefs((s) => ({ ...s, [k]: !s[k] }))}
            >
              {label}
            </button>
          );
        })}
      </div>

      <main className="chat" id="main" tabIndex={-1}>
        {messages.length === 0 && (
          <div className="hint">
            <p>
              {t("hintIntro")}
              <br />
              <em>{t("example1")}</em>
              <br />
              <em>{t("example2")}</em>
            </p>
          </div>
        )}

        <ul className="bubbles" aria-live="polite">
          {messages.map((m) =>
            m.role === "user" ? (
              <li key={m.id} className="bubble user">
                <div className="bubble-body">{m.text}</div>
              </li>
            ) : (
              <li
                key={m.id}
                className={
                  "bubble assistant" +
                  (m.escalated ? " escalated" : "") +
                  (m.refused ? " refused" : "")
                }
              >
                {(() => {
                  // Bild bevorzugt aus der relevantesten Quelle (sources[0]
                  // nach dem Relevanz-Gate). Nur wenn die oberen keins haben,
                  // auf die naechste Quelle mit Bild ausweichen.
                  const withImg =
                    m.sources[0]?.imageUrl != null
                      ? m.sources[0]
                      : m.sources.find((s) => s.imageUrl);
                  return withImg?.imageUrl ? (
                    <figure className="bubble-figure">
                      <img
                        className="bubble-image"
                        src={withImg.imageUrl}
                        alt={withImg.title}
                        loading="lazy"
                        draggable={false}
                      />
                      <figcaption className="bubble-figcaption">
                        {t("imageCaption", { title: withImg.title })}
                      </figcaption>
                    </figure>
                  ) : null;
                })()}
                <div className="bubble-body">{m.text}</div>
                <div className="bubble-actions">
                  <button
                    type="button"
                    className={"icon-btn" + (speakingId === m.id ? " active" : "")}
                    aria-label={speakingId === m.id ? t("speakStop") : t("speakStart")}
                    title={speakingId === m.id ? t("speakStop") : t("speakStart")}
                    onClick={() => toggleSpeak(m.id, m.text)}
                  >
                    {speakingId === m.id ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A7 7 0 0 1 14 18.71v2.06A9 9 0 0 0 14 3.23z"/></svg>
                    )}
                  </button>
                </div>
                {m.sources.length > 0 && (
                  <div className="sources">
                    <span className="sources-label">{t("source")}</span>
                    <ul>
                      {m.sources.map((s) => (
                        <li key={s.url}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {s.title}
                          </a>
                          {s.wiki && (
                            <span className="src-wiki">
                              {" "}({WIKI_LABEL[s.wiki]})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ),
          )}
          {loading && (
            <li className="bubble assistant loading">
              <div className="bubble-body">
                <span className="dots" aria-hidden="true">
                  <span /> <span /> <span />
                </span>
                <span className="visually-hidden">{t("loading")}</span>
              </div>
            </li>
          )}
          {error && (
            <li className="bubble assistant error" role="alert">
              <div className="bubble-body">{error}</div>
            </li>
          )}
        </ul>
        <div ref={scrollEnd} />
      </main>

      <form className="composer" onSubmit={submit}>
        <div className="composer-inner">
          <div className="input-wrap has-mic">
            <label className="visually-hidden" htmlFor="question-input">
              {t("placeholder")}
            </label>
            <textarea
              id="question-input"
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                recState === "recording"
                  ? t("placeholderRecording")
                  : recState === "transcribing"
                    ? t("placeholderTranscribing")
                    : t("placeholder")
              }
              rows={1}
              maxLength={500}
              disabled={loading || recState !== "idle"}
              autoFocus
              aria-busy={loading || recState !== "idle"}
            />
            <button
              type="button"
              className={
                "icon-btn mic-inline" +
                (recState === "recording" ? " active" : "") +
                (recState === "transcribing" ? " busy" : "")
              }
              aria-label={recState === "recording" ? t("micStop") : t("micStart")}
              aria-pressed={recState === "recording"}
              title={recState === "recording" ? t("micStop") : t("micStart")}
              onClick={recState === "recording" ? stopRecording : startRecording}
              disabled={loading || recState === "transcribing"}
            >
              {recState === "recording" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
              )}
            </button>
          </div>
          <button type="submit" className="send-btn" disabled={loading || !question.trim()}>
            {t("send")}
          </button>
        </div>
      </form>

      <footer className="footer">
        <span className="footer-credit">{t("footerCreditShort")}</span>
        <nav className="footer-links" aria-label={t("footerNavLabel")}>
          <a href={`/ueber?lang=${lang}`}>{t("footerAbout")}</a>
          <span aria-hidden="true">·</span>
          <a href="/impressum">{t("footerImprint")}</a>
          <span aria-hidden="true">·</span>
          <a href="/datenschutz">{t("footerPrivacy")}</a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/thosor87/fragKIm" target="_blank" rel="noopener noreferrer">{t("footerSource")}</a>
        </nav>
      </footer>

      {/* Außerhalb des Footers: der Footer hat opacity<1 (eigener Stacking-
          Context), sonst würde die Version hinter dem fixierten Composer
          verschwinden. */}
      <span className="footer-version" aria-hidden="true">v{__APP_VERSION__}</span>
    </>
  );
}
