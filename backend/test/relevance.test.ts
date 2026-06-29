import { describe, it, expect } from "vitest";
import { parseRelevantIndices } from "../src/rag/relevance.js";

// Der Relevanz-Gate fragt Mistral, welche Auszüge thematisch zur Kinderfrage
// passen. Der Mistral-Call selbst ist Integration; hier testen wir nur die
// deterministische Auswertung der Modellantwort (0-basierte Indizes).
//
// Konvention: das Modell antwortet mit den 1-basierten Auszug-Nummern oder
// mit "KEINE", wenn kein Auszug passt.

describe("parseRelevantIndices", () => {
  it("liest eine Komma-Liste von Nummern (1-basiert → 0-basiert)", () => {
    expect(parseRelevantIndices("1, 3", 3)).toEqual([0, 2]);
  });

  it("akzeptiert 'Auszug 1 und 2' u.ä. Fließtext", () => {
    expect(parseRelevantIndices("Auszug 1 und 2", 3)).toEqual([0, 1]);
  });

  it("liefert leeres Array bei 'KEINE' (nichts ist relevant)", () => {
    expect(parseRelevantIndices("KEINE", 3)).toEqual([]);
    expect(parseRelevantIndices("keine passen", 3)).toEqual([]);
  });

  it("ignoriert Nummern außerhalb des gültigen Bereichs", () => {
    expect(parseRelevantIndices("1, 5, 9", 3)).toEqual([0]);
  });

  it("dedupliziert und sortiert aufsteigend", () => {
    expect(parseRelevantIndices("3, 1, 1", 3)).toEqual([0, 2]);
  });

  it("gibt null zurück, wenn die Antwort unbrauchbar ist (fail-open: alle behalten)", () => {
    expect(parseRelevantIndices("häh?", 3)).toBeNull();
    expect(parseRelevantIndices("", 3)).toBeNull();
  });
});
