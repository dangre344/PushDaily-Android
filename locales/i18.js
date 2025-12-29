import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";
import en from "../locales/en.json";
import hi from "../locales/hi.json";

const locales = getLocales();
const primaryLocale = locales[0]?.languageTag || "en";

i18n.use(initReactI18next).init({
  compatibilityJSON: "v3",
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: primaryLocale,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

I18nManager.forceRTL(locales[0]?.textDirection === "rtl");

export default i18n;
