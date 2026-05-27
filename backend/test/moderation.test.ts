import { describe, it, expect } from "vitest";
import { classify } from "../src/rag/moderation.js";

// Prüft die deterministische Kategorie→Verdict-Zuordnung der Output-Moderation.
// Der eigentliche Mistral-API-Aufruf ist nicht deterministisch und wird hier
// nicht getestet (Integration), nur die Auswertung der Kategorie-Booleans.

const NONE = {
  sexual: false,
  hate_and_discrimination: false,
  violence_and_threats: false,
  dangerous_and_criminal_content: false,
  selfharm: false,
  health: false,
  financial: false,
  law: false,
  pii: false,
};

describe("Output-Moderation: Verdict-Zuordnung", () => {
  it("lässt saubere Antworten durch", () => {
    expect(classify({ ...NONE }).action).toBe("allow");
  });

  it("eskaliert bei selfharm (Nummer gegen Kummer)", () => {
    const v = classify({ ...NONE, selfharm: true });
    expect(v.action).toBe("escalate");
  });

  it("blockt bei sexuellem Inhalt", () => {
    expect(classify({ ...NONE, sexual: true }).action).toBe("block");
  });

  it("blockt bei Gewalt/Drohung", () => {
    expect(classify({ ...NONE, violence_and_threats: true }).action).toBe("block");
  });

  it("blockt bei gefährlichem/kriminellem Inhalt", () => {
    expect(classify({ ...NONE, dangerous_and_criminal_content: true }).action).toBe("block");
  });

  it("blockt bei Hass/Diskriminierung (deckt Mobbing-Kategorie ab)", () => {
    expect(classify({ ...NONE, hate_and_discrimination: true }).action).toBe("block");
  });

  it("Eskalation hat Vorrang vor Block bei Mehrfach-Treffer", () => {
    const v = classify({ ...NONE, selfharm: true, violence_and_threats: true });
    expect(v.action).toBe("escalate");
  });

  it("ignoriert nicht-kindrelevante Kategorien (z.B. financial)", () => {
    expect(classify({ ...NONE, financial: true, law: true, pii: true }).action).toBe("allow");
  });
});
