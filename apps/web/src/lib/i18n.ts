import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";

export const RTL_LANGUAGES = new Set(["ar"]);

export function applyDocumentDirection(lang: string) {
  const dir = RTL_LANGUAGES.has(lang) ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    fallbackLng: "ar",
    supportedLngs: ["ar", "en"],
    // Arabic is the product's primary language by design (not just a
    // fallback) — a fresh browser always starts in Arabic regardless of
    // its OS/browser locale. Only an explicit pick via the language
    // switcher (which this same detector then caches to localStorage)
    // moves it to English.
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "accora.lang",
    },
    interpolation: { escapeValue: false },
  });

applyDocumentDirection(i18n.resolvedLanguage ?? "ar");
i18n.on("languageChanged", applyDocumentDirection);

export default i18n;
