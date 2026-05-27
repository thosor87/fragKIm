import { describe, it, expect } from "vitest";
import {
  isSensitive,
  isHarmRequest,
  isCompanionRequest,
  isGreetingOnly,
} from "../src/triggers.js";
import {
  SENSITIVE_CASES,
  HARM_CASES,
  COMPANION_CASES,
  GREETING_CASES,
  IDENTITY_OK_CASES,
  SAFE_CASES,
  HARM_FALSE_POSITIVE_CASES,
} from "./fixtures.js";

describe("Pre-Filter: sensible Themen → Eskalation", () => {
  for (const q of SENSITIVE_CASES) {
    it(`erkennt sensibel: "${q}"`, () => {
      expect(isSensitive(q)).toBe(true);
    });
  }
});

describe("Pre-Filter: Schaden an Dritten → blockiert", () => {
  for (const q of HARM_CASES) {
    it(`erkennt Schaden: "${q}"`, () => {
      expect(isHarmRequest(q)).toBe(true);
    });
  }
});

describe("Pre-Filter: Companion/Beziehung → blockiert", () => {
  for (const q of COMPANION_CASES) {
    it(`erkennt Companion: "${q}"`, () => {
      expect(isCompanionRequest(q)).toBe(true);
    });
  }
});

describe("Pre-Filter: reine Begrüßung → Hinweis", () => {
  for (const q of GREETING_CASES) {
    it(`erkennt Begrüßung: "${q}"`, () => {
      expect(isGreetingOnly(q)).toBe(true);
    });
  }
});

describe("Identitätsfragen werden NICHT als Companion geblockt", () => {
  for (const q of IDENTITY_OK_CASES) {
    it(`lässt Identitätsfrage durch: "${q}"`, () => {
      expect(isCompanionRequest(q)).toBe(false);
    });
  }
});

describe("Legitime Sachfragen: KEIN Filter greift (Falsch-Positiv-Schutz)", () => {
  for (const q of SAFE_CASES) {
    it(`bleibt frei: "${q}"`, () => {
      expect(isSensitive(q)).toBe(false);
      expect(isHarmRequest(q)).toBe(false);
      expect(isCompanionRequest(q)).toBe(false);
      // Sachfragen sind keine reinen Begrüßungen
      expect(isGreetingOnly(q)).toBe(false);
    });
  }
});

describe("Schaden-Filter: keine Falsch-Positive bei harmlosen Fragen", () => {
  for (const q of HARM_FALSE_POSITIVE_CASES) {
    it(`blockt NICHT fälschlich: "${q}"`, () => {
      expect(isHarmRequest(q)).toBe(false);
    });
  }
});
