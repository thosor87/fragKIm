# Projekt: frag KIm – PoC

Kindersichere KI-gestützte Frage-Antwort-Suche, angelehnt an fragFINN, mit RAG
über geprüfte Kinderseiten. Langfristig gemeinnütziges Pilotprojekt für Schulen
in Niedersachsen. **Dieses Repo ist der PoC**, nicht die spätere Produktion.

## Wichtig: Das ist ein PoC, keine Produktion

- Lokale Entwicklung plus geschütztes Demo-Deployment (passwortgeschützt, EU-gehostet)
- **Keine ungeschützte Erreichbarkeit für Kinder** – Zugang nur über
  Cloudflare Access, Basic Auth oder ähnliche Schranke
- Nutzung nur für Demo-Termine: Schulleitungen, Förderer, Auxie-Team, Thomas, Birgit
- Sobald die Anwendung ungeschützt für Kinder zugänglich wäre: STOP, dann beginnt
  Phase 2 mit DSFA, AVV, Trägerschaft, Moderation usw.
- Demo-Banner permanent in der UI: "Interne Entwicklungs-Demo. Nicht für Kinder bestimmt."

## Deployment (PoC-Modus)

**Plattform: Fly.io, Region `fra` (Frankfurt).** EU-gehostet, Docker-Support
für Qdrant + Backend, Free Tier reicht für Demo-Last. Subdomain
`fragkim-poc.fly.dev`; *keine* echte Marken-Domain, bis Trägerschaft und DSFA
stehen. Alternative wäre Vercel + Qdrant Cloud, aber US-gehostet – deshalb
gleich EU.

### App-Architektur

Eine Fly-App, ein Container, beides drin: Fastify-Backend serviert die statisch
gebaute React-Frontend. Qdrant als separate Fly-App in derselben Region mit
persistent volume – kommuniziert über Flys internes 6PN-Netz
(`qdrant.internal:6333`). Trennt sauber Compute und Daten, kostet im Free Tier
trotzdem nichts.

### Dockerfile-Erwartungen

- Multi-stage Build: Stage 1 baut Frontend (Vite, `npm run build`), Stage 2 ist
  Node 20 alpine
- Backend serviert `dist/` des Frontends statisch via `@fastify/static`
- Exposed Port 8080, Health-Check-Endpoint `/healthz` (no auth)
- Non-root user, kein `npm install` zur Laufzeit

### fly.toml-Erwartungen

- `primary_region = "fra"`
- `[http_service]`: `internal_port = 8080`, `force_https = true`,
  `auto_stop_machines = true`, `auto_start_machines = true`, `min_machines_running = 0`
- `[[http_service.checks]]` auf `/healthz`
- Qdrant-App separat mit `[mounts] source = "qdrant_data" destination = "/qdrant/storage"`

### Environment / Secrets (per `fly secrets set`, nie ins Repo)

- `MISTRAL_API_KEY`
- `QDRANT_URL` (z. B. `http://fragkim-qdrant.internal:6333`)
- `QDRANT_API_KEY` (falls aktiviert)
- `DEMO_BASIC_AUTH_USER` und `DEMO_BASIC_AUTH_PASSWORD`
- `NODE_ENV=production`
- `PUBLIC_DEMO_BANNER=true`

### Zugangsschutz (mindestens eine Variante, idealerweise beide)

**Basic Auth in Fastify (MVP-Tauglich, sofort fertig):**
- `@fastify/basic-auth` auf allen Routen außer `/healthz` und statischen Assets
- Credentials aus Environment, ein gemeinsames Demo-Passwort pro Termin
- Erste Zeile Verteidigung, reicht für Termine mit 1–2 Personen

**Cloudflare Access (für richtige Demos mit mehreren Stakeholdern):**
- Subdomain bei Cloudflare verwalten (kostenlos), CNAME auf Fly
- Zero Trust → Access → Applications → Self-hosted, Hostname eintragen
- Policy: Allow + Include "Emails" mit Liste der Demo-Teilnehmer
- Identity Provider: One-Time-PIN per E-Mail (kein Account nötig)
- Vorteil: kein geteiltes Passwort, audit-fähig

