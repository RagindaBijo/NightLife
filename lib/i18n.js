import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "./locales/en";
import ka from "./locales/ka";
import ru from "./locales/ru";

const STORAGE_KEY = "languagePreference";
const DICTIONARIES = { en, ka, ru };

export const LANGUAGES = [
  { key: "en", label: "English" },
  { key: "ka", label: "ქართული" },
  { key: "ru", label: "Русский" },
];

/** The phone's language if we support it, otherwise English. */
function deviceLanguage() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en";
    const code = locale.split("-")[0].toLowerCase();
    return DICTIONARIES[code] ? code : "en";
  } catch {
    return "en";
  }
}

const languageFor = (preference) => (preference === "system" ? deviceLanguage() : preference);

// Active language for code outside React (lib/api.js error messages, formatters)
let currentLanguage = deviceLanguage();

function lookup(dictionary, key) {
  let node = dictionary;
  for (const part of key.split(".")) {
    if (node == null) return undefined;
    node = node[part];
  }
  return node;
}

// Plural category per language: en one/other, ru one/few/many, ka other only
function pluralCategory(language, count) {
  if (language === "ru") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "one";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  }
  if (language === "ka") return "other";
  return count === 1 ? "one" : "other";
}

function resolve(language, key, count) {
  const dictionary = DICTIONARIES[language];
  if (typeof count === "number") {
    const plural =
      lookup(dictionary, `${key}_${pluralCategory(language, count)}`) ??
      lookup(dictionary, `${key}_other`);
    if (plural !== undefined) return plural;
  }
  return lookup(dictionary, key);
}

/**
 * Translates a key like "settings.title". Fallback: language → English → key.
 * {name} placeholders are filled from params; params.count picks the plural form
 * (key_one / key_few / key_many / key_other).
 * Arrays and objects (e.g. FAQ lists) are returned with their placeholders filled.
 */
export function translate(key, params, language = currentLanguage) {
  const count = params?.count;
  let value = resolve(language, key, count) ?? resolve("en", key, count);
  if (value === undefined) return key;
  return params ? fill(value, params) : value;
}

// Fills {name} placeholders, also inside arrays and objects (legal sections, FAQ)
function fill(value, params) {
  if (typeof value === "string") {
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      params[name] !== undefined ? String(params[name]) : match,
    );
  }
  if (Array.isArray(value)) return value.map((item) => fill(item, params));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, params)]));
  }
  return value;
}

const I18nContext = createContext(null);

/**
 * Provides the UI language. The user picks "system" or a language in Settings;
 * "system" follows the phone. The choice is remembered.
 */
export function I18nProvider({ children }) {
  const [preference, setPreferenceState] = useState("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "system" || DICTIONARIES[saved]) {
          currentLanguage = languageFor(saved);
          setPreferenceState(saved);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const value = useMemo(() => {
    const language = languageFor(preference);
    return {
      language,
      preference,
      t: (key, params) => translate(key, params, language),
      setPreference: (next) => {
        // Set before re-rendering so translate() outside React matches right away
        currentLanguage = languageFor(next);
        setPreferenceState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    };
  }, [preference]);

  // Wait for the saved choice so the app doesn't flash the wrong language
  if (!loaded) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** { t, language, preference, setPreference } */
export const useI18n = () => useContext(I18nContext);
