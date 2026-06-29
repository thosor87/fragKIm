// Relevanz-Gate über die retrievten Auszüge.
//
// Problem: Bei mehrwörtigen Fragen ohne Phrasen-Treffer zerlegt das Online-
// Retrieval die Frage in Einzelwörter und merged deren Treffer. Dabei rutschen
// thematisch falsche Artikel herein — z.B. liefert "Steckbrief Tiger" neben
// "Tiger" auch den Klexikon-Artikel "Steckbrief" (Polizei-Fahndung), und
// "Josef und seine Brüder" zieht "Josef Stalin" o.ä. an sich. Diese fremden
// Auszüge tauchen dann als Quelle UND als (irreführendes) Bild auf.
//
// Dieser Gate fragt das EU-Modell (Mistral), welche Auszüge wirklich zur Frage
// gehören, und verwirft den Rest VOR Generierung, Quellen- und Bildauswahl.
// Bleibt nichts übrig, greift weiter oben sauber das "Weiß ich nicht".
//
// Im Sinne der Architektur-Leitplanke "Quelle vor Generierung": lieber eine
// ehrliche Lücke als eine Antwort mit thematisch fremder Quelle/Bild.

import { config } from "../config.js";
import type { Hit } from "./qdrant.js";

const RELEVANCE_PROMPT = `Du prüfst für eine Kinder-Wissenssuche, welche Wiki-Auszüge thematisch zur Frage des Kindes passen.

Ein Auszug passt nur, wenn er dasselbe Thema behandelt wie die Frage. Beispiele für NICHT passend:
- Frage nach einem Tier, Auszug handelt von einem gleichlautenden Begriff in anderem Sinn (z.B. "Steckbrief" als Polizei-Fahndung statt Tier-Steckbrief).
- Frage nach einer Person/Geschichte, Auszug handelt von einer nur zufällig namensgleichen anderen Person.

Antworte NUR mit den Nummern der passenden Auszüge, kommagetrennt (z.B. "1, 3").
Passt KEIN Auszug, antworte exakt mit "KEINE".`;

let mistralClient: import("@mistralai/mistralai").Mistral | null = null;

// Wertet die Modellantwort aus. Rückgabe:
//   number[]  -> 0-basierte Indizes der passenden Auszüge (auch [] = keiner)
//   null      -> Antwort unbrauchbar; Aufrufer behält alle Hits (fail-open)
export function parseRelevantIndices(
  content: string,
  count: number,
): number[] | null {
  const text = content.trim();
  if (!text) return null;
  const numbers = text.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    const idx = numbers
      .map((n) => parseInt(n, 10) - 1)
      .filter((i) => i >= 0 && i < count);
    return Array.from(new Set(idx)).sort((a, b) => a - b);
  }
  // Keine Zahlen: explizites "keine" heißt "nichts passt", alles andere ist
  // unbrauchbar und wird fail-open behandelt.
  if (/\bkeine?\b/i.test(text)) return [];
  return null;
}

export async function filterRelevantHits(
  question: string,
  hits: Hit[],
): Promise<Hit[]> {
  // Ohne Mistral (Stub/Tests) oder bei <2 Hits gibt es nichts sinnvoll zu
  // filtern — unverändert durchreichen.
  if (config.llmProvider !== "mistral") return hits;
  if (hits.length < 2) return hits;

  if (!mistralClient) {
    const { Mistral } = await import("@mistralai/mistralai");
    mistralClient = new Mistral({ apiKey: config.requireMistralKey() });
  }

  const excerpts = hits
    .map((h, i) => `[Auszug ${i + 1}] ${h.payload.title}\n${h.payload.text.slice(0, 500)}`)
    .join("\n\n");
  const userPrompt = `Frage des Kindes: "${question}"\n\nAuszüge:\n${excerpts}\n\nWelche Auszüge passen thematisch zur Frage? Nummern kommagetrennt oder "KEINE".`;

  try {
    const res = await mistralClient.chat.complete({
      model: "mistral-small-latest",
      temperature: 0,
      maxTokens: 20,
      messages: [
        { role: "system", content: RELEVANCE_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const content = res.choices?.[0]?.message?.content;
    if (typeof content !== "string") return hits;
    const indices = parseRelevantIndices(content, hits.length);
    if (indices === null) return hits; // unbrauchbar -> fail-open
    return indices.map((i) => hits[i]);
  } catch {
    // Bei Fehler im Gate nicht das Produkt lahmlegen: alle Hits behalten.
    // Die Bild-Sicherheit (image-safety) greift unabhängig davon weiter.
    return hits;
  }
}