### Suchmaschinen-Sperre, Linkvorschau erlaubt (Stand 2026-05-26)

- `robots.txt: User-agent: *\nDisallow: /` bleibt
- `<meta name="robots" content="noindex,nofollow,noarchive">` im `<head>` bleibt
- **Open-Graph-Tags und Twitter-Card sind erlaubt**, damit beim Teilen mit
  Förderern, Schulleitungen und Auxie-Team eine ordentliche Vorschau erscheint
  (Marke + Demo-Hinweis + neutrales Bild)
- Vorschau-Text muss klar machen: interne Demo, nicht für Kinder bestimmt

### Deploy-Workflow (manuell, kein CI/CD)

```
npm run build            # Frontend bauen
fly deploy               # Image bauen, deployen
fly secrets set KEY=...  # Secrets setzen
fly logs                 # Logs live
fly status               # Maschinen-Status
```

### Was NICHT auf das PoC-Deployment gehört

- Eigene Marken-Domain (fragkim.de, frag-kim.de etc.)
- Erwähnung in sozialen Medien, Newslettern, Pressekontakten
- Eintrag in Verzeichnissen (Seitenstark, Auxie, fragFINN-Partnerliste)
- Marketing-Seite, öffentliche Status-Page
- Sentry, Plausible, sonstiges externes Monitoring (auch wenn DSGVO-freundlich –
  jetzt noch nicht)

Alles davon erst nach Phase 2 (Trägerschaft + DSFA).

## Was der PoC beweisen soll

1. RAG über Klexikon liefert sachlich korrekte Antworten in kindgerechter Sprache
2. Mistral (EU-gehostet) reicht qualitativ für die Zielgruppe
3. Quellenangaben funktionieren zuverlässig (immer ein Klexikon-Link pro Antwort)
4. "Weiß ich nicht" lässt sich sauber auslösen, wenn die Whitelist nichts hergibt
5. Eine simple Trigger-basierte Eskalation für sensible Themen ist machbar
6. Das Ganze ist demo-fähig in unter zwei Wochenenden Arbeit

## Korpus: ausschließlich Klexikon

- Quelle: klexikon.zum.de (Wikipedia für Kinder, ~3.500 Artikel)
- Lizenz: CC BY-SA – Quellenangabe pflicht, Lizenz im Footer der UI
- Bevorzugt: offiziellen XML-Dump nutzen (ZUM-Wiki / MediaWiki) statt zu crawlen.
  Falls kein Dump verfügbar: respektvoller Crawler mit eigenem User-Agent
  ("fragKIm-PoC-Crawler / Kontakt: ..."), Rate Limit, robots.txt beachten.
- Re-Index manuell per Skript, kein Scheduler im PoC.
- Klexikon-Texte werden zu Chunks (~300–500 Tokens, mit Überlappung), Metadaten:
  Artikel-Titel, Klexikon-URL, letzter Update-Zeitstempel.

## Tech-Stack PoC (bewusst minimal)

Provider-Schalter per Env (`.env`), Default-Pfad funktioniert ohne externe Keys:

- **Retrieval**: `RETRIEVAL_PROVIDER=online|local`
  - `online` (Default): MediaWiki-API live gegen klexikon.zum.de, mit
    Stopwort-Strip und Per-Wort-Fallback. Null Setup.
  - `local`: Qdrant + Embeddings, Voraussetzung sind `npm run crawl` + `npm run index`.
- **Embeddings** (nur bei `local`): `EMBEDDING_PROVIDER=local|mistral`
  - `local` (Default): `@huggingface/transformers` mit `Xenova/multilingual-e5-base`.
  - `mistral`: `mistral-embed` via API.
- **LLM**: `LLM_PROVIDER=stub|mistral`
  - `stub` (Default): kein LLM, gibt Klexikon-Auszug verbatim aus.
    Erlaubt End-to-End-Tests ohne Key.
  - `mistral`: Mistral La Plateforme, Modell `mistral-small-latest`.
- **Auth**: Single-Password mit Magic-Link-Cookie (HTTP-only, 30 Tage).
  Login-Seite hat ein Passwort-Feld, Magic-Link `?k=<sha256-token>`
  setzt Cookie und redirected.
