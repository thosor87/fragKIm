import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { ask, type ChatTurn } from "./rag/pipeline.js";
import { registerAuth } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

const app = Fastify({
  logger: { level: config.nodeEnv === "production" ? "info" : "debug" },
  bodyLimit: 64 * 1024,
});

await app.register(fastifyCookie);
await app.register(formbody);

app.get("/healthz", async () => ({ ok: true }));
app.get("/robots.txt", async (_req, reply) => {
  reply.type("text/plain");
  return "User-agent: *\nDisallow: /\n";
});

registerAuth(app);

app.post<{
  Body: { question?: string; history?: ChatTurn[] };
}>("/api/ask", async (req, reply) => {
  const q = (req.body?.question ?? "").toString();
  if (!q || q.length > 500) {
    reply.code(400);
    return { error: "Frage fehlt oder ist zu lang (max. 500 Zeichen)." };
  }
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
  try {
    const result = await ask(q, history);
    return result;
  } catch (err) {
    app.log.error({ err }, "ask failed");
    reply.code(500);
    return {
      error: "Etwas ist schiefgegangen. Bitte versuche es gleich noch einmal.",
    };
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

const port = config.port;
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`fragKIm PoC listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
