// Impressum + Datenschutz als statische Server-rendered Seiten.
// Vor der Auth registriert, damit auch ohne Login erreichbar (Pflicht!).
// Optik analog zum Archive-Viewer.

import type { FastifyInstance } from "fastify";

const COMMON_STYLES = `
  :root {
    --primary: #2bb3a3;
    --primary-dark: #229387;
    --accent: #ffc857;
    --bg: #fbf8f3;
    --card: #fff;
    --text: #2a2d34;
    --muted: #6b6f78;
    --border: #e6e0d4;
  }
  *{box-sizing:border-box}
  html, body { margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; }
  body { background: var(--bg); color: var(--text);
    font-family: "Atkinson Hyperlegible", "Lexend", "Nunito",
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px; line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent; }
  .banner { position: sticky; top: 0; z-index: 10;
    background: var(--text); color: #fff; text-align: center;
    font-size: 14px; padding: 8px 16px; }
  .wrap { max-width: 760px; margin: 0 auto;
    padding: 24px 16px 64px;
    padding-left: max(16px, env(safe-area-inset-left, 16px));
    padding-right: max(16px, env(safe-area-inset-right, 16px)); }
  .crumbs { font-size: 14px; color: var(--muted); margin-bottom: 8px; }
  .crumbs a { color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
  h1 { font-size: 32px; line-height: 1.2; margin: 0 0 6px;
    letter-spacing: -0.01em; }
  h2 { font-size: 22px; margin: 28px 0 8px;
    padding-bottom: 6px; border-bottom: 1px solid var(--border); }
  h3 { font-size: 18px; margin: 18px 0 6px; }
  .meta { font-size: 14px; color: var(--muted); margin: 0 0 24px; }
  .legal { background: var(--card); border: 1px solid var(--border);
    border-radius: 20px; padding: 28px 32px;
    box-shadow: 0 1px 0 rgba(0,0,0,0.02); }
  .legal p { margin: 0 0 12px; }
  .legal ul { margin: 0 0 14px; padding-left: 24px; }
  .legal li { margin: 3px 0; }
  .legal a { color: var(--primary-dark); text-decoration: underline; text-underline-offset: 3px; }
  .legal strong { font-weight: 700; }
  .footer-nav { margin-top: 28px; font-size: 13px;
    color: var(--muted); display: flex; gap: 16px; flex-wrap: wrap;
    justify-content: center; }
  .footer-nav a { color: var(--muted); }
  @media (max-width: 520px) {
    body { font-size: 17px; }
    .banner { font-size: 13px; padding: 6px 12px; }
    .wrap { padding: 16px 14px 40px; }
    h1 { font-size: 26px; }
    h2 { font-size: 19px; margin: 22px 0 6px; }
    .legal { padding: 18px 18px; border-radius: 14px; }
  }
`;

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>${title} — frag KIm</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <meta name="theme-color" content="#2bb3a3">
    <style>${COMMON_STYLES}</style>
  </head>
  <body>
    <div class="banner">Interne Entwicklungs-Demo. Nicht für Kinder bestimmt.</div>
    <div class="wrap">
      <div class="crumbs">
        <a href="/">← frag KIm</a>
      </div>
      ${body}
      <nav class="footer-nav">
        <a href="/impressum">Impressum</a>
        <span>·</span>
        <a href="/datenschutz">Datenschutz</a>
        <span>·</span>
        <a href="https://github.com/thosor87/fragKIm" target="_blank" rel="noopener noreferrer">Quellcode</a>
      </nav>
    </div>
  </body>
