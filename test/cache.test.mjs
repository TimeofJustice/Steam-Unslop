// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, memoryStorage, disclosure, sleep, plain, CACHE_KEY } from "./helpers.mjs";

const tile = `<a id="t" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`;
const storePage = `<html><body><div id="appHubAppName">Test Game</div>${disclosure("AI voices.")}</body></html>`;
const fetchStore = async () => ({ ok: true, status: 200, text: async () => storePage });
const blurred = w => w.document.querySelector("#t").classList.contains("unslop-blur");

test("session cache blurs known games before the persistent cache has loaded", async () => {
  const storage = memoryStorage({}, 800);
  const w1 = page({ html: tile, fetch: fetchStore });
  w1.SteamUnslop.start(storage);
  await sleep(1300);
  assert.ok(blurred(w1));
  w1.dispatchEvent(new w1.Event("pagehide"));
  const session = { unslopSession: w1.sessionStorage.getItem("unslopSession") };
  assert.deepEqual(plain(JSON.parse(session.unslopSession)["111"].tags), ["voice"]);

  await sleep(1100); // let page 1 finish its deferred save
  const storage2 = memoryStorage(storage.data, 800);
  const t0 = Date.now();
  const w2 = page({ html: tile, session, fetch: fetchStore });
  w2.SteamUnslop.start(storage2);
  await sleep(30);
  assert.ok(blurred(w2), "blurred without waiting for the persistent cache");
  await sleep(1200);
  assert.equal(
    storage2.saves.filter(s => s.t - t0 < 800).length,
    0,
    "no persistent write before it was loaded",
  );
  assert.deepEqual(plain(storage2.data[CACHE_KEY]["111"].tags), ["voice"]);
  assert.equal(storage2.data[CACHE_KEY]["111"].text, undefined, "the statement text is not stored");
});

test("rate-limited responses are not cached as 'no AI'", async () => {
  let calls = 0;
  const storage = memoryStorage();
  const w = page({
    html: tile,
    fetch: async () =>
      ++calls === 1
        ? { ok: false, status: 500 }
        : { ok: true, status: 200, text: async () => storePage },
  });
  await w.SteamUnslop.start(storage);
  await sleep(400);
  assert.ok(blurred(w), "retried after the failed request");
  assert.equal(calls, 2);
});

test("expired entries are dropped from the persistent cache", async () => {
  const old = Date.now() - 8 * 864e5;
  const storage = memoryStorage({
    [CACHE_KEY]: { 1: { ai: false, t: old }, 2: { ai: false, t: Date.now() } },
  });
  const w = page({ html: tile, fetch: fetchStore });
  await w.SteamUnslop.start(storage);
  await sleep(1300);
  assert.deepEqual(Object.keys(storage.data[CACHE_KEY]).sort(), ["111", "2"]);
});

test("entries of the legacy cache key are taken over and the old key is removed", async () => {
  const storage = memoryStorage({
    aiCache5: { 111: { ai: true, tags: ["voice"], text: "AI voices.", t: Date.now() } },
  });
  const removed = [];
  storage.remove = keys => removed.push(...keys);
  const w = page({ html: tile });
  await w.SteamUnslop.start(storage);
  await sleep(50);
  assert.ok(blurred(w), "known from the legacy cache, no store request needed");
  assert.deepEqual(
    plain(storage.data[CACHE_KEY]["111"].hints),
    [],
    "hints are worked out before the text is dropped",
  );
  assert.ok(removed.includes("aiCache5"));
});

test("results and rate limits from other tabs are taken over without fetching", async () => {
  let calls = 0;
  const w = page({
    html: tile,
    io: false,
    fetch: async () => {
      calls++;
      return { ok: false, status: 429 };
    },
  });
  const storage = memoryStorage();
  await w.SteamUnslop.start(storage);
  await sleep(50);
  // Another tab hit the rate limit and then found the game.
  w.SteamUnslop.applyStored("unslopPause", Date.now() + 60000);
  w.SteamUnslop.applyStored(CACHE_KEY, {
    111: { ai: true, tags: ["voice"], text: "AI voices.", name: "G", t: Date.now(), v: 2 },
  });
  await sleep(100);
  assert.ok(blurred(w), "blurred from the other tab's result");
  const before = calls;
  await sleep(200);
  assert.equal(calls, before, "no further requests while paused");
});

test("a stored entry without its text keeps the lowered level of its hints", async () => {
  const page2 = `<html><body>${disclosure("Some backgrounds were generated with AI and then reworked by our artists.")}</body></html>`;
  const storage = memoryStorage();
  const w = page({
    html: tile,
    fetch: async () => ({ ok: true, status: 200, text: async () => page2 }),
  });
  await w.SteamUnslop.start(storage);
  await sleep(1300);
  const stored = storage.data[CACHE_KEY]["111"];
  assert.equal(stored.text, undefined);
  assert.ok(stored.hints.includes("rework"));
  // A new page rates the stored entry, without text, the same: medium lowered to low.
  const w2 = page({ html: tile });
  await w2.SteamUnslop.start(memoryStorage(storage.data));
  assert.equal(w2.document.querySelector("#t .unslop-level b").textContent, "Low");
});
