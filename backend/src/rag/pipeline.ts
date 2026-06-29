import { config } from "../config.js";
import { embed } from "./embeddings.js";
import { searchChunks, type Hit } from "./qdrant.js";
import { searchOnline } from "./retrieval-online.js";
import { filterRelevantHits } from "./relevance.js";
import type { WikiSourceId } from "./qdrant.js";

export type SourceFlags = {
  klexikon: boolean;
  grundschulwiki: boolean;
  allgemeinwissen: boolean;
};

export const DEFAULT_SOURCES: SourceFlags = {
  klexikon: true,
  grundschulwiki: true,
  allgemeinwissen: true,
};
import {
  isSensitive,
  isCompanionRequest,
  isGreetingOnly,
  isHarmRequest,
} from "../triggers.js";
import {
  escalationResponse,
  harmResponse,
  offtopicResponse,
  greetingResponse,
  noAnswerText,
  moderationBlockResponse,
} from "../responses.js";
import { generate } from "./generator.js";
import { rewriteQuery } from "./rewrite.js";
import { moderateInput, moderateOutput } from "./moderation.js";

export type Source = {
  title: string;
  url: string;
  imageUrl?: string;
  wiki?: WikiSourceId; // "klexikon" | "grundschulwiki"
};
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AskResult = {
  text: string;
  sources: Source[];
  escalated: boolean;
  noAnswer: boolean;
  refused: boolean;
};

function dedupeSources(hits: Hit[]): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const h of hits) {
    if (seen.has(h.payload.url)) continue;
    seen.add(h.payload.url);
    sources.push({
      title: h.payload.title,
      url: h.payload.url,
      imageUrl: h.payload.imageUrl,
      wiki: h.payload.source,
    });
  }
  return sources;
}

const MIN_LOCAL_SCORE = 0.55;
const MIN_ONLINE_SCORE = 0.6; // erste 3 MediaWiki-Hits sind so gut wie immer relevant

async function retrieve(
  question: string,
  sources: SourceFlags,
): Promise<Hit[]> {
  const wikiIds: WikiSourceId[] = [];
  if (sources.klexikon) wikiIds.push("klexikon");
  if (sources.grundschulwiki) wikiIds.push("grundschulwiki");
  if (wikiIds.length === 0) return [];

  if (config.retrievalProvider === "online") {
    return searchOnline(question, wikiIds);
  }
  const vec = await embed("query", question);
  return searchChunks(vec, 5);
}


