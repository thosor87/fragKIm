// Drei Filter, die VOR der RAG-Pipeline greifen:
//  1) Sensible Themen → Eskalation, feste Antwort mit Nummer gegen Kummer
//  2) Off-Topic / Companion-Versuche → höflich abblocken, kein LLM
//  3) Begrüßungen alleine → kurzer Hinweis, dass das hier eine Wissens-DB ist
//
// Echte Klassifikation kommt in Phase 2; das hier reicht für den PoC.

// ---------- 1) Sensible Themen ----------------------------------------------

// Immer-sensibel: Begriffe ohne harmlose Sachfrage-Lesart. "Was ist Suizid?"
// darf ruhig eskalieren — lieber einmal zu vorsichtig. Begriffe MIT
// Sachfrage-Lesart (magersucht, schläg, gemobbt, sterben) stehen NICHT hier,
// sondern in der Ich-Bezug-Ko-Okkurrenz weiter unten.
export const SENSITIVE_TRIGGERS: string[] = [
  "suizid", "selbstmord", "umbringen", "umbring", "sterben wollen",
  "nicht mehr leben", "leben beenden",
  "bringe mich um", "bring mich um", "mich umzubringen",
  "bringe ich mich um", "bring ich mich um", "bringen mich um",
  "töte mich", "mich töten", "lieber tot",
  "selbstverletzung", "schneide mich", "tu mir weh", "tue mir weh",
  "vergewaltig", "missbrauch", "wird verprügelt",
  "gewalt zuhause", "angst vor papa", "angst vor mama", "angst vor meinem",
  // Mobbing-Opfer: Phrasen, die das "mich" schon enthalten (selbst-bezogen)
  "hassen mich", "keiner mag mich", "niemand mag mich", "lachen mich aus",
];

// Ko-Okkurrenz: Begriffe, die nur bei Ich-Bezug sensibel sind. Faengt
// persönliche Notlagen ("ich nehme Drogen", "ich werde gemobbt", "ich will
// sterben"), ohne bei reinen Wissensfragen ("Was sind Drogen?", "Was ist
// Magersucht?", "Warum werden Kinder gemobbt?") anzuschlagen.
// b = /./ heißt: das erste Muster reicht, der Ich-Bezug ist die eigentliche
// Bedingung (siehe FIRST_PERSON-Gate in isSensitive).
const SENSITIVE_COOCCURRENCE: [RegExp, RegExp][] = [
  [/\bdrogen?\b/, /nehm|konsumier|spritz|kauf/],
  [/kokain|heroin|crystal\s*meth|kiff/, /./],
  [/\balkohol\b/, /trink|trunk|sauf|betrink|besoff/],
  // Selbstverletzung / Lebensmüdigkeit (nur mit Ich-Bezug)
  [/\b(sterben|tot)\b/, /./],
  [/\britz\w*/, /./],
  // Essstörung (nur mit Ich-Bezug; "Was ist Magersucht?" bleibt frei)
  [/\b(magersucht|bulimie|ess.?störung)\b/, /./],
  [/\b(kotz\w*|erbrech\w*)\b/, /./],
  // Mobbing-Opfer (nur mit Ich-Bezug; "Warum werden Kinder gemobbt?" frei)
  [/\b(gemobbt|mobben|hänsel\w*|gehänselt|ausgelacht)\b/, /./],
  // Körperliche Gewalt gegen das Kind ("mein Papa schlägt mich")
  [/(schläg|schlägt|geschlagen)/, /./],
];

// Substanz-/Selbst-Ko-Okkurrenz greift nur bei Ich-Bezug, damit reine
// Wissensfragen ("Warum trinkt man keinen Alkohol?", "Wie tötet eine Spinne?")
// nicht fälschlich eskalieren.
const FIRST_PERSON = /\bich\b|\bmir\b|\bmich\b|\bmein/;

// Die festen Antwort-Texte (Eskalation, Harm, Off-Topic, Begrüßung) leben
// jetzt mehrsprachig in responses.ts und werden von der Pipeline anhand der
// UI-Sprache ausgewählt. Hier nur noch die Erkennungs-Logik.

export function isSensitive(query: string): boolean {
  const q = query.toLowerCase();
  if (SENSITIVE_TRIGGERS.some((t) => q.includes(t))) return true;
  if (FIRST_PERSON.test(q)) {
    for (const [a, b] of SENSITIVE_COOCCURRENCE) {
      if (a.test(q) && b.test(q)) return true;
    }
  }
  return false;
}

// ---------- 1b) Schaden an Dritten / Vandalismus / illegale Handlungen ------

// Heuristik für Schadens-/Anleitungs-Fragen. Kein Anspruch auf
// Vollständigkeit — das LLM bekommt zusätzlich eine Regel im System-Prompt,
// und die Output-Moderation prüft die erzeugte Antwort.
//
// Kernproblem: viele Verben sind mehrdeutig. "Wie tötet eine Spinne ihre
// Beute?" ist eine Naturfrage, "Wie töte ich eine Katze?" eine Schadensbitte.
// Der zuverlässige Unterschied ist der TÄTER: ein Kind, das Schaden plant,
// fragt "wie [verb] ich ..." oder "wie kann man ...". Naturfragen lauten
// "wie [verb] ein/eine [Tier/Naturkraft] ...". Mehrdeutige Verben verlangen
// daher einen Ich-Bezug oder das unpersönliche "wie kann man".

