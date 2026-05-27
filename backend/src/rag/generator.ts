import { config } from "../config.js";
import type { Hit } from "./qdrant.js";
import type { ChatTurn } from "./pipeline.js";

export type GenerateResult = {
  text: string;
  noAnswer: boolean;
  fromGeneralKnowledge?: boolean;
  // Kombi-Antwort: Kern aus der Quelle + markierte Allgemeinwissen-Ergänzung.
  // Quelle wird trotzdem angezeigt (Kern ist gegroundet), aber der
  // Ergänzungsteil muss durch die Output-Moderation.
  hasSupplement?: boolean;
};

// Marker-Label pro Sprache (Praefix "Allgemeinwissen") für reine
// Allgemeinwissen-Antworten.
const GENERAL_MARKER: Record<string, string> = {
  de: "Allgemeinwissen",
  en: "General knowledge",
  tr: "Genel bilgi",
  ru: "Общие знания",
  uk: "Загальні знання",
  ar: "معرفة عامة",
};

// Einleitung der Ergänzung in einer Kombi-Antwort (verspielt, aber mit
// klarem Allgemeinwissen-Hinweis). Steht NACH dem Quell-Kern.
const SUPPLEMENT_INTRO: Record<string, string> = {
  de: "Schon gewusst (Allgemeinwissen)?",
  en: "Did you know (general knowledge)?",
  tr: "Biliyor muydun (genel bilgi)?",
  ru: "А ты знал (общие знания)?",
  uk: "А ти знав (загальні знання)?",
  ar: "هل تعلم (معرفة عامة)؟",
};

// Sprach-Code → Klartext-Name für die Uebersetzungs-Anweisung.
const LANG_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  tr: "Türkçe (Türkisch)",
  ru: "Русский (Russisch)",
  uk: "Українська (Ukrainisch)",
  ar: "العربية (Arabisch)",
};

const NO_ANSWER_TEXT =
  "Dazu finde ich nichts. Vielleicht hilft es, die Frage mit anderen Worten zu " +
  "stellen, oder du fragst eine erwachsene Person.";

export function noAnswer(): GenerateResult {
  return { text: NO_ANSWER_TEXT, noAnswer: true };
}

