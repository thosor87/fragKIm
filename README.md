# fragKIm – PoC

Kindersichere KI-gestützte Frage-Antwort-Suche, RAG über das Klexikon.
**Das ist ein PoC, keine Produktion.** Zugang nur passwortgeschützt, EU-gehostet.
Vollständige Leitplanken in [`CLAUDE.md`](./CLAUDE.md).

## Schnellstart (lokal)

```bash
# 1. Abhängigkeiten
npm install

# 2. Environment
cp .env.example .env
# MISTRAL_API_KEY eintragen (https://console.mistral.ai/)
# DEMO_BASIC_AUTH_USER / DEMO_BASIC_AUTH_PASSWORD setzen

# 3. Qdrant starten
npm run qdrant:up

# 4. Klexikon-Dump bereitstellen
# Lege eine JSONL-Datei unter ./klexikon-dump/articles.jsonl an,
# je Zeile: { "title": "...", "url": "https://klexikon.zum.de/wiki/...", "text": "..." }
# Quelle: XML-Dump des ZUM-Wikis (bevorzugt) oder respektvoller Crawler.

# 5. Indexieren
npm run index

# 6. Backend + Frontend im Dev-Modus
npm run dev:backend     # :8080
npm run dev:frontend    # :5173 (proxy → :8080)
```

Öffne <http://localhost:5173/>. Im Production-Build (s. unten) liefert
Fastify das Frontend mit aus.

## Production-Build (lokal)

```bash
npm run build
npm start
# → http://localhost:8080/
```

## Deployment (Fly.io, Region fra)

```bash
# Qdrant zuerst (eigene App mit Volume)
fly apps create fragkim-qdrant
fly volumes create qdrant_data --region fra --size 1 --app fragkim-qdrant
fly deploy --app fragkim-qdrant -c fly.qdrant.toml

# Backend + Frontend (eine App)
fly apps create fragkim-poc
fly secrets set --app fragkim-poc \
  MISTRAL_API_KEY=... \
  QDRANT_URL=http://fragkim-qdrant.internal:6333 \
  DEMO_BASIC_AUTH_USER=demo \
  DEMO_BASIC_AUTH_PASSWORD=...
fly deploy --app fragkim-poc
```

Anschließend Indexing einmalig laufen lassen (lokal, mit `QDRANT_URL` auf
einen `fly proxy 6333 -a fragkim-qdrant` getunnelten Port).

## Was der PoC NICHT hat

Siehe [`CLAUDE.md`](./CLAUDE.md) → Abschnitt „Was im PoC bewusst FEHLT". Wenn
der Wunsch aufkommt, eines davon mitzubauen: nicht tun, in `PHASE_2.md` notieren.

## Struktur

```
backend/        Fastify + RAG-Pipeline + Basic Auth
frontend/       Vite + React, eine Seite, eine Suchleiste
shared/         Trigger-Liste für Eskalation
scripts/        Indexing (Klexikon → Qdrant)
Dockerfile      Multi-stage Build (Frontend + Backend)
fly.toml        App
fly.qdrant.toml Qdrant separat
```
