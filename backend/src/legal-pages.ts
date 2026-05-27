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
        <a href="/ueber">Für Eltern</a>
        <span>·</span>
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
    Der Quellcode der Anwendung steht unter CC BY-NC-SA 4.0 (siehe Repository):
    keine kommerzielle Nutzung, Weitergabe von Änderungen unter derselben Lizenz.
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
      Sprachmodell-Anbieter zur Generierung der Antwort sowie zur
      automatisierten Sicherheitsprüfung der Eingabe und der Antwort
      (Erkennung kinder­gefährdender Inhalte). Anbieter mit Hauptsitz in
      der EU.
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

  <h2>7. Webanalyse (Umami)</h2>
  <p>
    Diese Anwendung nutzt <strong>Umami</strong>, eine datenschutzfreundliche,
    selbst gehostete Webanalyse-Software, betrieben auf eigenem Server
    unter <code>analytics.soring.de</code>.
  </p>
  <p>Umami ist so konfiguriert, dass:</p>
  <ul>
    <li><strong>keine Cookies</strong> gesetzt werden</li>
    <li><strong>keine personenbezogenen Daten</strong> erfasst oder gespeichert werden</li>
    <li><strong>kein geräteübergreifendes Tracking</strong> stattfindet</li>
    <li>IP-Adressen <strong>nicht</strong> gespeichert werden</li>
    <li>die Skripte <strong>nicht</strong> auf den Pflichtseiten (Impressum,
      Datenschutz) geladen werden</li>
  </ul>
  <p>
    Es werden ausschließlich anonymisierte, aggregierte Nutzungsstatistiken
    erhoben (Seitenaufrufe, Browser, Land). Ein Rückschluss auf einzelne
    Personen ist nicht möglich. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
    (berechtigtes Interesse an der Analyse der Demo-Nutzung).
  </p>
  <p>
    Über die Webanalyse hinaus nutzt diese Anwendung
    <strong>keine weiteren Tracking-Tools, keine Tracking-Cookies, keine
    Pixel und keine Drittanbieter-Werbung</strong>. Es werden keine
    Nutzerprofile gebildet.
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

// "Für Eltern"-Seite, mehrsprachig. Inhalt für Eltern/Lehrkräfte, nicht für
// Kinder. Sprache per ?lang=; Default Deutsch. Nicht-deutsche Fassungen sind
// maschinell und sollten von Muttersprachlern geprüft werden.
const UEBER_LANGS = ["de", "en", "tr", "ru", "uk", "ar"] as const;
type UeberLang = (typeof UEBER_LANGS)[number];

type UeberContent = {
  dir: "ltr" | "rtl";
  title: string;
  banner: string;
  back: string;
  nav: { about: string; imprint: string; privacy: string; source: string };
  body: string;
};

