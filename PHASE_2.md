# Phase 2 — Backlog (NICHT im PoC)

Stand: 2026-05-27

Sammelstelle für alles, was zwischen dem PoC (interne Demo für Erwachsene)
und einem **echten Schulwerkzeug für Kinder** liegt. Erst angehen, wenn
Trägerschaft + Finanzierung + DSFA stehen.

## Was unbedingt VOR dem ersten Kontakt mit echten Kindern stehen muss

### Recht und Trägerschaft

- **Trägerschaft klären**: Verein, gGmbH, oder Aufnahme bei bestehender
  Edu-Org (ZUM e. V., Auxie, Hanisauland-Träger)? Ohne juristische
  Person kein produktiver Betrieb mit Minderjährigen.
- **Datenschutz-Folgenabschätzung (DSFA)** nach Art. 35 DSGVO. Pflicht
  bei systematischer Verarbeitung personenbezogener Daten von
  Minderjährigen. Externe Datenschutzberatung sinnvoll.
- **Auftragsverarbeitungsverträge (AVV)** mit jedem Drittanbieter:
  Mistral (EU, einfach), ElevenLabs (US, kritisch), Vercel
  (US, Schrems-III-Risiko prüfen), GitHub (nur für Archive,
  möglicherweise migrierbar).
- **Rechtsgrundlage** für Datenverarbeitung mit Minderjährigen
  abklären: Art. 6 DSGVO + Art. 8 für Kinder, plus
  bundesländerspezifische Schulgesetze.

### Technische Verlagerung auf EU-Stack

- **Hosting weg von Vercel** auf STACKIT, Hetzner oder IONOS Cloud.
  Container-Setup (`Dockerfile`/`fly.toml`) ist bereits da, Migration
  überschaubar.
- **ElevenLabs ersetzen** durch eine EU-gehostete STT/TTS-Lösung:
  Gladia (Paris), oder selbst gehostetes Whisper-CPP + Coqui TTS.
  ElevenLabs ist im PoC akzeptabel, im Produktivbetrieb nicht.
- **GitHub-Archive evtl. spiegeln** auf eigenes Storage, falls
  GitHub als US-Anbieter rechtlich problematisch wird.

### Inhaltliche Sicherheit

- **Echte Output-Moderation** statt nur Trigger-Wortliste vor dem LLM:
  Output-Klassifikator (zweite LLM-Stufe), oder kommerzielle
  Moderations-API. Catcht Halluzinationen und subtilere Probleme,
  die unsere Trigger nicht abdecken.
  → **Umgesetzt:** Mistral Moderation API (EU) als Stufe 2, prüft die
  generierten Allgemeinwissen-Antworten (ohne Quellbeleg). Treffer →
  verwerfen + feste Meldung; `selfharm` eskaliert zur Nummer gegen Kummer,
  `hate_and_discrimination` deckt Mobbing-Inhalte ab. Siehe
  `backend/src/rag/moderation.ts`. Offen bleibt: jede Antwort prüfen (statt
  nur Allgemeinwissen), kindspezifischer Prompt-Check für subtilen Ton.
