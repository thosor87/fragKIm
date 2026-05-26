import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

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

const WIKI_LABEL: Record<WikiSourceId, string> = {
  klexikon: "Klexikon",
  grundschulwiki: "Grundschulwiki",
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
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
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
        body: JSON.stringify({ question: q, history, sources: sourcePrefs }),
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
      <div className="demo-banner" role="status">
        Interne Entwicklungs-Demo. Nicht für Kinder bestimmt.
      </div>

      <header className="brand">
        <div className="brand-inner">
          <span className="brand-mark" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="18" r="11" fill="#FFC857" />
              <rect x="15" y="28" width="10" height="4" rx="1.5" fill="#2A2D34" />
              <rect x="16" y="33" width="8" height="2" rx="1" fill="#2A2D34" />
            </svg>
          </span>
          <h1>frag KIm</h1>
        </div>
        {messages.length > 0 && (
          <button className="reset" type="button" onClick={resetChat}>
            Neues Gespräch
          </button>
        )}
      </header>

      <div className="sources-bar" aria-label="Aktive Wissensquellen">
        <span className="sources-bar-label">Quellen:</span>
        {(["klexikon", "grundschulwiki", "allgemeinwissen"] as const).map((k) => {
          const label =
            k === "klexikon"
              ? "Klexikon"
              : k === "grundschulwiki"
                ? "Grundschulwiki"
                : "Allgemeinwissen";
          const on = sourcePrefs[k];
          return (
            <button
              key={k}
              type="button"
              className={"source-toggle" + (on ? " on" : " off")}
              aria-pressed={on}
              onClick={() => setSourcePrefs((s) => ({ ...s, [k]: !s[k] }))}
              title={on ? `${label} ausschalten` : `${label} einschalten`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <main className="chat">
        {messages.length === 0 && (
          <div className="hint">
            <p>
              Stell hier eine Frage, zum Beispiel:
              <br />
              <em>„Wie schnell läuft ein Gepard?"</em>
              <br />
              <em>„Was ist ein Vulkan?"</em>
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
                  const img = m.sources.find((s) => s.imageUrl)?.imageUrl;
                  return img ? (
                    <img
                      className="bubble-image"
                      src={img}
                      alt=""
                      loading="lazy"
                    />
                  ) : null;
                })()}
                <div className="bubble-body">{m.text}</div>
                <div className="bubble-actions">
                  <button
                    type="button"
                    className={"icon-btn" + (speakingId === m.id ? " active" : "")}
                    aria-label={speakingId === m.id ? "Vorlesen stoppen" : "Vorlesen"}
                    title={speakingId === m.id ? "Vorlesen stoppen" : "Vorlesen"}
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
                    <span className="sources-label">Quelle:</span>
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
                <span className="dots">
                  <span /> <span /> <span />
                </span>
              </div>
            </li>
          )}
          {error && (
            <li className="bubble assistant error">
              <div className="bubble-body">{error}</div>
            </li>
          )}
        </ul>
        <div ref={scrollEnd} />
      </main>

      <form className="composer" onSubmit={submit}>
        <div className="composer-inner">
          <div className="input-wrap has-mic">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                recState === "recording"
                  ? "Sprich jetzt …"
                  : recState === "transcribing"
                    ? "Verstehe …"
                    : "Was möchtest du wissen?"
              }
              rows={1}
              maxLength={500}
              disabled={loading || recState !== "idle"}
              autoFocus
            />
            <button
              type="button"
              className={
                "icon-btn mic-inline" +
                (recState === "recording" ? " active" : "") +
                (recState === "transcribing" ? " busy" : "")
              }
              aria-label={
                recState === "recording" ? "Aufnahme stoppen" : "Per Mikrofon eingeben"
              }
              title={
                recState === "recording" ? "Aufnahme stoppen" : "Per Mikrofon eingeben"
              }
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
            Senden
          </button>
        </div>
      </form>

      <footer className="footer">
        Inhalte aus{" "}
        <a
          href="https://klexikon.zum.de/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Klexikon
        </a>{" "}
        und{" "}
        <a
          href="https://grundschulwiki.zum.de/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Grundschulwiki
        </a>
        , beide lizenziert unter{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
          target="_blank"
          rel="noopener noreferrer"
        >
          CC BY-SA
        </a>
        . Nichts an diesem Gespräch wird gespeichert.
      </footer>
    </>
  );
}
