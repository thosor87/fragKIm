// Faktenprüfer: nach dem Antwort-Call wird ein zweiter LLM-Call gestartet,
// der die vorgeschlagene Antwort gegen die Auszüge prüft. Liefert er kein
// klares "OK", wird die Antwort verworfen und durch "Weiß ich nicht" ersetzt.

import { config } from "../config.js";
import type { Hit } from "./qdrant.js";

const JUDGE_PROMPT = `Du bist ein strenger Faktenprüfer.

Aufgabe: Prüfe, ob JEDE Tatsachenbehauptung in einer vorgeschlagenen Kinder-Antwort durch die mitgelieferten Klexikon-Auszüge gedeckt ist. Tatsachenbehauptungen sind Namen, Daten, Jahreszahlen, Zahlen, Orte, Ereignisse, Eigenschaften.

Regeln:
- Wörtliche oder klar sinngemäße Übereinstimmung mit den Auszügen ist OK.
- Wenn ein Name, eine Zahl, ein Datum oder eine Jahreszahl in der Antwort NICHT in den Auszügen vorkommt: NICHT_OK.
- Allgemeine Sprachelemente, Verbindungswörter und kindgerechte Umformulierungen sind erlaubt.
- Antworte EXAKT mit einem dieser zwei Wörter: "OK" oder "NICHT_OK".
- Im Zweifelsfall: NICHT_OK.`;

let mistralClient: import("@mistralai/mistralai").Mistral | null = null;

export async function judge(
  answer: string,
  hits: Hit[],
): Promise<{ ok: boolean }> {
  if (config.llmProvider !== "mistral") return { ok: true };
  if (!answer || hits.length === 0) return { ok: true };

  if (!mistralClient) {
    const { Mistral } = await import("@mistralai/mistralai");
    mistralClient = new Mistral({ apiKey: config.requireMistralKey() });
  }

  const excerpts = hits
    .map((h, i) => `[Auszug ${i + 1}] ${h.payload.title}\n${h.payload.text}`)
    .join("\n\n");
  const userPrompt = `Auszüge:\n${excerpts}\n\nVorgeschlagene Antwort an das Kind:\n"${answer}"\n\nIst jede Tatsachenbehauptung durch die Auszüge gedeckt? Antworte exakt OK oder NICHT_OK.`;

  try {
    const res = await mistralClient.chat.complete({
      model: "mistral-small-latest",
      temperature: 0,
      maxTokens: 20,
      messages: [
        { role: "system", content: JUDGE_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const content = res.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false };
    const verdict = content.trim().toUpperCase();
    // Strikt: nur exakt "OK" als Pass
    return { ok: verdict.startsWith("OK") && !verdict.startsWith("OKNICHT") };
  } catch {
    // Bei Fehler im Judge: konservativ als nicht-gedeckt behandeln
    return { ok: false };
  }
}
