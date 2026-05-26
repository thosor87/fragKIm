import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

const COOKIE = "fragkim_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

function tokenFromPassword(pw: string): string {
  return createHash("sha256").update(pw).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function isPublic(url: string): boolean {
  // url enthält Query, deshalb startsWith bzw. exakte Vergleiche
  if (url === "/healthz" || url === "/robots.txt") return true;
  if (url === "/login" || url.startsWith("/login?")) return true;
  if (url === "/api/login" || url.startsWith("/api/login?")) return true;
  return false;
}

const LOGIN_PAGE = (error?: string): string => `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>fragKIm – Demo-Login</title>
  <style>
    :root { --primary:#2bb3a3; --primary-dark:#229387; --bg:#fbf8f3; --text:#2a2d34; --border:#e6e0d4; --error:#8a1f12; }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:18px;line-height:1.6}
    .wrap{max-width:420px;margin:10vh auto;padding:0 16px;text-align:center}
    h1{font-size:28px;margin:0 0 8px}
    p.muted{color:#6b6f78;margin:0 0 24px}
    form{display:flex;flex-direction:column;gap:12px}
    input[type=password]{font:inherit;font-size:20px;padding:16px 20px;border-radius:999px;border:2px solid var(--border);background:#fff}
    input[type=password]:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 4px rgba(43,179,163,0.18)}
    button{font:inherit;font-weight:600;font-size:18px;padding:14px 24px;border-radius:999px;border:none;background:var(--primary);color:#fff;cursor:pointer}
    button:hover{background:var(--primary-dark)}
    .error{color:var(--error);margin-top:12px;font-size:15px}
    .banner{position:sticky;top:0;background:var(--text);color:#fff;text-align:center;font-size:14px;padding:8px 16px}
  </style>
</head>
<body>
  <div class="banner">Interne Entwicklungs-Demo. Nicht für Kinder bestimmt.</div>
  <div class="wrap">
    <h1>fragKIm</h1>
    <p class="muted">Demo-Zugang</p>
    <form method="POST" action="/api/login">
      <input type="password" name="password" placeholder="Passwort" autofocus required>
      <button type="submit">Anmelden</button>
    </form>
    ${error ? `<p class="error">${error}</p>` : ""}
  </div>
</body>
</html>`;

export function registerAuth(app: FastifyInstance): void {
  if (!config.demoPassword) {
    throw new Error("DEMO_PASSWORD env var is required");
  }
  const expectedToken = tokenFromPassword(config.demoPassword);
  const cookieSecure = config.nodeEnv === "production";

  function setSession(reply: FastifyReply): void {
    reply.setCookie(COOKIE, expectedToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      maxAge: COOKIE_MAX_AGE,
    });
  }

  function hasValidCookie(req: FastifyRequest): boolean {
    const got = req.cookies?.[COOKIE];
    return !!got && safeEqual(got, expectedToken);
  }

  // Magic-Link & Cookie-Check als onRequest-Gate
  app.addHook("onRequest", async (req, reply) => {
    if (isPublic(req.url)) return;

    // Magic-Link: ?k=<token>
    const k =
      typeof (req.query as Record<string, unknown>)?.k === "string"
        ? ((req.query as Record<string, string>).k as string)
        : null;
    if (k && safeEqual(k, expectedToken)) {
      setSession(reply);
      // sauberer Redirect ohne Token in der URL
      const clean = req.url.replace(/([?&])k=[^&]*(&|$)/, (_m, p1, p2) =>
        p2 ? p1 : "",
      ).replace(/[?&]$/, "");
      reply.redirect(clean || "/", 302);
      return reply;
    }

    if (hasValidCookie(req)) return;

    // Browser-Navigation → Login-Seite. API-Calls → 401 JSON.
    if (req.url.startsWith("/api/")) {
      reply.code(401);
      return { error: "Bitte zuerst einloggen." };
    }
    reply.type("text/html").code(401).send(LOGIN_PAGE());
    return reply;
  });

  // Login-Endpoint: akzeptiert form-urlencoded oder JSON
  app.post<{ Body: { password?: string } }>("/api/login", async (req, reply) => {
    const pw = (req.body?.password ?? "").toString();
    if (!pw || !safeEqual(tokenFromPassword(pw), expectedToken)) {
      reply.type("text/html").code(401).send(LOGIN_PAGE("Passwort falsch."));
      return reply;
    }
    setSession(reply);
    reply.redirect("/", 302);
    return reply;
  });

  app.get("/login", async (_req, reply) => {
    reply.type("text/html").send(LOGIN_PAGE());
    return reply;
  });

  // Helper für die UI: zeigt den aktuellen Magic-Link an (eingeloggt benötigt)
  app.get("/api/magic-link", async (req) => {
    const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
    const host = req.headers["host"] ?? "localhost";
    return { url: `${proto}://${host}/?k=${expectedToken}` };
  });
}
