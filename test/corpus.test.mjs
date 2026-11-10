// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* Real disclosures from the store with reviewed tags and levels. The file holds the developers'
   own statements, so it stays local (gitignored); create it with scripts/collect-disclosures.mjs.
   When a detection change moves a rating on purpose, re-rate with
   `node scripts/collect-disclosures.mjs --update` and review the diff. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { page, plain } from "./helpers.mjs";

const file = new URL("./fixtures/disclosures.json", import.meta.url);
const corpus = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
const pageOf = text =>
  `<h2>AI Generated Content Disclosure</h2><p>${text.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p><h2></h2>`;

test(
  "real disclosures keep their reviewed rating",
  { skip: !corpus && "no test/fixtures/disclosures.json, see scripts/collect-disclosures.mjs" },
  () => {
    const { SteamUnslop } = page();
    const wrong = [];
    for (const d of corpus) {
      const info = SteamUnslop.analyze(pageOf(d.text));
      const tags = plain(info.tags);
      const level = SteamUnslop.rate(info).level;
      if (tags.join() !== d.tags.join() || level !== d.level)
        wrong.push(`${d.id} ${d.name}: expected ${d.level} [${d.tags}], got ${level} [${tags}]`);
    }
    assert.deepEqual(wrong, [], `${wrong.length} of ${corpus.length} changed`);
  },
);
