// Deterministischer Bild-Filter für Kinder-Antworten.
//
// frag KIm zeigt zu einer Antwort das erste Bild des Quell-Artikels. Das ist
// in den meisten Fällen ein harmloses Foto, aber einige Klexikon-Artikel
// führen als erstes Bild gerenderte Dokument-Scans oder unpassende Motive —
// z.B. der Artikel "Steckbrief" (Polizei-Fahndung) ein Fahndungsplakat
// "…polizistenmord.pdf.jpg". Solche Bilder dürfen Kindern nie angezeigt
// werden, unabhängig davon, ob der Relevanz-Gate die Quelle durchlässt.
//
// Bewusst konservativ und rein musterbasiert (kein Netz-/LLM-Aufruf), damit
// dieser Filter immer und ohne Latenz greift.

const BLOCKED_PATTERNS: RegExp[] = [
  // Gerenderte PDF-/Dokumentseiten (Wikimedia hängt .jpg an den .pdf-Namen).
  /\.pdf\.[a-z0-9]+(?:\?|$)/i,
  // Multi-Page-Dokument-Renders: "…/pageN-…"
  /\/page\d+-/i,
  // Tatort-/Gewalt-/Fahndungs-Motive im Dateinamen.
  /fahndung/i,
  /polizistenmord|tatort|leiche|gewalt|massaker|hinrichtung/i,
];

export function isSafeArticleImage(url: string | undefined): boolean {
  if (!url) return false;
  return !BLOCKED_PATTERNS.some((re) => re.test(url));
}
