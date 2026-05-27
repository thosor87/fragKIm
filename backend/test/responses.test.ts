import { describe, it, expect } from "vitest";
import {
  escalationResponse,
  harmResponse,
  offtopicResponse,
  greetingResponse,
  noAnswerText,
  moderationBlockResponse,
} from "../src/responses.js";

const LANGS = ["de", "en", "tr", "ru", "uk", "ar"];

describe("Mehrsprachige Sicherheits-Texte", () => {
  it("liefert für jede Sprache einen nicht-leeren Text", () => {
    for (const lang of LANGS) {
      expect(escalationResponse(lang).text.trim().length).toBeGreaterThan(0);
      expect(harmResponse(lang).text.trim().length).toBeGreaterThan(0);
      expect(offtopicResponse(lang).text.trim().length).toBeGreaterThan(0);
      expect(greetingResponse(lang).text.trim().length).toBeGreaterThan(0);
      expect(noAnswerText(lang).trim().length).toBeGreaterThan(0);
      expect(moderationBlockResponse(lang).text.trim().length).toBeGreaterThan(0);
    }
  });

  it("Eskalation enthält in jeder Sprache die Hilfe-Nummer 116 111", () => {
    for (const lang of LANGS) {
      expect(escalationResponse(lang).text).toContain("116 111");
      expect(escalationResponse(lang).sources[0].url).toContain("nummergegenkummer");
    }
  });

  it("übersetzt tatsächlich (en weicht von de ab)", () => {
    expect(escalationResponse("en").text).not.toBe(escalationResponse("de").text);
    expect(harmResponse("tr").text).not.toBe(harmResponse("de").text);
  });

  it("fällt bei unbekannter Sprache auf Deutsch zurück", () => {
    expect(noAnswerText("xx")).toBe(noAnswerText("de"));
    expect(greetingResponse("zz").text).toBe(greetingResponse("de").text);
  });
});
