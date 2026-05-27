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
  Mistral (EU, einfach), ElevenLabs (US, kritisch), Vercel (US —
  Drittlandtransfer nach Art. 44 ff. DSGVO bzw. EU-US Data Privacy Framework
  prüfen), GitHub (nur für Archive, möglicherweise migrierbar).
- **Rechtsgrundlage** für Datenverarbeitung mit Minderjährigen
  abklären: Art. 6 DSGVO + Art. 8 für Kinder, plus
  bundesländerspezifische Schulgesetze.

### Technische Verlagerung auf EU-Stack

- **Hosting weg von Vercel** auf STACKIT, Hetzner oder IONOS Cloud.
  Container-Setup (`Dockerfile`/`fly.toml`) ist bereits da, Migration
  überschaubar.
- **ElevenLabs ersetzen** durch eine EU-gehostete STT/TTS-Lösung (z. B.
  Gladia, Paris) oder selbst gehostete Open-Source-Modelle. ElevenLabs ist
  im PoC akzeptabel, im Produktivbetrieb nicht.
- **GitHub-Archive evtl. spiegeln** auf eigenes Storage, falls
  GitHub als US-Anbieter rechtlich problematisch wird.

### Inhaltliche Sicherheit

- **Muttersprachliche Prüfung** der nicht-deutschen Sicherheits-Texte plus
  sprach-spezifische Wortlisten. Bekannte Lücke: eine türkische
  Selbstverletzungs-Formulierung wird gestoppt, aber ohne Hilfe-Verweis.

## Was den Schulalltag bedient

### Inhaltliche Breite

- **Weitere Quellen** in den RAG-Pool aufnehmen:
  - Hanisauland (bpb, politische Bildung)
  - Seitenstark-Verbund
  - KiKA-Lexikon
  - bpb-Kinderseiten

  Jeweils Lizenz und Zugang klären; nicht jede Quelle lässt sich als sauberer
  RAG-Korpus nutzen.

  (Mehrsprachigkeit ist umgesetzt, siehe „erledigt"; offen ist nur das
  muttersprachliche Review, siehe Inhaltliche Sicherheit.)

### Aufklärung

- **Eltern-Information**: kurzes Dokument, was die KI macht und nicht macht,
  plus klare Abgrenzung zu Companion-Bots.

> Bewusst **nicht** geplant: Lehrer-Mitlese-Funktionen, Dashboards mit
> Frage-Inhalten, individuelle oder klassenbezogene Aktivitäts-Auswertung.
> Das widerspricht der unbegleiteten, datensparsamen Linie (siehe README
> „Was es nicht macht"). Wer Mitlese-/Aufsichtsfunktionen braucht, ist mit
> telli/AIS.chat oder fobizz besser bedient.

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

- **Formales Barrierefreiheits-Audit** nach BFSG / WCAG AA mit echtem
  Screenreader-Test. Grundlagen sind umgesetzt (Skip-Link, Tastatur-Fokus,
  AA-Kontraste, reduced-motion, Screenreader-Status); das formale Audit und
  selbst gehostete, gut lesbare Schriften stehen aus.
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

Details der erledigten Punkte: [`CHANGELOG.md`](./CHANGELOG.md), technischer
Stand: [`README.md`](./README.md).

- ~~Production-Hosting~~ → Vercel, Auto-Deploy aus GitHub
- ~~Eigene Domain~~ → fragkim.lilapixel.de
- ~~Webanalyse-Lösung~~ → Umami (cookieless, selbst gehostet)
- ~~Impressum und Datenschutz~~ → DDG/DSGVO-konform unter
  `/impressum` und `/datenschutz`
- ~~Linkvorschau, OG-Tags, Favicon, Mobile-Optimierung~~ → siehe v0.1.0
- ~~Output-Moderation~~ → Mistral Moderation API (EU), Stufe 2 auf
  Allgemeinwissen-Antworten
- ~~Mehrsprachige Input-Moderation~~ → sprach-agnostisches Sicherheitsnetz
  vor dem LLM (fängt Krisen auch in anderen Sprachen)
- ~~Mehrsprachigkeit~~ → UI, Antworten und Sicherheits-Texte in 6 Sprachen
  (de/en/tr/ru/uk/ar, RTL); offen bleibt das muttersprachliche Review
- ~~Rate-Limit (generisch)~~ → pro IP auf die kostenpflichtigen Endpunkte
- ~~Test-Suite~~ → über 200 Adversarial-Cases (Vitest, ohne LLM-Calls)
- ~~Barrierefreiheits-Grundlagen~~ → Skip-Link, Fokus, AA-Kontrast,
  reduced-motion, Screenreader-Status
- ~~Mobbing-Opfer-Eskalation, Grounding-Fix, Kombi-Antworten~~ → siehe
  v0.3.0 im CHANGELOG
