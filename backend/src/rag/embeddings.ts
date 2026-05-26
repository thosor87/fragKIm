import { config } from "../config.js";

// E5-Modelle erwarten Prefixes:
//   "query: <text>"   für Suchanfragen
//   "passage: <text>" für indexierte Texte
// Wichtig, sonst leidet die Retrieval-Qualität spürbar.

export type EmbedKind = "query" | "passage";

type LocalPipeline = (
  inputs: string[],
  opts: { pooling: "mean"; normalize: true },
) => Promise<{ data: Float32Array; dims: number[] }>;

let localPipeline: LocalPipeline | null = null;

async function getLocalPipeline(): Promise<LocalPipeline> {
  if (localPipeline) return localPipeline;
  // import-Pfad als string-cast: in Vercel-Production ist @huggingface/transformers
  // nicht installiert (optionalDependency), tsc soll das Modul nicht statisch
  // auflösen. Aufruf wird nur bei EMBEDDING_PROVIDER=local erreicht.
  const mod = (await import("@huggingface/transformers" as string)) as {
    pipeline: (task: string, model: string) => Promise<unknown>;
  };
  const p = await mod.pipeline(
    "feature-extraction",
    "Xenova/multilingual-e5-base",
  );
  localPipeline = p as unknown as LocalPipeline;
  return localPipeline;
}

function prefix(kind: EmbedKind, text: string): string {
  return `${kind}: ${text}`;
}

async function localEmbedMany(
  kind: EmbedKind,
  texts: string[],
): Promise<number[][]> {
  const pipe = await getLocalPipeline();
  const inputs = texts.map((t) => prefix(kind, t));
  const out = await pipe(inputs, { pooling: "mean", normalize: true });
  const [n, dim] = out.dims;
  if (n !== texts.length || !dim) {
    throw new Error(`Unexpected embedding shape ${out.dims.join("x")}`);
  }
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const slice = out.data.slice(i * dim, (i + 1) * dim);
    result.push(Array.from(slice));
  }
  return result;
}

let mistralClient: import("@mistralai/mistralai").Mistral | null = null;

async function mistralEmbedMany(texts: string[]): Promise<number[][]> {
  if (!mistralClient) {
    const { Mistral } = await import("@mistralai/mistralai");
    mistralClient = new Mistral({ apiKey: config.requireMistralKey() });
  }
  const res = await mistralClient.embeddings.create({
    model: "mistral-embed",
    inputs: texts,
  });
  return res.data.map((d) => {
    if (!d.embedding) throw new Error("Empty embedding in batch");
    return d.embedding;
  });
}

export async function embedMany(
  kind: EmbedKind,
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (config.embeddingProvider === "mistral") {
    return mistralEmbedMany(texts);
  }
  return localEmbedMany(kind, texts);
}

export async function embed(kind: EmbedKind, text: string): Promise<number[]> {
  const [v] = await embedMany(kind, [text]);
  if (!v) throw new Error("Empty embedding");
  return v;
}

export async function embeddingDimension(): Promise<number> {
  const v = await embed("query", "probe");
  return v.length;
}