- **Input-Filter** für Schul-Mobbing-Kontext (Namen aus Klassenlisten
  hardcoded ausblenden? oder LLM-basiertes „ist das eine konkrete
  Privatperson"-Pattern).
- **Test-Suite** für Pre-Filter und RAG-Robustheit mit 200+
  Beispielfragen, darunter Adversarial-Cases (Bombe bauen, Suizid,
  Sex-Aufklärung, Drogen, Schul-Konflikte).

## Was den Schulalltag bedient

### Identitäten

- **Schul-Login** statt geteiltem Demo-Passwort: per Schul-SSO
  (Bildungslogin Niedersachsen, IServ, Microsoft for Education),
  oder schulspezifische Tokens.
- **Rate-Limiting** pro Schüler, pro Schule, pro Tag.
- **Sperrzeiten** (z. B. nur während Schulstunden, oder nicht nachts).

### Inhaltliche Breite

- **Weitere Quellen** in den RAG-Pool aufnehmen:
  - Hanisauland (bpb, politische Bildung)
  - fragFINN-Whitelist als Crawling-Hint
  - Seitenstark-Verbund
  - KiKA-Lexikon
  - bpb-Kinderseiten
- **Mehrsprachigkeit**: Türkisch, Russisch, Ukrainisch, Arabisch,
  Englisch. Mistral kann das, braucht aber sorgfältige Prompt-Anpassung.

### Schulbetrieb-Werkzeuge

- **Admin-Oberfläche pro Schule**: aktivieren/deaktivieren von
  Sprachfunktionen, Einsehen aggregierter Aktivität (keine
  individuellen Logs), eigene Trigger-Wörter ergänzen.
- **Lehrkräfte-Sicht**: Sample der gestellten Fragen für eine Klasse
  (anonymisiert), damit Lehrkraft sehen kann, was Kinder bewegt, ohne
  individuelle Überwachung.
- **Eltern-Information**: kurzes Aufklärungs-Dokument, was die KI macht
  und nicht macht, plus klare Abgrenzung zu Companion-Bots.

### Produktionsbetrieb

- **Logging** mit Datenschutzkonformität (kein
  Personenbezug, keine Frage-Inhalte mit IDs verknüpft).
- **Monitoring**: Uptime, Error-Rate, LLM-Antwortzeiten.
  Wahrscheinlich Grafana + Prometheus auf eigenem Host.
- **Backups** der Trägerschafts-relevanten Daten (Schulmitgliedschaften,
  Konfigurationen, nicht der Nutzungsdaten).
- **Incident-Response-Prozess**: was passiert wenn die KI etwas
  Falsches/Gefährliches sagt? Notfall-Off-Switch, Eskalation an
  Trägerschaft.

### Pflicht-Compliance

- **Barrierefreiheits-Audit** nach BFSG / WCAG AA. Screenreader-Test,
  Tastatur-Bedienung, Farbkontraste, Schriftgrößen. Atkinson Hyperlegible
  ist schon eingebaut, aber nicht selbst gehostet.
- **Sprachvereinfachung-Audit** mit echten Grundschulkindern: liest und
  versteht die Zielgruppe die Antworten? Iterieren am System-Prompt.

## Strategische Themen

- **Finanzierung**: Förderer (BMBF, Telekom-Stiftung, Bertelsmann-Stiftung,
  Deutsche Kinder- und Jugendstiftung). Voraussetzung: Trägerschaft.
- **Pilot-Schulen**: 2 bis 3 niedersächsische Grundschulen als
  Erstkontakt, gerne mit Lehrkräften, die offen für KI-Experimente sind.
- **Curriculum-Anbindung**: Wo im niedersächsischen Grundschullehrplan
  (Klasse 3-4 Sachunterricht, Deutsch) kann fragKIm sinnvoll andocken?
- **Verzeichniseinträge** nach Pilotphase: fragFINN-Partnerliste,
  Seitenstark, klick-tipps.net.
- **Pressepräsenz**: zurückhaltend, erst nach Trägerschaft. Kein
  Medien-Hype vor solider Grundlage.

## Was im PoC bewusst FEHLT und auch nicht in Phase 2 gehört

- Companion-Persona oder „ich"-Form auf Interaktions-Ebene
  (siehe CLAUDE.md, Markenfigur). Phase 3 oder gar nicht.
- Echtzeit-Chat mit Memory über Sessions hinweg
  (kollidiert mit Companion-Linie).
- Eigene Bilderzeugung. Kommerzielle Bild-KI bei Kindern nicht.

## Was schon erledigt ist (war früher in dieser Liste)

- ~~Production-Hosting~~ → Vercel, Auto-Deploy aus GitHub
- ~~Eigene Domain~~ → fragkim.lilapixel.de
- ~~Webanalyse-Lösung~~ → Umami (cookieless, selbst gehostet)
- ~~Impressum und Datenschutz~~ → DDG/DSGVO-konform unter
  `/impressum` und `/datenschutz`
- ~~Linkvorschau, OG-Tags, Favicon, Mobile-Optimierung~~ → siehe
  v0.1.0-Release
