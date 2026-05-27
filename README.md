# frag KIm

Kindersichere KI-Wissensauskunft, angelehnt an die Idee von fragFINN.
**Proof of Concept**, interne Demo-Phase. Live: <https://fragkim.lilapixel.de>

> Diese Instanz ist eine interne Entwicklungs-Demo und **nicht für Kinder
> bestimmt**. Vollständige Leitplanken in [`CLAUDE.md`](./CLAUDE.md).

## Was es macht

- Chat-Interface, Antworten kommen aus
  [Klexikon](https://klexikon.zum.de/) (live) und
  [Grundschulwiki](https://github.com/thosor87/grundschulwiki-archiv)
  (lokales Archive, weil das Original im Juni 2026 abgeschaltet wird).
- Klassisches **RAG-Pattern**: Frage → Suche in den Wikis → Top-Treffer
  als Kontext an Mistral → kindgerechte Antwort mit Quellenangabe. Liegt
  ein passender Artikel vor, wird zwingend dessen Angabe verwendet (auch
  die konkreten Zahlen), nicht das eigene Modellwissen.
- **Allgemeinwissen-Fallback** für Fragen, die in den Wikis nicht stehen
  (klar gekennzeichnet mit „Allgemeinwissen: …"). Als **Kombi-Antwort**
  kann ein Quell-Kern um eine kurze, markierte Allgemeinwissen-Ergänzung
  erweitert werden (Klexikon-Fakt plus erläuternder Zusatz).
- **Zweistufige Sicherheit**: schnelle deutsche Pre-Filter (Wortlisten/
  Regex, kein LLM-Call) plus **Mistral-Moderation als sprach-agnostisches
  Netz** — auf den Input (vor dem LLM) und auf generierte Allgemeinwissen-
  Antworten. Sensible Themen, Beziehungsangebote, Vandalismus-Anleitungen
  und Mobbing werden abgefangen; bei Notlagen erscheint die Nummer gegen
  Kummer.
- **Mehrsprachig**: Oberfläche, Antworten und Sicherheits-Texte in
  Deutsch, Englisch, Türkisch, Russisch, Ukrainisch und Arabisch (inkl.
  RTL). Antworten werden zuverlässig auf Deutsch generiert und übersetzt.
- **Barrierefreiheit**: Skip-Link, sichtbarer Fokus, Screenreader-Status,
  WCAG-AA-Kontraste, `prefers-reduced-motion`.
- **Rate-Limit** pro IP gegen Missbrauch der kostenpflichtigen Endpunkte.
- **Single-Turn-Memory** im Browser (letzte 6 Turns), nichts wird
  serverseitig gespeichert.
- **Vorlesen** (ElevenLabs TTS) und **Spracheingabe** (ElevenLabs
  Scribe STT) optional.
- **Archive-Viewer** unter `/archive/grundschulwiki/:title`: jeder
  archivierte Artikel als lesbare HTML-Seite mit Bildern und Wiki-Links
  innerhalb des Archivs. Funktioniert auch nach der Original-Abschaltung.

## Stack

| Schicht | Technik |
|---|---|
| Frontend | React + Vite, Single-Page Chat-UI |
| Backend | Fastify (Node 20), als Vercel Serverless Function |
| LLM | Mistral La Plateforme (`mistral-small-latest`, EU) |
| Moderation | Mistral Moderation API (`mistral-moderation-latest`, EU) |
| i18n | i18next, 6 Sprachen (de/en/tr/ru/uk/ar, RTL) |
| TTS / STT | ElevenLabs (Stimme „Sarah", Scribe v1) |
| Retrieval | Live MediaWiki-API + GitHub-Archive-Mirror |
| Auth | Single-Password mit signiertem Cookie + Magic-Link |
| Hosting | Vercel (Production), eigene Domain via DNS |
| Webanalyse | Umami (selbst gehostet, cookieless) |

## Lokal starten

```bash
npm install
cp .env.example .env
# Werte in .env eintragen (mindestens DEMO_PASSWORD, MISTRAL_API_KEY)

npm run dev:backend     # :8080 (Backend + statisch serviertes Frontend)
npm run dev:frontend    # :5173 (HMR, Proxy zur Backend-API)
```

Optional Voice (TTS + STT):

```
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL  # Sarah (Default-Voice, Free API)
```

Production-Build lokal testen:

```bash
npm run build
npm start
# → http://localhost:8080
```

## Deployment

Aktuell läuft ein Auto-Deploy bei jedem Push auf `main`:

- **Vercel** zieht den Build (`vercel.json` definiert Function +
  outputDirectory). Eine Catch-all-Function leitet alle Requests durch
  Fastify, statische Assets werden von `@fastify/static` ausgeliefert.
- Sensible Env-Vars (`MISTRAL_API_KEY`, `DEMO_PASSWORD`,
  `ELEVENLABS_API_KEY`) liegen in Vercel-Projekt-Settings.

Wer die Anwendung migrieren möchte (z. B. auf STACKIT/Hetzner für
Phase 2): siehe `Dockerfile` und `fly.toml`/`fly.qdrant.toml` für eine
Container-basierte Variante. Lokales Embedding-Retrieval mit Qdrant ist
ebenfalls eingebaut, aktivierbar via `RETRIEVAL_PROVIDER=local`.

## Architektur

frag KIm ist ein RAG-System (Retrieval-Augmented Generation): Die Antwort
wird nicht frei vom Sprachmodell erfunden, sondern aus geprüften Quellen
abgeleitet. Eine Frage durchläuft folgende Kette (Code:
[`backend/src/rag/pipeline.ts`](./backend/src/rag/pipeline.ts)):

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
   │      Folgefrage → eigenständige Suchanfrage (Pronomen auflösen)
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

**Retrieval.** Gesucht wird per MediaWiki-Volltextsuche in den aktivierten
Quellen (Klexikon live, Grundschulwiki aus dem GitHub-Archiv, da das
Original im Juni 2026 abgeschaltet wird). Pro Quelle werden die Top-Treffer
geholt, nach Rang gewichtet und ineinander gefächert. Findet die Suche
nichts, greifen Fallbacks (Stoppwörter entfernen, dann Einzelwort-Suche).
Der Artikeltext wird aus HTML zu sauberem Text reduziert und (bis ~6000
Zeichen) als Kontext mitgegeben; das erste sinnvolle Bild wird für die
Anzeige neben der Antwort extrahiert.

**Generierung und Grounding.** Das Sprachmodell (`mistral-small-latest`,
EU) bekommt die Auszüge plus einen harten System-Prompt. Die Quellen-Logik
(„Weg 2"):

1. Liegt ein themenpassender Auszug vor, **muss** die Antwort darauf
   beruhen und dessen konkrete Angaben/Zahlen übernehmen (auch wenn das
   Modell es anders zu wissen glaubt). Die Quelle wird unter der Antwort
   angezeigt. Das ist der Normalfall.
2. Nur wenn die Auszüge die Frage nicht enthalten (oder gar keine da
   sind), darf gesichertes Allgemeinwissen genutzt werden, dann mit
   klarem Marker „Allgemeinwissen: …" und ohne Quellenanzeige.
3. **Kombi-Antwort**: Eine Quell-Antwort kann um eine kurze
   Allgemeinwissen-Ergänzung erweitert werden (intern durch eine
   `+++`-Zeile getrennt). Der Quell-Kern bleibt gegroundet und behält die
   Quelle, die Ergänzung wird markiert und zusätzlich moderiert.

Antworten werden zuverlässig auf Deutsch generiert und für andere Sprachen
in einem zweiten Schritt übersetzt (robuster, als das kleine Modell direkt
mehrsprachig antworten zu lassen).

**Was nicht passiert.** Keine Konten, keine serverseitig gespeicherten
Verläufe, kein Tracking pro Person. Der Chatverlauf lebt nur im Browser der
laufenden Sitzung und wird (gekappt auf die letzten Turns) nur zur
Pronomen-Auflösung mitgeschickt.

## Sicherheit

Die Sicherheit ist mehrschichtig aufgebaut, weil bei der unbegleiteten
Kindernutzung keine Lehrkraft mitfiltert. Keine Schicht ist für sich
perfekt; sie ergänzen sich.

1. **Deterministische Pre-Filter** ([`triggers.ts`](./backend/src/triggers.ts)),
   vor jedem LLM-Call, kostenlos und schnell:
   - *Sensible Themen* (Suizid, Selbstverletzung, Gewalt gegen das Kind,
     Essstörung, Mobbing-Opfer, Substanzkonsum) → Eskalation.
   - *Schaden an Dritten* (Verletzen, Zerstören, Anzünden, Stehlen,
     Waffen) → Abblocken. Mehrdeutige Verben verlangen einen Täter-Bezug,
     damit Naturfragen („Wie tötet eine Spinne ihre Beute?") frei bleiben.
   - *Companion-/Beziehungsversuche* → Abblocken; reine Begrüßung → Hinweis.
2. **Input-Moderation** ([`moderation.ts`](./backend/src/rag/moderation.ts),
   Mistral Moderation API, EU): prüft die Frage **sprach-agnostisch**, weil
   die deutschen Wortlisten für andere Sprachen blind sind. Selbstverletzung
   eskaliert über das Flag **oder** einen Score-Schwellwert (manche
   Formulierungen werden von der API erkannt, aber nicht geflaggt); die
   übrigen Kategorien blocken nur bei hoher Konfidenz, damit Sachfragen
   nicht fälschlich abgewiesen werden.
3. **Output-Moderation**: generierte Allgemeinwissen-Antworten und der
   Ergänzungsteil von Kombi-Antworten laufen vor der Ausgabe noch einmal
   durch die Moderation (reine Quell-Antworten nicht, die gelten als
   vertrauenswürdig).
4. **Eskalation** bei Krisen: feste, nicht vom LLM erzeugte Antwort mit
   Verweis auf die **Nummer gegen Kummer (116 111)**, in der jeweiligen
   Sprache.
5. **Harter System-Prompt**: keine Ich-Persona, nur Sachfragen, keine
   Schadensanleitungen; plus die Grounding-Regel (Quelle vor Eigenwissen).
6. **Test-Suite** ([`backend/test/`](./backend/test/)): über 200
   Adversarial-Fälle für die Pre-Filter und die Moderations-Zuordnung,
   deterministisch und ohne LLM-Calls (schnell und reproduzierbar).
7. **Datensparsamkeit**: nichts wird gespeichert, EU-Sprachmodell, keine
   Weitergabe an Dritte, kein Training mit Eingaben.
8. **Rate-Limit** pro IP gegen Missbrauch der kostenpflichtigen Endpunkte.

**Fail-open vs. fail-safe.** Fällt die Moderations-API aus, wird
durchgelassen (fail-open), damit nicht jede harmlose Frage blockiert wird.
Die deterministischen Pre-Filter laufen lokal und unabhängig von der API,
greifen also auch dann.

**Bekannte Grenzen (ehrlich).** Die Übersetzungen sind bislang maschinell
und sollten von Muttersprachlern geprüft werden. Die Moderation verfehlt
manche nicht-deutschen Selbstverletzungs-Formulierungen (z. B. eine
türkische Variante, die zwar gestoppt, aber ohne Hilfe-Verweis abgeblockt
wird). Das schließt nur eine sprach-spezifische, geprüfte Wortliste.

## Designentscheidungen

Vollständige Begründungen, was im PoC drin ist und was bewusst nicht:
[`CLAUDE.md`](./CLAUDE.md). Phase-2-Backlog (DSFA, Trägerschaft,
Schul-Login, souveränes Hosting, mehr Quellen): [`PHASE_2.md`](./PHASE_2.md).

- **Chat-Optik, aber inhaltlich Single-Turn-Wissens-DB.** Keine
  Companion-Persona, keine Ich-Form als Selbstreferenz, kein Beziehungs-
  oder Gefühls-Kontext.
- **Weg-2-Quellen-Linie** statt reiner Quellen-Bindung: Letztere war
  konservativer, führte bei kindlichen Folgefragen aber zu vielen
  „Weiß ich nicht"-Antworten.
- **Voice serverseitig via ElevenLabs**, weil die Browser-Speech-API unter
  macOS unzuverlässig ist (Mikro-Flackern, Anfangs-Clipping beim Vorlesen).

## Lizenz

Code: [CC BY-NC-SA 4.0](./LICENSE) (keine kommerzielle Nutzung,
Änderungen müssen bei Weitergabe unter derselben Lizenz veröffentlicht
werden). Für kommerzielle Nutzung: Kontakt aufnehmen.

Klexikon- und Grundschulwiki-Inhalte: CC BY-SA 4.0 ihrer jeweiligen
Quellen, nicht Teil dieser Lizenz.
