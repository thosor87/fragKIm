// Output-Moderation (Stufe 2) mit der Mistral Moderation API (EU).
//
// Greift NUR auf Allgemeinwissen-Antworten (ohne Quellbeleg), weil die aus
// dem generellen Modellwissen kommen und damit das höchste Halluzinations-/
// Themenrisiko tragen. Geprüfte Klexikon/Grundschulwiki-Auszüge laufen NICHT
// hier durch — die sind bereits eine vertrauenswürdige Quelle.
//
// Verhalten bei Treffer: Antwort verwerfen + feste Meldung. Je nach Kategorie
// entweder Eskalation (Nummer gegen Kummer) oder neutrales Abblocken.
//
// Fail-open: Wenn die Moderation-API nicht erreichbar ist, wird die Antwort
// durchgelassen. Die Input-Filter (triggers.ts) und der harte System-Prompt
// bleiben als erste Verteidigungslinie bestehen; ein Ausfall der zweiten Stufe
// soll nicht jede harmlose Wissensantwort blockieren.

import { config } from "../config.js";

export type ModerationVerdict =
  | { action: "allow" }
  | { action: "escalate"; category: string }
  | { action: "block"; category: string };

// Kategorien, die bei einem Kind auf eine Notlage hindeuten → Eskalation
// (gleiche Reaktion wie der Input-Filter: Hinweis auf Hilfe-Angebote).
const ESCALATE_CATEGORIES = new Set(["selfharm"]);

// Kategorien, die für ein Kind schlicht unpassend sind → neutral abblocken.
const BLOCK_CATEGORIES = new Set([
  "sexual",
  "violence_and_threats",
  "dangerous_and_criminal_content",
  "hate_and_discrimination",
]);

// Feste Meldung, wenn eine Antwort als unpassend verworfen wird (kein
// Schaden-Vorwurf ans Kind — die Frage selbst war ja durch die Input-Filter
// gekommen, hier hakt erst die generierte Antwort).
export const MODERATION_BLOCK_RESPONSE = {
  text:
    "Diese Frage kann hier gerade nicht kindgerecht beantwortet werden. " +
    "Frag am besten eine erwachsene Person, der du vertraust, oder stell " +
    "eine andere Sachfrage.",
};

let mistralClient: import("@mistralai/mistralai").Mistral | null = null;

type ModerationResult = {
  categories?: Record<string, boolean>;
};

// Verdict aus den Booleans ableiten. Eskalation hat Vorrang vor Block, damit
// eine Selbstverletzungs-Andeutung immer zur Hilfe-Meldung führt.
// Exportiert für Unit-Tests (der API-Call selbst ist nicht deterministisch).
export function classify(categories: Record<string, boolean>): ModerationVerdict {
  for (const [cat, flagged] of Object.entries(categories)) {
    if (flagged && ESCALATE_CATEGORIES.has(cat)) {
      return { action: "escalate", category: cat };
    }
  }
  for (const [cat, flagged] of Object.entries(categories)) {
    if (flagged && BLOCK_CATEGORIES.has(cat)) {
      return { action: "block", category: cat };
    }
  }
  return { action: "allow" };
}

export async function moderateOutput(text: string): Promise<ModerationVerdict> {
  // Nur mit echtem Mistral-Provider sinnvoll; im Stub-/Ollama-Modus überspringen.
  if (config.llmProvider !== "mistral") return { action: "allow" };
  if (!text.trim()) return { action: "allow" };

  try {
    if (!mistralClient) {
      const { Mistral } = await import("@mistralai/mistralai");
      mistralClient = new Mistral({ apiKey: config.requireMistralKey() });
    }
    const res = await mistralClient.classifiers.moderate({
      model: "mistral-moderation-latest",
      inputs: [text],
    });
    const results = (res as { results?: ModerationResult[] }).results ?? [];
    const categories = results[0]?.categories;
    if (!categories) return { action: "allow" };
    return classify(categories);
  } catch (err) {
    // Fail-open: Wissensantwort lieber durchlassen als bei API-Ausfall alles
    // blocken. Input-Filter + System-Prompt schützen weiterhin.
    console.warn("[moderation] Mistral Moderation nicht erreichbar, lasse Antwort durch:", err);
    return { action: "allow" };
  }
}
