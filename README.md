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
- Klassisches **RAG-Pattern**: Frage → semantische Suche → Top-Treffer
  als Kontext an Mistral → kindgerechte Zusammenfassung mit
  Quellenangabe.
- **Allgemeinwissen-Fallback** für Fragen, die in den Wikis nicht
  stehen (klar gekennzeichnet mit „Allgemeinwissen: …").
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

## Architektur und Designentscheidungen

Vollständige Begründungen, was im PoC drin ist und was bewusst nicht:
[`CLAUDE.md`](./CLAUDE.md). Phase-2-Backlog (DSFA, Trägerschaft,
Schul-Login, mehr Quellen): [`PHASE_2.md`](./PHASE_2.md).

Wichtigste Designentscheidungen:

- **Chat-Optik, aber inhaltlich Single-Turn-Wissens-DB**. Keine
  Companion-Persona, keine Ich-Form als Selbstreferenz, kein
  Beziehungs- oder Gefühls-Kontext. Begründung im Markenfigur-Abschnitt
  von CLAUDE.md.
- **Weg-2-Quellen-Linie**: Klexikon und Grundschulwiki zuerst, dann
  Allgemeinwissen mit klarem Marker. Reine Quellen-Bindung wäre
  konservativer, hat aber bei kindlichen Folgefragen zu vielen
  „Weiß ich nicht"-Antworten geführt.
- **Voice serverseitig via ElevenLabs**, weil die Browser-Speech-API
  unter macOS unzuverlässig ist (Mikro-Indikator-Flackern, Anfangs-
  Clipping beim Vorlesen).
- **Pre-Filter vor dem LLM** für sensible Themen, Beziehungsangebote
  und Schadens-Anleitungen. Kein LLM-Call bei Treffern, fester
  Hinweistext mit Nummer gegen Kummer 116 111 (bei akuten Themen).
- **Moderation als zweite Verteidigungslinie**: Die deutschen Wortlisten
  sind schnell und kostenlos, aber blind für andere Sprachen. Deshalb
  prüft die Mistral-Moderation jede Frage sprach-agnostisch (Eskalation
  bei Selbstverletzung schon am Flag; übrige Kategorien nur bei hoher
  Konfidenz, damit Sachfragen wie „Wie jagt ein Löwe?" frei bleiben) und
  zusätzlich die generierten Allgemeinwissen-Antworten (geprüfte Wiki-
  Quellen werden nicht erneut moderiert). Fail-open bei API-Ausfall.
- **Tests**: deterministische Vitest-Suite (>200 Adversarial-Cases) für
  die Pre-Filter und die Moderations-Zuordnung; bewusst ohne LLM-Calls,
  damit sie schnell und reproduzierbar bleibt.

## Lizenz

Code: [CC BY-NC-SA 4.0](./LICENSE) (keine kommerzielle Nutzung,
Änderungen müssen bei Weitergabe unter derselben Lizenz veröffentlicht
werden). Für kommerzielle Nutzung: Kontakt aufnehmen.

Klexikon- und Grundschulwiki-Inhalte: CC BY-SA 4.0 ihrer jeweiligen
Quellen, nicht Teil dieser Lizenz.
