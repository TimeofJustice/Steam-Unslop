// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, start, entry, noAiEntry, sleep } from "./helpers.mjs";

// 111 discloses AI art, 333 AI voices, 222 has no disclosure.
const cache = {
  111: entry(["art"], { name: "AI Game" }),
  222: noAiEntry(),
  333: entry(["voice"], { name: "Voice Game" }),
};

// The store API names the games of each bundle.
function storeWith(bundleGames) {
  return async url => {
    const address = String(url);
    if (!address.includes("/IStoreBrowseService/GetItems/")) return { ok: false, status: 404 };

    const input = JSON.parse(new URL(address).searchParams.get("input_json"));
    const storeItems = input.ids.map(({ bundleid }) => ({
      id: bundleid,
      name: `Bundle ${bundleid}`,
      included_appids: bundleGames[bundleid],
    }));
    return { ok: true, status: 200, json: async () => ({ response: { store_items: storeItems } }) };
  };
}

const bundleTile = (id, bundleId) =>
  `<a id="${id}" data-r="0,0,300,140" href="https://store.steampowered.com/bundle/${bundleId}/Pack/">` +
  `<img src="${bundleId}.jpg"></a>`;

const isBlurred = (w, id) => w.document.getElementById(id).classList.contains("unslop-blur");

test("a bundle with an AI game is blurred and sums up the AI use of its games", async () => {
  const w = page({
    html: bundleTile("pack", 500),
    fetch: storeWith({ 500: [111, 222, 333] }),
  });
  await start(w, cache);
  await sleep(150);
  const d = w.document;

  assert.ok(isBlurred(w, "pack"));
  const tags = [...d.querySelectorAll("#pack .unslop-tags em")].map(tag => tag.textContent);
  assert.deepEqual(tags.sort(), ["Art", "Voices"]);
  assert.equal(
    d.querySelector('#pack [data-tile-action="ignore"]'),
    null,
    "bundles cannot be ignored",
  );

  d.querySelector('#pack [data-tile-action="why"]').click();
  const pages = d.querySelector(".unslop-dialog .unslop-game-pages");
  const shownPage = () =>
    `${pages.querySelector(".unslop-game-name").textContent}: ` +
    [...pages.querySelectorAll(".unslop-game-rating .unslop-tags em")]
      .map(tag => tag.textContent)
      .join(", ") +
    ` | ${pages.querySelector("blockquote").textContent}`;

  // One page per AI game, the higher rated (art, Medium) before the lower (voices).
  assert.equal(pages.querySelector(".unslop-game-count").textContent, "Game 1 of 2");
  assert.equal(shownPage(), "AI Game: Art | x");
  assert.equal(pages.querySelector("[data-page-prev]").disabled, true);

  pages.querySelector("[data-page-next]").click();
  assert.equal(shownPage(), "Voice Game: Voices | x");
  assert.equal(pages.querySelector("[data-page-next]").disabled, true);

  pages.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  assert.equal(shownPage(), "AI Game: Art | x", "the arrow keys turn the pages too");
});

test("a bundle without AI games stays visible", async () => {
  const w = page({ html: bundleTile("clean", 600), fetch: storeWith({ 600: [222] }) });
  await start(w, cache);
  await sleep(150);

  assert.ok(!isBlurred(w, "clean"));
  assert.ok(!w.document.querySelector("#clean").classList.contains("unslop-wait"));
});

test("a bundle whose AI games are all shown anyway stays visible", async () => {
  const w = page({ html: bundleTile("allowed", 700), fetch: storeWith({ 700: [111] }) });
  await start(w, cache);
  w.SteamUnslop.applySettings({ minLevel: 0, allow: [{ id: "111", name: "AI Game" }] });
  await sleep(150);

  assert.ok(!isBlurred(w, "allowed"));
});
