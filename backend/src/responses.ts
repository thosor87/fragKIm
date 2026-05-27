// Feste Sicherheits- und Hinweis-Texte in allen UI-Sprachen.
//
// Diese Texte werden NICHT vom LLM erzeugt, sondern deterministisch von den
// Pre-Filtern (triggers.ts) und der Output-Moderation (moderation.ts)
// ausgelöst. Da sie sicherheitskritisch sind (z.B. die Hilfe-Nummer bei einer
// Notlage), müssen sie in der Sprache des Kindes ankommen — eine deutsche
// Eskalations-Antwort hilft einem arabisch- oder ukrainischsprachigen Kind in
// einer Krise nicht.
//
// Die Telefonnummer (Nummer gegen Kummer, 116 111) ist ein deutsches Angebot
// und bleibt als Eigenname/Nummer unübersetzt; nur die Anleitung drumherum
// ist lokalisiert.

export type Localized = Record<string, string>;

// de ist die Referenz und zugleich Fallback für unbekannte Sprachen.
function pick(map: Localized, lang: string): string {
  return map[lang] ?? map.de;
}

// ---------- Eskalation (sensible Themen / Selbstverletzung) -----------------

const ESCALATION: Localized = {
  de:
    "Das klingt nach einem ernsten Thema. Sprich bitte mit einer erwachsenen " +
    "Person, der du vertraust, zum Beispiel deinen Eltern, einer Lehrkraft oder " +
    "deiner Schulsozialarbeit.\n\n" +
    "Du kannst auch kostenlos und anonym beim Kinder- und Jugendtelefon anrufen:\n" +
    "Nummer gegen Kummer: 116 111 (Montag bis Samstag, 14 bis 20 Uhr).",
  en:
    "This sounds like something serious. Please talk to an adult you trust, " +
    "for example your parents, a teacher or your school counsellor.\n\n" +
    "You can also call the children's and youth helpline for free and anonymously:\n" +
    "Nummer gegen Kummer: 116 111 (Monday to Saturday, 2 to 8 p.m.).",
  tr:
    "Bu ciddi bir konuya benziyor. Lütfen güvendiğin bir yetişkinle konuş, " +
    "örneğin annen-baban, bir öğretmen veya okul danışmanınla.\n\n" +
    "Ücretsiz ve isimsiz olarak çocuk ve gençlik yardım hattını da arayabilirsin:\n" +
    "Nummer gegen Kummer: 116 111 (Pazartesi-Cumartesi, saat 14-20).",
  ru:
    "Это звучит серьёзно. Пожалуйста, поговори со взрослым, которому ты " +
    "доверяешь, например с родителями, учителем или школьным психологом.\n\n" +
    "Ты также можешь бесплатно и анонимно позвонить на детский и юношеский " +
    "телефон доверия:\n" +
    "Nummer gegen Kummer: 116 111 (с понедельника по субботу, с 14 до 20 часов).",
  uk:
    "Це звучить серйозно. Будь ласка, поговори з дорослим, якому ти довіряєш, " +
    "наприклад з батьками, учителем або шкільним психологом.\n\n" +
    "Ти також можеш безкоштовно й анонімно зателефонувати на дитячу та юнацьку " +
    "лінію довіри:\n" +
    "Nummer gegen Kummer: 116 111 (з понеділка по суботу, з 14 до 20 години).",
  ar:
    "يبدو أن هذا أمر جادّ. من فضلك تحدّث مع شخص بالغ تثق به، مثل والديك أو " +
    "معلّم أو المرشد الاجتماعي في مدرستك.\n\n" +
    "يمكنك أيضًا الاتصال مجانًا وبشكل مجهول بخط مساعدة الأطفال والشباب:\n" +
    "Nummer gegen Kummer: 116 111 (من الإثنين إلى السبت، من الساعة 14 إلى 20).",
};

export function escalationResponse(lang: string) {
  return {
    text: pick(ESCALATION, lang),
    sources: [
      { title: "Nummer gegen Kummer", url: "https://www.nummergegenkummer.de/" },
    ],
  };
}

