// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import english from "../locales/en.json";
import german from "../locales/de.json";

// To add a language, import its file here; steamLanguage() picks it by the two-letter code.
const TEXTS_BY_LANGUAGE = { en: english.ui, de: german.ui };
const DEFAULT_LANGUAGE = "en";

// Follows the Steam language: <html lang>, then the Steam_Language cookie, then the browser.
export function steamLanguage() {
  const pageLanguage = (document.documentElement.lang || "").toLowerCase().slice(0, 2);
  if (pageLanguage) return TEXTS_BY_LANGUAGE[pageLanguage] ? pageLanguage : DEFAULT_LANGUAGE;

  const cookieLanguage = document.cookie.match(/(?:^|;\s*)Steam_Language=([^;]+)/)?.[1];
  if (cookieLanguage) return cookieLanguage === "german" ? "de" : DEFAULT_LANGUAGE;

  const browserLanguage = (navigator.language || "").toLowerCase().slice(0, 2);
  return TEXTS_BY_LANGUAGE[browserLanguage] ? browserLanguage : DEFAULT_LANGUAGE;
}

// The UI texts of the current language.
export let texts = TEXTS_BY_LANGUAGE[DEFAULT_LANGUAGE];

export function setLanguage(language) {
  texts = TEXTS_BY_LANGUAGE[language] || TEXTS_BY_LANGUAGE[DEFAULT_LANGUAGE];
}

export const tagLabel = tagKey => texts.tags[tagKey];

// Replaces {name} placeholders, e.g. formatText("{n} more", { n: 3 }).
export function formatText(template, values) {
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder);
}
