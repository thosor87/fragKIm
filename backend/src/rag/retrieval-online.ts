// Online-Retrieval direkt gegen die MediaWiki-API von klexikon.zum.de.
//
// Vorteil: Null Setup, keine Qdrant, kein Index.
// Nachteil: Keyword-Suche statt semantischer Suche, ~1-2s Latenz pro Frage,
// Last auf dem kleinen ZUM-Server.
//
// Liefert Hits in derselben Form wie das lokale Qdrant-Backend.

import type { Hit, KlexikonPayload } from "./qdrant.js";
import { config } from "../config.js";

const API = "https://klexikon.zum.de/api.php";
const UA = `fragKIm-PoC/0.1 (+Kontakt: ${config.crawlerContact})`;
const MAX_HITS = 3;
const TEXT_CHARS = 6000; // pro Treffer: 6 KB reichen für mittellange Klexikon-Artikel

// In-Memory-Cache, einfacher LRU-Ersatz: Title → { text, imageUrl? }
const cache = new Map<string, { text: string; imageUrl?: string }>();
const CACHE_MAX = 200;

function rememberCache(
  title: string,
  entry: { text: string; imageUrl?: string },
): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(title, entry);
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Klexikon API HTTP ${res.status}`);
  return (await res.json()) as T;
}

type SearchResp = {
  query?: { search?: { title: string; pageid: number; snippet?: string }[] };
};

type ParseResp = {
  parse?: { title: string; pageid: number; text?: string };
  error?: { code: string; info: string };
};

// Extrahiert die erste passende Thumbnail-URL aus dem Article-HTML.
// Klexikon-Artikel haben Bilder meist als <img class="thumbimage" src="...">
// in Wikimedia-Commons-Hosting. Wir nehmen die thumb-URL und upgraden auf
// eine etwas größere Variante.
function extractFirstImage(html: string): string | undefined {
  // Erste Variante: gezielt thumbimage-Klasse
  let m = html.match(
    /<img\b[^>]*\bclass="[^"]*\bthumbimage\b[^"]*"[^>]*\bsrc="([^"]+)"/i,
  );
  if (!m) {
    // Fallback: erstes Bild aus upload.wikimedia.org
    m = html.match(
      /<img\b[^>]*\bsrc="(https?:\/\/upload\.wikimedia\.org\/[^"]+)"/i,
    );
  }
  if (!m) return undefined;
  // Originale thumb-URL übernehmen. Hochskalieren ist heikel, weil
  // Wikimedia nur bestimmte Standardgrößen generiert; falsche px-Werte
  // geben HTTP 400.
  return m[1];
}

function htmlToText(html: string): string {
  let out = html;
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<table[\s\S]*?<\/table>/gi, "");
  out = out.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "");
  out = out.replace(/<span\s+class="mw-editsection"[\s\S]*?<\/span>/gi, "");
  out = out.replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n");
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<[^>]+>/g, "");
  out = out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  out = out
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return out;
}

function articleUrl(title: string): string {
  return `https://klexikon.zum.de/wiki/${encodeURIComponent(title.replace(/\s/g, "_"))}`;
}

async function fetchArticle(
  title: string,
): Promise<{ text: string; imageUrl?: string } | null> {
  const cached = cache.get(title);
  if (cached) return cached;
  const resp = await api<ParseResp>({
    action: "parse",
    page: title,
    prop: "text",
    redirects: "1",
    disableeditsection: "1",
    disabletoc: "1",
  });
  if (resp.error || !resp.parse?.text) return null;
  const imageUrl = extractFirstImage(resp.parse.text);
  const text = htmlToText(resp.parse.text).trim().slice(0, TEXT_CHARS);
  if (text.length < 80) return null;
  const entry = { text, imageUrl };
  rememberCache(title, entry);
  return entry;
}

// Deutsche Stopwörter + Frageeinleitungen. Reduziert Fragesätze auf die
// inhaltlichen Begriffe, damit MediaWiki-Volltextsuche brauchbar funktioniert.
const STOPWORDS = new Set([
  "wie", "was", "wer", "wo", "wann", "warum", "wieso", "weshalb", "welche",
  "welcher", "welches", "welchen",
  "ist", "sind", "war", "waren", "wird", "werden", "haben", "hat", "habe",
  "kann", "können", "könnt", "soll", "sollen", "muss", "müssen", "darf", "dürfen",
  "ein", "eine", "einen", "einer", "eines", "einem",
  "der", "die", "das", "den", "dem", "des",
  "und", "oder", "aber", "doch", "nicht", "kein", "keine", "keinen",
  "mit", "von", "vom", "zur", "zum", "zu", "in", "im", "an", "am", "auf",
  "für", "bei", "über", "unter", "nach", "vor", "durch", "gegen", "ohne",
  "es", "er", "sie", "wir", "ihr", "ich", "du", "mich", "dich", "uns", "euch",
  "mein", "dein", "sein", "ihr", "unser",
  "auch", "schon", "noch", "mehr", "sehr", "viel", "viele",
  "denn", "weil", "wenn", "dass",
  "laufen", "läuft", "macht", "geht",
]);

function reduceQuery(q: string): string {
  const tokens = q
    .toLowerCase()
    .replace(/[?!.,;:()"„""'']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return tokens.join(" ").trim();
}

type SearchItem = { title: string; pageid: number; snippet?: string };

async function rawSearch(srsearch: string): Promise<SearchItem[]> {
  const r = await api<SearchResp>({
    action: "query",
    list: "search",
    srsearch,
    srnamespace: "0",
    srlimit: String(MAX_HITS),
  });
  return r.query?.search ?? [];
}

function uniqByTitle(arr: SearchItem[]): SearchItem[] {
  const seen = new Set<string>();
  const out: SearchItem[] = [];
  for (const item of arr) {
    if (seen.has(item.title)) continue;
    seen.add(item.title);
    out.push(item);
  }
  return out;
}

export async function searchOnline(query: string): Promise<Hit[]> {
  // ZUM-Wiki MediaWiki-Search ist AND-of-tokens ohne Stemming.
  // Mehrwort-Queries scheitern fast immer. Eskalation in drei Stufen:
  let items = await rawSearch(query);
  if (items.length === 0) {
    const reduced = reduceQuery(query);
    if (reduced && reduced !== query.toLowerCase()) {
      items = await rawSearch(reduced);
    }
    // 3. Stufe: jedes Inhaltswort einzeln, dann mergen
    if (items.length === 0 && reduced) {
      const words = reduced
        .split(/\s+/)
        .filter((w) => w.length > 2)
        // Längste Wörter zuerst — vermutlich das Hauptsubjekt
        .sort((a, b) => b.length - a.length)
        .slice(0, 4);
      const perWord = await Promise.all(words.map((w) => rawSearch(w)));
      items = uniqByTitle(perWord.flat()).slice(0, MAX_HITS);
    }
  }
  if (items.length === 0) return [];

  // Texte parallel holen, jeweils mit Timeout
  const settled = await Promise.allSettled(
    items.map(async (it, i) => {
      const article = await fetchArticle(it.title);
      if (!article) return null;
      // MediaWiki sortiert nach Relevanz; wir simulieren Scores leicht abfallend
      const score = 1 - i * 0.1;
      const payload: KlexikonPayload = {
        title: it.title,
        url: articleUrl(it.title),
        chunkIndex: 0,
        text: article.text,
        imageUrl: article.imageUrl,
      };
      return { score, payload } satisfies Hit;
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<Hit | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((h): h is Hit => h !== null);
}
