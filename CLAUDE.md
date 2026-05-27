# frag KIm — Leitplanken

Kindersichere KI-Wissensauskunft, angelehnt an fragFINN, mit RAG über geprüfte
Kinderquellen. Langfristig gemeinnütziges Pilotprojekt für die Primarstufe.

Dieses Dokument hält die **zeitlosen, nicht verhandelbaren Leitplanken** fest
(Kinderschutz, Markenidentität, Prinzipien) sowie die Arbeitsweise im Repo.
Für den **aktuellen technischen Stand** ist die [`README.md`](./README.md) die
maßgebliche Quelle, das Phase-2-Backlog steht in [`PHASE_2.md`](./PHASE_2.md),
die Änderungshistorie im [`CHANGELOG.md`](./CHANGELOG.md).

## PoC, keine Produktion

- Geschütztes Demo-Deployment (passwortgeschützt, EU-Komponenten), **keine
  ungeschützte Erreichbarkeit für Kinder** ohne Zugangsschranke.
- **Sobald das Angebot ungeschützt für Kinder zugänglich werden soll: STOP.**
  Dann beginnt Phase 2 mit DSFA, AVV, Trägerschaft, muttersprachlicher Prüfung
  der Sicherheits-Texte und souveränem Hosting.
- Solange Demo: Banner „Interne Entwicklungs-Demo. Nicht für Kinder bestimmt."
- Keine eigene Marken-Domain, keine Pressepräsenz, keine Verzeichniseinträge
  (Seitenstark, fragFINN-Partnerliste o. ä.) vor Phase 2.

## Was der PoC zeigt

1. RAG über Kinderquellen (Klexikon, Grundschulwiki) liefert sachlich korrekte
   Antworten in kindgerechter Sprache.
2. Ein EU-Sprachmodell (Mistral) reicht qualitativ für die Zielgruppe.
3. Quellenangaben funktionieren zuverlässig; Allgemeinwissen ist klar als
   solches markiert.
4. „Weiß ich nicht" lässt sich sauber auslösen.
5. Sicherheits-Leitplanken für die unbegleitete Kindernutzung sind machbar
   (Pre-Filter + KI-Moderation + Eskalation).

## Markenfigur — die scharfe Grenze

Das ist die Abgrenzung zu Companion-Bots (Replika, Character.ai), die Kinder
besonders gefährden. Sie ist nicht verhandelbar.

- **Brand-Ebene ja**: ein freundliches Logo, ein kleines abstraktes Symbol
  (stilisierte Glühbirne). Macht die Marke nahbar.
- **Interaktions-Ebene streng begrenzt**:
  - „Du" als Anrede ans Kind ist OK („Du kannst nachlesen…").
  - **Keine Ich-Form als Selbstreferenz** („ich denke", „ich finde", „ich
    weiß"). Stattdessen unpersönlich/sachlich („Geparde sind…").
  - Kein „Hi, ich bin KIm!", kein Avatar, keine Animation, die das System
    lebendig wirken lässt.
  - Kein Beziehungsangebot, kein Smalltalk, keine Gefühlsfragen ans System.
    Der Pre-Filter blockt das vor dem LLM ab und leitet zurück auf Sachfragen.
- Identitätsfragen („wer bist du", „bist du eine KI") werden knapp und sachlich
  in dritter Person beantwortet, nicht als „Wesen".

## Architektur-Prinzipien (nicht verhandelbar)

1. **Quelle vor Generierung.** Liegt ein passender Auszug vor, beruht die
   Antwort darauf und übernimmt dessen konkrete Angaben/Zahlen, nicht das
   eigene Modellwissen.
2. **Herkunft transparent.** Aus den Quellen beantwortete Fragen zeigen die
   Quelle; Allgemeinwissen wird klar markiert („Aus dem Allgemeinwissen: …")
   und nicht mit geprüften Quellen vermischt.
3. **„Weiß ich nicht" ist ein gültiges Ergebnis** — lieber ehrlich als
   halluzinieren.
4. **Sprachstil**: einfach, freundlich, geduldig, ohne Babysprache, nie
   herablassend.
5. **Kein Companion-Charakter** auf Interaktions-Ebene (siehe Markenfigur).

## Sicherheits-Leitplanken

Mehrschichtig, weil bei der unbegleiteten Kindernutzung keine Lehrkraft
mitfiltert (Details und aktueller Stand: README, Abschnitt „Sicherheit"):

- **Deterministische Pre-Filter** vor dem LLM (`backend/src/triggers.ts`):
  sensible Themen → Eskalation (Nummer gegen Kummer 116 111); Schaden an
  Dritten → Abblocken; Companion/Beziehung → Abblocken; reine Begrüßung →
  Hinweis.
- **KI-Moderation** (Mistral, EU) auf Eingabe und auf Allgemeinwissen-Anteile
  der Antwort, sprach-agnostisch.
- **Datensparsamkeit**: keine Konten, keine gespeicherten Verläufe.

Sensible Themen sind kein „Edge Case", sondern der Kern. Änderungen an den
Filtern oder am System-Prompt immer gegen die Test-Suite (`backend/test/`)
prüfen.

## Design (an fragFINN angelehnt, eigene Identität)

Warm, freundlich, große runde Formen, großzügiger Weißraum, kindgerecht ohne
kindisch. Distinkte Marke, **nicht** orange wie fragFINN.

- **Farben**: Primär warmes Türkis `#2BB3A3`, Akzent sonniges Gelb `#FFC857`,
  Hintergrund cremeweiß `#FBF8F3`, Text Anthrazit `#2A2D34`. Gefüllte Buttons
  mit weißer Schrift nutzen einen tieferen Ton (WCAG-AA-Kontrast). Mindestens
  WCAG AA, für Fließtext besser AAA.
- **Typografie**: eine gut lesbare Schrift (Ziel: Atkinson Hyperlegible,
  selbst gehostet, kein Google Fonts), große Basisgröße, großzügige Zeilenhöhe.
- **Layout**: Chat-Optik mit Bubbles (vertraut aus Messengern), aber inhaltlich
  zustandsloses Single-Turn-Q&A. Eingabe sticky unten, Banner oben, dünner
  Footer. Quellen kompakt am Ende der Antwort. Maximale Inhaltsbreite ~760px,
  mobile-first.
- **Bewegung/Sound**: minimale Übergänge, kein Bouncing/Confetti, keine Sounds,
  dezenter Lade-Indikator (kein „denkender Charakter"). `prefers-reduced-motion`
  respektieren.

## Arbeitsweise im Repo

- Klein anfangen, lauffähig vor schön.
- Vor jeder neuen Abhängigkeit Lizenz und Datenfluss prüfen (Telemetrie? Wo
  hostet der Anbieter? EU?).
- **Keine hartkodierten Credentials/Keys** — Secrets nur in `.env`
  (gitignored) bzw. den Hosting-Settings.
- Änderungen an Sicherheit/Filtern/Prompt mit der Test-Suite absichern; bei
  sicherheitsrelevantem Verhalten gegen die echte Pipeline gegentesten, nicht
  nur behaupten.
- Bei Unklarheit nachfragen, nicht raten.
- Private Kommunikation/Outreach gehört nicht ins (öffentliche) Repo (siehe
  `.gitignore`).