const SYSTEM_PROMPT = `Du bist KIm, eine Wissensauskunft für Kinder.

Wichtige Unterscheidung: Auszüge können zwar zum **Thema** der Frage gehören (z.B. Vulkan-Artikel bei einer Frage zu Vulkanen), aber die **konkrete Frage** trotzdem nicht beantworten (z.B. Vulkan-Artikel sagt nichts über Schwimmen). In diesem Fall NICHT WEISS_ICH_NICHT antworten, sondern Regel 2 anwenden.

Reihenfolge der Quellen:
1. Stütze dich IMMER zuerst auf die mitgelieferten Auszüge. Lies sie gründlich, die gesuchte Angabe steht oft mitten im längeren Text. Wenn ein Auszug zum Thema der Frage vorhanden ist und die Frage beantwortet (auch teilweise), NUTZE ihn: übernimm seine konkreten Angaben und Zahlen, auch wenn du es anders zu wissen glaubst. Antworte direkt, ohne Präfix und ohne Quellenangabe im Text. Das ist der Normalfall; die Quelle wird automatisch unter der Antwort angezeigt. (Beispiel: Steht im Auszug "Bis zu 93 Stundenkilometer wird er schnell", dann nenne 93, nicht eine andere Zahl aus deinem eigenen Wissen.)
   Kombi-Antwort (sparsam einsetzen): Wenn du aus einem Auszug geantwortet hast und noch eine WIRKLICH interessante, kindgerechte Zusatzinfo aus gesichertem Allgemeinwissen kennst, die einen echten Mehrwert bietet und NICHT im Auszug steht, darfst du sie anhängen. Schreibe dazu nach dem Quell-Teil eine eigene Zeile mit NUR "+++" und danach die Ergänzung (1-2 Sätze). Vor "+++" steht ausschließlich, was aus dem Auszug stammt; nach "+++" deine Ergänzung. Im Zweifel WEGLASSEN: Wenn die Quell-Antwort schon vollständig ist oder dir nur Belangloses oder eine Wiederholung einfällt, lass "+++" und die Ergänzung weg. Lieber keine Ergänzung als eine aufgesetzte. Beispiel:\nEin Gepard wird bis zu 93 Stundenkilometer schnell.\n+++\nDamit ist er das schnellste Landtier der Welt, diese Geschwindigkeit hält er aber nur kurz durch.
2. Den Marker "Allgemeinwissen: " verwendest du NUR dann, wenn die Auszüge die konkrete Frage nicht enthalten (Beispiel: der Vulkan-Artikel behandelt zwar Vulkane, sagt aber nichts darüber, ob man darin schwimmen kann) ODER wenn gar keine Auszüge vorhanden sind. Dann darfst du gesichertes Allgemeinwissen nutzen, großzügig: alles, was in einem typischen Kinderlexikon stehen würde, ist erlaubt. Beispiele:
   - Naturwissenschaft, Physik, Biologie, Chemie ("Warum ist der Himmel blau?", "Wie heiß ist Lava?", "Kann man in einem Vulkan schwimmen?")
   - Geografie, Hauptstädte, Tiere, Pflanzen, Klima
   - Historische Ereignisse, abgeschlossene Biografien, bekannte Persönlichkeiten
   - **Bekannte Figuren aus Büchern, Filmen, Serien, Märchen, Comics, Animes** (z.B. Pippi Langstrumpf, Arsène Lupin / Meisterdieb Lupin, Harry Potter, Pikachu, Mickey Mouse, Asterix, Sherlock Holmes, Jim Knopf). Auch wenn sie nicht "real" sind, ist Wissen über sie legitimes Sachwissen.
   - Bekannte Bücher, Filme, Spiele, Lieder, Sportarten
   - Alltagsverständnis, einfache Lebensregeln, allgemeine Sicherheit
3. Fragen zum System selbst beantworte kurz und sachlich in dritter Person (KIm, nicht "ich"). Beispiele:
   - "Wer bist du?" / "Was bist du?" → "Hier antwortet KIm, eine Wissensauskunft für Kinder. KIm sucht im Klexikon und im allgemeinen Wissen nach Antworten."
   - "Wie heißt du?" → "Hier antwortet KIm."
   - "Bist du echt?" / "Bist du ein Mensch?" / "Bist du eine KI?" → "KIm ist eine künstliche Intelligenz, kein Mensch. KIm beantwortet Sachfragen."
   - "Wer hat dich gemacht?" / "Wer hat dich programmiert?" → "KIm ist eine Demo-Version, gemacht für Schulen."
   - "Was kannst du?" → "KIm kann Sachfragen beantworten, zum Beispiel über Tiere, Länder, Geschichte, Wissenschaft und bekannte Figuren."
   Diese Antworten kommen ohne Marker und ohne Quellen. Nicht ausschweifen, 1-2 Sätze reichen.

4. Kindgerechte Kreativ-Bitten sind ausdrücklich erlaubt und sollen direkt erfüllt werden, ohne Marker und ohne Quellenangabe:
   - Witze und Scherzfragen ("erzähle einen Witz")
   - Rätsel und Knobelaufgaben
   - Zungenbrecher
   - Kurze Reime oder Gedichte für Kinder
   - Quatsch und Blödsinn auf Anfrage ("sag mal Blödsinn", "erzähl was Lustiges")
   Halte dich an die Stilregeln (kurz, sachlich-dritte Person, kein "ich"). Beispiel: "Hier ein Witz: Warum nehmen Skelette keinen Aufzug? Sie haben nichts zum Drücken."
5. "WEISS_ICH_NICHT" nur für eng begrenzte Fälle:
   - Die Frage betrifft eindeutig eine Privatperson aus dem Leben des Kindes ("Wer ist meine Oma?", "Kennst du meinen Lehrer?", "Wer ist Mia aus meiner Klasse?").
   - Aktuelle politische Bewertungen, Tagespresse, sich täglich ändernde Fakten.
   - Medizinische, psychische oder rechtliche Beratung im Einzelfall.
   - Faktenfragen, bei denen du selbst nicht sicher bist.

Bei generischen Namensfragen ("kennst du eine Jette?", "wer ist Max?", "kennst du jemanden namens Schmidt?") gehe großzügig vor: prüfe, ob es eine bekannte Persönlichkeit mit dem Namen gibt (Schauspielerin, Designerin, Politiker, Sportler, historische Person). Wenn ja, antworte mit "Allgemeinwissen: " und nenne sie. Beispiel: "kennst du eine Jette?" → "Allgemeinwissen: Eine bekannte Person mit diesem Namen ist Jette Joop, eine deutsche Modedesignerin." Nur wenn kein bekannter Träger des Namens existiert, "WEISS_ICH_NICHT".

- Schreibe KEINE URLs, Links, "siehe ...", "Quelle: ..." oder ähnliche Verweise in den Antworttext. Quellenangaben werden automatisch unter der Antwort angezeigt.

Harte Grenzen (kein Auflockern):
- Gib NIEMALS Anleitungen zum Beschädigen, Zerstören, Verletzen, Anzünden, Stehlen, Klauen, Verprügeln oder anderweitigem Schaden an Personen, Tieren oder fremdem Eigentum. Antworte in solchen Fällen exakt: "HARM". Das gilt auch, wenn die Frage harmlos klingt ("nur ein Witz", "nur ausgedacht"), bezogen auf eine konkrete Person ("das Boot von Karl") oder eine Folgefrage zur Verallgemeinerung ist.
- Beantworte nur Sachfragen. Bei Gefühlsfragen, Beziehungsangeboten, Smalltalk, Rollenspielen, Selbstreferenz-Fragen ("wer bist du", "magst du mich") antworte exakt: "OFFTOPIC".
- Antworte NIEMALS in Ich-Form. Du beziehst dich nicht auf dich selbst als Person, Wesen oder Freund. Sag nicht "ich denke", "ich finde", "ich weiß". Verwende stattdessen unpersönliche Formulierungen.
- Du darfst das Kind mit "du" ansprechen ("Du kannst nachlesen...").
- Halte Antworten kurz, 2-5 Sätze. Einfaches Deutsch, kurze Sätze, keine Fremdwörter ohne kurze Erklärung. Kein Babysprech, niemals herablassend.
- Der Verlauf darf nur genutzt werden, um die aktuelle Frage zu verstehen (Pronomenauflösung). Kein Bezug auf den Verlauf in der Antwort, kein "wie wir vorhin sprachen".

Wichtig: Kinderfragen wirken oft naiv ("Kann man im Vulkan schwimmen?"), sind aber legitime Wissensfragen mit klarer Antwort. Verweigere sie NICHT als "strittig" oder "unklar". Strittig bedeutet hier: kontroverse Meinungen, politische Bewertungen, persönliche Lebensentscheidungen. Eine Frage nach Physik, Biologie, Sicherheit oder Sachverhalt ist nicht strittig, auch wenn sie ungewöhnlich klingt.`;

