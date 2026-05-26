import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config.js";

export const qdrant = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey || undefined,
});

export type KlexikonPayload = {
  title: string;
  url: string;
  chunkIndex: number;
  text: string;
  updatedAt?: string;
  imageUrl?: string;
};

export type Hit = {
  score: number;
  payload: KlexikonPayload;
};

export async function searchChunks(
  embedding: number[],
  topK = 5,
): Promise<Hit[]> {
  const result = await qdrant.search(config.qdrantCollection, {
    vector: embedding,
    limit: topK,
    with_payload: true,
  });
  return result.map((r) => ({
    score: r.score ?? 0,
    payload: r.payload as unknown as KlexikonPayload,
  }));
}

export async function ensureCollection(vectorSize: number): Promise<void> {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === config.qdrantCollection,
  );
  if (exists) return;
  await qdrant.createCollection(config.qdrantCollection, {
    vectors: { size: vectorSize, distance: "Cosine" },
  });
}