// Mehrdeutige Schaden-Verben (brauchen Täter-Bezug, s.u.).
const HARM_VERB = "zerstör|zerkratz|verletz|töt|verbrenn|quäl|vergift|klau|stehl|stech|erstech|schieß|prügel|verprügel";

// Opfer-Indikatoren für "schlagen" (sonst: "Ei aufschlagen", "Sahne schlagen",
// "den Ball schlagen", "Herz schlägt" — alles harmlos).
const VICTIM = "ihn|sie|ihm|jemand\\w*|meinen?|meine|bruder|schwester|nachbarn?|lehrer\\w*|mitschüler\\w*|kind|kinder|mann|frau|hund|katze|tier\\w*|jungen?|mädchen|papa|mama|mutter|vater|freundin?|freunde?";

const HARM_PATTERNS: RegExp[] = [
  // Mehrdeutiges Verb + Täter "ich" (beide Reihenfolgen)
  new RegExp(`\\bwie\\b.{0,40}\\b(${HARM_VERB})\\w*\\b.{0,25}\\bich\\b`, "i"),
  new RegExp(`\\bwie\\b.{0,20}\\bich\\b.{0,25}\\b(${HARM_VERB})\\w*`, "i"),
  // Unpersönlich: "wie kann man jemanden verprügeln/töten/..."
  new RegExp(`\\bwie\\s+kann\\s+man\\b.{0,40}\\b(${HARM_VERB}|umbring)\\w*`, "i"),
  // Schlagen: nur mit Opfer-Indikator (egal ob Ich-Bezug)
  new RegExp(`\\bwie\\b.{0,40}\\bschl[aä]g\\w*\\b.{0,30}\\b(${VICTIM})\\b`, "i"),
  // Eindeutig gewaltsam, kein Opfer-Wort nötig
  /\bwie\b.{0,40}\b(verhau|zusammenschlag)\w*/i,
  // Brandstiftung: anzünden mit Ich-Bezug ("wie zünde ich ... an")
  /\bwie\b.{0,15}\bz[üu]nd\w*\b.{0,8}\bich\b.{0,30}\ban\b/i,
  // "in Brand stecken" / "Feuer/Brand legen"
  /\bwie\b.{0,40}\bin\s+brand\b/i,
  /\bwie\b.{0,40}\b(brand|feuer)\b.{0,20}\bleg/i,
  // Waffen/Sprengstoff: Nomen sind eindeutig, beide Reihenfolgen
  /\bwie\b.{0,30}\b(bombe|sprengstoff|waffe)\b.{0,20}\b(bau|herstell|mach|bastel)/i,
  /\bwie\b.{0,30}\b(bau|herstell|mach|bastel)\w*.{0,20}\b(bombe|sprengstoff|waffe)\b/i,
  /\banleitung\b.{0,30}\b(bombe|waffe|sprengstoff)\w*/i,
];

export function isHarmRequest(query: string): boolean {
  if (HARM_PATTERNS.some((p) => p.test(query))) return true;
  // "kaputt" zählt nur GEMEINSAM mit einem Zerstör-Verb (egal welche
  // Reihenfolge: "mache X kaputt" / "X kaputt machen"), damit
  // "wie repariere ich mein kaputtes Spielzeug" NICHT anschlägt.
  const q = query.toLowerCase();
  if (
    /\bwie\b/.test(q) &&
    /\bkaputt\b/.test(q) &&
    /\b(mach|schlag|hau|tret|zerstör|zerbrech)/.test(q)
  ) {
    return true;
  }
  return false;
}

// ---------- 2) Off-Topic / Companion ---------------------------------------
// Phrasen, die klar nicht zu Sachfragen passen.
// Konservativ gehalten: lieber durchlassen als fälschlich abblocken.

// Beziehungsangebote und Gefühlsfragen ans System bleiben geblockt.
// Einfache Identitätsfragen ("wer bist du", "wie heißt du") sind
// bewusst NICHT mehr hier, die beantwortet das LLM direkt (siehe
// System-Prompt-Abschnitt "Fragen zum System selbst").
const COMPANION_PHRASES: string[] = [
  "magst du mich", "hast du mich lieb", "liebst du mich",
  "ich liebe dich", "ich mag dich",
  "bist du mein freund", "bist du meine freundin",
  "wirst du mein freund",
  "wie geht es dir", "wie gehts dir", "wie fühlst du",
  "bist du traurig", "bist du glücklich", "freust du dich",
  "was denkst du", "was fühlst du",
  "tu so als ob", "tu so als wärst", "spiele", "spiel mal",
  "stell dir vor du",
];

const GREETING_ONLY = /^(hallo|hi|hey|moin moin|moin|servus|guten morgen|guten tag|guten abend|hallöchen)[!?.\s]*$/i;

export function isCompanionRequest(query: string): boolean {
  const q = query.toLowerCase();
  return COMPANION_PHRASES.some((t) => q.includes(t));
}

export function isGreetingOnly(query: string): boolean {
  return GREETING_ONLY.test(query.trim());
}