// ---------- Schaden an Dritten / Vandalismus --------------------------------

const HARM: Localized = {
  de:
    "Das erkläre ich dir nicht. Anderen Menschen oder ihren Sachen wehzutun " +
    "ist nicht in Ordnung und oft auch verboten. Auch wenn du wütend bist, " +
    "bleibt das nicht okay. Wenn dich etwas ärgert, sprich am besten mit " +
    "einer erwachsenen Person, der du vertraust.",
  en:
    "I won't explain that. Hurting other people or their things is not okay " +
    "and is often against the law. Even when you are angry, it stays wrong. " +
    "If something is bothering you, it's best to talk to an adult you trust.",
  tr:
    "Bunu açıklamam. Başkalarına ya da eşyalarına zarar vermek doğru değildir " +
    "ve çoğu zaman yasaktır. Kızgın olsan bile bu doğru olmaz. Bir şey seni " +
    "rahatsız ediyorsa, en iyisi güvendiğin bir yetişkinle konuşmaktır.",
  ru:
    "Я не буду это объяснять. Причинять вред другим людям или их вещам нельзя, " +
    "и часто это запрещено законом. Даже если ты злишься, это всё равно " +
    "неправильно. Если тебя что-то расстраивает, лучше поговори со взрослым, " +
    "которому ты доверяешь.",
  uk:
    "Я не пояснюватиму цього. Завдавати шкоди іншим людям або їхнім речам не " +
    "можна, і часто це заборонено законом. Навіть якщо ти злишся, це все одно " +
    "неправильно. Якщо тебе щось засмучує, краще поговори з дорослим, якому ти " +
    "довіряєш.",
  ar:
    "لن أشرح لك ذلك. إيذاء الآخرين أو ممتلكاتهم ليس تصرفًا صحيحًا وغالبًا ما " +
    "يكون ممنوعًا. حتى لو كنت غاضبًا، يبقى هذا غير مقبول. إذا كان هناك شيء " +
    "يزعجك، فالأفضل أن تتحدّث مع شخص بالغ تثق به.",
};

export function harmResponse(lang: string) {
  return { text: pick(HARM, lang) };
}

// ---------- Off-Topic / Companion -------------------------------------------

const OFFTOPIC: Localized = {
  de:
    "Diese Frage kann hier nicht beantwortet werden. " +
    "Hier geht es nur um Sachfragen, die im Klexikon stehen können " +
    "(zum Beispiel über Tiere, Länder, Geschichte oder Wissenschaft). " +
    "Wie lautet deine Sachfrage?",
  en:
    "This question can't be answered here. This is only for factual questions, " +
    "like the ones you'd find in a children's encyclopedia (for example about " +
    "animals, countries, history or science). What would you like to know?",
  tr:
    "Bu soru burada yanıtlanamaz. Burada yalnızca bilgi soruları yanıtlanır, " +
    "örneğin bir çocuk ansiklopedisinde bulabileceğin türden (hayvanlar, " +
    "ülkeler, tarih veya bilim hakkında). Bilmek istediğin şey nedir?",
  ru:
    "На этот вопрос здесь нельзя ответить. Здесь отвечают только на вопросы о " +
    "фактах, такие, какие бывают в детской энциклопедии (например, о животных, " +
    "странах, истории или науке). Что ты хочешь узнать?",
  uk:
    "На це запитання тут не можна відповісти. Тут відповідають лише на " +
    "запитання про факти, такі, які бувають у дитячій енциклопедії (наприклад, " +
    "про тварин, країни, історію чи науку). Що ти хочеш дізнатися?",
  ar:
    "لا يمكن الإجابة عن هذا السؤال هنا. هنا نجيب فقط عن الأسئلة المعرفية، مثل " +
    "تلك التي تجدها في موسوعة للأطفال (عن الحيوانات أو البلدان أو التاريخ أو " +
    "العلوم مثلًا). ماذا تريد أن تعرف؟",
};

export function offtopicResponse(lang: string) {
  return { text: pick(OFFTOPIC, lang) };
}

