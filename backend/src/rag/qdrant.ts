import { config } from "../config.js";

// Lazy-Init des Qdrant-Clients. Wird nur bei RETRIEVAL_PROVIDER=local
// gebraucht; im Default-Modus (online) wird @qdrant/js-client-rest gar
// nicht geladen. Wichtig fuer Vercel: das Paket steht in
// optionalDependencies und wird im Production-Build ausgelassen.
// Deshalb verwenden wir hier kein Type-Import (sonst scheitert tsc,
// wenn das Paket nicht installiert ist).
type QdrantClientLike = {
  search: (col: string, params: Record<string, unknown>) => Promise<
    { score?: number; payload?: unknown }[]
  >;
  getCollections: () => Promise<{ collections: { name: string }[] }>;
  createCollection: (col: string, opts: unknown) => Promise<unknown>;
  getCollection: (col: string) => Promise<{
    config?: { params?: { vectors?: unknown } };
  }>;
  deleteCollection: (col: string) => Promise<unknown>;
  upsert: (col: string, params: unknown) => Promise<unknown>;
};
let _qdrant: QdrantClientLike | null = null;
async function getQdrant(): Promise<QdrantClientLike> {
  if (_qdrant) return _qdrant;
  const mod = (await import("@qdrant/js-client-rest" as string)) as {
    QdrantClient: new (opts: { url: string; apiKey?: string }) => QdrantClientLike;
  };
  _qdrant = new mod.QdrantClient({
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
