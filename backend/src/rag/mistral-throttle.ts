// Gemeinsame Drosselung + Retry für ALLE Mistral-Aufrufe.
//
// Eine Frage löst mehrere Aufrufe aus (Moderation, Umformulieren,
// Relevanz-Gate, Antwort, Output-Moderation, ggf. Übersetzung). Kleine
// Mistral-Tarife erlauben nur ca. 1 Anfrage/Sekunde → sonst HTTP 429
// "Rate limit exceeded". Deshalb: Mindestabstand zwischen Aufrufen (pro
// Prozess) und Backoff-Retry bei 429/5xx/Netzwerkfehlern.

const MIN_INTERVAL_MS = Number(process.env.MISTRAL_MIN_INTERVAL_MS ?? 1100);
const MAX_RETRIES = Number(process.env.MISTRAL_MAX_RETRIES ?? 1);

let nextSlot = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reserviert den nächsten freien Zeitslot und wartet darauf. */
async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + MIN_INTERVAL_MS;
  if (start > now) await sleep(start - now);
}

function retryAfterMs(err: unknown): number | null {
  const h = (err as { headers?: { get?: (k: string) => string | null } }).headers;
  const v = h?.get?.("retry-after");
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(n * 1000, 10_000) : null;
}

export async function mistralCall<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await waitForSlot();
    try {
      return await fn();
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      const transient = status === undefined || status === 429 || status >= 500;
      if (!transient || attempt >= MAX_RETRIES) throw err;
      // Backoff: 2s je Versuch – oder Retry-After, falls geliefert.
      const wait = retryAfterMs(err) ?? 2000 * (attempt + 1);
      console.warn(`[mistral] Status ${status ?? "?"}, Retry ${attempt + 1} in ${wait}ms`);
      nextSlot = Math.max(nextSlot, Date.now() + wait);
      await sleep(wait);
    }
  }
}

/** Mistral-Rate-Limit (429), auch nach Retries. */
export function isRateLimited(err: unknown): boolean {
  return (err as { statusCode?: number })?.statusCode === 429;
}
