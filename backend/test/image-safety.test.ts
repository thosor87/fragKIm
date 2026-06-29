import { describe, it, expect } from "vitest";
import { isSafeArticleImage } from "../src/rag/image-safety.js";

// Deterministischer Bild-Filter: hält Dokument-Scans und thematisch
// ungeeignete Bilder aus Kinder-Antworten heraus, BEVOR sie als Quelle
// angehängt werden. Hintergrund: Der Klexikon-Artikel "Steckbrief" (im Sinne
// von Polizei-Fahndung) hat als erstes Bild ein gerendertes Fahndungsplakat
// "…polizistenmord.pdf.jpg" — das darf einem Kind nie angezeigt werden.

describe("isSafeArticleImage", () => {
  it("blockt das gerenderte Fahndungsplakat aus dem Steckbrief-Artikel", () => {
    const url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/" +
      "Fahndungsplakat-komplett_polizistenmord.pdf/" +
      "page1-330px-Fahndungsplakat-komplett_polizistenmord.pdf.jpg";
    expect(isSafeArticleImage(url)).toBe(false);
  });

  it("blockt gerenderte PDF-Seiten generell (Dokument-Scans)", () => {
    const url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/23/" +
      "Irgendein_Dokument.pdf/page1-200px-Irgendein_Dokument.pdf.jpg";
    expect(isSafeArticleImage(url)).toBe(false);
  });

  it("blockt Dateinamen mit Gewalt-/Tatort-Bezug", () => {
    const url =
      "https://upload.wikimedia.org/wikipedia/commons/a/b/Tatort_Leiche.jpg";
    expect(isSafeArticleImage(url)).toBe(false);
  });

  it("lässt ein normales Tier-Foto durch", () => {
    const url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/" +
      "Panthera_tigris_corbett.jpg/330px-Panthera_tigris_corbett.jpg";
    expect(isSafeArticleImage(url)).toBe(true);
  });

  it("behandelt fehlende URL als unsicher", () => {
    expect(isSafeArticleImage(undefined)).toBe(false);
    expect(isSafeArticleImage("")).toBe(false);
  });
});
