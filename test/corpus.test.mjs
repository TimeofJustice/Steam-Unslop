// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* Real disclosures with reviewed tags and levels. The files hold the developers' own statements,
   so they stay local (gitignored):
   - disclosures.json from recent store releases, made by scripts/collect-disclosures.mjs. When a
     detection change moves a rating on purpose, re-rate with
     "node scripts/collect-disclosures.mjs --update" and review the diff.
   - reported.json from "wrong rating" issues, made by scripts/import-reports.mjs. Only reports
     marked reviewed are checked. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { page, plain } from "./helpers.mjs";

const load = name => {
  const file = new URL(`./fixtures/${name}`, import.meta.url);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
};

const pageOf = text =>
  `<h2>AI Generated Content Disclosure</h2><p>${text.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p><h2></h2>`;

function changedRatings(entries, describe) {
  const { SteamUnslop } = page();
  const changed = [];

  for (const entry of entries) {
    const info = SteamUnslop.analyze(pageOf(entry.text));
    const tags = plain(info.tags);
    const level = SteamUnslop.rate(info).level;

    if (tags.join() !== entry.tags.join() || level !== entry.level) {
      changed.push(
        `${describe(entry)}: expected ${entry.level} [${entry.tags}], got ${level} [${tags}]`,
      );
    }
  }
  return changed;
}

const disclosures = load("disclosures.json");
test(
  "real disclosures keep their reviewed rating",
  {
    skip: !disclosures && "no test/fixtures/disclosures.json, see scripts/collect-disclosures.mjs",
  },
  () => {
    const changed = changedRatings(disclosures, entry => `${entry.id} ${entry.name}`);
    assert.deepEqual(changed, [], `${changed.length} of ${disclosures.length} changed`);
  },
);

const reviewedReports = load("reported.json")?.filter(report => report.reviewed);
test(
  "reported wrong ratings stay fixed",
  { skip: !reviewedReports?.length && "no reviewed reports, see scripts/import-reports.mjs" },
  () => {
    const changed = changedRatings(reviewedReports, entry => `#${entry.issue} ${entry.name}`);
    assert.deepEqual(changed, [], `${changed.length} of ${reviewedReports.length} changed`);
  },
);