const UEBER: Record<UeberLang, UeberContent> = {
  de: {
    dir: "ltr",
    title: "Für Eltern",
    banner: "Interne Entwicklungs-Demo. Nicht für Kinder bestimmt.",
    back: "← frag KIm",
    nav: { about: "Für Eltern", imprint: "Impressum", privacy: "Datenschutz", source: "Quellcode" },
    body: `
<h1>Für Eltern und Lehrkräfte</h1>
<p class="meta">Was frag KIm ist, was es macht und was bewusst nicht.</p>
<article class="legal">
  <p><strong>frag KIm</strong> ist eine kindersichere Wissensauskunft, angelehnt an die Idee von fragFINN. Ein Kind stellt eine Frage und bekommt eine kindgerechte Antwort, die aus geprüften Kinderquellen abgeleitet ist (<a href="https://klexikon.zum.de/" target="_blank" rel="noopener noreferrer">Klexikon</a> und Grundschulwiki). Gedacht für die direkte, eigenständige Nutzung durch jüngere Kinder, zu Hause oder in der Freiarbeit.</p>
  <h2>Was frag KIm macht</h2>
  <ul>
    <li>Sachfragen beantworten („Was ist ein Vulkan?") in einfacher, freundlicher Sprache.</li>
    <li>Die Antwort auf geprüfte Quellen stützen und diese unter der Antwort anzeigen.</li>
    <li>Ehrlich „Das weiß ich nicht" sagen, statt etwas zu erfinden.</li>
    <li>Auf Wunsch vorlesen und Spracheingabe verstehen.</li>
    <li>In mehreren Sprachen antworten.</li>
  </ul>
  <h2>Was frag KIm bewusst nicht macht</h2>
  <ul>
    <li><strong>Kein künstlicher Freund.</strong> frag KIm gibt sich nicht als Person oder Wesen aus, hat keine Gefühle und führt keinen Smalltalk. Das ist die bewusste Abgrenzung zu Companion-Apps wie Replika oder Character.ai, die für Kinder problematisch sind, weil sie eine Beziehung vortäuschen.</li>
    <li><strong>Kein offener Chatbot.</strong> Es schreibt keine Aufsätze oder Hausaufgaben, erzeugt keine Bilder und berät nicht in medizinischen, seelischen oder rechtlichen Fragen, sondern verweist an Erwachsene.</li>
    <li><strong>Keine Überwachung.</strong> Es gibt keine Lehrer- oder Eltern-Funktion, die mitliest. Gespräche werden nicht gespeichert.</li>
    <li><strong>Keine Werbung, keine Profile, kein Verkauf von Daten.</strong></li>
  </ul>
  <h2>Wie wir auf Sicherheit achten</h2>
  <p>Weil hier keine Lehrkraft mitliest, sitzt die Sicherheit im System selbst, in mehreren Schichten: Bestimmte Themen werden noch vor der KI abgefangen, und sowohl die Frage als auch die Antwort werden automatisch geprüft. Deutet eine Frage auf eine Notlage hin (etwa Gedanken, sich selbst zu schaden), antwortet frag KIm nicht mit Wissen, sondern bittet das Kind, mit einer erwachsenen Person zu sprechen, und nennt die <a href="https://www.nummergegenkummer.de/" target="_blank" rel="noopener noreferrer">Nummer gegen Kummer</a> (116 111).</p>
  <h2>Was mit den Eingaben passiert</h2>
  <p>Es werden keine Konten angelegt und keine Gespräche gespeichert. Der Verlauf lebt nur im Browser und ist nach „Neues Gespräch" oder einem Neuladen weg. Das Sprachmodell läuft bei einem EU-Anbieter. Einzelheiten in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
  <h2>Ein ehrlicher Hinweis</h2>
  <p>frag KIm ist ein Proof of Concept (eine frühe Demo) und macht Fehler. Es ersetzt keine erwachsene Begleitung. Wir empfehlen, jüngere Kinder zu begleiten und Antworten gemeinsam einzuordnen. Rückmeldungen gern über das <a href="/impressum">Impressum</a>.</p>
</article>`,
  },
  en: {
    dir: "ltr",
    title: "For parents",
    banner: "Internal development demo. Not intended for children.",
    back: "← frag KIm",
    nav: { about: "For parents", imprint: "Imprint", privacy: "Privacy", source: "Source code" },
    body: `
<h1>For parents and teachers</h1>
<p class="meta">What frag KIm is, what it does and what it deliberately does not.</p>
<article class="legal">
  <p><strong>frag KIm</strong> is a child-safe knowledge assistant, inspired by the idea of fragFINN. A child asks a question and gets a child-friendly answer derived from trusted children's sources (<a href="https://klexikon.zum.de/" target="_blank" rel="noopener noreferrer">Klexikon</a> and Grundschulwiki). It is meant for direct, independent use by younger children, at home or in self-study.</p>
  <h2>What frag KIm does</h2>
  <ul>
    <li>Answers factual questions ("What is a volcano?") in simple, friendly language.</li>
    <li>Bases the answer on trusted sources and shows them below the answer.</li>
    <li>Honestly says "I don't know" instead of making things up.</li>
    <li>Reads answers aloud and understands voice input on request.</li>
    <li>Answers in several languages.</li>
  </ul>
  <h2>What frag KIm deliberately does not do</h2>
  <ul>
    <li><strong>No artificial friend.</strong> frag KIm does not pose as a person or being, has no feelings and makes no small talk. This is the deliberate distinction from companion apps like Replika or Character.ai, which are problematic for children because they fake a relationship.</li>
    <li><strong>No open chatbot.</strong> It does not write essays or homework, does not generate images and does not give medical, psychological or legal advice; it refers to adults instead.</li>
    <li><strong>No monitoring.</strong> There is no teacher or parent feature that reads along. Conversations are not stored.</li>
    <li><strong>No advertising, no profiles, no selling of data.</strong></li>
  </ul>
  <h2>How we keep it safe</h2>
  <p>Because no teacher reads along here, safety is built into the system itself, in several layers: certain topics are caught before the AI, and both the question and the answer are checked automatically. If a question suggests distress (for example thoughts of self-harm), frag KIm does not answer with knowledge but asks the child to talk to a trusted adult and gives the German child helpline <a href="https://www.nummergegenkummer.de/" target="_blank" rel="noopener noreferrer">Nummer gegen Kummer</a> (116 111).</p>
  <h2>What happens to the input</h2>
  <p>No accounts are created and no conversations are stored. The history lives only in the browser and is gone after "New conversation" or a reload. The language model runs with an EU provider. Details in the <a href="/datenschutz">privacy policy</a>.</p>
  <h2>An honest note</h2>
  <p>frag KIm is a proof of concept (an early demo) and makes mistakes. It does not replace adult guidance. We recommend accompanying younger children and discussing answers together. Feedback is welcome via the <a href="/impressum">imprint</a>.</p>
</article>`,
  },
  tr: {
    dir: "ltr",
    title: "Veliler için",
    banner: "Dahili geliştirme demosu. Çocuklar için tasarlanmamıştır.",
    back: "← frag KIm",
    nav: { about: "Veliler için", imprint: "Künye", privacy: "Gizlilik", source: "Kaynak kodu" },
    body: `
<h1>Veliler ve öğretmenler için</h1>
<p class="meta">frag KIm nedir, ne yapar ve bilinçli olarak ne yapmaz.</p>
<article class="legal">
  <p><strong>frag KIm</strong>, fragFINN fikrinden esinlenen, çocuklar için güvenli bir bilgi yardımcısıdır. Çocuk bir soru sorar ve güvenilir çocuk kaynaklarından (<a href="https://klexikon.zum.de/" target="_blank" rel="noopener noreferrer">Klexikon</a> ve Grundschulwiki) türetilmiş, çocuğa uygun bir yanıt alır. Daha küçük çocukların evde veya serbest çalışmada doğrudan, kendi başlarına kullanması için düşünülmüştür.</p>
  <h2>frag KIm ne yapar</h2>
  <ul>
    <li>Bilgi sorularını ("Volkan nedir?") basit ve dostça bir dille yanıtlar.</li>
    <li>Yanıtı güvenilir kaynaklara dayandırır ve bunları yanıtın altında gösterir.</li>
    <li>Bir şey uydurmak yerine dürüstçe "Bilmiyorum" der.</li>
    <li>İstenirse yanıtı sesli okur ve sesli girişi anlar.</li>
    <li>Birkaç dilde yanıt verir.</li>
  </ul>
  <h2>frag KIm bilinçli olarak ne yapmaz</h2>
  <ul>
    <li><strong>Yapay bir arkadaş değildir.</strong> frag KIm kendini bir kişi veya varlık gibi göstermez, duyguları yoktur ve sohbet etmez. Bu, çocuklar için sorunlu olan Replika veya Character.ai gibi arkadaş uygulamalarından bilinçli bir ayrımdır, çünkü bunlar bir ilişki varmış gibi yapar.</li>
    <li><strong>Açık bir sohbet botu değildir.</strong> Kompozisyon veya ödev yazmaz, görsel üretmez ve tıbbi, ruhsal veya hukuki danışmanlık vermez; bunun yerine yetişkinlere yönlendirir.</li>
    <li><strong>İzleme yoktur.</strong> Birlikte okuyan bir öğretmen veya veli işlevi yoktur. Görüşmeler kaydedilmez.</li>
    <li><strong>Reklam yok, profil yok, veri satışı yok.</strong></li>
  </ul>
  <h2>Güvenliği nasıl sağlıyoruz</h2>
  <p>Burada birlikte okuyan bir öğretmen olmadığı için güvenlik sistemin kendisinde, birkaç katmanda yer alır: belirli konular yapay zekadan önce yakalanır ve hem soru hem de yanıt otomatik olarak denetlenir. Bir soru sıkıntıya işaret ediyorsa (örneğin kendine zarar verme düşünceleri), frag KIm bilgiyle yanıt vermez, çocuktan güvendiği bir yetişkinle konuşmasını ister ve Alman çocuk yardım hattını <a href="https://www.nummergegenkummer.de/" target="_blank" rel="noopener noreferrer">Nummer gegen Kummer</a> (116 111) verir.</p>
  <h2>Girdilere ne olur</h2>
  <p>Hesap oluşturulmaz ve görüşmeler saklanmaz. Geçmiş yalnızca tarayıcıda kalır ve "Yeni sohbet" ya da yeniden yükleme sonrası kaybolur. Dil modeli bir AB sağlayıcısında çalışır. Ayrıntılar <a href="/datenschutz">gizlilik politikasında</a>.</p>
  <h2>Dürüst bir not</h2>
  <p>frag KIm bir kavram kanıtıdır (erken bir demo) ve hata yapar. Yetişkin rehberliğinin yerini tutmaz. Daha küçük çocuklara eşlik etmenizi ve yanıtları birlikte değerlendirmenizi öneririz. Geri bildirim için <a href="/impressum">künye</a>.</p>
</article>`,
  },
  ru: {
    dir: "ltr",
    title: "Для родителей",
    banner: "Внутренняя демоверсия для разработки. Не предназначена для детей.",
    back: "← frag KIm",
    nav: { about: "Для родителей", imprint: "Импрессум", privacy: "Конфиденциальность", source: "Исходный код" },
    body: `
<h1>Для родителей и учителей</h1>
<p class="meta">Что такое frag KIm, что он делает и чего сознательно не делает.</p>
<article class="legal">
  <p><strong>frag KIm</strong> — это безопасный для детей помощник по знаниям, вдохновлённый идеей fragFINN. Ребёнок задаёт вопрос и получает понятный детям ответ, основанный на проверенных детских источниках (<a href="https://klexikon.zum.de/" target="_blank" rel="noopener noreferrer">Klexikon</a> и Grundschulwiki). Он предназначен для прямого, самостоятельного использования младшими детьми — дома или при самостоятельной работе.</p>
  <h2>Что делает frag KIm</h2>
  <ul>
    <li>Отвечает на вопросы о фактах («Что такое вулкан?») простым, дружелюбным языком.</li>
    <li>Опирается на проверенные источники и показывает их под ответом.</li>
    <li>Честно говорит «Я не знаю» вместо того, чтобы выдумывать.</li>
    <li>По желанию читает ответ вслух и понимает голосовой ввод.</li>
    <li>Отвечает на нескольких языках.</li>
  </ul>
  <h2>Чего frag KIm сознательно не делает</h2>
  <ul>
    <li><strong>Не искусственный друг.</strong> frag KIm не выдаёт себя за человека или существо, не имеет чувств и не ведёт светских бесед. Это сознательное отличие от приложений-компаньонов вроде Replika или Character.ai, которые опасны для детей, потому что имитируют отношения.</li>
    <li><strong>Не открытый чат-бот.</strong> Он не пишет сочинения или домашние задания, не создаёт изображения и не консультирует по медицинским, психологическим или правовым вопросам, а направляет ко взрослым.</li>
    <li><strong>Нет слежки.</strong> Нет функции учителя или родителя, которая бы читала переписку. Разговоры не сохраняются.</li>
    <li><strong>Нет рекламы, нет профилей, нет продажи данных.</strong></li>
  </ul>
  <h2>Как мы заботимся о безопасности</h2>
  <p>Поскольку здесь никто из учителей не читает переписку, безопасность встроена в саму систему, в несколько слоёв: определённые темы перехватываются ещё до ИИ, и как вопрос, так и ответ проверяются автоматически. Если вопрос указывает на кризис (например, мысли причинить себе вред), frag KIm отвечает не знанием, а просит ребёнка поговорить со взрослым, которому он доверяет, и даёт немецкую детскую линию помощи <a href="https://www.nummergegenkummer.de/" target="_blank" rel="noopener noreferrer">Nummer gegen Kummer</a> (116 111).</p>
  <h2>Что происходит с введёнными данными</h2>
  <p>Учётные записи не создаются, разговоры не сохраняются. История живёт только в браузере и исчезает после «Новый разговор» или перезагрузки. Языковая модель работает у поставщика в ЕС. Подробности в <a href="/datenschutz">политике конфиденциальности</a>.</p>
  <h2>Честное замечание</h2>
  <p>frag KIm — это прототип (ранняя демоверсия), и он делает ошибки. Он не заменяет сопровождение взрослыми. Мы рекомендуем сопровождать младших детей и обсуждать ответы вместе. Обратная связь — через <a href="/impressum">импрессум</a>.</p>
</article>`,
  },
  uk: {
    dir: "ltr",
    title: "Для батьків",
    banner: "Внутрішня демоверсія для розробки. Не призначена для дітей.",
    back: "← frag KIm",
    nav: { about: "Для батьків", imprint: "Імпресум", privacy: "Конфіденційність", source: "Вихідний код" },
    body: `
<h1>Для батьків і вчителів</h1>
<p class="meta">Що таке frag KIm, що він робить і чого свідомо не робить.</p>
<article class="legal">
  <p><strong>frag KIm</strong> — це безпечний для дітей помічник зі знань, натхненний ідеєю fragFINN. Дитина ставить запитання й отримує зрозумілу дітям відповідь, що ґрунтується на перевірених дитячих джерелах (<a href="https://klexikon.zum.de/" target="_blank" rel="noopener noreferrer">Klexikon</a> і Grundschulwiki). Він призначений для прямого, самостійного використання молодшими дітьми — удома або під час самостійної роботи.</p>
  <h2>Що робить frag KIm</h2>
  <ul>
    <li>Відповідає на запитання про факти («Що таке вулкан?») простою, дружньою мовою.</li>
    <li>Спирається на перевірені джерела й показує їх під відповіддю.</li>
    <li>Чесно каже «Я не знаю» замість того, щоб вигадувати.</li>
    <li>За бажанням читає відповідь уголос і розуміє голосове введення.</li>
    <li>Відповідає кількома мовами.</li>
  </ul>
  <h2>Чого frag KIm свідомо не робить</h2>
  <ul>
    <li><strong>Не штучний друг.</strong> frag KIm не видає себе за людину чи істоту, не має почуттів і не веде світських бесід. Це свідома відмінність від застосунків-компаньйонів на кшталт Replika чи Character.ai, які небезпечні для дітей, бо імітують стосунки.</li>
    <li><strong>Не відкритий чат-бот.</strong> Він не пише твори чи домашні завдання, не створює зображень і не консультує з медичних, психологічних чи правових питань, а спрямовує до дорослих.</li>
    <li><strong>Немає стеження.</strong> Немає функції вчителя чи батьків, яка б читала листування. Розмови не зберігаються.</li>
    <li><strong>Немає реклами, профілів, продажу даних.</strong></li>
  </ul>
  <h2>Як ми дбаємо про безпеку</h2>
  <p>Оскільки тут ніхто з учителів не читає листування, безпека вбудована в саму систему, у кілька шарів: певні теми перехоплюються ще до ШІ, і як запитання, так і відповідь перевіряються автоматично. Якщо запитання вказує на кризу (наприклад, думки завдати собі шкоди), frag KIm відповідає не знанням, а просить дитину поговорити з дорослим, якому вона довіряє, і дає німецьку дитячу лінію довіри <a href="https://www.nummergegenkummer.de/" target="_blank" rel="noopener noreferrer">Nummer gegen Kummer</a> (116 111).</p>
  <h2>Що відбувається з введеними даними</h2>
  <p>Облікові записи не створюються, розмови не зберігаються. Історія живе лише у браузері й зникає після «Нова розмова» або перезавантаження. Мовна модель працює в постачальника в ЄС. Деталі в <a href="/datenschutz">політиці конфіденційності</a>.</p>
  <h2>Чесне зауваження</h2>
  <p>frag KIm — це прототип (рання демоверсія), і він робить помилки. Він не замінює супровід дорослих. Радимо супроводжувати молодших дітей і обговорювати відповіді разом. Відгуки — через <a href="/impressum">імпресум</a>.</p>
</article>`,
  },
  ar: {
    dir: "rtl",
    title: "لأولياء الأمور",
    banner: "نسخة تجريبية داخلية للتطوير. ليست مخصّصة للأطفال.",
    back: "← frag KIm",
    nav: { about: "لأولياء الأمور", imprint: "بيانات الناشر", privacy: "الخصوصية", source: "الشيفرة المصدرية" },
    body: `
<h1>لأولياء الأمور والمعلّمين</h1>
<p class="meta">ما هو frag KIm، وماذا يفعل، وما الذي لا يفعله عن قصد.</p>
<article class="legal">
  <p><strong>frag KIm</strong> مساعد معرفي آمن للأطفال، مستوحى من فكرة fragFINN. يطرح الطفل سؤالًا فيحصل على إجابة مناسبة للأطفال مستمدّة من مصادر أطفال موثوقة (<a href="https://klexikon.zum.de/" target="_blank" rel="noopener noreferrer">Klexikon</a> وGrundschulwiki). وهو مُعدّ للاستخدام المباشر والمستقل من قِبل الأطفال الأصغر سنًّا، في المنزل أو أثناء العمل الحرّ.</p>
  <h2>ماذا يفعل frag KIm</h2>
  <ul>
    <li>يجيب عن الأسئلة المعرفية («ما هو البركان؟») بلغة بسيطة وودودة.</li>
    <li>يبني الإجابة على مصادر موثوقة ويعرضها أسفل الإجابة.</li>
    <li>يقول بصدق «لا أعرف» بدلًا من اختلاق المعلومات.</li>
    <li>يقرأ الإجابة بصوت عالٍ ويفهم الإدخال الصوتي عند الطلب.</li>
    <li>يجيب بعدّة لغات.</li>
  </ul>
  <h2>ما الذي لا يفعله frag KIm عن قصد</h2>
  <ul>
    <li><strong>ليس صديقًا اصطناعيًّا.</strong> لا يدّعي frag KIm أنه شخص أو كائن، وليست له مشاعر، ولا يجري أحاديث جانبية. هذا تمييز مقصود عن تطبيقات الرفيق مثل Replika أو Character.ai، التي تمثّل خطرًا على الأطفال لأنها تتظاهر بعلاقة.</li>
    <li><strong>ليس روبوت محادثة مفتوحًا.</strong> لا يكتب مقالات أو واجبات، ولا يولّد صورًا، ولا يقدّم استشارات طبية أو نفسية أو قانونية، بل يحيل إلى البالغين.</li>
    <li><strong>لا مراقبة.</strong> لا توجد ميزة للمعلّم أو ولي الأمر تقرأ المحادثات. ولا تُحفظ المحادثات.</li>
    <li><strong>لا إعلانات، ولا ملفّات تعريف، ولا بيع للبيانات.</strong></li>
  </ul>
  <h2>كيف نحافظ على الأمان</h2>
  <p>لأنه لا يوجد معلّم يقرأ المحادثات هنا، فإن الأمان مدمج في النظام نفسه على عدّة طبقات: تُلتقط مواضيع معيّنة قبل الذكاء الاصطناعي، ويُفحص كلٌّ من السؤال والإجابة تلقائيًّا. وإذا أشار سؤال إلى ضائقة (مثل أفكار إيذاء النفس)، لا يردّ frag KIm بالمعرفة، بل يطلب من الطفل التحدّث إلى شخص بالغ يثق به، ويقدّم خطّ مساعدة الأطفال الألماني <a href="https://www.nummergegenkummer.de/" target="_blank" rel="noopener noreferrer">Nummer gegen Kummer</a> (116 111).</p>
  <h2>ماذا يحدث للمُدخلات</h2>
  <p>لا تُنشأ حسابات ولا تُحفظ المحادثات. يبقى السجلّ في المتصفّح فقط ويختفي بعد «محادثة جديدة» أو إعادة التحميل. ويعمل النموذج اللغوي لدى مزوّد في الاتحاد الأوروبي. التفاصيل في <a href="/datenschutz">سياسة الخصوصية</a>.</p>
  <h2>ملاحظة صادقة</h2>
  <p>frag KIm نموذج أوّلي (نسخة تجريبية مبكّرة) ويرتكب أخطاء. وهو لا يحلّ محلّ مرافقة البالغين. ننصح بمرافقة الأطفال الأصغر سنًّا ومناقشة الإجابات معًا. ملاحظاتكم مرحّب بها عبر <a href="/impressum">بيانات الناشر</a>.</p>
</article>`,
  },
};

