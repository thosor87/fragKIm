import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

const COOKIE = "fragkim_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

// Umami: anonymes, cookieless Webanalyse, selbst gehostet (analytics.soring.de)
const UMAMI_SCRIPT = `<script defer src="https://analytics.soring.de/script.js" data-website-id="80b5fe08-2b0d-4c67-8c46-6d814f42d2ae"></script>`;

function tokenFromPassword(pw: string): string {
  return createHash("sha256").update(pw).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Pfade, die Linkvorschau-Scraper, Browser-Tabs und PWA-Installer abrufen
// koennen muessen, ohne sich einloggen zu muessen.
const PUBLIC_STATIC = new Set<string>([
  "/og-image.png",
  "/og-image.svg",
  "/favicon.svg",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/site.webmanifest",
]);

function isPublic(url: string): boolean {
  // url enthält Query, deshalb startsWith bzw. exakte Vergleiche
  if (url === "/healthz" || url === "/robots.txt") return true;
  if (url === "/login" || url.startsWith("/login?")) return true;
  if (url === "/api/login" || url.startsWith("/api/login?")) return true;
  // Legal-Pages sind oeffentlich erreichbar (Pflicht nach DDG/DSGVO)
  if (url === "/impressum" || url.startsWith("/impressum?")) return true;
  if (url === "/datenschutz" || url.startsWith("/datenschutz?")) return true;
  // Static assets, die Linkvorschauen und Browser-Apps brauchen
  const pathOnly = url.split("?")[0];
  if (PUBLIC_STATIC.has(pathOnly)) return true;
  return false;
}

const LOGIN_PAGE = (error?: string): string => `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>frag KIm — Kindersichere Wissens-KI</title>
  <meta name="description" content="frag KIm ist ein Proof of Concept einer kindersicheren KI-Wissensauskunft. Antworten aus Klexikon und Grundschulwiki, RAG-Architektur, EU-gehostet. Interne Entwicklungs-Demo, nicht für Kinder bestimmt.">

  <!-- Linkvorschau (greift auch wenn der Scraper nur die Login-Seite sieht) -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="frag KIm">
  <meta property="og:title" content="frag KIm — Kindersichere Wissens-KI">
  <meta property="og:description" content="Antworten aus Klexikon und Grundschulwiki, kindgerecht zusammengefasst von einer KI. EU-gehostet. Interne Demo, nicht für Kinder bestimmt.">
  <meta property="og:url" content="https://fragkim.lilapixel.de/">
  <meta property="og:image" content="https://fragkim.lilapixel.de/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="de_DE">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="frag KIm — Kindersichere Wissens-KI">
  <meta name="twitter:description" content="Antworten aus Klexikon und Grundschulwiki. EU-gehostet. Interne Demo, nicht für Kinder bestimmt.">
  <meta name="twitter:image" content="https://fragkim.lilapixel.de/og-image.png">

  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#2bb3a3">
  <style>
    :root {
      --primary:#2bb3a3; --primary-dark:#229387; --accent:#ffc857;
      --bg:#fbf8f3; --card:#ffffff; --text:#2a2d34;
      --muted:#6b6f78; --border:#e6e0d4; --error:#8a1f12;
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
      font-family:"Atkinson Hyperlegible","Lexend","Nunito",
        -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      font-size:18px;line-height:1.65;-webkit-font-smoothing:antialiased;
      -webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}
    .banner{position:sticky;top:0;background:var(--text);color:#fff;
      text-align:center;font-size:14px;padding:8px 16px;z-index:10}
    .wrap{max-width:520px;margin:8vh auto;padding:0 16px;
      padding-left:max(16px,env(safe-area-inset-left,16px));
      padding-right:max(16px,env(safe-area-inset-right,16px))}
    .brand{display:flex;align-items:center;justify-content:center;
      gap:14px;margin-bottom:8px}
    .brand h1{font-size:34px;margin:0;font-weight:800;letter-spacing:-0.01em}
    .tagline{text-align:center;color:var(--primary);font-size:14px;
      font-weight:600;letter-spacing:1.5px;text-transform:uppercase;
      margin:0 0 28px}
    .intro{background:var(--card);border:1px solid var(--border);
      border-radius:18px;padding:22px 24px;margin-bottom:28px;
      color:var(--text);font-size:16px}
    .intro p{margin:0 0 10px}
    .intro p:last-child{margin:0}
    .intro strong{font-weight:700}
    .intro .pill{display:inline-block;background:#fff6d6;color:var(--text);
      font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;
      border:1px solid var(--accent);margin-right:4px}
    form{display:flex;flex-direction:column;gap:12px}
    input[type=password]{font:inherit;font-size:18px;padding:14px 20px;
      border-radius:999px;border:2px solid var(--border);background:#fff;
      color:var(--text)}
    input[type=password]:focus{outline:none;border-color:var(--primary);
      box-shadow:0 0 0 4px rgba(43,179,163,0.18)}
    button{font:inherit;font-weight:700;font-size:17px;padding:14px 24px;
      border-radius:999px;border:none;background:var(--primary);
      color:#fff;cursor:pointer;transition:background 150ms ease}
    button:hover{background:var(--primary-dark)}
    .error{color:var(--error);margin-top:12px;font-size:15px;text-align:center}
    .legal-links{display:flex;gap:14px;justify-content:center;
      flex-wrap:wrap;margin-top:28px;font-size:13px;color:var(--muted)}
    .legal-links a{color:var(--muted);text-decoration:underline;
      text-underline-offset:3px}
    .legal-links a:hover{color:var(--text)}
    .legal-links span{opacity:0.5}
    @media (max-width: 520px) {
      .wrap{margin:5vh auto}
      .brand h1{font-size:28px}
      .brand svg{width:36px;height:36px}
      .intro{padding:16px 18px;font-size:15px}
      input[type=password]{font-size:16px}
    }
  </style>
  ${UMAMI_SCRIPT}
</head>
<body>
  <div class="banner">Interne Entwicklungs-Demo. Nicht für Kinder bestimmt.</div>
  <div class="wrap">
    <div class="brand">
      <svg width="42" height="42" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="18" r="11" fill="#FFC857"/>
        <rect x="15" y="28" width="10" height="4" rx="1.5" fill="#2A2D34"/>
        <rect x="16" y="33" width="8" height="2" rx="1" fill="#2A2D34"/>
      </svg>
      <h1>frag KIm</h1>
    </div>
    <p class="tagline">Kindersichere Wissens-KI</p>

    <div class="intro">
      <p>
        <strong>frag KIm</strong> ist ein Proof of Concept einer kindersicheren
        KI-Wissensauskunft, angelehnt an die Idee von fragFINN.
      </p>
      <p>
        Antworten kommen aus dem
        <a href="https://klexikon.zum.de/" target="_blank" rel="noopener noreferrer">Klexikon</a>
        und dem
        <a href="https://grundschulwiki.zum.de/" target="_blank" rel="noopener noreferrer">Grundschulwiki</a>
        und werden kindgerecht zusammengefasst. Sensible Themen und Beziehungsfragen
        werden bewusst abgeblockt.
      </p>
      <p style="margin-top:14px;font-size:14px;color:var(--muted)">
        Diese Instanz ist eine interne Entwicklungs-Demo, nicht für Kinder
        bestimmt. Zugang nur mit Demo-Passwort.
      </p>
    </div>

    <form method="POST" action="/api/login">
      <input type="password" name="password" placeholder="Demo-Passwort" autofocus required autocomplete="off">
      <button type="submit">Anmelden</button>
    </form>
    ${error ? `<p class="error">${error}</p>` : ""}

    <nav class="legal-links">
      <a href="/impressum">Impressum</a>
      <span>·</span>
      <a href="/datenschutz">Datenschutz</a>
      <span>·</span>
      <a href="https://github.com/thosor87/fragKIm" target="_blank" rel="noopener noreferrer">Quellcode</a>
    </nav>
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

    // API-Calls → 401 JSON
    if (req.url.startsWith("/api/")) {
      reply.code(401);
      return { error: "Bitte zuerst einloggen." };
    }
    // Browser-Navigation → Login-Seite mit Status 200, damit Linkvorschau-
    // Scraper (Slack, WhatsApp, Mail-Clients) die OG-Tags lesen. Die
    // eigentlichen Inhalte sind ja durch die API-Auth geschuetzt.
    reply.type("text/html").send(LOGIN_PAGE());
    return reply;
  });

  // Login-Endpoint: akzeptiert form-urlencoded oder JSON
  app.post<{ Body: { password?: string } }>("/api/login", async (req, reply) => {
    const pw = (req.body?.password ?? "").toString();
    if (!pw || !safeEqual(tokenFromPassword(pw), expectedToken)) {
      reply.type("text/html").send(LOGIN_PAGE("Passwort falsch."));
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
