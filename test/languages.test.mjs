// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { page, memoryStorage, sleep, plain } from "./helpers.mjs";

// The markup Steam uses for both the AI disclosure and the mature content description.
const block = (heading, intro, statement) => `<div class="game_page_autocollapse">
  <div id="game_area_content_descriptors" class="game_area_description">
    <h2>${heading}</h2>
    <p>${intro}</p>
    <p><i>
      ${statement}</i>
    </p>
  </div></div>`;
const headings = JSON.parse(
  readFileSync(new URL("../src/data/ai-headings.json", import.meta.url), "utf8"),
);
const mature = block(
  "Mature Content Description",
  "The developers describe the content like this:",
  "Strong language and violence.",
);

test("the disclosure is found in every store language", () => {
  const { SteamUnslop } = page();
  for (const [lang, heading] of Object.entries(headings)) {
    const info = SteamUnslop.analyze(
      block(heading, "...", "AI generated voices.<br />And some music."),
    );
    assert.ok(info, lang);
    assert.equal(info.text, "AI generated voices.\nAnd some music.", lang);
    assert.deepEqual(plain(info.tags), ["voice", "music"], lang);
  }
});

test("the mature content block is no disclosure, and a page with both reads the AI one", () => {
  const { SteamUnslop } = page();
  assert.equal(SteamUnslop.analyze(mature), null);
  const info = SteamUnslop.analyze(
    mature + block(headings.french, "Les d\u00e9veloppeurs ...", "AI art."),
  );
  assert.equal(info.text, "AI art.");
});

const tile = `<a id="t" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`;
const blurred = w => w.document.querySelector("#t").classList.contains("unslop-blur");

test("an age check page is not cached as 'no AI'", async () => {
  let calls = 0;
  const w = page({
    html: tile,
    fetch: async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        url: "https://store.steampowered.com/agecheck/app/111/",
        text: async () => "<html>age check</html>",
      };
    },
  });
  const storage = memoryStorage();
  await w.SteamUnslop.start(storage);
  await sleep(300);
  assert.equal(calls, 1, "no retries either");
  assert.ok(!blurred(w));
  await sleep(1100);
  assert.equal(storage.data.unslopCache?.["111"], undefined);
});

test("old 'no AI' entries are fetched again on stores in other languages", async () => {
  const old = { unslopCache: { 111: { ai: false, t: Date.now() } } };
  const html = block(headings.french, "...", "AI art.");
  let calls = 0;
  const fetch = async () => {
    calls++;
    return {
      ok: true,
      status: 200,
      url: "https://store.steampowered.com/app/111/",
      text: async () => html,
    };
  };

  const fr = page({ lang: "fr", html: tile, fetch });
  await fr.SteamUnslop.start(memoryStorage(old));
  await sleep(300);
  assert.equal(calls, 1);
  assert.ok(blurred(fr), "the AI game is found now");

  const en = page({ lang: "en", html: tile, fetch });
  await en.SteamUnslop.start(memoryStorage(old));
  await sleep(300);
  assert.equal(calls, 1, "English and German stores were read before, so the entry stays");
});