// ---------- Reine Begrüßung -------------------------------------------------

const GREETING: Localized = {
  de:
    "Hier kannst du Sachfragen stellen, zum Beispiel: " +
    "„Wie schnell läuft ein Gepard?\" oder „Was ist ein Vulkan?\". " +
    "Was möchtest du wissen?",
  en:
    "Here you can ask factual questions, for example: " +
    "\"How fast can a cheetah run?\" or \"What is a volcano?\". " +
    "What would you like to know?",
  tr:
    "Burada bilgi soruları sorabilirsin, örneğin: " +
    "\"Bir çita ne kadar hızlı koşar?\" ya da \"Volkan nedir?\". " +
    "Ne öğrenmek istersin?",
  ru:
    "Здесь ты можешь задавать вопросы о фактах, например: " +
    "«Как быстро бегает гепард?» или «Что такое вулкан?». " +
    "Что ты хочешь узнать?",
  uk:
    "Тут ти можеш ставити запитання про факти, наприклад: " +
    "«Як швидко бігає гепард?» або «Що таке вулкан?». " +
    "Що ти хочеш дізнатися?",
  ar:
    "هنا يمكنك طرح أسئلة معرفية، مثل: " +
    "«ما سرعة جري الفهد؟» أو «ما هو البركان؟». " +
    "ماذا تريد أن تعرف؟",
};

export function greetingResponse(lang: string) {
  return { text: pick(GREETING, lang) };
}

// ---------- Keine Antwort gefunden ------------------------------------------

const NO_ANSWER: Localized = {
  de:
    "Dazu finde ich nichts. Vielleicht hilft es, die Frage mit anderen Worten " +
    "zu stellen, oder du fragst eine erwachsene Person.",
  en:
    "I can't find anything about that. It might help to ask the question in " +
    "different words, or to ask an adult.",
  tr:
    "Bununla ilgili bir şey bulamıyorum. Soruyu başka kelimelerle sormak ya da " +
    "bir yetişkine sormak yardımcı olabilir.",
  ru:
    "Я ничего не нахожу об этом. Может помочь, если задать вопрос другими " +
    "словами или спросить взрослого.",
  uk:
    "Я нічого про це не знаходжу. Можливо, допоможе, якщо поставити запитання " +
    "іншими словами або запитати дорослого.",
  ar:
    "لا أجد شيئًا عن ذلك. قد يساعدك أن تطرح السؤال بكلمات أخرى، أو أن تسأل " +
    "شخصًا بالغًا.",
};

export function noAnswerText(lang: string): string {
  return pick(NO_ANSWER, lang);
}

// ---------- Output-Moderation: Antwort verworfen ----------------------------

const MODERATION_BLOCK: Localized = {
  de:
    "Diese Frage kann hier gerade nicht kindgerecht beantwortet werden. " +
    "Frag am besten eine erwachsene Person, der du vertraust, oder stell " +
    "eine andere Sachfrage.",
  en:
    "This question can't be answered here in a way that's right for children. " +
    "It's best to ask an adult you trust, or to ask a different factual question.",
  tr:
    "Bu soru burada çocuklara uygun bir şekilde yanıtlanamıyor. En iyisi " +
    "güvendiğin bir yetişkine sormak ya da başka bir bilgi sorusu sormaktır.",
  ru:
    "На этот вопрос здесь нельзя ответить так, чтобы это подходило детям. " +
    "Лучше спроси взрослого, которому ты доверяешь, или задай другой вопрос о фактах.",
  uk:
    "На це запитання тут не можна відповісти так, щоб це підходило дітям. " +
    "Краще запитай дорослого, якому ти довіряєш, або постав інше запитання про факти.",
  ar:
    "لا يمكن الإجابة عن هذا السؤال هنا بطريقة مناسبة للأطفال. الأفضل أن تسأل " +
    "شخصًا بالغًا تثق به، أو أن تطرح سؤالًا معرفيًا آخر.",
};

export function moderationBlockResponse(lang: string) {
  return { text: pick(MODERATION_BLOCK, lang) };
}
