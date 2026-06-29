// Online-Retrieval direkt gegen MediaWiki-APIs der ZUM-Wikis.
//
// Unterstützte Quellen:
//   - Klexikon          (klexikon.zum.de)         für Kinder ab ca. 8 Jahren
//   - Grundschulwiki    (grundschulwiki.zum.de)   für Grundschule (Klasse 1-4)
//
// Beide Wikis nutzen die gleiche MediaWiki-Struktur, deshalb kann eine
// einzige Such-Logik beide bedienen. Bei "beide" werden parallel angefragt
// und die Treffer gemerged.

import type { Hit, KlexikonPayload, WikiSourceId } from "./qdrant.js";
import { config } from "../config.js";
import { isSafeArticleImage } from "./image-safety.js";
import {
  archiveEnabled,
  searchGrundschulwikiArchive,
} from "./retrieval-archive.js";

type WikiSource = {
  id: WikiSourceId;
  label: string;
  apiUrl: string;
  articleBase: string;
};

const SOURCES: Record<WikiSourceId, WikiSource> = {
  klexikon: {
    id: "klexikon",
    label: "Klexikon",
    apiUrl: "https://klexikon.zum.de/api.php",
    articleBase: "https://klexikon.zum.de/wiki/",
  },
  grundschulwiki: {
    id: "grundschulwiki",
    label: "Grundschulwiki",
    apiUrl: "https://grundschulwiki.zum.de/api.php",
    articleBase: "https://grundschulwiki.zum.de/wiki/",
  },
};

const UA = `fragKIm-PoC/0.1 (+Kontakt: ${config.crawlerContact})`;
const MAX_HITS_PER_SOURCE = 3;
const TEXT_CHARS = 6000;

// Cache: source|title → entry
const cache = new Map<string, { text: string; imageUrl?: string }>();
const CACHE_MAX = 400;

function cacheKey(source: WikiSourceId, title: string): string {
  return `${source}|${title}`;
}

function rememberCache(
  source: WikiSourceId,
  title: string,
  entry: { text: string; imageUrl?: string },
): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(cacheKey(source, title), entry);
}

async function api<T>(
  source: WikiSource,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(source.apiUrl);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${source.label} API HTTP ${res.status}`);
  return (await res.json()) as T;
}

type SearchItem = { title: string; pageid: number; snippet?: string };

type SearchResp = {
  query?: { search?: SearchItem[] };
};

// MediaWiki v1 liefert text als { "*": "..." }, v2 als string.
type ParseTextV1 = { "*": string };
type ParseResp = {
  parse?: {
    title: string;
    pageid?: number;
    text?: string | ParseTextV1;
  };
  error?: { code: string; info: string };
};

function parseHtml(text: string | ParseTextV1 | undefined): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return text["*"] ?? "";
}

function extractFirstImage(html: string, baseOrigin: string): string | undefined {
  // Verschiedene MediaWiki-Versionen liefern unterschiedliche Klassen.
  // Wir versuchen drei Varianten und nehmen die erste, die matched.
  let m = html.match(
    /<img\b[^>]*\bclass="[^"]*\bthumbimage\b[^"]*"[^>]*\bsrc="([^"]+)"/i,
  );
  if (!m) {
    m = html.match(
      /<img\b[^>]*\bsrc="(https?:\/\/upload\.wikimedia\.org\/[^"]+)"/i,
    );
  }
  if (!m) {
    // Generisches erstes <img> mit src, auch relative URLs (Grundschulwiki)
    m = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i);
  }
  if (!m) return undefined;
  let url = m[1];
  if (url.startsWith("//")) url = "https:" + url;
  else if (url.startsWith("/")) url = baseOrigin + url;
  // Kinderschutz: Dokument-Scans/Fahndungsplakate u.ä. nie als Bild anhängen.
  if (!isSafeArticleImage(url)) return undefined;
  return url;
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

function articleUrl(source: WikiSource, title: string): string {
  return source.articleBase + encodeURIComponent(title.replace(/\s/g, "_"));
}

async function fetchArticle(
  source: WikiSource,
  title: string,
): Promise<{ text: string; imageUrl?: string } | null> {
  const cached = cache.get(cacheKey(source.id, title));
  if (cached) return cached;
  const resp = await api<ParseResp>(source, {
    action: "parse",
    page: title,
    prop: "text",
    redirects: "1",
    disableeditsection: "1",
    disabletoc: "1",
  });
  if (resp.error) return null;
  const html = parseHtml(resp.parse?.text);
  if (!html) return null;
  const baseOrigin = new URL(source.articleBase).origin;
  const imageUrl = extractFirstImage(html, baseOrigin);
  const text = htmlToText(html).trim().slice(0, TEXT_CHARS);
  if (text.length < 80) return null;
  const entry = { text, imageUrl };
  rememberCache(source.id, title, entry);
  return entry;
}

// Deutsche Stopwörter und Frageeinleitungen.
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

async function rawSearch(
  source: WikiSource,
  srsearch: string,
): Promise<SearchItem[]> {
  const r = await api<SearchResp>(source, {
    action: "query",
    list: "search",
    srsearch,
    srnamespace: "0",
    srlimit: String(MAX_HITS_PER_SOURCE),
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

async function searchOneSource(
  source: WikiSource,
  query: string,
): Promise<Hit[]> {
  let items = await rawSearch(source, query);
  if (items.length === 0) {
    const reduced = reduceQuery(query);
    if (reduced && reduced !== query.toLowerCase()) {
      items = await rawSearch(source, reduced);
    }
    if (items.length === 0 && reduced) {
      const words = reduced
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .sort((a, b) => b.length - a.length)
        .slice(0, 4);
      const perWord = await Promise.all(
        words.map((w) => rawSearch(source, w)),
      );
      items = uniqByTitle(perWord.flat()).slice(0, MAX_HITS_PER_SOURCE);
    }
  }
  if (items.length === 0) return [];

  const settled = await Promise.allSettled(
    items.map(async (it, i) => {
      const article = await fetchArticle(source, it.title);
      if (!article) return null;
      const score = 1 - i * 0.1;
      const payload: KlexikonPayload = {
        title: it.title,
        url: articleUrl(source, it.title),
        chunkIndex: 0,
        text: article.text,
        imageUrl: article.imageUrl,
        source: source.id,
      };
      return { score, payload } satisfies Hit;
    }),
  );
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<Hit | null> => r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((h): h is Hit => h !== null);
}

async function searchOneSourceOrArchive(
  id: WikiSourceId,
  query: string,
): Promise<Hit[]> {
  // Grundschulwiki: wenn Archive konfiguriert ist, lokales Archiv verwenden,
  // sonst die (bald abgeschaltete) Live-API.
  if (id === "grundschulwiki" && archiveEnabled()) {
    return searchGrundschulwikiArchive(query);
  }
  return searchOneSource(SOURCES[id], query);
}

export async function searchOnline(
  query: string,
  sourceIds: WikiSourceId[] = ["klexikon", "grundschulwiki"],
): Promise<Hit[]> {
  if (sourceIds.length === 0) return [];
  const results = await Promise.all(
    sourceIds.map((id) => searchOneSourceOrArchive(id, query)),
  );
  // Hits ineinanderfächern: erst Klexikon-Top, dann Grundschulwiki-Top usw.,
  // bis MAX erreicht.
  const merged: Hit[] = [];
  const max = Math.max(...results.map((r) => r.length));
  for (let i = 0; i < max && merged.length < 5; i++) {
    for (const list of results) {
      if (list[i]) merged.push(list[i]);
      if (merged.length >= 5) break;
    }
  }
  return merged;
}
