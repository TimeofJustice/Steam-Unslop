// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, entry, noAiEntry, disclosure, memoryStorage, sleep, CACHE_KEY } from "./helpers.mjs";

const EIGHT_DAYS = 8 * 24 * 60 * 60 * 1000;

// Steam's answers: the user's wishlist, and store pages with or without a disclosure.
function steamWith({ wishlist, storePages = {} }) {
  return async url => {
    const address = String(url);
    if (address.includes("/dynamicstore/userdata/")) {
      return { ok: true, status: 200, json: async () => ({ rgWishlist: wishlist }) };
    }

    const appId = address.match(/\/app\/(\d+)\//)?.[1];
    if (appId && storePages[appId]) {
      return { ok: true, status: 200, text: async () => storePages[appId] };
    }
    return { ok: false, status: 404 };
  };
}

const header = '<div id="search"><form id="searchform"></form></div>';
const tile = `<a id="t" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`;

test("a wishlist game that adds an AI disclosure shows up on the Unslop button", async () => {
  const w = page({
    html: header + tile,
    fetch: steamWith({
      wishlist: [111],
      storePages: { 111: `<div id="appHubAppName">Wished Game</div>${disclosure("AI art.")}` },
    }),
  });

  // Rated before without a disclosure, by the same detection, and due again.
  const stale = { ...noAiEntry(), t: Date.now() - EIGHT_DAYS };
  const storage = memoryStorage({ [CACHE_KEY]: { 111: stale } });
  await w.SteamUnslop.start(storage);
  await sleep(400);
  const d = w.document;

  const count = d.querySelector(".unslop-nav-btn .unslop-nav-count");
  assert.equal(count.hidden, false);
  assert.equal(count.textContent, "1");
  assert.equal(storage.data.unslopNews[0].kind, "new");

  // The button opens the news first; closing them marks them as seen.
  d.querySelector(".unslop-nav-btn").click();
  assert.ok(d.querySelector(".unslop-news"));
  assert.equal(d.querySelector(".unslop-news .unslop-game-name").textContent, "Wished Game");

  d.querySelector(".unslop-news [data-close]").click();
  assert.equal(count.hidden, true);
  assert.deepEqual([...storage.data.unslopNews], []);
});

test("a better detection is no news, and neither are games off the wishlist", async () => {
  const storePages = { 111: disclosure("AI art."), 222: disclosure("AI art.") };
  const w = page({
    html:
      header +
      tile +
      '<a id="t2" data-r="0,200,300,140" href="https://store.steampowered.com/app/222/"><img src="b.jpg"></a>',
    fetch: steamWith({ wishlist: [111], storePages }),
  });

  const oldDetection = { ...noAiEntry(), v: 1, t: Date.now() };
  const notWished = { ...noAiEntry(), t: Date.now() - EIGHT_DAYS };
  const storage = memoryStorage({ [CACHE_KEY]: { 111: oldDetection, 222: notWished } });
  await w.SteamUnslop.start(storage);
  await sleep(400);

  assert.equal(w.document.querySelector(".unslop-nav-count").hidden, true);
  assert.equal(storage.data.unslopNews, undefined);
});

test("the own wishlist counts and lists its AI games", async () => {
  const w = page({
    url: "https://store.steampowered.com/wishlist/",
    fetch: steamWith({ wishlist: [111, 222, 333] }),
  });
  const storage = memoryStorage({
    [CACHE_KEY]: { 111: entry(["art"], { name: "AI Game" }), 222: noAiEntry() },
  });
  await w.SteamUnslop.start(storage);

  // 333 cannot be fetched; it is given up on after a few tries.
  await sleep(1500);
  const d = w.document;

  const card = d.querySelector(".unslop-wishlist-card");
  assert.ok(card);
  assert.match(card.textContent, /1 of 3 games on your wishlist disclose AI/);

  card.querySelector("[data-wishlist-show]").click();
  assert.equal(d.querySelector(".unslop-wishlist-games .unslop-game-name").textContent, "AI Game");
});

const wishlistRows = appIds =>
  appIds
    .map(
      (appId, index) =>
        `<a data-r="0,${index * 100},300,90" href="https://store.steampowered.com/app/${appId}/"><img src="${appId}.jpg"></a>`,
    )
    .join("");

test("someone else's wishlist shows no overview", async () => {
  const w = page({
    url: "https://store.steampowered.com/wishlist/id/someone/",
    html: wishlistRows([444, 555, 666]),
    fetch: steamWith({ wishlist: [111] }),
  });
  await w.SteamUnslop.start(memoryStorage({ [CACHE_KEY]: { 111: entry(["art"]) } }));
  await sleep(100);

  assert.equal(w.document.querySelector(".unslop-wishlist-card"), null);
});

test("the own wishlist opened by its custom address shows the overview once its rows appear", async () => {
  const w = page({
    url: "https://store.steampowered.com/wishlist/id/my-name/",
    fetch: steamWith({ wishlist: [111, 222] }),
  });
  await w.SteamUnslop.start(
    memoryStorage({ [CACHE_KEY]: { 111: entry(["art"], { name: "AI Game" }), 222: noAiEntry() } }),
  );
  await sleep(200);
  assert.equal(w.document.querySelector(".unslop-wishlist-card"), null, "no rows yet");

  // The page renders its rows after the start.
  w.document.body.insertAdjacentHTML("beforeend", wishlistRows([111, 222]));
  await sleep(1300);

  const card = w.document.querySelector(".unslop-wishlist-card");
  assert.ok(card, "the rows are all on the user's wishlist");
  assert.match(card.textContent, /1 of 2 games on your wishlist disclose AI/);
});
