// Mini-Viewer für archivierte Grundschulwiki-Artikel.
// Wird unter /archive/grundschulwiki/:title ausgeliefert.
//
// Quellenangabe linkt darauf statt aufs Live-Wiki. Damit überleben die Links
// auch die Abschaltung im Juni 2026.

import type { FastifyInstance } from "fastify";
import { config } from "./config.js";
import { archiveIndex } from "./rag/retrieval-archive.js";
import { wikitextToHtml } from "./rag/wikitext.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Wiki-Links innerhalb der Artikel → andere Archive-Viewer-Seiten
function internalLink(target: string): string | null {
  const clean = target.split("#")[0].trim();
  if (!clean) return null;
  return `/archive/grundschulwiki/${encodeURIComponent(clean.replace(/\s/g, "_"))}`;
}

// Bild-Dateinamen → GitHub-raw-URL des Archive-Repos
function imageSrc(filename: string): string | null {
  if (!config.grundschulwikiArchiveUrl) return null;
  const safe = filename.replace(/[\\/]/g, "__").replace(/\s+/g, "_");
  return `${config.grundschulwikiArchiveUrl}/files/${encodeURIComponent(safe)}`;
}

function renderHtml(opts: {
  title: string;
  bodyHtml: string;
  originalUrl: string;
}): string {
  const { title, bodyHtml, originalUrl } = opts;
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>${esc(title)} — Grundschulwiki-Archiv (fragKIm)</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <style>
      :root {
        --primary: #2bb3a3;
        --primary-dark: #229387;
        --accent: #ffc857;
        --bg: #fbf8f3;
        --card: #fff;
        --text: #2a2d34;
        --muted: #6b6f78;
        --border: #e6e0d4;
      }
      *{box-sizing:border-box}
      html, body { margin: 0; padding: 0; }
      body { background: var(--bg); color: var(--text);
        font-family: "Atkinson Hyperlegible", "Lexend", "Nunito",
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 18px; line-height: 1.65;
        -webkit-font-smoothing: antialiased; }
      .banner { position: sticky; top: 0; z-index: 10;
        background: var(--text); color: #fff; text-align: center;
        font-size: 14px; padding: 8px 16px; }
      .wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
      .crumbs { font-size: 14px; color: var(--muted); margin-bottom: 8px; }
      .crumbs a { color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
      h1 { font-size: 36px; line-height: 1.15; margin: 0 0 8px;
        letter-spacing: -0.01em; display: flex; align-items: center;
        gap: 12px; flex-wrap: wrap; }
      .meta { font-size: 14px; color: var(--muted); margin: 0 0 24px; }
      .article { background: var(--card); border: 1px solid var(--border);
        border-radius: 20px; padding: 28px 32px;
        box-shadow: 0 1px 0 rgba(0,0,0,0.02); }
      .article h2 { font-size: 24px; margin: 28px 0 10px;
        padding-bottom: 6px; border-bottom: 1px solid var(--border); }
      .article h3 { font-size: 20px; margin: 24px 0 8px; }
      .article h4 { font-size: 18px; margin: 20px 0 6px; }
      .article p { margin: 0 0 14px; }
      .article ul, .article ol { margin: 0 0 14px; padding-left: 28px; }
      .article li { margin: 4px 0; }
      .article a { color: var(--primary-dark);
        text-decoration: underline; text-underline-offset: 3px; }
      .article strong { font-weight: 700; }
      .article em { font-style: italic; }
      .wt-figure { margin: 16px 0; text-align: center;
        background: var(--bg); border-radius: 12px; padding: 12px;
        border: 1px solid var(--border); }
      .wt-figure img { max-width: 100%; height: auto; border-radius: 8px; }
      .wt-figure figcaption { font-size: 13px; color: var(--muted);
        margin-top: 8px; font-style: italic; }
      .archive-badge { display: inline-block; background: #fff6d6;
        border: 1px solid var(--accent); border-radius: 999px;
        padding: 4px 12px; font-size: 13px; color: var(--text);
        font-weight: 400; letter-spacing: 0; }
      .footer { margin-top: 28px; font-size: 13px;
        color: var(--muted); padding: 16px 20px;
        background: var(--card); border: 1px solid var(--border);
        border-radius: 12px; }
      .footer a { color: var(--muted); }
      .empty { padding: 24px 28px; color: var(--muted); }
    </style>
  </head>
  <body>
    <div class="banner">Interne Entwicklungs-Demo. Nicht für Kinder bestimmt.</div>
    <div class="wrap">
      <div class="crumbs">
        <a href="/">← frag KIm</a> · Grundschulwiki-Archiv
      </div>
      <h1>${esc(title)} <span class="archive-badge">Archiv</span></h1>
      <p class="meta">
        Inhalt aus dem ZUM-Grundschul-Wiki, archiviert vor der Abschaltung im Juni 2026.
      </p>
      <article class="article">${bodyHtml || '<div class="empty">Dieser Artikel ist im Archiv nicht vorhanden.</div>'}</article>
      <div class="footer">
        <strong>Original-Quelle:</strong>
        <a href="${esc(originalUrl)}" target="_blank" rel="noopener noreferrer">${esc(originalUrl)}</a>
        (voraussichtlich ab Juni 2026 nicht mehr erreichbar)<br>
        <strong>Lizenz:</strong>
        <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.de" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.
        Die Inhalte wurden von Lehrkräften und Grundschulkindern auf
        grundschulwiki.zum.de gemeinschaftlich erstellt.<br>
        <strong>Archiv-Repo:</strong>
        <a href="https://github.com/thosor87/grundschulwiki-archiv" target="_blank" rel="noopener noreferrer">github.com/thosor87/grundschulwiki-archiv</a>
      </div>
    </div>
  </body>
</html>`;
}

export function registerArchiveViewer(app: FastifyInstance): void {
  app.get<{ Params: { wiki: string; title: string } }>(
    "/archive/:wiki/:title",
    async (req, reply) => {
      const { wiki, title } = req.params;
      if (wiki !== "grundschulwiki") {
        reply.code(404);
        return { error: "Unbekanntes Wiki." };
      }
      const decodedTitle = decodeURIComponent(title).replace(/_/g, " ");
      const idx = archiveIndex();
      if (!idx.enabled()) {
        reply.code(503);
        return { error: "Archive nicht konfiguriert." };
      }
      const hits = await idx.search(decodedTitle, 1);
      const match = hits.find(
        (h) => h.payload.title.toLowerCase() === decodedTitle.toLowerCase(),
      );
      const originalUrl = `https://grundschulwiki.zum.de/wiki/${encodeURIComponent(
        decodedTitle.replace(/\s/g, "_"),
      )}`;
      if (!match) {
        reply.code(404).type("text/html").send(
          renderHtml({
            title: decodedTitle,
            bodyHtml: '<div class="empty">Dieser Artikel ist im Archiv (noch) nicht vorhanden. Möglicherweise wurde er nicht gecrawlt, oder der Titel ist anders geschrieben.</div>',
            originalUrl,
          }),
        );
        return reply;
      }
      // Wir holen den vollständigen Wikitext direkt aus dem Archive (nicht den
      // bereits konvertierten Text aus dem RAG-Hit), um das Original-Markup
      // für das HTML-Rendering zu haben.
      const article = await fetchArchiveArticle(decodedTitle);
      const wikitext = article?.revisions[0]?.wikitext ?? match.payload.text;
      const bodyHtml = wikitextToHtml(wikitext, {
        internalLink,
        imageSrc,
      });
      reply.type("text/html").send(
        renderHtml({
          title: match.payload.title,
          bodyHtml,
          originalUrl,
        }),
      );
      return reply;
    },
  );
}

type ArticleJson = {
  title: string;
  ns: number;
  pageid: number;
  revisions: { wikitext: string; timestamp?: string; user?: string }[];
};

async function fetchArchiveArticle(title: string): Promise<ArticleJson | null> {
  const base = config.grundschulwikiArchiveUrl;
  if (!base) return null;
  const safe = title.replace(/[\\/]/g, "__").replace(/\s+/g, "_");
  const url = `${base}/pages/ns0-main/${encodeURIComponent(safe)}.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as ArticleJson;
  } catch {
    return null;
  }
}