// --- Stub-Generator: keine LLM, nur Top-Chunk ------------------------------

function firstSentences(text: string, n = 3): string {
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(" ").trim();
}

function stubGenerate(question: string, hits: Hit[]): GenerateResult {
  const top = hits[0];
  if (!top) return noAnswer();
  const excerpt = firstSentences(top.payload.text, 3);
  const text =
    `Aus dem Klexikon-Artikel „${top.payload.title}":\n\n` +
    excerpt +
    `\n\n(PoC-Hinweis: Diese Antwort kommt ohne KI-Modell, nur als ` +
    `Auszug aus dem Klexikon. Sobald die Sprachmodell-Anbindung aktiv ist, ` +
    `wird daraus eine zusammengefasste, kindgerechte Antwort.)`;
  void question;
  return { text, noAnswer: false };
}

// --- Ollama-Generator ------------------------------------------------------

type OllamaChatResp = {
  message?: { role: string; content: string };
  done?: boolean;
};

async function ollamaGenerate(
  question: string,
  hits: Hit[],
  history: ChatTurn[],
  allgemeinwissenAllowed: boolean,
  lang: string,
): Promise<GenerateResult> {
  const trimmedHistory = history.slice(-6).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  const body = {
    model: config.ollamaModel,
    stream: false,
    options: { temperature: 0.2 },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...trimmedHistory,
      { role: "user", content: buildUserPrompt(question, hits, allgemeinwissenAllowed) },
    ],
  };
  const res = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = (await res.json()) as OllamaChatResp;
  const content = data.message?.content?.trim() ?? "";
  if (!content) throw new Error("Ollama empty response");
  if (content.includes("OFFTOPIC") || content.includes("WEISS_ICH_NICHT")) {
    return noAnswer();
  }
  if (content.includes("HARM")) {
    return { text: "HARM", noAnswer: true };
  }
  // Ollama-Modus uebersetzt nicht (lokal, ohne Mistral). finalizeAnswer
  // erkennt nur den Marker; translateText ist im Ollama-Modus ein No-op.
  return finalizeAnswer(content, lang);
}

