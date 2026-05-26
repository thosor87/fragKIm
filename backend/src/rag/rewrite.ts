// Schreibt eine Folgefrage in eine eigenständige Suchanfrage um.
// "und davor?" + Verlauf "Wer ist Kanzler? / ... Friedrich Merz ..."
//   → "Wer war Bundeskanzler vor Friedrich Merz?"
//
// Ohne diesen Schritt scheitert Retrieval an Pronomen und Folgefragen.

import { config } from "../config.js";
import type { ChatTurn } from "./pipeline.js";

const REWRITE_PROMPT = `Du bist ein Hilfssystem für eine Wissens-Suchmaschine. Aufgabe: aus einem Gesprächsverlauf und der letzten Nutzerfrage eine EIGENSTÄNDIGE Suchanfrage formulieren, die ohne den Verlauf verstanden werden kann.

Regeln:
- Pronomen ("er", "sie", "es", "der", "das") und Bezüge ("davor", "danach", "dort", "und?") müssen aufgelöst werden.
- Wenn die Frage schon eigenständig ist, gib sie unverändert zurück.
- Antworte NUR mit der umgeschriebenen Frage, OHNE Anführungszeichen, OHNE Erklärung, OHNE Präfix.
- Bei sinnlosen oder leeren Eingaben gib die Original-Frage zurück.

Beispiel 1:
Verlauf: "Wer ist Kanzler?" → "Im Klexikon steht: ... Friedrich Merz ..."
Aktuelle Frage: "und davor?"
Umgeschriebene Frage: Wer war Bundeskanzler vor Friedrich Merz?

Beispiel 2:
Verlauf: "Was ist ein Gepard?" → "Im Klexikon steht: ... Gepard ist eine Großkatze ..."
Aktuelle Frage: "Wie schnell läuft er?"
Umgeschriebene Frage: Wie schnell läuft ein Gepard?

Beispiel 3:
Verlauf: (leer)
Aktuelle Frage: "Was ist ein Vulkan?"
Umgeschriebene Frage: Was ist ein Vulkan?`;

let mistralClient: import("@mistralai/mistralai").Mistral | null = null;

function buildRewritePrompt(question: string, history: ChatTurn[]): string {
  if (history.length === 0) return `Verlauf: (leer)\nAktuelle Frage: "${question}"\nUmgeschriebene Frage:`;
  const hist = history
    .slice(-4)
    .map((t) => `${t.role === "user" ? "Frage" : "Antwort"}: "${t.content.slice(0, 300)}"`)
    .join("\n");
  return `Verlauf:\n${hist}\nAktuelle Frage: "${question}"\nUmgeschriebene Frage:`;
}

export async function rewriteQuery(
  question: string,
  history: ChatTurn[],
): Promise<string> {
  // Ohne LLM-Provider, keine Umschreibung möglich
  if (config.llmProvider !== "mistral") return question;

  // Sehr kurze Eingaben (1-2 Wörter, kein Fragezeichen) als "Was ist X?"
  // expandieren. Sonst weiß das LLM bei "Gepard" nicht, was es antworten soll.
  const trimmed = question.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const looksLikeQuestion = /[?]/.test(trimmed);
  if (!looksLikeQuestion && wordCount <= 2 && history.length === 0) {
    return `Was ist ${trimmed}?`;
  }

  if (history.length === 0) return question;
  try {
    if (!mistralClient) {
      const { Mistral } = await import("@mistralai/mistralai");
      mistralClient = new Mistral({ apiKey: config.requireMistralKey() });
    }
    const res = await mistralClient.chat.complete({
      model: "mistral-small-latest",
      temperature: 0,
      maxTokens: 100,
      messages: [
        { role: "system", content: REWRITE_PROMPT },
        { role: "user", content: buildRewritePrompt(question, history) },
      ],
    });
    const content = res.choices?.[0]?.message?.content;
    if (typeof content !== "string") return question;
    const rewritten = content.trim().replace(/^["']|["']$/g, "");
    if (rewritten.length < 3 || rewritten.length > 300) return question;
    return rewritten;
  } catch {
    // Bei Fehler im Rewriter: lieber Original-Query als Pipeline crashen
    return question;
  }
}