</html>`;
}

const IMPRESSUM_BODY = `
<h1>Impressum</h1>
<p class="meta">Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>
<article class="legal">
  <h2>Verantwortlich</h2>
  <p>
    Thomas Soring<br>
    Le-Corbusier-Str. 31b<br>
    26127 Oldenburg
  </p>

  <h2>Kontakt</h2>
  <p>
    E-Mail: <a href="mailto:tsoring@lilapixel.de">tsoring@lilapixel.de</a><br>
    Quellcode: <a href="https://github.com/thosor87/fragKIm" target="_blank" rel="noopener noreferrer">github.com/thosor87/fragKIm</a>
  </p>

  <h2>Zweck dieser Anwendung</h2>
  <p>
    <strong>frag KIm</strong> ist ein Proof of Concept (PoC) für eine kindersichere
    KI-gestützte Wissensauskunft, angelehnt an die Idee von fragFINN.
    Diese Instanz ist eine interne Entwicklungs-Demo, nicht für Kinder
    bestimmt und nicht für die Produktivnutzung vorgesehen. Der Zugang
    erfolgt ausschließlich per Demo-Passwort.
  </p>

  <h2>Hosting</h2>
  <p>
    Die Anwendung läuft auf der Infrastruktur von
    <strong>Vercel Inc.</strong> (440 N Barranca Avenue #4133,
    Covina, CA 91723, USA). Vercel betreibt Edge- und Function-Knoten
    weltweit; für diese Demo wird die Standard-Region des Hobby-Plans
    verwendet. Weitere Informationen zur Datenverarbeitung in der
    Datenschutzerklärung.
  </p>

  <h2>Inhalte und Quellen</h2>
  <p>
    Die in den Antworten zitierten Sachtexte stammen aus dem
    <a href="https://klexikon.zum.de/" target="_blank" rel="noopener noreferrer">Klexikon</a>
    und dem
    <a href="https://grundschulwiki.zum.de/" target="_blank" rel="noopener noreferrer">ZUM-Grundschul-Wiki</a>
    (beide CC BY-SA 4.0, herausgegeben von der ZUM e. V.).
    Eine private Sicherung des Grundschul-Wikis vor dessen Abschaltung
    im Juni 2026 wird unter
    <a href="https://github.com/thosor87/grundschulwiki-archiv" target="_blank" rel="noopener noreferrer">github.com/thosor87/grundschulwiki-archiv</a>
    bereitgestellt.
  </p>

  <h2>Haftung für Inhalte</h2>
  <p>
    Die Inhalte dieser Anwendung wurden mit größter Sorgfalt erstellt.
    Für die Richtigkeit, Vollständigkeit und Aktualität der von der
    KI generierten Antworten kann jedoch keine Gewähr übernommen werden.
    Als Diensteanbieter bin ich gemäß § 7 Abs. 1 DDG für eigene Inhalte
    nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG
    bin ich nicht verpflichtet, übermittelte oder gespeicherte fremde
    Informationen zu überwachen.
  </p>

  <h2>Haftung für Links</h2>
  <p>
    Diese Anwendung verlinkt auf externe Websites Dritter, auf deren
    Inhalte ich keinen Einfluss habe. Für die Inhalte der verlinkten
    Seiten ist stets der jeweilige Anbieter verantwortlich.
  </p>

  <h2>Urheberrecht</h2>
  <p>
    Der Quellcode der Anwendung steht unter MIT-Lizenz (siehe Repository).
    Die zitierten Sachtexte stehen unter CC BY-SA 4.0 ihrer Original-Quellen.
    Die Marke „frag KIm" und das Lampen-Logo sind freie eigene Schöpfung
    für diesen PoC.
  </p>

  <h2>Datenschutz</h2>
  <p>
    Informationen zur Verarbeitung personenbezogener Daten finden Sie
    in der <a href="/datenschutz">Datenschutzerklärung</a>.
  </p>
