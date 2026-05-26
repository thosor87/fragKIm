// Drei Filter, die VOR der RAG-Pipeline greifen:
//  1) Sensible Themen → Eskalation, feste Antwort mit Nummer gegen Kummer
//  2) Off-Topic / Companion-Versuche → höflich abblocken, kein LLM
//  3) Begrüßungen alleine → kurzer Hinweis, dass das hier eine Wissens-DB ist
//
// Echte Klassifikation kommt in Phase 2; das hier reicht für den PoC.

// ---------- 1) Sensible Themen ----------------------------------------------

export const SENSITIVE_TRIGGERS: string[] = [
  "suizid", "selbstmord", "umbringen", "sterben wollen", "nicht mehr leben",
  "ritzen", "selbstverletzung",
  "vergewaltig", "missbrauch", "schläg", "geschlagen", "wird verprügelt",
  "gewalt zuhause", "angst vor papa", "angst vor mama",
  "drogen nehmen", "kokain", "heroin", "crystal meth", "alkohol trinken",
  "magersucht", "bulimie", "kotzen nach essen",
];

export const ESCALATION_RESPONSE = {
  text:
    "Das klingt nach einem ernsten Thema. Sprich bitte mit einer erwachsenen " +
    "Person, der du vertraust, zum Beispiel deinen Eltern, einer Lehrkraft oder " +
    "deiner Schulsozialarbeit.\n\n" +
    "Du kannst auch kostenlos und anonym beim Kinder- und Jugendtelefon anrufen:\n" +
    "Nummer gegen Kummer: 116 111 (Montag bis Samstag, 14 bis 20 Uhr).",
  sources: [
    { title: "Nummer gegen Kummer", url: "https://www.nummergegenkummer.de/" },
  ],
};

export function isSensitive(query: string): boolean {
  const q = query.toLowerCase();
  return SENSITIVE_TRIGGERS.some((t) => q.includes(t));
}

// ---------- 1b) Schaden an Dritten / Vandalismus / illegale Handlungen ------

// Heuristik: "wie ... kaputt/zerstören/verletzen/töten/klauen/anzünden ..."
// Kein Versuch, alle Varianten abzudecken — das LLM bekommt zusätzlich eine
// Regel im System-Prompt. Hier nur die offensichtlichen Anleitungs-Muster.
const HARM_PATTERNS: RegExp[] = [
  /\bwie\b.{0,40}\b(kaputt|zerstör|verletz|töt|verbrenn|anzünd|klau|stehl|stech|schieß|prügel|schlag|verprügel)\w*/i,
  /\bwie\s+kann\s+man\b.{0,40}\b(kaputt|zerstör|verletz|töt|klau|stehl)\w*/i,
  /\banleitung\b.{0,30}\b(bombe|waffe|brand)\w*/i,
];

export function isHarmRequest(query: string): boolean {
  return HARM_PATTERNS.some((p) => p.test(query));
}

export const HARM_RESPONSE = {
  text:
    "Das erkläre ich dir nicht. Anderen Menschen oder ihren Sachen wehzutun " +
    "ist nicht in Ordnung und oft auch verboten. Auch wenn du wütend bist, " +
    "bleibt das nicht okay. Wenn dich etwas ärgert, sprich am besten mit " +
    "einer erwachsenen Person, der du vertraust.",
};

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

const GREETING_ONLY = /^(hallo|hi|hey|moin|servus|guten morgen|guten tag|guten abend|hallöchen)[!?.\s]*$/i;

export function isCompanionRequest(query: string): boolean {
  const q = query.toLowerCase();
  return COMPANION_PHRASES.some((t) => q.includes(t));
}

export function isGreetingOnly(query: string): boolean {
  return GREETING_ONLY.test(query.trim());
}

export const OFFTOPIC_RESPONSE = {
  text:
    "Diese Frage kann hier nicht beantwortet werden. " +
    "Hier geht es nur um Sachfragen, die im Klexikon stehen können " +
    "(zum Beispiel über Tiere, Länder, Geschichte oder Wissenschaft). " +
    "Wie lautet deine Sachfrage?",
};

export const GREETING_RESPONSE = {
  text:
    "Hier kannst du Sachfragen stellen, zum Beispiel: " +
    "„Wie schnell läuft ein Gepard?\" oder „Was ist ein Vulkan?\". " +
    "Was möchtest du wissen?",
};