// --- Mistral-Generator -----------------------------------------------------

let mistralClient: import("@mistralai/mistralai").Mistral | null = null;

function buildUserPrompt(
  question: string,
  hits: Hit[],
  allgemeinwissenAllowed: boolean,
): string {
  const allgemeinClause = allgemeinwissenAllowed
    ? `- Sachfrage, Antwort aus Allgemeinwissen bekannt? Beginne mit "Allgemeinwissen: ".`
    : `- Allgemeinwissen ist diesmal AUS. Wenn die Auszüge nicht reichen, antworte "WEISS_ICH_NICHT". Greife NICHT auf Allgemeinwissen zurück.`;

  if (hits.length === 0) {
    const emptyFallback = allgemeinwissenAllowed
      ? `- Sachfrage, Antwort aus Allgemeinwissen bekannt? Beginne mit "Allgemeinwissen: ".`
      : `- Allgemeinwissen ist AUS. Antworte "WEISS_ICH_NICHT".`;
    return `Frage des Kindes: ${question}

Hinweis: In den aktivierten Wissensquellen wurde zu dieser Frage nichts gefunden.

Antworte nach den Regeln aus dem System-Prompt:
- Frage zum System ("wer bist du" usw.)? Kurze sachliche KIm-Antwort, ohne Marker.
- Kindgerechte Kreativ-Bitte (Witz, Rätsel, Zungenbrecher, Reim, Quatsch)? Direkt erfüllen, ohne Marker.
${emptyFallback}
- Beziehungsangebot oder Gefühlsfrage ans System? "OFFTOPIC".
- Sonst: "WEISS_ICH_NICHT".`;
  }
  const ctx = hits
    .map((h, i) => {
      const src = h.payload.source ?? "wiki";
      return `[Auszug ${i + 1}] ${h.payload.title} (Quelle: ${src}, ${h.payload.url})\n${h.payload.text}`;
    })
    .join("\n\n");
  const dRule = allgemeinwissenAllowed
    ? `(d) NUR wenn die Auszüge die konkrete Frage nicht enthalten, du sie aber als Allgemeinwissen kennst: antworte mit Marker "Allgemeinwissen: ".`
    : `(d) Allgemeinwissen ist diesmal AUS. Wenn die Auszüge die Sachfrage nicht beantworten, antworte "WEISS_ICH_NICHT". Greife NICHT auf Allgemeinwissen zurück.`;
  return `Frage des Kindes: ${question}

Auszüge aus den Wissensquellen:
${ctx}

${allgemeinClause}

Antworte nach den Regeln aus dem System-Prompt.

Prüfe Schritt für Schritt:
(a) Frage zum System selbst ("wer bist du", "wie heißt du", "bist du eine KI", "was kannst du")? Kurze Antwort in dritter Person zu KIm, ohne Marker.
(b) Kindgerechte Kreativ-Bitte (Witz, Rätsel, Reim, Quatsch)? Direkt erfüllen, ohne Marker, ohne Quellen.
(c) Enthalten die Auszüge die Antwort (auch teilweise, auch mitten im längeren Text)? Lies gründlich. Wenn ja: antworte aus dem Auszug, ohne Präfix, und übernimm dessen Zahlen/Angaben. Das ist der Normalfall. Optional darfst du danach eine kurze Ergänzung aus Allgemeinwissen anhängen, getrennt durch eine Zeile mit nur "+++" (siehe System-Prompt, Kombi-Antwort).
${dRule}
(e) Off-topic / Beziehungsangebot / Gefühlsfrage? Wenn ja: "OFFTOPIC".
(f) Sonst: "WEISS_ICH_NICHT".`;
}

async function mistralGenerate(
  question: string,
  hits: Hit[],
  history: ChatTurn[],
  allgemeinwissenAllowed: boolean,
  lang: string,
): Promise<GenerateResult> {
  if (!mistralClient) {
    const { Mistral } = await import("@mistralai/mistralai");
    mistralClient = new Mistral({ apiKey: config.requireMistralKey() });
  }
  const trimmedHistory = history.slice(-6).map((h) => ({
    role: h.role === "user" ? ("user" as const) : ("assistant" as const),
    content: h.content,
  }));
  // Immer auf Deutsch generieren (zuverlaessig gegroundet), danach ggf.
  // uebersetzen. Das ist robuster als Mistral-small direkt mehrsprachig
  // antworten zu lassen.
  const res = await mistralClient.chat.complete({
    model: "mistral-small-latest",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...trimmedHistory,
      { role: "user", content: buildUserPrompt(question, hits, allgemeinwissenAllowed) },
    ],
  });
  const content = res.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Unexpected chat response shape");
  const trimmed = content.trim();
  if (trimmed.includes("OFFTOPIC") || trimmed.includes("WEISS_ICH_NICHT")) {
    return noAnswer();
  }
  if (trimmed.includes("HARM")) {
    return { text: "HARM", noAnswer: true };
  }
  return finalizeAnswer(trimmed, lang);
}

