// Moderation mit der Mistral Moderation API (EU). Zwei Einsatzorte:
//
//  1) INPUT (moderateInput): die Frage des Kindes, BEVOR das LLM antwortet.
//     Sprach-agnostisch — fängt eine Krise ("ich will nicht mehr leben") auch
//     auf Türkisch/Arabisch/… , wo die deutschen Wortlisten in triggers.ts
//     blind sind. Das ist die eigentliche mehrsprachige Sicherheitslücke.
//
//  2) OUTPUT (moderateOutput): die generierte Allgemeinwissen-Antwort (ohne
//     Quellbeleg), weil die aus dem Modellwissen kommt. Geprüfte Klexikon-/
//     Grundschulwiki-Antworten laufen NICHT durch (vertrauenswürdige Quelle).
//
// Fail-open: Bei API-Ausfall wird durchgelassen. Die deutschen Wortlisten und
// der harte System-Prompt bleiben als erste Verteidigung bestehen; ein Ausfall
// der Moderation soll nicht jede harmlose Frage blockieren.

import { config } from "../config.js";

export type ModerationVerdict =
  | { action: "allow" }
  | { action: "escalate"; category: string }
  | { action: "block"; category: string };

// Kategorie, die auf eine Notlage des Kindes hindeutet → Eskalation
// (Hinweis auf Hilfe-Angebote, Nummer gegen Kummer).
const SELFHARM = "selfharm";

// Kategorien, die für ein Kind unpassend sind → neutral abblocken.
const BLOCK_CATEGORIES = [
  "sexual",
  "violence_and_threats",
  "dangerous_and_criminal_content",
  "hate_and_discrimination",
];

// Beim INPUT blocken wir die Nicht-Krisen-Kategorien nur bei hoher Konfidenz.
// Grund: Sachfragen aus einem Kinderlexikon streifen diese Themen ständig
// ("Wie jagt ein Löwe?", "Wie ist Hitler gestorben?", "Was ist Krieg?").
const INPUT_BLOCK_THRESHOLD = 0.85;

// selfharm wird NICHT nur am Boolean-Flag erkannt: Mistral setzt das Flag bei
// manchen (v.a. nicht-deutschen) Formulierungen nicht, obwohl der Score hoch
// ist — z.B. "Artık yaşamak istemiyorum" (tr) → Score 0.80, Flag false. Eine
// Krise zu verpassen ist katastrophal, ein Hilfe-Hinweis bei einer Grenzfrage
// verschmerzbar. Darum eskalieren wir hier schon ab einem deutlich niedrigeren
// Score. Reine Sachfragen liegen klar darunter (Vulkan/Gepard ~0, "Was ist
// Suizid?" ~0.19).
const SELFHARM_SCORE_THRESHOLD = 0.5;

function isSelfharm(
  categories: Record<string, boolean>,
  scores: Record<string, number>,
): boolean {
  return !!categories[SELFHARM] || (scores[SELFHARM] ?? 0) >= SELFHARM_SCORE_THRESHOLD;
}

let mistralClient: import("@mistralai/mistralai").Mistral | null = null;

type ModerationResult = {
  categories?: Record<string, boolean>;
  categoryScores?: Record<string, number>;
};

// --- Verdict-Logik (deterministisch, unit-getestet) ------------------------

// OUTPUT: an der generierten Antwort vertrauen wir bei den Block-Kategorien
// den Boolean-Flags; selfharm zusätzlich über den Score (s.o.).
export function classifyOutput(
  categories: Record<string, boolean>,
  scores: Record<string, number> = {},
): ModerationVerdict {
  if (isSelfharm(categories, scores)) return { action: "escalate", category: SELFHARM };
  for (const cat of BLOCK_CATEGORIES) {
    if (categories[cat]) return { action: "block", category: cat };
  }
  return { action: "allow" };
}

// INPUT: selfharm über Flag ODER Score (kritisch, sprach-agnostisch), übrige
// Kategorien nur bei hoher Konfidenz, damit legitime Sachfragen nicht
// fälschlich geblockt werden.
export function classifyInput(
  categories: Record<string, boolean>,
  scores: Record<string, number> = {},
): ModerationVerdict {
  if (isSelfharm(categories, scores)) return { action: "escalate", category: SELFHARM };
  for (const cat of BLOCK_CATEGORIES) {
    if (categories[cat] && (scores[cat] ?? 1) >= INPUT_BLOCK_THRESHOLD) {
      return { action: "block", category: cat };
    }
  }
  return { action: "allow" };
}

// Rückwärtskompatibler Alias (frühere Tests/Imports).
export const classify = classifyOutput;

// --- API-Aufruf ------------------------------------------------------------

async function runModeration(text: string): Promise<ModerationResult | null> {
  if (config.llmProvider !== "mistral") return null;
  if (!text.trim()) return null;
  if (!mistralClient) {
    const { Mistral } = await import("@mistralai/mistralai");
    mistralClient = new Mistral({ apiKey: config.requireMistralKey() });
  }
  const res = await mistralClient.classifiers.moderate({
    model: "mistral-moderation-latest",
    inputs: [text],
  });
  const results = (res as { results?: ModerationResult[] }).results ?? [];
  return results[0] ?? null;
}

export async function moderateInput(text: string): Promise<ModerationVerdict> {
  try {
    const r = await runModeration(text);
    if (!r?.categories) return { action: "allow" };
    return classifyInput(r.categories, r.categoryScores ?? {});
  } catch (err) {
    console.warn("[moderation] Input-Moderation nicht erreichbar, lasse Frage durch:", err);
    return { action: "allow" };
  }
}

export async function moderateOutput(text: string): Promise<ModerationVerdict> {
  try {
    const r = await runModeration(text);
    if (!r?.categories) return { action: "allow" };
    return classifyOutput(r.categories, r.categoryScores ?? {});
  } catch (err) {
    console.warn("[moderation] Output-Moderation nicht erreichbar, lasse Antwort durch:", err);
    return { action: "allow" };
  }
}
