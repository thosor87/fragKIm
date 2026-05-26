import { config } from "../config.js";

// Lazy-Init des Qdrant-Clients. Wird nur bei RETRIEVAL_PROVIDER=local
// gebraucht; im Default-Modus (online) wird @qdrant/js-client-rest gar
// nicht erst geladen. Wichtig fuer Vercel: dort ist das Modul nicht im
// Function-Bundle.
type QdrantClientType = import("@qdrant/js-client-rest").QdrantClient;
let _qdrant: QdrantClientType | null = null;
async function getQdrant(): Promise<QdrantClientType> {
  if (_qdrant) return _qdrant;
  const { QdrantClient } = await import("@qdrant/js-client-rest");
  _qdrant = new QdrantClient({
    url: config.qdrantUrl,
    apiKey: config.qdrantApiKey || undefined,
  });
  return _qdrant;
}

export type WikiSourceId = "klexikon" | "grundschulwiki";

export type KlexikonPayload = {
  title: string;
  url: string;
  chunkIndex: number;
  text: string;
  updatedAt?: string;
  imageUrl?: string;
  source?: WikiSourceId;
};

export type Hit = {
  score: number;
  payload: KlexikonPayload;
};

export async function searchChunks(
  embedding: number[],
  topK = 5,
): Promise<Hit[]> {
  const qdrant = await getQdrant();
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
  const qdrant = await getQdrant();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === config.qdrantCollection,
  );
  if (exists) return;
  await qdrant.createCollection(config.qdrantCollection, {
    vectors: { size: vectorSize, distance: "Cosine" },
  });
}
