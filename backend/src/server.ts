import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { ask, type ChatTurn, type SourceFlags, DEFAULT_SOURCES } from "./rag/pipeline.js";
import { registerAuth } from "./auth.js";
import { registerArchiveViewer } from "./archive-viewer.js";
import { registerLegalPages } from "./legal-pages.js";
import { makeRateLimiter } from "./rate-limit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Frontend-Verzeichnis je nach Laufzeit:
// - Lokal/Docker: backend/dist/server.js  → ../../frontend/dist
// - Vercel-Function: api/index.js         → ../frontend/dist
function resolveFrontendDist(): string {
  // Bevorzugt explizit gesetzt
  if (process.env.FRONTEND_DIST) return path.resolve(process.env.FRONTEND_DIST);
  // Standard: relativ vom server.js aus
  return path.resolve(__dirname, "../../frontend/dist");
}

export async function buildApp(): Promise<FastifyInstance> {
  const frontendDist = resolveFrontendDist();

  const app = Fastify({
    logger: { level: config.nodeEnv === "production" ? "info" : "debug" },
    bodyLimit: 64 * 1024,
  });

  await app.register(fastifyCookie);
  await app.register(formbody);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  app.get("/healthz", async () => ({ ok: true }));
  app.get("/robots.txt", async (_req, reply) => {
    reply.type("text/plain");
    return "User-agent: *\nDisallow: /\n";
  });

  registerLegalPages(app);
  registerAuth(app);
  registerArchiveViewer(app);

  // Rate-Limit pro IP. Ein Limiter (eigener Zähler) fürs Fragen, ein
  // gemeinsamer für die teureren ElevenLabs-Endpunkte. max=0 → kein Limit.
  const win = config.rateLimitWindowMs;
  const askLimit =
    config.rateLimitAsk > 0
      ? makeRateLimiter({ windowMs: win, max: config.rateLimitAsk, name: "ask" })
      : undefined;
  const mediaLimit =
    config.rateLimitMedia > 0
      ? makeRateLimiter({ windowMs: win, max: config.rateLimitMedia, name: "media" })
      : undefined;

  app.post<{
    Body: {
      question?: string;
      history?: ChatTurn[];
      sources?: Partial<SourceFlags>;
      lang?: string;
    };
  }>("/api/ask", { preHandler: askLimit }, async (req, reply) => {
    const q = (req.body?.question ?? "").toString();
    if (!q || q.length > 500) {
      reply.code(400);
      return { error: "Frage fehlt oder ist zu lang (max. 500 Zeichen)." };
    }
    const lang = (req.body?.lang ?? "de").toString().slice(0, 5);
    const raw = Array.isArray(req.body?.history) ? req.body!.history : [];
    const history: ChatTurn[] = raw
      .filter(
        (t): t is ChatTurn =>
          !!t &&
          (t.role === "user" || t.role === "assistant") &&
          typeof t.content === "string" &&
          t.content.length <= 2000,
      )
      .slice(-6);
    const sIn = req.body?.sources ?? {};
    const sources: SourceFlags = {
      klexikon: sIn.klexikon ?? DEFAULT_SOURCES.klexikon,
      grundschulwiki: sIn.grundschulwiki ?? DEFAULT_SOURCES.grundschulwiki,
      allgemeinwissen: sIn.allgemeinwissen ?? DEFAULT_SOURCES.allgemeinwissen,
    };
    try {
      const result = await ask(q, history, sources, lang);
      return result;
    } catch (err) {
      app.log.error({ err }, "ask failed");
      reply.code(500);
      return {
        error: "Etwas ist schiefgegangen. Bitte versuche es gleich noch einmal.",
      };
    }
  });

  app.post<{ Body: { text?: string } }>("/api/speak", { preHandler: mediaLimit }, async (req, reply) => {
    const text = (req.body?.text ?? "").toString().slice(0, 2000);
    if (!text) {
      reply.code(400);
      return { error: "Text fehlt" };
    }
    if (!config.elevenLabsApiKey) {
      reply.code(503);
      return { error: "Vorlesen ist nicht konfiguriert (ELEVENLABS_API_KEY fehlt)." };
    }
    // Marker-Label nicht mitsprechen: das Präfix "Allgemeinwissen:" reiner
    // Allgemeinwissen-Antworten sowie der Klammerzusatz "(Allgemeinwissen)"
    // im Kombi-Intro ("Schon gewusst (Allgemeinwissen)?" → "Schon gewusst?").
    const speakable = text
      .replace(/^\s*allgemeinwissen\s*:\s*/gim, "")
      .replace(/\s*\(allgemeinwissen\)\s*/gi, " ");
    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": config.elevenLabsApiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: speakable,
          model_id: config.elevenLabsModelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        app.log.error({ status: r.status, body }, "ElevenLabs error");
        reply.code(502);
        return { error: "ElevenLabs hat nicht reagiert." };
      }
      const buf = Buffer.from(await r.arrayBuffer());
      reply.type("audio/mpeg");
      reply.header("cache-control", "no-store");
      return buf;
    } catch (err) {
      app.log.error({ err }, "tts failed");
      reply.code(500);
      return { error: "Vorlesen ist gerade nicht möglich." };
    }
  });

  app.post("/api/transcribe", { preHandler: mediaLimit }, async (req, reply) => {
    if (!config.elevenLabsApiKey) {
      reply.code(503);
      return { error: "Spracheingabe ist nicht konfiguriert." };
    }
    const file = await req.file();
    if (!file) {
      reply.code(400);
      return { error: "Keine Audiodatei mitgeschickt." };
    }
    const buf = await file.toBuffer();
    try {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(buf)], { type: file.mimetype || "audio/webm" }),
        file.filename || "audio.webm",
      );
      form.append("model_id", "scribe_v1");
      form.append("language_code", "deu");
      const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": config.elevenLabsApiKey },
        body: form,
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        app.log.error({ status: r.status, body }, "ElevenLabs STT error");
        reply.code(502);
        return { error: "Spracherkennung hat nicht reagiert." };
      }
      const data = (await r.json()) as { text?: string };
      return { text: (data.text ?? "").trim() };
    } catch (err) {
      app.log.error({ err }, "transcribe failed");
      reply.code(500);
      return { error: "Spracherkennung ist gerade nicht möglich." };
    }
  });

  await app.register(fastifyStatic, {
    root: frontendDist,
    prefix: "/",
    index: ["index.html"],
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.type("text/html").sendFile("index.html");
  });

  return app;
}

// Direkt-Start (lokal, Docker, Fly): nur ausführen, wenn diese Datei das
// Einstiegsskript des Prozesses ist. Im Vercel-Function-Modus wird buildApp
// stattdessen vom api/index.ts-Handler genutzt.
const entryUrl = `file://${process.argv[1]}`;
if (import.meta.url === entryUrl) {
  const app = await buildApp();
  const port = config.port;
  app
    .listen({ port, host: "0.0.0.0" })
    .then(() => app.log.info(`fragKIm PoC listening on :${port}`))
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
