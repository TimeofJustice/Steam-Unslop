// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Collects real AI disclosures from recent store releases into test/fixtures/disclosures.json,
// for the local regression test test/corpus.test.mjs. The file holds the developers' statements
// and stays out of the repository. The expected tags and levels come from the current detection;
// review them once, the test then guards them.
// Usage: node scripts/collect-disclosures.mjs [count]   (needs the built dist/core.js)
//        node scripts/collect-disclosures.mjs --update  (re-rate the existing statements only)
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = join(repositoryRoot, "test/fixtures/disclosures.json");
const onlyUpdate = process.argv.includes("--update");
const wantedCount = Number(process.argv.find(argument => /^\d+$/.test(argument)) || 150);

const COOKIE = "birthtime=470703601; wants_mature_content=1; Steam_Language=english";
const PARALLEL_REQUESTS = 4;

const { window } = new JSDOM('<html lang="en"><body></body></html>', {
  runScripts: "outside-only",
  url: "https://store.steampowered.com/",
});

// Only the detection is used.
window.IntersectionObserver = class {
  observe() {}
  unobserve() {}
};
window.eval(readFileSync(join(repositoryRoot, "dist/core.js"), "utf8"));
const { SteamUnslop } = window;

function rateStatement(text) {
  const escapedText = text.replace(/</g, "&lt;").replace(/\n/g, "<br>");
  const info = SteamUnslop.analyze(
    `<h2>AI Generated Content Disclosure</h2><p>${escapedText}</p><h2></h2>`,
  );
  const rating = SteamUnslop.rate(info);

  return { tags: [...info.tags], level: rating.level, hints: rating.hints.map(hint => hint.key) };
}

const writeDisclosures = disclosures =>
  writeFileSync(outputFile, JSON.stringify(disclosures, null, 2) + "\n");

const knownDisclosures = existsSync(outputFile) ? JSON.parse(readFileSync(outputFile, "utf8")) : [];

if (onlyUpdate) {
  writeDisclosures(
    knownDisclosures.map(disclosure => ({ ...disclosure, ...rateStatement(disclosure.text) })),
  );
  console.log(`Re-rated ${knownDisclosures.length} disclosures`);
  process.exit(0);
}

const fetchStore = (url, type = "text") =>
  fetch(url, { headers: { cookie: COOKIE } }).then(response =>
    response.ok ? response[type]() : null,
  );
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const disclosuresById = new Map(knownDisclosures.map(disclosure => [disclosure.id, disclosure]));

async function collectDisclosure(appId) {
  const html = await fetchStore(`https://store.steampowered.com/app/${appId}/`);
  const info = html && SteamUnslop.analyze(html);
  if (!info?.text) return;

  const name = html.match(/id="appHubAppName"[^>]*>([^<]+)</)?.[1].trim() || "";
  disclosuresById.set(appId, { id: appId, name, text: info.text, ...rateStatement(info.text) });
  console.log(`${disclosuresById.size}`.padStart(4), appId, name);
}

// Search results of recent releases with an AI disclosure (category 998), newest first.
for (let offset = 0; disclosuresById.size < wantedCount && offset < 3000; offset += 100) {
  const results = await fetchStore(
    `https://store.steampowered.com/search/results/?sort_by=Released_DESC&category1=998&start=${offset}&count=100&infinite=1`,
    "json",
  );

  const foundIds = [...(results?.results_html || "").matchAll(/data-ds-appid="(\d+)"/g)].map(
    match => match[1],
  );
  const newIds = [...new Set(foundIds)].filter(appId => !disclosuresById.has(appId));

  for (let index = 0; index < newIds.length && disclosuresById.size < wantedCount;) {
    const batch = newIds.slice(index, index + PARALLEL_REQUESTS);
    index += PARALLEL_REQUESTS;

    await Promise.all(batch.map(collectDisclosure));
    await sleep(300);
  }
}

mkdirSync(dirname(outputFile), { recursive: true });
writeDisclosures([...disclosuresById.values()].sort((first, second) => first.id - second.id));
console.log(`Wrote ${disclosuresById.size} disclosures to test/fixtures/disclosures.json`);
