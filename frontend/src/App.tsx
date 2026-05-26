import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

// Voice-Eingabe und Vorlesen wurden bewusst entfernt: die Browser-Speech-API
// (sowohl SpeechRecognition als auch SpeechSynthesis) ist auf macOS in beiden
// Browsern zu unzuverlässig (Mic-Indikator-Flackern, Anfangs-Clipping beim
// Vorlesen). Voice kommt in Phase 2 über Server-STT/TTS (Whisper/Gladia/
// Mistral Voice), wenn echte Kinder das nutzen sollen.

type Source = { title: string; url: string; imageUrl?: string };

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
  const scrollEnd = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function resetChat() {
    setMessages([]);
    setError(null);
    setQuestion("");
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
        body: JSON.stringify({ question: q, history }),
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
          <div className="input-wrap">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Was möchtest du wissen?"
              rows={1}
              maxLength={500}
              disabled={loading}
              autoFocus
            />
          </div>
          <button type="submit" className="send-btn" disabled={loading || !question.trim()}>
            Senden
          </button>
        </div>
      </form>

      <footer className="footer">
        Inhalte aus dem{" "}
        <a
          href="https://klexikon.zum.de/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Klexikon
        </a>
        , lizenziert unter{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
          target="_blank"
          rel="noopener noreferrer"
        >
          CC BY-SA 4.0
        </a>
        . Nichts an diesem Gespräch wird gespeichert.
      </footer>
    </>
  );
}
