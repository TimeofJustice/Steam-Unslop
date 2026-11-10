// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, memoryStorage, disclosure, hover, sleep } from "./helpers.mjs";

const storePage = `<html><body><div id="appHubAppName">G</div>${disclosure("AI art.")}</body></html>`;
const countingFetch = calls => async url => {
  calls.push(url);
  return { ok: true, status: 200, text: async () => storePage };
};
const blurred = (w, sel) => w.document.querySelector(sel).classList.contains("unslop-blur");

// io: false simulates an IntersectionObserver that never reports the tile.
test("visible tiles are loaded even if the IntersectionObserver never fires", async () => {
  const calls = [];
  const w = page({
    io: false,
    fetch: countingFetch(calls),
    html: `
    <a id="visible" data-r="0,100,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>
    <div id="tab" style="display:none"><a id="hidden" data-r="0,300,300,140" href="https://store.steampowered.com/app/222/"><img src="b.jpg"></a></div>`,
  });
  await w.SteamUnslop.start(memoryStorage());
  await sleep(1300);
  assert.ok(blurred(w, "#visible"));
  assert.ok(!calls.some(u => u.includes("/app/222/")), "hidden tab is not loaded yet");

  w.document.querySelector("#tab").style.display = "block"; // tab switched via CSS only
  await sleep(1300);
  assert.ok(blurred(w, "#hidden"));
});

test("hovering an unchecked game loads it immediately", async () => {
  const calls = [];
  const w = page({
    io: false,
    fetch: countingFetch(calls),
    html: `
    <a id="far" data-r="0,5000,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`,
  });
  await w.SteamUnslop.start(memoryStorage());
  await sleep(50);
  assert.equal(calls.length, 0, "far below the viewport");
  hover(w, "#far img");
  await sleep(100);
  assert.equal(calls.length, 1);
  assert.ok(blurred(w, "#far"));
});

test("tiles stay blurred until their rating has arrived", async () => {
  let answer;
  const pageFor = id =>
    `<html><body>${id === "111" ? disclosure("AI art.") : "<p>Nothing</p>"}</body></html>`;
  const w = page({
    fetch: url =>
      new Promise(r => {
        answer = () => r({ ok: true, status: 200, text: async () => pageFor(url.match(/\d+/)[0]) });
      }),
    html: `<a id="t" data-r="0,100,300,140" href="https://store.steampowered.com/app/222/"><img src="a.jpg"></a>`,
  });
  await w.SteamUnslop.start(memoryStorage());
  await sleep(50);
  const t = w.document.querySelector("#t");
  assert.ok(t.classList.contains("unslop-wait"), "waiting while the store page loads");
  answer();
  await sleep(50);
  assert.ok(
    !t.classList.contains("unslop-wait") && !t.classList.contains("unslop-blur"),
    "no AI: shown",
  );
});

test("hold blurs unchecked game links, non-tiles are released", async () => {
  const w = page({
    html: `
    <a id="tile" data-r="0,100,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>
    <a id="text" href="https://store.steampowered.com/app/333/">Some game</a>`,
  });
  w.SteamUnslop.hold();
  assert.ok(w.document.documentElement.hasAttribute("data-unslop-hold"));
  await w.SteamUnslop.start(
    memoryStorage({ unslopCache: { 111: { ai: false, t: Date.now(), v: 3 } } }),
  );
  assert.equal(w.document.querySelector("#tile").dataset.unslopId, "111");
  assert.equal(w.document.querySelector("#text").dataset.unslopSkip, "1");
});

test("game page stays hidden until the gate has decided", async () => {
  const w = page({
    url: "https://store.steampowered.com/app/123/",
    html: `<div id="appHubAppName">T</div>${disclosure("AI art.")}`,
  });
  w.SteamUnslop.hold();
  const root = w.document.documentElement;
  assert.ok(root.hasAttribute("data-unslop-hold-page"));
  await w.SteamUnslop.start(memoryStorage());
  assert.ok(!root.hasAttribute("data-unslop-hold-page"));
  assert.ok(root.hasAttribute("data-unslop-page"));
});
