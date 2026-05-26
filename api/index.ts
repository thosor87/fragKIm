// Vercel-Serverless-Entrypoint.
// Diese Datei lädt einmalig die Fastify-App und delegiert jeden
// eingehenden Vercel-Request über das interne HTTP-Routing weiter.
//
// Lokales Verhalten (`npm start`) bleibt unverändert; die Listen-Logik in
// backend/src/server.ts wird nur dann aktiv, wenn die Datei direkt
// ausgeführt wird.
//
// Vercel-Bundling: die Function bringt das gebaute Backend (`backend/dist`)
// und das gebaute Frontend (`frontend/dist`) als statische Assets mit.

import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Frontend-Pfad relativ zum Function-Bundle auflösen
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.FRONTEND_DIST = path.resolve(__dirname, "../frontend/dist");

// Lazy-Init der App, damit nicht jeder Request neu instanziiert wird.
// Vercel hält die Function zwischen Requests warm.
let appPromise: Promise<unknown> | null = null;
async function getApp() {
  if (!appPromise) {
    appPromise = import("../backend/dist/server.js").then(async (mod) => {
      const app = await mod.buildApp();
      await app.ready();
      return app;
    });
  }
  return appPromise as Promise<{
    server: { emit: (event: string, req: IncomingMessage, res: ServerResponse) => void };
  }>;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getApp();
  app.server.emit("request", req, res);
}

export const config = {
  // Erlaubt größere Audio-Antworten (TTS-MP3) und längere LLM-Calls
  maxDuration: 60,
};
