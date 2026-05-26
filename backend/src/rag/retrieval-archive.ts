// Liest Grundschulwiki-Artikel aus dem statischen Archive-Repo
// (github.com/thosor87/grundschulwiki-archiv) via raw.githubusercontent.com.
//
// Beim ersten Aufruf: manifest.json fetchen, Titel-Index im Speicher halten.
// Pro Query: Titel-Suche im Index, Top-Treffer per Lazy-Fetch laden, im
// LRU-Cache halten. Damit funktioniert die Quelle auch nach der ZUM-Abschaltung.

import { config } from "../config.js";
import type { Hit, KlexikonPayload } from "./qdrant.js";
import { wikitextToText, extractFirstImageName } from "./wikitext.js";

type ManifestEntry = {
  title: string;
  ns: number;
  pageid: number;
  revisions: number;
};

type Manifest = {
  source: string;
  pages: ManifestEntry[];
};

type ArticleJson = {
  title: string;
  ns: number;
  pageid: number;
  categories: string[];
  revisions: { wikitext: string; timestamp?: string; user?: string }[];
};

const NS_FOLDER: Record<number, string> = {
  0: "ns0-main",
  4: "ns4-projekt",
  6: "ns6-datei",
  10: "ns10-vorlage",
  12: "ns12-hilfe",
  14: "ns14-kategorie",
};

// Spiegelt scripts/crawl.ts (Archive-Repo). Wenn das dort geändert wird,
// muss es hier auch nachgezogen werden.
function safeFilename(title: string): string {
  return title.replace(/[\\/]/g, "__").replace(/\s+/g, "_").slice(0, 200);
}

function articlePath(entry: ManifestEntry): string {
  const folder = NS_FOLDER[entry.ns] ?? `ns${entry.ns}`;
  return `pages/${folder}/${safeFilename(entry.title)}.json`;
}

function viewerUrl(title: string): string {
  // Eigener Archive-Viewer in fragKIm, läuft auch nach der Abschaltung weiter.
  return `/archive/grundschulwiki/${encodeURIComponent(
    title.replace(/\s/g, "_"),
  )}`;
}

// Eine Bild-Referenz im Wikitext (z.B. "Vulkan.jpg") in eine GitHub-raw-URL
// auf das Archive-Repo umwandeln. Funktioniert sobald crawl-images.ts
// gelaufen ist und die Bilder unter data/files/ liegen.
function archiveImageUrl(baseUrl: string, filename: string): string {
  // Crawler verwendet safeFilename: Spaces zu _, Slashes raus
  const safe = filename.replace(/[\\/]/g, "__").replace(/\s+/g, "_");
  return `${baseUrl}/files/${encodeURIComponent(safe)}`;
}

class ArchiveIndex {
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private entries: ManifestEntry[] = [];
  // Lookup: lowercase title → entry (für exakte Titel-Treffer)
  private byTitleLower = new Map<string, ManifestEntry>();
  // Tokenized title parts → Set of indices in entries (für Substring-Suche)
  private articleCache = new Map<string, ArticleJson>();
  private articleCacheMax = 200;

  constructor(private baseUrl: string) {}

  enabled(): boolean {
    return !!this.baseUrl && this.baseUrl.toLowerCase() !== "off";
  }