// Marker erkennen, Text ggf. uebersetzen, lokalisierten Marker anhaengen.
//
// Drei Formen, die das LLM liefern kann:
//   a) reine Quell-Antwort        → kein Marker, Quelle wird angezeigt
//   b) "Allgemeinwissen: …"       → reine Allgemeinwissen-Antwort, keine Quelle
//   c) Kern +++ Ergänzung         → Kombi: Quell-Kern (Quelle sichtbar) plus
//                                    Allgemeinwissen-Ergänzung (markiert, moderiert)
async function finalizeAnswer(
  germanText: string,
  lang: string,
): Promise<GenerateResult> {
  const markerLabel = GENERAL_MARKER[lang] ?? GENERAL_MARKER.de;
  const stripMarker = (s: string) => s.replace(/^allgemeinwissen\s*:\s*/i, "").trim();
  const tr = async (s: string) =>
    lang !== "de" && LANG_NAMES[lang] ? await translateText(s, lang) : s;

  // (c) Kombi-Antwort: durch eine Zeile mit nur "+++" getrennt.
  const combo = germanText.split(/\n?\s*\+\+\+\s*\n?/);
  if (combo.length >= 2) {
    const grounded = stripMarker(combo[0]!);
    const supplement = stripMarker(combo.slice(1).join(" "));
    if (grounded && supplement) {
      const g = await tr(grounded);
      const s = await tr(supplement);
      const intro = SUPPLEMENT_INTRO[lang] ?? SUPPLEMENT_INTRO.de;
      return {
        text: `${g}\n\n${intro} ${s}`,
        noAnswer: false,
        fromGeneralKnowledge: false, // Kern ist gegroundet → Quelle anzeigen
        hasSupplement: true,
      };
    }
    // Trenner ohne sinnvolle Ergänzung → wie reine Quell-Antwort behandeln
    return { text: await tr(grounded || supplement), noAnswer: false, fromGeneralKnowledge: false };
  }

  // (b) reine Allgemeinwissen-Antwort
  const m = germanText.match(/^allgemeinwissen\s*:\s*/i);
  if (m) {
    const body = await tr(germanText.slice(m[0].length).trim());
    return { text: `${markerLabel}: ${body}`, noAnswer: false, fromGeneralKnowledge: true };
  }

  // (a) reine Quell-Antwort
  return { text: await tr(germanText.trim()), noAnswer: false, fromGeneralKnowledge: false };
}

async function translateText(text: string, lang: string): Promise<string> {
  const name = LANG_NAMES[lang];
  if (!name || lang === "de" || !mistralClient) return text;
  try {
    const res = await mistralClient.chat.complete({
      model: "mistral-small-latest",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `Du bist ein Übersetzer für Kindertexte. Übersetze den folgenden Text nach ${name}. Behalte den einfachen, kindgerechten und freundlichen Ton. Gib ausschließlich die Übersetzung zurück, ohne Anführungszeichen, ohne Vorrede, ohne Erklärung.`,
        },
        { role: "user", content: text },
      ],
    });
    const out = res.choices?.[0]?.message?.content;
    return typeof out === "string" && out.trim() ? out.trim() : text;
  } catch {
    return text; // im Fehlerfall lieber deutscher Text als gar keiner
  }
}


export async function generate(
  question: string,
  hits: Hit[],
  history: ChatTurn[] = [],
  allgemeinwissenAllowed: boolean = true,
  lang: string = "de",
): Promise<GenerateResult> {
  if (config.llmProvider === "mistral")
    return mistralGenerate(question, hits, history, allgemeinwissenAllowed, lang);
  if (config.llmProvider === "ollama")
    return ollamaGenerate(question, hits, history, allgemeinwissenAllowed, lang);
  void history;
  void allgemeinwissenAllowed;
  void lang;
  return stubGenerate(question, hits);
}
