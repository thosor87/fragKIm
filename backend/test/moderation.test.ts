import { describe, it, expect } from "vitest";
import { classifyOutput, classifyInput } from "../src/rag/moderation.js";

// Prüft die deterministische Kategorie→Verdict-Zuordnung der Moderation.
// Der eigentliche Mistral-API-Aufruf ist nicht deterministisch und wird hier
// nicht getestet (Integration), nur die Auswertung der Kategorien.

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
    expect(classifyOutput({ ...NONE }).action).toBe("allow");
  });

  it("eskaliert bei selfharm (Nummer gegen Kummer)", () => {
    expect(classifyOutput({ ...NONE, selfharm: true }).action).toBe("escalate");
  });

  it("blockt bei sexuellem Inhalt", () => {
    expect(classifyOutput({ ...NONE, sexual: true }).action).toBe("block");
  });

  it("blockt bei Gewalt/Drohung", () => {
    expect(classifyOutput({ ...NONE, violence_and_threats: true }).action).toBe("block");
  });

  it("blockt bei gefährlichem/kriminellem Inhalt", () => {
    expect(classifyOutput({ ...NONE, dangerous_and_criminal_content: true }).action).toBe("block");
  });

  it("blockt bei Hass/Diskriminierung (deckt Mobbing-Kategorie ab)", () => {
    expect(classifyOutput({ ...NONE, hate_and_discrimination: true }).action).toBe("block");
  });

  it("Eskalation hat Vorrang vor Block bei Mehrfach-Treffer", () => {
    const v = classifyOutput({ ...NONE, selfharm: true, violence_and_threats: true });
    expect(v.action).toBe("escalate");
  });

  it("ignoriert nicht-kindrelevante Kategorien (z.B. financial)", () => {
    expect(classifyOutput({ ...NONE, financial: true, law: true, pii: true }).action).toBe("allow");
  });
});

describe("Input-Moderation: Verdict-Zuordnung (mit Score-Schwelle)", () => {
  it("lässt saubere Fragen durch", () => {
    expect(classifyInput({ ...NONE }).action).toBe("allow");
  });

  it("eskaliert bei selfharm am Flag (sprach-agnostisch, kritisch)", () => {
    expect(classifyInput({ ...NONE, selfharm: true }).action).toBe("escalate");
  });

  it("blockt Gewalt nur bei hoher Konfidenz", () => {
    // niedriger Score → Sachfrage, NICHT blocken (z.B. "Wie jagt ein Löwe?")
    expect(
      classifyInput({ ...NONE, violence_and_threats: true }, { violence_and_threats: 0.4 }).action,
    ).toBe("allow");
    // hoher Score → echte Schadensbitte, blocken
    expect(
      classifyInput({ ...NONE, violence_and_threats: true }, { violence_and_threats: 0.95 }).action,
    ).toBe("block");
  });

  it("selfharm eskaliert auch bei niedrigem Score (Flag genügt)", () => {
    expect(
      classifyInput({ ...NONE, selfharm: true }, { selfharm: 0.3 }).action,
    ).toBe("escalate");
  });

  it("blockt sexuellen Inhalt nur bei hoher Konfidenz", () => {
    // "Wie entstehen Babys?" könnte leicht sexual-Score haben → nicht blocken
    expect(classifyInput({ ...NONE, sexual: true }, { sexual: 0.5 }).action).toBe("allow");
    expect(classifyInput({ ...NONE, sexual: true }, { sexual: 0.9 }).action).toBe("block");
  });
});