  private async loadOnce(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      try {
        const url = `${this.baseUrl}/manifest.json`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          throw new Error(`Manifest HTTP ${res.status}`);
        }
        const m = (await res.json()) as Manifest;
        this.entries = m.pages.filter((e) => e.ns === 0); // Hauptartikel
        for (const e of this.entries) {
          this.byTitleLower.set(e.title.toLowerCase(), e);
        }
        this.loaded = true;
      } catch (err) {
        console.error("Archive manifest load failed:", err);
        // Wir setzen loaded NICHT auf true, damit der nächste Versuch nochmal lädt
      } finally {
        this.loadPromise = null;
      }
    })();
    return this.loadPromise;
  }

  async ensureLoaded(): Promise<boolean> {
    if (!this.enabled()) return false;
    await this.loadOnce();
    return this.loaded;
  }

  private rememberArticle(title: string, art: ArticleJson): void {
    if (this.articleCache.size >= this.articleCacheMax) {
      const first = this.articleCache.keys().next().value;
      if (first) this.articleCache.delete(first);
    }
    this.articleCache.set(title, art);
  }

  private async fetchArticle(entry: ManifestEntry): Promise<ArticleJson | null> {
    const cached = this.articleCache.get(entry.title);
    if (cached) return cached;
    const url = `${this.baseUrl}/${articlePath(entry)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const art = (await res.json()) as ArticleJson;
      this.rememberArticle(entry.title, art);
      return art;
    } catch {
      return null;
    }
  }

  // Sehr einfache Titel-Suche: erst exakte Treffer auf Titel-Substring,
  // dann Token-Overlap. Funktioniert nicht semantisch, aber für eine
  // Suche im Stil von "Was ist Vulkan" -> Title "Vulkan" reicht das gut.
  private searchTitles(query: string, limit: number): ManifestEntry[] {
    const q = query.toLowerCase();
    const exact = this.byTitleLower.get(q);
    const out: ManifestEntry[] = [];
    if (exact) out.push(exact);

    // Tokenize Query, Stopwörter raus (gleiche Liste wie Online-Retrieval)
    const STOPWORDS = new Set([
      "wie", "was", "wer", "wo", "wann", "warum", "wieso", "weshalb",
      "welche", "welcher", "welches", "welchen",
      "ist", "sind", "war", "waren", "wird", "werden", "haben", "hat",
      "habe", "kann", "können", "soll", "sollen", "muss", "müssen",
      "ein", "eine", "einen", "einer", "eines", "einem",
      "der", "die", "das", "den", "dem", "des",
      "und", "oder", "aber", "doch", "nicht", "kein", "keine", "keinen",
      "mit", "von", "vom", "zur", "zum", "in", "im", "an", "am", "auf",
      "für", "bei", "über", "unter", "nach", "vor", "durch", "gegen",
      "es", "er", "sie", "wir", "ihr", "ich", "du", "mich", "dich",
      "auch", "schon", "noch", "mehr", "sehr", "viel", "viele",
      "denn", "weil", "wenn", "dass",
    ]);
    const tokens = q
      .replace(/[?!.,;:()"„""'']/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t));

    if (tokens.length === 0) return out;

    // Score jedes Entry: wie viele Tokens kommen im Titel vor?
    type Scored = { entry: ManifestEntry; score: number };
    const scored: Scored[] = [];
    for (const e of this.entries) {
      const titleLower = e.title.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (titleLower.includes(t)) {
          // Volltreffer = mehr Wert als Substring
          score += titleLower === t ? 5 : titleLower.startsWith(t) ? 2 : 1;
        }
      }
      if (score > 0) scored.push({ entry: e, score });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const s of scored) {
      if (out.some((e) => e.title === s.entry.title)) continue;
      out.push(s.entry);
      if (out.length >= limit) break;
    }
    return out;
  }

  async search(query: string, maxHits = 3): Promise<Hit[]> {
    const ok = await this.ensureLoaded();
    if (!ok) return [];
    const candidates = this.searchTitles(query, maxHits);
    if (candidates.length === 0) return [];

    const articles = await Promise.allSettled(
      candidates.map((e) => this.fetchArticle(e)),
    );
    const hits: Hit[] = [];
    for (let i = 0; i < articles.length; i++) {
      const r = articles[i];
      if (r.status !== "fulfilled" || !r.value) continue;
      const art = r.value;
      const latest = art.revisions[0];
      if (!latest?.wikitext) continue;
      const text = wikitextToText(latest.wikitext).slice(0, 6000);
      if (text.length < 80) continue;
      const imgName = extractFirstImageName(latest.wikitext);
      const imageUrl = imgName
        ? archiveImageUrl(this.baseUrl, imgName)
        : undefined;
      const payload: KlexikonPayload = {
        title: art.title,
        url: viewerUrl(art.title),
        chunkIndex: 0,
        text,
        source: "grundschulwiki",
        imageUrl,
      };
      const score = 1 - i * 0.1;
      hits.push({ score, payload });
    }
    return hits;
  }
}

let _index: ArchiveIndex | null = null;

export function archiveIndex(): ArchiveIndex {
  if (!_index) {
    _index = new ArchiveIndex(config.grundschulwikiArchiveUrl);
  }
  return _index;
}

export function archiveEnabled(): boolean {
  return archiveIndex().enabled();
}

export async function searchGrundschulwikiArchive(
  query: string,
): Promise<Hit[]> {
  return archiveIndex().search(query, 3);
}
