# Changelog

Alle nennenswerten Änderungen an frag KIm. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

## [0.3.0] – 2026-05-27

### Hinzugefügt
- **Kombi-Antworten**: Eine Quell-Antwort kann um eine kurze, klar
  markierte Allgemeinwissen-Ergänzung erweitert werden (Klexikon-Fakt plus
  erläuternder Zusatz, eingeleitet mit „Schon gewusst (Allgemeinwissen)?").
  Der Quell-Kern bleibt gegroundet und behält die Quelle; der
  Ergänzungsteil läuft zusätzlich durch die Output-Moderation. Wird nur
  angehängt, wenn er echten Mehrwert bietet.
- README deutlich ausgebaut: ausführliche Abschnitte zu Architektur (mit
  Ablaufdiagramm) und zu den Sicherheitsmechanismen.

### Geändert
- **Grounding-Fix (wichtig):** Antworten greifen jetzt zuerst auf
  Klexikon/Grundschulwiki und übernehmen deren konkrete Angaben. Vorher
  markierte das LLM fast jede Antwort als „Allgemeinwissen", obwohl der
  passende Artikel vorlag, und blendete so die Quellen aus. Schlimmer: bei
  „Wie schnell läuft ein Gepard?" überschrieb es die Klexikon-Angabe
  (93 km/h) mit eigenem Wissen (130 km/h). Jetzt kommt 93, mit Quelle.
- Marker reiner Allgemeinwissen-Antworten: „Aus dem Allgemeinwissen: …"
  statt des nackten „Allgemeinwissen: …".

## [0.2.1] – 2026-05-27

### Behoben
- **Kritisch: selfharm-Eskalation verfehlt bei nicht-deutschen Formulierungen.**
  Mistral setzt das `selfharm`-Boolean-Flag bei manchen Sprachen nicht,
  obwohl der Score hoch ist — „Artık yaşamak istemiyorum" (tr, „ich will
  nicht mehr leben") lieferte Score 0.80, Flag `false`, und rutschte als
  „weiß ich nicht" durch, statt zur Nummer gegen Kummer zu eskalieren.
  Jetzt wird `selfharm` über Flag **oder** Score (≥ 0.5) erkannt, auf Input
  und Output. Verifiziert gegen die echte Moderation-API.

### Bekannte Einschränkung
- Mistrals Moderation verfehlt manche türkische Selbstverletzungs-Formulierungen
  ganz (z.B. „kendime zarar vermek istiyorum" → Score 0.002). Sprach-spezifische,
  von Muttersprachlern geprüfte Wortlisten bleiben für echten Einsatz nötig.

## [0.2.0] – 2026-05-27

Sicherheits- und Mehrsprachigkeits-Ausbau. Schwerpunkt: die Leitplanken
funktionieren jetzt auch außerhalb des Deutschen.

### Hinzugefügt
- **Mehrsprachigkeit**: Oberfläche, Antworten und alle festen Sicherheits-
  Texte in Deutsch, Englisch, Türkisch, Russisch, Ukrainisch und Arabisch
  (inkl. RTL). Antworten werden zuverlässig auf Deutsch generiert und dann
  übersetzt.
- **Output-Moderation** (Mistral Moderation API, EU) auf generierte
  Allgemeinwissen-Antworten: Treffer werden verworfen, `selfharm`
  eskaliert zur Nummer gegen Kummer, `hate_and_discrimination` deckt
  Mobbing-Inhalte ab. Geprüfte Wiki-Antworten laufen nicht durch.
- **Input-Moderation** (kritisch): Die Frage wird vor dem LLM sprach-
  agnostisch geprüft — eine Krise („ich will nicht mehr leben") wird so
  auch auf Türkisch/Arabisch erkannt, wo die deutschen Wortlisten blind
  sind. `selfharm` eskaliert am Flag; übrige Kategorien blocken nur bei
  hoher Konfidenz (Score ≥ 0.85), damit Sachfragen frei bleiben.
- **Rate-Limit** pro IP/Minute auf die kostenpflichtigen Endpunkte
  (`/api/ask`, `/api/speak`, `/api/transcribe`), env-konfigurierbar.
- **Barrierefreiheit**: Skip-Link, globaler sichtbarer Fokus-Ring,
  Screenreader-Status für Laden/Fehler, `prefers-reduced-motion` beim
  Scrollen, WCAG-AA-Kontrast (tieferer Button-Ton statt hellem Türkis
  mit weißer Schrift).
- **Test-Suite** auf über 200 Adversarial-Cases ausgebaut (Pre-Filter +
  Moderations-Zuordnung), Vitest, ohne LLM-Calls.

### Geändert
- Feste Sicherheits-Texte aus `triggers.ts`/`moderation.ts` in ein
  zentrales, mehrsprachiges `responses.ts` ausgelagert.
- Datenschutzseite um die Sicherheitsprüfung der Eingabe ergänzt
  (gleicher Auftragsverarbeiter Mistral, kein neuer Empfänger).

### Behoben
- Schaden-Filter blockierte Naturfragen wie „Wie tötet eine Spinne ihre
  Beute?" — mehrdeutige Verben verlangen jetzt einen Täter-Bezug.
- „schläg" als zu breiter Trigger ließ „Wie schlägt man ein Ei auf?" und
  „Warum schlägt das Herz?" fälschlich eskalieren — jetzt mit Ich-Bezug.
- Mobbing-Opfer („ich werde gemobbt") lösen jetzt Eskalation aus, ohne
  die Sachfrage „Warum werden Kinder gemobbt?" zu blockieren.
- Doppeltes Label über dem Eingabefeld (fehlende `.visually-hidden`-Regel).
- „Senden"-Button war hartkodiert deutsch.

## [0.1.0] – 2026-05-27

Erster Demo-Release.

### Hinzugefügt
- Chat-Oberfläche mit RAG über Klexikon (live) und Grundschulwiki
  (GitHub-Archiv), Allgemeinwissen-Fallback mit Marker.
- Deutsche Pre-Filter für sensible Themen, Companion-Versuche und
  Schadens-Anleitungen.
- Vorlesen (ElevenLabs TTS) und Spracheingabe (ElevenLabs Scribe STT).
- Archive-Viewer für die Grundschulwiki-Artikel.
- Single-Password-Auth mit Cookie + Magic-Link, Impressum/Datenschutz.
- Deployment auf Vercel, Domain fragkim.lilapixel.de.

[0.3.0]: https://github.com/thosor87/fragKIm/releases/tag/v0.3.0
[0.2.1]: https://github.com/thosor87/fragKIm/releases/tag/v0.2.1
[0.2.0]: https://github.com/thosor87/fragKIm/releases/tag/v0.2.0
[0.1.0]: https://github.com/thosor87/fragKIm/releases/tag/v0.1.0