</article>
`;

const DATENSCHUTZ_BODY = `
<h1>Datenschutzerklärung</h1>
<p class="meta">Stand: ${new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long" })}</p>
<article class="legal">

  <h2>1. Verantwortliche Stelle</h2>
  <p>
    Thomas Soring<br>
    Le-Corbusier-Str. 31b<br>
    26127 Oldenburg<br>
    E-Mail: <a href="mailto:tsoring@lilapixel.de">tsoring@lilapixel.de</a>
  </p>

  <h2>2. Zweck und Status der Anwendung</h2>
  <p>
    <strong>frag KIm</strong> ist ein Proof of Concept (PoC). Die hier
    erreichbare Instanz ist eine interne Entwicklungs-Demo,
    ausschließlich passwortgeschützt zugänglich und ausdrücklich
    <strong>nicht</strong> für die Nutzung durch Kinder bestimmt. Ein
    Wechsel in einen produktiven Betrieb mit Kinder-Nutzern setzt eine
    Datenschutz-Folgenabschätzung (DSFA), Auftragsverarbeitungsverträge
    mit allen Dienstleistern und eine geeignete Trägerschaft voraus,
    die zum jetzigen Zeitpunkt nicht vorliegen.
  </p>

  <h2>3. Hosting (Vercel)</h2>
  <p>
    Die Anwendung wird auf der Infrastruktur von <strong>Vercel Inc.</strong>
    (USA) betrieben. Beim Aufruf werden technisch notwendige Daten
    (IP-Adresse, Zeitstempel, Browser-User-Agent, abgerufene URL)
    verarbeitet. Vercel speichert diese Server-Logs für eine begrenzte
    Zeit zur Sicherstellung des Betriebs.
  </p>
  <p>
    Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
    Interesse am störungsfreien Betrieb der Anwendung).
    Datenübermittlung in die USA erfolgt auf Basis der EU-US Data
    Privacy Framework Vereinbarungen, denen Vercel beigetreten ist.
    Weitere Informationen:
    <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel Privacy Policy</a>.
  </p>

  <h2>4. Cookies und Session</h2>
  <p>
    Diese Anwendung setzt ein einziges Cookie:
  </p>
  <ul>
    <li>
      <strong>fragkim_session</strong> – technisch notwendiges
      HTTP-only-Cookie, das den Demo-Login speichert. Gültigkeit:
      30 Tage. Kein Tracking, keine Profilbildung. Rechtsgrundlage:
      Art. 6 Abs. 1 lit. f DSGVO bzw. § 25 Abs. 2 Nr. 2 TTDSG
      (unbedingt erforderliches Cookie zur Bereitstellung des Dienstes).
    </li>
  </ul>

  <h2>5. Verarbeitung der eingegebenen Fragen</h2>
  <p>
    Wenn Sie eine Frage in den Chat eingeben, wird diese an folgende
    Drittanbieter übermittelt, um eine Antwort zu generieren:
  </p>
  <ul>
    <li>
      <strong>Mistral AI</strong> (Paris, Frankreich) – als
      Sprachmodell-Anbieter zur Generierung der Antwort. Anbieter mit
      Hauptsitz in der EU.
      <a href="https://mistral.ai/terms#privacy-policy" target="_blank" rel="noopener noreferrer">Mistral Privacy Policy</a>
    </li>
    <li>
      <strong>klexikon.zum.de</strong> und ggf. <strong>grundschulwiki.zum.de</strong>
      (ZUM e. V., Deutschland) – zur Live-Abfrage von Klexikon-Artikeln
      über die MediaWiki-API. Es wird nur die umformulierte Suchanfrage
      gesendet.
    </li>
    <li>
      <strong>raw.githubusercontent.com</strong> (GitHub Inc., USA) –
      zur Anlieferung archivierter Grundschulwiki-Inhalte aus dem
      öffentlichen Repository
      <a href="https://github.com/thosor87/grundschulwiki-archiv" target="_blank" rel="noopener noreferrer">grundschulwiki-archiv</a>.
    </li>
  </ul>
  <p>
    Eingegebene Fragen werden <strong>nicht dauerhaft gespeichert</strong>.
    Der Browser hält den aktuellen Chat-Verlauf nur im Arbeitsspeicher;
    ein Klick auf „Neues Gespräch" oder ein Browser-Reload löscht den
    Verlauf.
  </p>

  <h2>6. Optionale Sprachfunktionen (ElevenLabs)</h2>
  <p>
    Wenn Sie den Vorlesen-Knopf oder den Mikrofon-Knopf nutzen, werden
    der Antworttext bzw. eine Audio-Aufnahme an <strong>ElevenLabs Inc.</strong>
    (USA) übermittelt, um eine Sprachausgabe oder Transkription zu
    erzeugen. ElevenLabs verarbeitet die übermittelten Daten auf
    Grundlage des dortigen Datenschutz-Vertrags.
  </p>
  <p>
    <a href="https://elevenlabs.io/privacy" target="_blank" rel="noopener noreferrer">ElevenLabs Privacy Policy</a>.
    Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch
    aktive Klick-Handlung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
    Interesse an den Demo-Funktionen).
  </p>

  <h2>7. Keine Webanalyse, kein Tracking</h2>
  <p>
    Diese Anwendung nutzt <strong>keine Webanalyse-Tools, keine
    Tracking-Cookies, keine Pixel und keine Drittanbieter-Werbung</strong>.
    Es werden keine Profile gebildet.
  </p>

  <h2>8. SSL/TLS-Verschlüsselung</h2>
  <p>
    Die Verbindung zur Anwendung erfolgt ausschließlich TLS-verschlüsselt
    (HTTPS), bereitgestellt durch Vercel.
  </p>

  <h2>9. Ihre Rechte als betroffene Person</h2>
  <p>Sie haben folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
  <ul>
    <li><strong>Auskunftsrecht</strong> (Art. 15 DSGVO)</li>
    <li><strong>Recht auf Berichtigung</strong> (Art. 16 DSGVO)</li>
    <li><strong>Recht auf Löschung</strong> (Art. 17 DSGVO)</li>
    <li><strong>Recht auf Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)</li>
    <li><strong>Recht auf Datenübertragbarkeit</strong> (Art. 20 DSGVO)</li>
    <li><strong>Widerspruchsrecht</strong> (Art. 21 DSGVO)</li>
    <li><strong>Widerruf einer Einwilligung</strong> (Art. 7 Abs. 3 DSGVO)</li>
  </ul>
  <p>
    Zudem haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde
    zu beschweren. Zuständig:
  </p>
  <p>
    Die Landesbeauftragte für den Datenschutz Niedersachsen<br>
    Prinzenstraße 5, 30159 Hannover<br>
    <a href="https://www.lfd.niedersachsen.de" target="_blank" rel="noopener noreferrer">www.lfd.niedersachsen.de</a>
  </p>

  <h2>10. Impressum</h2>
  <p>
    Das vollständige <a href="/impressum">Impressum</a> mit allen
    Pflichtangaben gemäß § 5 DDG.
  </p>

  <h2>11. Aktualität dieser Datenschutzerklärung</h2>
  <p>
    Diese Datenschutzerklärung ist aktuell gültig und wird aktualisiert,
    sobald sich Datenverarbeitungs-Prozesse oder Dienstleister-Auswahl
    ändern.
  </p>
</article>
`;

export function registerLegalPages(app: FastifyInstance): void {
  app.get("/impressum", async (_req, reply) => {
    reply.type("text/html").send(pageShell("Impressum", IMPRESSUM_BODY));
    return reply;
  });
  app.get("/datenschutz", async (_req, reply) => {
    reply.type("text/html").send(pageShell("Datenschutz", DATENSCHUTZ_BODY));
    return reply;
  });
}
