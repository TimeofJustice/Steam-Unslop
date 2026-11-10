// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "release/", "dist/", "platforms/millennium/", "docs/"] },
  js.configs.recommended,
  {
    files: ["platforms/extension/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: { ...globals.browser, chrome: "readonly", SteamUnslop: "readonly" },
    },
  },
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser } },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.mjs", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } },
  },
  // Playwright runs parts of these files inside the page.
  {
    files: ["scripts/screenshots.mjs", "test/visual/*.mjs"],
    languageOptions: { globals: { ...globals.browser, SteamUnslop: "readonly" } },
  },
  {
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      // One declaration per statement; Prettier spreads combined ones over several lines.
      "one-var": ["error", "never"],
    },
  },
];
