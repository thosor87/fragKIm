import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { resources, LANGS, type LangCode } from "./locales";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "de",
    supportedLngs: LANGS.map((l) => l.code),
    interpolation: { escapeValue: false }, // React macht das Escapen selbst
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "fragkim_lang",
    },
  });

// Bei Sprachwechsel: dir-Attribut auf html setzen (RTL für Arabisch)
function applyDir(lang: string): void {
  const meta = LANGS.find((l) => l.code === lang);
  const dir = meta?.dir ?? "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang);
}
applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export default i18n;
export { LANGS };
export type { LangCode };
