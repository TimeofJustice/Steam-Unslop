// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Collects the heading of Steam's AI disclosure in every store language into
// src/data/ai-headings.json, which the build bakes into the detection.
// Usage: node scripts/collect-headings.mjs [app id of a game with an AI disclosure]
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appId = process.argv[2] || "3300800";

const STORE_LANGUAGES = [
  "english",
  "german",
  "french",
  "italian",
  "spanish",
  "latam",
  "portuguese",
  "brazilian",
  "dutch",
  "danish",
  "finnish",
  "norwegian",
  "swedish",
  "polish",
  "czech",
  "hungarian",
  "romanian",
  "bulgarian",
  "greek",
  "russian",
  "ukrainian",
  "turkish",
  "arabic",
  "thai",
  "vietnamese",
  "indonesian",
  "japanese",
  "koreana",
  "schinese",
  "tchinese",
];

const DESCRIPTOR_HEADING = /<div id="game_area_content_descriptors"[^>]*>\s*<h2>([^<]+)<\/h2>/g;

const decodeEntities = text =>
  text
    .replace(/&#(\d+);/g, (entity, codePoint) => String.fromCodePoint(codePoint))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

// The mature content block shares the markup; a game without one has only the AI block.
const headings = {};

for (const language of STORE_LANGUAGES) {
  const response = await fetch(`https://store.steampowered.com/app/${appId}/?l=${language}`, {
    headers: { cookie: "birthtime=470703601; wants_mature_content=1" },
  });
  const html = await response.text();

  const blockHeadings = [...html.matchAll(DESCRIPTOR_HEADING)].map(match =>
    decodeEntities(match[1]),
  );
  if (blockHeadings.length !== 1) {
    throw new Error(`${language}: expected one disclosure block, found ${blockHeadings.length}`);
  }

  headings[language] = blockHeadings[0];
  console.log(language.padEnd(11), headings[language]);
}

mkdirSync(join(repositoryRoot, "src/data"), { recursive: true });
writeFileSync(
  join(repositoryRoot, "src/data/ai-headings.json"),
  JSON.stringify(headings, null, 2) + "\n",
);
console.log(`Wrote src/data/ai-headings.json (${Object.keys(headings).length} languages)`);
