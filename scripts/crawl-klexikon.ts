/**
 * Klexikon-Crawler über die MediaWiki-API.
 *
 * - Listet alle Artikel im Namespace 0 via `action=query&list=allpages`
 * - Holt pro Artikel den Klartext via `action=query&prop=extracts&explaintext=1`
 *   (das spart uns Wikitext-Parsing; ungenauer als 'parse', aber gut genug)
 * - 1 Request/Sekunde, eigener User-Agent mit Kontakt-Mail
 * - Schreibt JSONL nach ./klexikon-dump/articles.jsonl
 *
 * Lizenz: Klexikon-Inhalte sind CC BY-SA 4.0. Attribution-Pflicht steht im
 * Footer der UI ("Inhalte aus dem Klexikon, CC BY-SA").
 */
import "dotenv/config";
import { mkdir, writeFile, appendFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const API = "https://klexikon.zum.de/api.php";
const OUT = resolve(process.cwd(), "klexikon-dump/articles.jsonl");
const CONTACT = process.env.CRAWLER_CONTACT ?? "anonymous";
const UA = `fragKIm-PoC-Crawler/0.1 (+Kontakt: ${CONTACT})`;
const DELAY_MS = 1000;

const MAX_ARTICLES = Number(process.env.CRAWL_LIMIT ?? 0); // 0 = alles
const RESUME = process.env.CRAWL_RESUME === "true";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return (await res.json()) as T;
}

type AllPagesResp = {
  query?: { allpages?: { pageid: number; title: string }[] };
  continue?: { apcontinue?: string };
};

type ParseResp = {
  parse?: {
    title: string;
    pageid: number;
    text?: string;
    revid?: number;
  };
  error?: { code: string; info: string };
};

function htmlToText(html: string): string {
  // ZUM-Wiki liefert sauberes MediaWiki-HTML. Wir entfernen:
  //  - <style>, <script>
  //  - Navigationsboxen (.navigation, .toc, .infobox, etc.)
  //  - Editierhinweise (.mw-editsection)
  //  - <sup class="reference">
  //  - alle übrigen Tags → reiner Text
  let out = html;
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<table[\s\S]*?<\/table>/gi, "");
  out = out.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "");
  out = out.replace(/<span\s+class="mw-editsection"[\s\S]*?<\/span>/gi, "");
  // Block-Tags → Zeilenumbrüche, damit Sätze nicht verschmelzen
  out = out.replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n");
  out = out.replace(/<br\s*\/?>/gi, "\n");
  // Restliche Tags weg
  out = out.replace(/<[^>]+>/g, "");
  // HTML-Entities (sehr minimal — reicht für PoC)
  out = out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Whitespace normalisieren, aber Absätze erhalten
  out = out
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return out;
}

async function* allPages(): AsyncGenerator<{ title: string; pageid: number }> {
  let cont: string | undefined;
  for (;;) {
    const resp = await api<AllPagesResp>({
      action: "query",
      list: "allpages",
      apnamespace: "0",
      aplimit: "500",
      apfilterredir: "nonredirects",
      ...(cont ? { apcontinue: cont } : {}),
    });
    for (const p of resp.query?.allpages ?? []) {
      yield { title: p.title, pageid: p.pageid };
    }
    if (!resp.continue?.apcontinue) return;
    cont = resp.continue.apcontinue;
    await sleep(DELAY_MS);
  }
}

async function fetchExtract(
  title: string,
): Promise<{ text: string } | null> {
  const resp = await api<ParseResp>({
    action: "parse",
    page: title,
    prop: "text",
    redirects: "1",
    disableeditsection: "1",
    disabletoc: "1",
  });
  if (resp.error || !resp.parse?.text) return null;
  const text = htmlToText(resp.parse.text).trim();
  if (!text) return null;
  return { text };
}

function articleUrl(title: string): string {
  return `https://klexikon.zum.de/wiki/${encodeURIComponent(title.replace(/\s/g, "_"))}`;
}

async function loadSeenTitles(): Promise<Set<string>> {
  const seen = new Set<string>();
  try {
    await stat(OUT);
  } catch {
    return seen;
  }
  if (!RESUME) return seen;
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(OUT, "utf8");
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as { title?: string };
      if (r.title) seen.add(r.title);
    } catch {
      /* skip */
    }
  }
  return seen;
}

async function main(): Promise<void> {
  await mkdir(dirname(OUT), { recursive: true });
  const seen = await loadSeenTitles();
  console.log(`User-Agent: ${UA}`);
  if (seen.size > 0) console.log(`Resume aktiv, ${seen.size} Artikel überspringen.`);
  if (!RESUME) {
    // Datei frisch anlegen
    await writeFile(OUT, "");
  }

  let count = 0;
  let written = 0;
  for await (const { title } of allPages()) {
    count++;
    if (seen.has(title)) continue;
    if (MAX_ARTICLES > 0 && written >= MAX_ARTICLES) break;
    try {
      const ex = await fetchExtract(title);
      if (ex && ex.text.length > 80) {
        const row = {
          title,
          url: articleUrl(title),
          text: ex.text,
        };
        await appendFile(OUT, JSON.stringify(row) + "\n");
        written++;
        if (written % 25 === 0) {
          console.log(`  ${written} Artikel geschrieben (Seite ${count})`);
        }
      }
    } catch (err) {
      console.warn(`Fehler bei '${title}':`, (err as Error).message);
    }
    await sleep(DELAY_MS);
  }

  console.log(`Fertig. ${written} Artikel in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