- **Vector DB**: Qdrant in Docker, lokal und auf Fly.io (nur bei `local`-Retrieval).
- **Backend**: Node.js + TypeScript + Fastify, ein Repo, ein Service.
- **Frontend**: Vite + React, Chat-UI (siehe „Layout").
- **Setup**: `docker-compose.yml` für lokal, `fly.toml` für Deployment.

Wenn Python für Indexing-Schritte deutlich einfacher ist: separates Skript in
`scripts/` ist okay. Kein zweiter Service in Produktion.

## Design (zielgruppengerecht, an fragFINN angelehnt)

**Anlehnung, nicht Kopie.** fragFINN-Prinzip übernehmen: warm, freundlich, große
runde Formen, großzügiger Weißraum, kindgerecht ohne kindisch zu wirken. Aber
mit distinkter Markenidentität – nicht orange wie fragFINN.

**Farben (Vorschlag):**
- Primär: warmes Türkis `#2BB3A3` (klar abgegrenzt zu fragFINN-Orange)
- Akzent: sonniges Gelb `#FFC857` für CTA und Highlights
- Hintergrund: cremeweiß `#FBF8F3` (augenfreundlicher als grellweiß)
- Text: dunkles Anthrazit `#2A2D34`, kein reines Schwarz
- Mindestkontrast WCAG AA, für Fließtext besser AAA

**Typografie:**
- Eine einzige Schrift, sehr gut lesbar: **Atkinson Hyperlegible** (auch bei
  Leseschwäche lesbar), alternativ **Nunito** oder **Lexend**
- **Selbst hosten**, kein Google Fonts (Datenschutz, auch im PoC)
- Basis-Größe 18px+, Antwort-Text 20px, Überschrift 32–40px
- Großzügige Zeilenhöhe (1.5–1.7)

**Layout (Stand 2026-05-26 überarbeitet):**
- Chat-Optik mit Bubbles, weil Kinder das aus WhatsApp/iMessage kennen.
  Aber inhaltlich streng zustandsloses Single-Turn-Q&A (siehe „Markenfigur").
- Eingabezeile sticky unten, Bubbles scrollen darüber, Demo-Banner sticky oben.
- Letzte 6 Turns als Browser-State (React useState) gehen als Kontext mit;
  nichts wird gespeichert, weg bei Reload, kein localStorage, keine Server-Logs.
- „Neues Gespräch"-Button leert den State sofort.
- Antwort-Bubble zeigt Klexikon-Quellen kompakt am Ende.
- Footer mit Lizenz-Hinweis (Klexikon CC BY-SA) und Hinweis „Nichts wird gespeichert".
- Maximale Inhaltsbreite ~760px, mobile-first, Tablet-tauglich.

**Markenfigur – wichtige Unterscheidung:**
- **Brand-Ebene ja**: ein freundliches Logo, gerne ein kleines abstraktes Symbol
  (z. B. stilisierte Glühbirne). Macht die Marke nahbar.
- **Interaktions-Ebene streng begrenzt**:
  - „Du" als Anrede ans Kind ist OK („Du kannst nachlesen…").
  - Keine Ich-Form als Selbstreferenz („ich denke", „ich finde", „ich weiß").
    Stattdessen unpersönlich: „Im Klexikon steht…", „Geparde sind…".
  - Kein „Hi, ich bin KIm!", kein Avatar, keine Animation, die das System
    lebendig wirken lässt.
  - Kein Beziehungsangebot, kein Smalltalk, keine Gefühlsfragen ans System.
    Pre-Filter blockt das vor dem LLM ab, fester Hinweistext leitet zurück
    auf Sachfragen.
- Das ist die scharfe Abgrenzung zu Companion-Bots (Replika, Character.ai),
  die Kinder besonders gefährden.

**Bewegung und Sound:**
- Minimale Animationen (200ms Übergänge), kein Bouncing, kein Confetti
- Keine Sound-Effekte
- Lade-Indikator dezent, kein "denkender Charakter"

## Architektur-Prinzipien (auch im PoC nicht verhandelbar)

1. **RAG vor Generierung**: Ohne abgerufene Klexikon-Quellen keine Antwort.
2. **Quellenangabe pflicht**: Jede Antwort verlinkt mindestens einen Klexikon-Artikel.
3. **"Weiß ich nicht" ist ein gültiges Ergebnis** – lieber ehrlich als halluzinieren.
4. **Sprachstil**: einfach, freundlich, geduldig, ohne Babysprache, nie herablassend.
5. **Kein Companion-Charakter auf Interaktions-Ebene** (siehe Design-Abschnitt):
   Antworten in sachlicher dritter Person oder direkter Information, nicht in
   Ich-Form. Marke darf freundlich sein, das System spricht nicht als "Wesen".

## Drei Pre-Filter vor der RAG-Pipeline

In `backend/src/triggers.ts`, alle ohne LLM-Call:

1. **Sensible Themen** (Suizid, Gewalt, Missbrauch, Drogen, Essstörung):
   feste Antwort mit Verweis auf erwachsene Bezugsperson + Nummer gegen Kummer 116 111.
2. **Companion-/Off-Topic-Versuche** („wer bist du", „magst du mich",
   „bist du mein Freund", „tu so als ob", Gefühlsfragen ans System):
   feste Abblock-Antwort, leitet zurück auf Sachfragen.
3. **Begrüßung allein** („Hallo", „Hi"): kurzer Hinweistext mit Beispielfragen.

Reicht für die Demo. Wird in Produktion durch echte Klassifikation ersetzt.

## Was im PoC bewusst FEHLT (kommt erst in Phase 2)

- Echte Input-/Output-Moderation jenseits der Trigger-Liste
- Logging, QS-Backend, Admin-Oberfläche
- Schul-Login, User-Verwaltung im App-Layer, Rate Limiting
- Mehrere Quellen (fragFINN-Whitelist, Seitenstark, bpb, KiKA)
- DSFA, AVV, Trägerschaftsfragen, Verträge
- Production-Hosting jenseits der Demo-Subdomain, TLS-eigene-Domain, Backups, Monitoring
- Tests jenseits der RAG-Kernlogik und Eskalations-Trigger
- Mehrsprachigkeit, Barrierefreiheits-Audit
- Eigene Marken-Domain, Pressepräsenz, Verzeichniseinträge

Wenn der Wunsch aufkommt, eines davon "schnell mitzubauen": nicht tun, in
PHASE_2.md notieren und im PoC ignorieren.

## Arbeitsweise mit Claude Code

- Klein anfangen, lauffähig vor schön
- Vor jeder neuen Abhängigkeit: Lizenz und Datenfluss prüfen (sendet sie
  Telemetrie? Wo hostet der Anbieter?)
- Tests bevorzugt für RAG-Logik und Eskalations-Trigger
- Bei Unklarheit nachfragen, nicht raten
- Nicht in Production-Modus abdriften: kein Reverse-Proxy-Custom-Setup, kein
  Auth-System im App-Layer, keine Multi-Tenant-Strukturen, kein CI/CD

## Aktueller Stand (2026-05-26)

PoC lokal lauffähig auf `http://localhost:8080/`. Default-Konfiguration ist
key-frei: Online-Retrieval gegen Klexikon-API + Stub-Generator. Login per
Magic-Link `?k=<sha256(DEMO_PASSWORD)>` oder Passwort-Eingabe.

Funktioniert:
- Chat-UI mit Bubbles, Browser-Memory letzte 6 Turns, „Neues Gespräch"-Button.
- Pre-Filter: Eskalation / Off-Topic / Begrüßung.
- Online-Retrieval (Klexikon MediaWiki-API live) inkl. Stopwort-Strip und
  Per-Wort-Fallback (sonst scheitert die AND-Volltextsuche).
- Magic-Link-Login, 30 Tage Cookie.
- Lokales Indexing-Skript (`npm run crawl` + `npm run index`) für späteres
  Umschalten auf `RETRIEVAL_PROVIDER=local` mit lokalen Embeddings.

Noch offen:
- Mistral-Anbindung (LLM_PROVIDER=mistral) testen, sobald Key da.
- Selbst gehostete Atkinson-Hyperlegible-Fonts nach `frontend/public/fonts/`.
- Fly.io-Deployment (Konfiguration fertig, noch nicht ausgeführt).