function renderUeber(langRaw: string): string {
  const lang: UeberLang = (UEBER_LANGS as readonly string[]).includes(langRaw)
    ? (langRaw as UeberLang)
    : "de";
  const u = UEBER[lang];
  return `<!doctype html>
<html lang="${lang}" dir="${u.dir}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>${u.title} — frag KIm</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <meta name="theme-color" content="#2bb3a3">
    <style>${COMMON_STYLES}</style>
  </head>
  <body>
    <div class="banner">${u.banner}</div>
    <div class="wrap">
      <div class="crumbs"><a href="/">${u.back}</a></div>
      ${u.body}
      <nav class="footer-nav">
        <a href="/ueber?lang=${lang}">${u.nav.about}</a>
        <span>·</span>
        <a href="/impressum">${u.nav.imprint}</a>
        <span>·</span>
        <a href="/datenschutz">${u.nav.privacy}</a>
        <span>·</span>
        <a href="https://github.com/thosor87/fragKIm" target="_blank" rel="noopener noreferrer">${u.nav.source}</a>
      </nav>
    </div>
  </body>
</html>`;
}

export function registerLegalPages(app: FastifyInstance): void {
  app.get<{ Querystring: { lang?: string } }>("/ueber", async (req, reply) => {
    reply.type("text/html").send(renderUeber((req.query?.lang ?? "de").toString()));
    return reply;
  });
  app.get("/impressum", async (_req, reply) => {
    reply.type("text/html").send(pageShell("Impressum", IMPRESSUM_BODY));
    return reply;
  });
  app.get("/datenschutz", async (_req, reply) => {
    reply.type("text/html").send(pageShell("Datenschutz", DATENSCHUTZ_BODY));
    return reply;
  });
}
