// Schlankes In-Memory-Rate-Limit ohne externe Dependency.
//
// Schützt die kostenpflichtigen Endpunkte (Mistral, ElevenLabs) vor Missbrauch:
// Wer das Demo-Passwort hat, soll nicht beliebig viele teure API-Calls auslösen.
//
// Grenze der Methode: auf Vercel läuft jede Function-Instanz für sich, der
// Zähler ist also pro Instanz, nicht global. Fluid Compute hält Instanzen warm
// und wiederverwendet sie, daher greift es in der Praxis spürbar — für einen
// harten, globalen Schutz bräuchte es geteilten Speicher (KV/Redis). Für einen
// PoC ist das hier der richtige Kompromiss (Schutz ohne Zusatz-Infrastruktur).

import type { FastifyReply, FastifyRequest } from "fastify";

type Bucket = { count: number; resetAt: number };

function clientIp(req: FastifyRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0]!.trim();
  }
  return req.ip || "unknown";
}

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
};

export function makeRateLimiter(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return async function rateLimit(req: FastifyRequest, reply: FastifyReply) {
    const now = Date.now();
    const ip = clientIp(req);
    let b = buckets.get(ip);

    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(ip, b);
    }
    b.count += 1;

    // Gelegentlich abgelaufene Einträge wegräumen (verhindert Memory-Leak).
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    }

    if (b.count > opts.max) {
      const retryAfter = Math.ceil((b.resetAt - now) / 1000);
      reply.header("retry-after", String(retryAfter));
      reply.code(429);
      return reply.send({
        error:
          "Etwas zu viele Anfragen in kurzer Zeit. Bitte warte einen Moment " +
          "und versuch es dann noch einmal.",
      });
    }
  };
}