export async function ask(
  question: string,
  history: ChatTurn[] = [],
  sources: SourceFlags = DEFAULT_SOURCES,
  lang: string = "de",
): Promise<AskResult> {
  const q = question.trim();
  if (!q) {
    return {
      text: greetingResponse(lang).text,
      sources: [],
      escalated: false,
      noAnswer: false,
      refused: true,
    };
  }

  if (isSensitive(q)) {
    const esc = escalationResponse(lang);
    return {
      text: esc.text,
      sources: esc.sources,
      escalated: true,
      noAnswer: false,
      refused: false,
    };
  }

  if (isHarmRequest(q)) {
    return {
      text: harmResponse(lang).text,
      sources: [],
      escalated: false,
      noAnswer: false,
      refused: true,
    };
  }

  if (isGreetingOnly(q)) {
    return {
      text: greetingResponse(lang).text,
      sources: [],
      escalated: false,
      noAnswer: false,
      refused: true,
    };
  }

  if (isCompanionRequest(q)) {
    return {
      text: offtopicResponse(lang).text,
      sources: [],
      escalated: false,
      noAnswer: false,
      refused: true,
    };
  }

  // Mehrsprachiges Sicherheitsnetz: die deutschen Wortlisten oben sind blind
  // für andere Sprachen. Die Mistral-Moderation prüft die Frage sprach-
  // agnostisch, BEVOR das LLM sie sieht — eine Krise ("ich will nicht mehr
  // leben") wird so auch auf Türkisch/Arabisch/… erkannt.
  const inputVerdict = await moderateInput(q);
  if (inputVerdict.action === "escalate") {
    const esc = escalationResponse(lang);
    return {
      text: esc.text,
      sources: esc.sources,
      escalated: true,
      noAnswer: false,
      refused: false,
    };
  }
  if (inputVerdict.action === "block") {
    return {
      text: moderationBlockResponse(lang).text,
      sources: [],
      escalated: false,
      noAnswer: false,
      refused: true,
    };
  }

  // 1. Folgefrage in eigenständige Frage umschreiben (nur mit LLM-Provider)
  const retrievalQuery = await rewriteQuery(q, history);
  // Re-Check der Harm-Filter, weil "auch das von Karl?" erst nach Rewrite zu
  // "wie mache ich das Boot von Karl kaputt?" wird.
  if (isHarmRequest(retrievalQuery)) {
    return {
      text: harmResponse(lang).text,
      sources: [],
      escalated: false,
      noAnswer: false,
      refused: true,
    };
  }
  // 2. Retrieval mit der eigenständigen Frage (nur in aktivierten Wikis)
  const retrieved = await retrieve(retrievalQuery, sources);
  // 2b. Relevanz-Gate: thematisch fremde Auszüge (z.B. "Steckbrief"=Fahndung
  // bei einer Tierfrage) raus, BEVOR sie Quelle/Bild/Generierung beeinflussen.
  const hits = await filterRelevantHits(retrievalQuery, retrieved);
  const minScore = config.retrievalProvider === "online" ? MIN_ONLINE_SCORE : MIN_LOCAL_SCORE;
  const strong = hits.filter((h) => h.score >= minScore);

  // Mit LLM-Provider: auch bei 0 Treffern weiter, das LLM entscheidet
  // selbst, ob es aus Allgemeinwissen antworten kann (Weg 2). Im Stub-Modus
  // braucht es Treffer, sonst gibt's keine Quelle zum Auszug-Zitieren.
  if (strong.length === 0 && config.llmProvider === "stub") {
    return {
      text: noAnswerText(lang),
      sources: [],
      escalated: false,
      noAnswer: true,
      refused: false,
    };
  }

  // 3. Antwort generieren mit der eigenständigen Frage (rewritten), damit
  // Pronomen wie "darin" / "er" auch im Generator aufgelöst sind. Verlauf
  // bleibt für stilistischen Kontext. Faktenchecker bleibt deaktiviert
  // (Weg 2 erlaubt Allgemeinwissen-Fallback, sofern aktiv).
  const out = await generate(
    retrievalQuery,
    strong,
    history,
    sources.allgemeinwissen,
    lang,
  );
  // Wenn das LLM "HARM" zurückgibt, übernehmen wir die feste Harm-Antwort,
  // damit das Modell keinen eigenen Refusal-Text produziert.
  if (out.text === "HARM") {
    return {
      text: harmResponse(lang).text,
      sources: [],
      escalated: false,
      noAnswer: false,
      refused: true,
    };
  }
  if (out.noAnswer) {
    return {
      text: noAnswerText(lang),
      sources: [],
      escalated: false,
      noAnswer: true,
      refused: false,
    };
  }

  // Fail-Safe: URLs aus dem Antworttext streifen, Quellen kommen in eigenem
  // UI-Bereich. Erlaubt http-Hashtags oder Wort-Schrägstriche bewusst nicht.
  const cleaned = out.text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/\n\s*\n\s*$/g, "")
    .trim();

  // Output-Moderation (Stufe 2): reine Allgemeinwissen-Antworten UND der
  // Allgemeinwissen-Ergänzungsteil einer Kombi-Antwort werden geprüft, weil
  // sie ohne Quellbeleg aus dem Modellwissen stammen. Reine Klexikon-/
  // Grundschulwiki-Antworten überspringen wir (vertrauenswürdige Quelle).
  if (out.fromGeneralKnowledge || out.hasSupplement) {
    const verdict = await moderateOutput(cleaned);
    if (verdict.action === "escalate") {
      const esc = escalationResponse(lang);
      return {
        text: esc.text,
        sources: esc.sources,
        escalated: true,
        noAnswer: false,
        refused: false,
      };
    }
    if (verdict.action === "block") {
      return {
        text: moderationBlockResponse(lang).text,
        sources: [],
        escalated: false,
        noAnswer: false,
        refused: true,
      };
    }
  }

  // Quellen werden gezeigt, wenn die Antwort NICHT aus Allgemeinwissen kommt
  // (Flag aus dem Generator, sprachunabhängig) UND Auszüge da waren.
  const showSources = !out.fromGeneralKnowledge && strong.length > 0;
  return {
    text: cleaned,
    sources: showSources ? dedupeSources(strong) : [],
    escalated: false,
    noAnswer: false,
    refused: false,
  };
}
