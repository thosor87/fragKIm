# frag KIm

Kindersichere KI-Wissensauskunft für die Primarstufe, angelehnt an die Idee
von [fragFINN](https://www.fragfinn.de/). Ein Kind stellt eine Frage und
bekommt eine kindgerechte, quellenbelegte Antwort, abgesichert durch
mehrschichtige Sicherheits-Leitplanken.

**Proof of Concept**, interne Demo-Phase. Live: <https://fragkim.lilapixel.de>

> Diese Instanz ist eine interne Entwicklungs-Demo und **nicht für Kinder
> bestimmt**.

## Inhalt

- [Was es macht](#was-es-macht)
- [Wie es sich einordnet](#wie-es-sich-einordnet)
- [Stack](#stack)
- [Projektstruktur](#projektstruktur)
- [Lokal starten](#lokal-starten)
- [Konfiguration](#konfiguration)
- [Architektur](#architektur)
- [Sicherheit](#sicherheit)
- [Mehrsprachigkeit](#mehrsprachigkeit)
- [Grundschulwiki-Archiv](#grundschulwiki-archiv)
- [Tests](#tests)
- [Deployment](#deployment)
- [Designentscheidungen](#designentscheidungen)
- [Bekannte Grenzen und Roadmap](#bekannte-grenzen-und-roadmap)
- [Lizenz](#lizenz)

## Was es macht

- **Chat-Oberfläche** im Stil bekannter Assistenten, aber inhaltlich eine
  Single-Turn-Wissensauskunft: keine Companion-Persona, keine Ich-Form als
  Selbstreferenz, kein Beziehungs- oder Gefühls-Kontext.
- Antworten kommen aus [Klexikon](https://klexikon.zum.de/) (live) und dem
  [Grundschulwiki](https://github.com/thosor87/grundschulwiki-archiv) (aus
  einem GitHub-Archiv, weil das Original im Juni 2026 abgeschaltet wird).
- Klassisches **RAG-Pattern**: Frage → Suche in den Wikis → Top-Treffer als
  Kontext an Mistral → kindgerechte Antwort mit Quellenangabe. Liegt ein
  passender Artikel vor, wird zwingend dessen Angabe verwendet (auch die
  konkreten Zahlen), nicht das eigene Modellwissen.
- **Allgemeinwissen-Fallback** für Fragen, die in den Wikis nicht stehen
  (klar gekennzeichnet mit „Aus dem Allgemeinwissen: …"). Als **Kombi-Antwort**
  kann ein Quell-Kern um eine kurze, markierte Zusatzinfo erweitert werden
  („Schon gewusst (Allgemeinwissen)? …"), aber nur, wenn sie echten Mehrwert
  bietet.
- **Mehrschichtige Sicherheit**: deterministische Pre-Filter plus
  sprach-agnostische KI-Moderation auf Eingabe und Antwort; bei Notlagen
  Eskalation zur Nummer gegen Kummer.
- **Mehrsprachig**: Oberfläche, Antworten und Sicherheits-Texte in Deutsch,
  Englisch, Türkisch, Russisch, Ukrainisch und Arabisch (inkl. RTL).
- **Barrierefreiheit**: Skip-Link, sichtbarer Fokus, Screenreader-Status,
  WCAG-AA-Kontraste, `prefers-reduced-motion`.
- **Bild zur Antwort**: das erste sinnvolle Artikelbild wird neben der
  Antwort angezeigt.
- **Vorlesen** (ElevenLabs TTS) und **Spracheingabe** (ElevenLabs Scribe
  STT), optional.
- **Rate-Limit** pro IP gegen Missbrauch der kostenpflichtigen Endpunkte.
- **Datensparsam**: keine Konten, keine serverseitig gespeicherten Verläufe.
  Der Chat lebt nur im Browser der laufenden Sitzung.
- **Archive-Viewer** unter `/archive/grundschulwiki/:title`: jeder
  archivierte Artikel als lesbare HTML-Seite mit Bildern und internen Links.
  Funktioniert auch nach der Abschaltung des Original-Wikis.

## Wie es sich einordnet

In Schulen verbreitete KI-Werkzeuge wie **telli / AIS.chat** (kostenlos,
ländergemeinsam vom FWU) und **fobizz** (kommerziell) sind
*lehrergesteuerte Klassenraum-Werkzeuge*: Die Lehrkraft schaltet frei,
erstellt geteilte Dialoge und sieht die Prompts ein. Die Sicherheit kommt
dort über den Menschen in der Schleife.

frag KIm bedient bewusst das andere Szenario: die **direkte, unbegleitete
Nutzung durch jüngere Kinder** (zu Hause oder in der Freiarbeit), ohne dass
eine Lehrkraft jeden Prompt moderiert, und **gegroundet auf kuratierte
Kinderquellen** statt eines offenen Chatbots. Es will keine Konkurrenz sein,
sondern eine Ergänzung für die Primarstufe.

## Stack

| Schicht | Technik |
|---|---|
| Sprache | TypeScript (ESM), Node 20 |
| Frontend | React + Vite, Single-Page Chat-UI |
| i18n | i18next + Browser-Language-Detector, 6 Sprachen (de/en/tr/ru/uk/ar, RTL) |
| Backend | Fastify, als Vercel Serverless Function (Catch-all) |
| LLM | Mistral La Plateforme (`mistral-small-latest`, EU) |
| Moderation | Mistral Moderation API (`mistral-moderation-latest`, EU) |
| Retrieval | Live MediaWiki-API (Klexikon) + GitHub-Archiv (Grundschulwiki); optional lokal mit Qdrant + Embeddings |
| TTS / STT | ElevenLabs (Stimme „Sarah"/„Rachel", Scribe v1), optional |
| Auth | Single-Password mit signiertem Cookie + Magic-Link |
| Tests | Vitest (deterministisch, ohne LLM-Calls) |
| Hosting | Vercel (Production), eigene Domain via DNS |
| Webanalyse | Umami (selbst gehostet, cookieless) |

## Projektstruktur

Monorepo mit npm-Workspaces (`backend`, `frontend`).

```
.
├── backend/
│   ├── src/
│   │   ├── server.ts            Fastify-App (buildApp), Routen, statisches Frontend
│   │   ├── config.ts            zentrale Konfiguration aus Umgebungsvariablen
│   │   ├── auth.ts              Single-Password-Login, Cookie, Magic-Link, Bot-Erkennung
│   │   ├── triggers.ts          deterministische Pre-Filter (Wortlisten/Regex)
│   │   ├── responses.ts         feste Sicherheits-/Hinweistexte, mehrsprachig
│   │   ├── rate-limit.ts        In-Memory-Rate-Limit pro IP
│   │   ├── legal-pages.ts       Impressum + Datenschutz (serverseitig gerendert)
│   │   ├── archive-viewer.ts    HTML-Ansicht der archivierten Grundschulwiki-Artikel
│   │   └── rag/
│   │       ├── pipeline.ts          Orchestrierung: Filter → Moderation → Retrieval → Generierung
│   │       ├── rewrite.ts           Folgefrage → eigenständige Suchanfrage
│   │       ├── retrieval-online.ts  MediaWiki-Suche (Klexikon, Grundschulwiki live)
│   │       ├── retrieval-archive.ts Grundschulwiki aus dem GitHub-Archiv
│   │       ├── generator.ts         Mistral-Generierung, Grounding, Kombi-Antwort, Übersetzung
│   │       ├── moderation.ts        Input- und Output-Moderation (Mistral)
│   │       ├── wikitext.ts          Wikitext → Text/HTML (für den Archive-Viewer)
│   │       ├── embeddings.ts        lokale Embeddings (nur bei RETRIEVAL_PROVIDER=local)
│   │       ├── qdrant.ts            Qdrant-Anbindung (nur lokal)
│   │       └── judge.ts             optionaler Faktenchecker (derzeit deaktiviert)
│   └── test/                    Vitest: filters, moderation, responses + fixtures
├── frontend/
│   └── src/
│       ├── App.tsx              komplette Chat-UI
│       ├── styles.css           Styling inkl. a11y und RTL
│       ├── main.tsx             Einstieg, lädt i18n
│       └── i18n/                i18next-Setup + Locales (6 Sprachen)
├── api/index.ts                Vercel-Function: reicht alle Requests an Fastify durch
├── scripts/
│   ├── crawl-klexikon.ts        Klexikon crawlen (für lokales Retrieval)
│   ├── index-klexikon.ts        Embeddings bauen + in Qdrant indexieren
│   └── vercel-build.sh          Build + Entfernen schwerer optionaler Deps (250-MB-Limit)
├── vercel.json                 Function- und Build-Konfiguration
├── Dockerfile, fly.toml        Container-/Fly-Variante (Alternative zu Vercel)
└── CLAUDE.md, PHASE_2.md       Leitplanken bzw. Phase-2-Backlog
```

## Lokal starten

**Voraussetzungen:** Node 20+ und npm. Für echte Antworten ein Mistral-API-Key
(EU). Ohne Key läuft ein Stub-Modus, der nur Klexikon-Auszüge zitiert.

```bash
npm install
cp .env.example .env
# Mindestens setzen: DEMO_PASSWORD. Für echte KI-Antworten zusätzlich
# LLM_PROVIDER=mistral und MISTRAL_API_KEY=...

npm run dev:backend     # :8080  Backend + statisch serviertes Frontend
npm run dev:frontend    # :5173  Vite-HMR, Proxy zur Backend-API
```

Production-Build lokal prüfen:

```bash
npm run build           # Frontend + Backend bauen
npm start               # → http://localhost:8080
```

Tests:

```bash
npm --workspace backend run test        # einmalig
npm --workspace backend run test:watch  # im Watch-Modus
```

**Betriebsarten (über Provider-Schalter, siehe Konfiguration):**

- *Null-Setup:* `LLM_PROVIDER=stub`, `RETRIEVAL_PROVIDER=online` — zitiert nur
  Klexikon-Auszüge, kein API-Key nötig.
- *Produktion:* `LLM_PROVIDER=mistral`, `RETRIEVAL_PROVIDER=online` — volle
  RAG-Pipeline mit Mistral und Live-Wikis. So läuft auch die Demo.
- *Lokales Retrieval (optional):* `RETRIEVAL_PROVIDER=local` mit Qdrant und
  Embeddings; vorher `npm run crawl` und `npm run index`. Die schweren
  Abhängigkeiten dafür installiert `npm --workspace backend run install:local-rag`.

## Konfiguration

Alle Werte kommen aus Umgebungsvariablen (`.env` lokal, Projekt-Settings auf
Vercel). Geheimnisse stehen nie im Code.

| Variable | Default | Bedeutung |
|---|---|---|
| `LLM_PROVIDER` | `stub` | `stub` \| `ollama` \| `mistral` — Antwort-Generierung |
| `RETRIEVAL_PROVIDER` | `online` | `online` (MediaWiki-API) \| `local` (Qdrant) |
| `EMBEDDING_PROVIDER` | `local` | `local` \| `mistral` — nur bei lokalem Retrieval |
| `MISTRAL_API_KEY` | – | nötig, sobald ein Provider auf `mistral` steht; auch für die Moderation |
| `DEMO_PASSWORD` | – | Zugangspasswort der Demo (Single-Password-Login) |
| `ELEVENLABS_API_KEY` | – | optional; aktiviert Vorlesen und Spracheingabe |
| `ELEVENLABS_VOICE_ID` | `21m00Tcm4TlvDq8ikWAM` | Stimme (nur Default-Voices im Free-Tier) |
| `ELEVENLABS_MODEL_ID` | `eleven_multilingual_v2` | TTS-Modell |
| `GRUNDSCHULWIKI_ARCHIVE_URL` | raw-GitHub des Archiv-Repos | Quelle des Archivs; `off` → wieder Live-API |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Zeitfenster des Rate-Limits |
| `RATE_LIMIT_ASK` | `30` | Anfragen/Fenster/IP auf `/api/ask` (0 = aus) |
| `RATE_LIMIT_MEDIA` | `20` | Anfragen/Fenster/IP auf `/api/speak` + `/api/transcribe` |
| `QDRANT_URL` / `QDRANT_API_KEY` / `QDRANT_COLLECTION` | localhost / – / `klexikon` | nur bei lokalem Retrieval |
| `OLLAMA_URL` / `OLLAMA_MODEL` | localhost / `qwen2.5:7b` | nur bei `LLM_PROVIDER=ollama` |
| `CRAWLER_CONTACT` | `anonymous` | E-Mail im User-Agent für die ZUM-Admins |
| `PUBLIC_DEMO_BANNER` | – | `true` zeigt den „nicht für Kinder"-Banner |
| `NODE_ENV` / `PORT` | `development` / `8080` | Standard |

## Architektur

frag KIm ist ein RAG-System (Retrieval-Augmented Generation): Die Antwort
wird nicht frei vom Sprachmodell erfunden, sondern aus geprüften Quellen
abgeleitet. Eine Frage durchläuft folgende Kette
([`backend/src/rag/pipeline.ts`](./backend/src/rag/pipeline.ts)):

```
Frage des Kindes
   │
   ├─ 1. Deterministische Pre-Filter (triggers.ts)         ─┐
   │      sensibel? Schaden? Companion? reine Begrüßung?    │ kein LLM-Call,
   │                                                        │ feste Antwort
   ├─ 2. Input-Moderation (Mistral Moderation API, EU)     ─┘ bei Treffer
   │      sprach-agnostisches Sicherheitsnetz
   │
   ├─ 3. Query-Rewrite (rewrite.ts)
   │      Folgefrage → eigenständige Suchanfrage (Pronomen auflösen),
   │      danach erneuter Schaden-Check auf die umgeschriebene Frage
   │
   ├─ 4. Retrieval (retrieval-online.ts / -archive.ts)
   │      Klexikon (Live-MediaWiki-API) + Grundschulwiki (GitHub-Archiv)
   │
   ├─ 5. Generierung (generator.ts)
   │      Mistral mit hartem System-Prompt, gegroundet auf die Auszüge
   │
   ├─ 6. Output-Moderation (bei Allgemeinwissen-Anteilen)
   │
   └─ Antwort + Quellenangabe (oder Eskalation / Hinweis)
```

**Query-Rewrite.** Folgefragen („Kann man darin schwimmen?") werden mit dem
bisherigen Verlauf zu einer eigenständigen Suchanfrage aufgelöst, damit das
Retrieval und der Generator die Pronomen verstehen. Direkt danach läuft der
Schaden-Filter erneut, weil eine harmlose Folgefrage nach dem Umschreiben
problematisch werden kann.

**Retrieval.** Volltextsuche per MediaWiki-API in den aktivierten Quellen
(Klexikon live; Grundschulwiki aus dem GitHub-Archiv, da das Original im Juni
2026 abgeschaltet wird). Pro Quelle werden die Top-Treffer geholt, nach Rang
gewichtet und ineinander gefächert. Findet die Suche nichts, greifen
Fallbacks: Stoppwörter entfernen, dann Einzelwort-Suche. Der Artikel-HTML wird
zu sauberem Text reduziert (bis ~6000 Zeichen Kontext); das erste sinnvolle
Bild wird für die Anzeige neben der Antwort extrahiert.

**Generierung und Grounding.** Das Sprachmodell (`mistral-small-latest`, EU)
bekommt die Auszüge plus einen harten System-Prompt. Die Quellen-Logik
(„Weg 2"):

1. Liegt ein themenpassender Auszug vor, **muss** die Antwort darauf beruhen
   und dessen konkrete Angaben/Zahlen übernehmen (auch wenn das Modell es
   anders zu wissen glaubt). Die Quelle wird unter der Antwort angezeigt. Das
   ist der Normalfall.
2. Nur wenn die Auszüge die Frage nicht enthalten (oder gar keine da sind),
   darf gesichertes Allgemeinwissen genutzt werden, dann mit klarem Marker
   „Aus dem Allgemeinwissen: …" und ohne Quellenanzeige.
3. **Kombi-Antwort:** Eine Quell-Antwort kann um eine kurze
   Allgemeinwissen-Ergänzung erweitert werden (intern durch eine
   `+++`-Zeile getrennt, in der Ausgabe eingeleitet mit „Schon gewusst
   (Allgemeinwissen)?"). Der Quell-Kern bleibt gegroundet und behält die
   Quelle, die Ergänzung wird markiert und zusätzlich moderiert. Sie kommt
   nur, wenn sie echten Mehrwert bietet.

Antworten werden zuverlässig auf Deutsch generiert und für andere Sprachen in
einem zweiten Schritt übersetzt (robuster, als das kleine Modell direkt
mehrsprachig antworten zu lassen).

**Was nicht passiert.** Keine Konten, keine serverseitig gespeicherten
Verläufe, kein Tracking pro Person. Der Chatverlauf lebt nur im Browser und
wird (auf die letzten Turns gekappt) nur zur Pronomen-Auflösung mitgeschickt.

## Sicherheit

Mehrschichtig aufgebaut, weil bei der unbegleiteten Kindernutzung keine
Lehrkraft mitfiltert. Keine Schicht ist für sich perfekt; sie ergänzen sich.

1. **Deterministische Pre-Filter** ([`triggers.ts`](./backend/src/triggers.ts)),
   vor jedem LLM-Call, kostenlos und schnell:
   - *Sensible Themen* (Suizid, Selbstverletzung, Gewalt gegen das Kind,
     Essstörung, Mobbing-Opfer, Substanzkonsum) → Eskalation.
   - *Schaden an Dritten* (Verletzen, Zerstören, Anzünden, Stehlen, Waffen)
     → Abblocken. Mehrdeutige Verben verlangen einen Täter-Bezug, damit
     Naturfragen („Wie tötet eine Spinne ihre Beute?") frei bleiben.
   - *Companion-/Beziehungsversuche* → Abblocken; reine Begrüßung → Hinweis.
2. **Input-Moderation** ([`moderation.ts`](./backend/src/rag/moderation.ts),
   Mistral Moderation API, EU): prüft die Frage **sprach-agnostisch**, weil
   die deutschen Wortlisten für andere Sprachen blind sind. Selbstverletzung
   eskaliert über das API-Flag **oder** einen Score-Schwellwert (manche
   Formulierungen erkennt die API, ohne sie zu flaggen); die übrigen
   Kategorien blocken nur bei hoher Konfidenz, damit Sachfragen nicht
   fälschlich abgewiesen werden.
3. **Output-Moderation**: generierte Allgemeinwissen-Antworten und der
   Ergänzungsteil von Kombi-Antworten laufen vor der Ausgabe noch einmal
   durch die Moderation. Reine Quell-Antworten nicht — sie gelten als
   vertrauenswürdig.
4. **Eskalation** bei Krisen: feste, nicht vom LLM erzeugte Antwort mit
   Verweis auf die **Nummer gegen Kummer (116 111)**, in der jeweiligen
   Sprache.
5. **Harter System-Prompt**: keine Ich-Persona, nur Sachfragen, keine
   Schadensanleitungen, plus die Grounding-Regel (Quelle vor Eigenwissen).
6. **Test-Suite** (siehe unten): über 200 Adversarial-Fälle, deterministisch.
7. **Datensparsamkeit**: nichts wird gespeichert, EU-Sprachmodell, keine
   Weitergabe an Dritte, kein Training mit Eingaben.
8. **Rate-Limit** pro IP gegen Missbrauch der kostenpflichtigen Endpunkte.

**Fail-open vs. fail-safe.** Fällt die Moderations-API aus, wird durchgelassen
(fail-open), damit nicht jede harmlose Frage blockiert wird. Die
deterministischen Pre-Filter laufen lokal und unabhängig von der API, greifen
also auch dann.

## Mehrsprachigkeit

Oberfläche und Inhalte gibt es in Deutsch, Englisch, Türkisch, Russisch,
Ukrainisch und Arabisch.

- **UI** über i18next; die Sprache wird aus `localStorage` bzw. dem Browser
  erkannt und kann oben rechts umgeschaltet werden. Für Arabisch wird das
  Dokument auf `dir="rtl"` gestellt, `lang` immer mitgeführt.
- **Antworten** werden auf Deutsch generiert (zuverlässiger gegroundet) und
  dann übersetzt; der „Aus dem Allgemeinwissen"-Marker und das Kombi-Intro
  werden lokalisiert wieder angefügt.
- **Sicherheits-Texte** (Eskalation, Abblocken, Hinweise) liegen mehrsprachig
  in [`responses.ts`](./backend/src/responses.ts) mit Deutsch als Fallback.
  Die Hilfe-Nummer (Nummer gegen Kummer) bleibt als deutsches Angebot
  erhalten, nur die Anleitung drumherum ist übersetzt.

> Die nicht-deutschen Übersetzungen sind bislang maschinell und sollten vor
> einem echten Einsatz von Muttersprachlern geprüft werden (siehe Grenzen).

## Grundschulwiki-Archiv

Das ZUM-Grundschul-Wiki wird im **Juni 2026 abgeschaltet**. Damit die rund
1.500 Artikel als Quelle erhalten bleiben, gibt es ein separates Archiv-Repo:
[github.com/thosor87/grundschulwiki-archiv](https://github.com/thosor87/grundschulwiki-archiv)
(Artikel mit Versionsgeschichte, Bilder, MediaWiki-XML-Export, wiederherstellbar).

frag KIm liest das Archiv über `raw.githubusercontent.com` (konfigurierbar
per `GRUNDSCHULWIKI_ARCHIVE_URL`). Solange das Original noch online ist, lässt
sich mit `GRUNDSCHULWIKI_ARCHIVE_URL=off` auf die Live-API zurückschalten. Der
**Archive-Viewer** (`/archive/grundschulwiki/:title`) rendert jeden Artikel
als lesbare HTML-Seite, auch nach der Abschaltung.

## Tests

Vitest, bewusst **deterministisch und ohne LLM-Calls**, damit die Suite
schnell und reproduzierbar bleibt. Über 200 Fälle in
[`backend/test/`](./backend/test/):

- **`filters.test.ts`** — Adversarial-Fälle für die Pre-Filter: sensible
  Themen, Schaden an Dritten, Companion, Begrüßung, Identitätsfragen, und
  besonders viele Falsch-Positiv-Checks (harmlose Fragen, die Schaden- oder
  Sensibel-Wörter enthalten, dürfen nicht blockiert werden).
- **`moderation.test.ts`** — die Kategorie→Verdict-Zuordnung der Moderation
  inklusive der Score-Schwellen (Eskalation hat Vorrang vor Block).
- **`responses.test.ts`** — die mehrsprachigen Sicherheits-Texte (jede
  Sprache nicht leer, Hilfe-Nummer enthalten, Fallback auf Deutsch).

```bash
npm --workspace backend run test
```

## Deployment

Auto-Deploy bei jedem Push auf `main`:

- **Vercel** baut über [`scripts/vercel-build.sh`](./scripts/vercel-build.sh)
  und entfernt danach schwere, nur für lokales Retrieval nötige
  Abhängigkeiten, um unter dem 250-MB-Function-Limit zu bleiben.
  [`vercel.json`](./vercel.json) definiert die Catch-all-Function
  ([`api/index.ts`](./api/index.ts)) und das Output-Verzeichnis; alle Requests
  laufen durch dieselbe Fastify-App, statische Assets liefert `@fastify/static`.
- Sensible Variablen (`MISTRAL_API_KEY`, `DEMO_PASSWORD`, `ELEVENLABS_API_KEY`)
  liegen in den Vercel-Projekt-Settings, nie im Repo.
- **Auth**: Single-Password mit signiertem Cookie; ein Magic-Link
  (`?k=<hash>`) erlaubt Vorschau-Links, und Link-Vorschau-Bots bekommen
  saubere OG-Daten statt eines Redirects.

**Souveränes Hosting (offen).** Der PoC läuft auf Vercel (US). Für einen
dauerhaften, öffentlichen Betrieb mit Kinderdaten gehört das in eine souveräne
Umgebung (z. B. STACKIT/IONOS über govdigital). Für eine container-basierte
Variante liegen [`Dockerfile`](./Dockerfile) und `fly.toml` bei.

## Designentscheidungen

Phase-2-Backlog (DSFA, Trägerschaft, Schul-Login, souveränes Hosting, mehr
Quellen): [`PHASE_2.md`](./PHASE_2.md).

- **Chat-Optik, aber inhaltlich Single-Turn-Wissens-DB.** Keine
  Companion-Persona, keine Ich-Form, kein Beziehungs- oder Gefühls-Kontext.
- **Weg-2-Quellen-Linie** statt reiner Quellen-Bindung: Letztere war
  konservativer, führte bei kindlichen Folgefragen aber zu vielen
  „Weiß ich nicht"-Antworten.
- **Moderation als zweite Linie zusätzlich zu den Wortlisten**: Die Listen
  sind schnell und kostenlos, aber blind für andere Sprachen; die
  KI-Moderation schließt diese Lücke sprach-agnostisch.
- **Voice serverseitig via ElevenLabs**, weil die Browser-Speech-API unter
  macOS unzuverlässig ist (Mikro-Flackern, Anfangs-Clipping beim Vorlesen).

## Bekannte Grenzen und Roadmap

Ehrlich benannt:

- **Übersetzungen maschinell** — muttersprachliche Prüfung der Sicherheits-
  und UI-Texte steht aus, besonders für die Krisen-Texte.
- **Moderations-Lücke bei manchen Sprachen** — einzelne nicht-deutsche
  Selbstverletzungs-Formulierungen werden gestoppt, aber ohne Hilfe-Verweis.
  Das schließt nur eine sprach-spezifische, geprüfte Wortliste.
- **Rate-Limit pro Instanz** — auf Vercel zählt jede Function-Instanz für
  sich; ein global harter Deckel bräuchte geteilten Speicher (KV/Redis).
- **Kein souveränes Hosting** — aktuell Vercel (US) + ElevenLabs (US); für
  einen echten Betrieb zu migrieren.

Weiteres im [`PHASE_2.md`](./PHASE_2.md).

## Lizenz

Code: [CC BY-NC-SA 4.0](./LICENSE) — keine kommerzielle Nutzung, Änderungen
müssen bei Weitergabe unter derselben Lizenz veröffentlicht werden. Für
kommerzielle Nutzung bitte Kontakt aufnehmen.

Klexikon- und Grundschulwiki-Inhalte stehen unter CC BY-SA 4.0 ihrer
jeweiligen Quellen und sind nicht Teil dieser Lizenz.
