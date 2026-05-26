/**
 * Indexing-Skript für Klexikon → Qdrant.
 *
 * Erwartet eine JSONL-Datei unter ./klexikon-dump/articles.jsonl
 * mit je einem Artikel pro Zeile:
 *   { "title": "Sonne", "url": "https://klexikon.zum.de/wiki/Sonne",
 *     "text": "...", "updatedAt": "2025-..." }
 *
 * Nutzt denselben Provider-Schalter wie das Backend:
 *   EMBEDDING_PROVIDER=local|mistral
 *
 * Nutzung:
 *   npm run qdrant:up
 *   npm run crawl     # einmalig: Klexikon → klexikon-dump/articles.jsonl
 *   npm run index
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { QdrantClient } from "@qdrant/js-client-rest";
import { embedMany, embeddingDimension } from "../backend/src/rag/embeddings.js";

const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const COLLECTION = process.env.QDRANT_COLLECTION ?? "klexikon";
const DUMP_PATH = resolve(process.cwd(), "klexikon-dump/articles.jsonl");

const CHUNK_CHARS = 1600;
const CHUNK_OVERLAP = 200;
const BATCH = 16;

type Article = {
  title: string;
  url: string;
  text: string;
  updatedAt?: string;
};

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= CHUNK_CHARS) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_CHARS, clean.length);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

async function readArticles(): Promise<Article[]> {
  let raw: string;
  try {
    raw = await readFile(DUMP_PATH, "utf8");
  } catch {
    throw new Error(
      `Klexikon-Dump nicht gefunden unter ${DUMP_PATH}. ` +
        `Lauf zuerst 'npm run crawl' oder lege eine JSONL-Datei dort an.`,
    );
  }
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Article);
}

async function main(): Promise<void> {
  const articles = await readArticles();
  console.log(`Artikel geladen: ${articles.length}`);
  console.log(`Embedding-Provider: ${process.env.EMBEDDING_PROVIDER ?? "local"}`);

  const qdrant = new QdrantClient({
    url: QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY || undefined,
  });

  const vectorSize = await embeddingDimension();
  console.log(`Embedding-Dimension: ${vectorSize}`);

  // Collection: wenn vorhanden mit falscher Dimension → neu anlegen
  const cols = await qdrant.getCollections();
  const existing = cols.collections.find((c) => c.name === COLLECTION);
  if (existing) {
    const info = await qdrant.getCollection(COLLECTION);
    const cfgVec = info.config?.params?.vectors;
    const currentSize =
      cfgVec && typeof cfgVec === "object" && "size" in cfgVec
        ? (cfgVec as { size: number }).size
        : undefined;
    if (currentSize !== vectorSize) {
      console.log(
        `Collection '${COLLECTION}' existiert mit Dimension ${currentSize}, brauche ${vectorSize} → neu anlegen.`,
      );
      await qdrant.deleteCollection(COLLECTION);
      await qdrant.createCollection(COLLECTION, {
        vectors: { size: vectorSize, distance: "Cosine" },
      });
    } else {
      console.log(`Collection '${COLLECTION}' OK (Dim ${vectorSize}).`);
    }
  } else {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: vectorSize, distance: "Cosine" },
    });
    console.log(`Collection '${COLLECTION}' angelegt.`);
  }

  type ChunkRow = {
    id: number;
    title: string;
    url: string;
    chunkIndex: number;
    text: string;
    updatedAt?: string;
  };
  const rows: ChunkRow[] = [];
  let id = 1;
  for (const a of articles) {
    const chunks = chunkText(a.text);
    chunks.forEach((text, i) => {
      rows.push({
        id: id++,
        title: a.title,
        url: a.url,
        chunkIndex: i,
        text,
        updatedAt: a.updatedAt,
      });
    });
  }
  console.log(`Chunks zu indexieren: ${rows.length}`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vecs = await embedMany("passage", batch.map((b) => b.text));
    const points = batch.map((b, j) => {
      const vec = vecs[j];
      if (!vec) throw new Error(`Embedding fehlt für Chunk ${b.id}`);
      return {
        id: b.id,
        vector: vec,
        payload: {
          title: b.title,
          url: b.url,
          chunkIndex: b.chunkIndex,
          text: b.text,
          updatedAt: b.updatedAt,
        },
      };
    });
    await qdrant.upsert(COLLECTION, { points });
    console.log(`Upsert ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log("Indexing fertig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
