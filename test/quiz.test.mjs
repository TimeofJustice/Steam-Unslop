// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { page, start, entry, disclosure, plain } from "./helpers.mjs";

const tiles = `
  <a id="low" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>
  <a id="high" data-r="0,200,300,140" href="https://store.steampowered.com/app/222/"><img src="b.jpg"></a>`;
const cache = { 111: entry(["transl"]), 222: entry(["live", "art"]) };
const blurred = (w, sel) => w.document.querySelector(sel).classList.contains("unslop-blur");
const quiz = w => w.document.querySelector(".unslop-quiz");

for (const lang of ["en", "de"]) {
  test(`the ${lang} examples cover every level once the detection has rated them`, () => {
    const { SteamUnslop } = page({ lang });
    const examples = JSON.parse(
      readFileSync(new URL(`../src/locales/${lang}.json`, import.meta.url), "utf8"),
    ).ui.quizExamples;
    const levels = examples.map(t => SteamUnslop.rate(SteamUnslop.analyze(disclosure(t))).level);
    assert.deepEqual(plain(levels), [0, 1, 1, 1, 2, 2, 3, 3]);
  });
}

async function runQuiz(answers) {
  const w = page({ html: tiles });
  const storage = await start(w, cache);
  const d = w.document;
  d.querySelector('#low [data-tile-action="why"]').click();
  d.querySelector("[data-settings]").click();
  d.querySelector(".unslop-settings-dialog [data-quiz]").click();
  for (const a of answers)
    quiz(w)
      .querySelector(`[data-answer="${a ? 1 : 0}"]`)
      .click();
  return { w, d, storage };
}

test("answers suggest the matching level; keeping it saves it and closes the settings", async () => {
  const { w, d, storage } = await runQuiz([false, false, false, false, true, true, true, true]);
  assert.equal(quiz(w).querySelector(".unslop-quiz-result b").textContent, "Medium and above");
  assert.deepEqual(
    [...quiz(w).querySelectorAll(".unslop-quiz-state")].map(s => s.classList.contains("on")),
    [false, false, false, false, true, true, true, true],
  );
  quiz(w).querySelector("[data-quiz-keep]").click();
  assert.equal(quiz(w), null);
  assert.equal(d.querySelector(".unslop-settings-dialog"), null);
  assert.equal(storage.data.unslopSettings.minLevel, 2);
  assert.ok(!blurred(w, "#low"));
  assert.ok(blurred(w, "#high"));
});

test("choose myself preselects the suggestion without saving", async () => {
  const { w, d, storage } = await runQuiz([false, true, true, true, true, true, true, true]);
  quiz(w).querySelector("[data-quiz-choose]").click();
  assert.equal(quiz(w), null);
  assert.ok(d.querySelector('.unslop-settings-dialog input[value="1"]').checked);
  assert.equal(storage.data.unslopSettings.minLevel, 0);
});

test("back revises an answer; contradicting answers fall back to blurring more", async () => {
  const w = page({ html: tiles });
  await start(w, cache);
  const d = w.document;
  d.querySelector('#low [data-tile-action="why"]').click();
  d.querySelector("[data-settings]").click();
  d.querySelector("[data-quiz]").click();
  quiz(w).querySelector('[data-answer="1"]').click();
  quiz(w).querySelector("[data-quiz-back]").click();
  assert.ok(quiz(w).textContent.includes("Example 1 of 8"));
  // Only the low one shown: "any disclosure" and "low and above" both miss once, the lower one wins.
  for (const a of [true, false, true, true, true, true, true, true])
    quiz(w)
      .querySelector(`[data-answer="${a ? 1 : 0}"]`)
      .click();
  assert.equal(quiz(w).querySelector(".unslop-quiz-result b").textContent, "Any disclosure");
});
