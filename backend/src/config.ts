import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export type EmbeddingProvider = "local" | "mistral";
export type LlmProvider = "stub" | "ollama" | "mistral";
export type RetrievalProvider = "online" | "local";

function parseEmbedding(v: string | undefined): EmbeddingProvider {
  return v === "mistral" ? "mistral" : "local";
}
function parseLlm(v: string | undefined): LlmProvider {
  if (v === "mistral") return "mistral";
  if (v === "ollama") return "ollama";
  return "stub";
}
function parseRetrieval(v: string | undefined): RetrievalProvider {
  return v === "local" ? "local" : "online";
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? "development",
  demoBanner: process.env.PUBLIC_DEMO_BANNER === "true",

  retrievalProvider: parseRetrieval(process.env.RETRIEVAL_PROVIDER),
  embeddingProvider: parseEmbedding(process.env.EMBEDDING_PROVIDER),
  llmProvider: parseLlm(process.env.LLM_PROVIDER),

  mistralApiKey: process.env.MISTRAL_API_KEY ?? "",
  qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY,
  qdrantCollection: process.env.QDRANT_COLLECTION ?? "klexikon",

  demoPassword: process.env.DEMO_PASSWORD ?? "",

  crawlerContact: process.env.CRAWLER_CONTACT ?? "anonymous",

  ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen2.5:7b",

  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM",
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",

  requireMistralKey: () => required("MISTRAL_API_KEY"),
};
