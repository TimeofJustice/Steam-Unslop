// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, start, entry, sleep } from "./helpers.mjs";

const row = `
  <div id="row1">
    <div class="left"><div class="handle" style="cursor: grab">=</div><span class="rank">415</span></div>
    <a href="https://store.steampowered.com/app/111/"><img src="x.jpg"></a>
    <div class="info">
      <a href="https://store.steampowered.com/app/111/" class="title">Game</a><div class="tags">Open World</div>
      <div><span class="date">Added on 3 Nov</span><div class="rm"><svg></svg>remove</div></div>
      <div><span class="price">29,99</span><button>Add to cart</button></div>
    </div>
  </div>
  <div><a href="https://store.steampowered.com/app/222/"><img src="y.jpg"></a></div>`;

function wishlistPage(calls) {
  return page({
    html: row,
    url: "https://store.steampowered.com/wishlist/profiles/1/",
    cookie: "sessionid=abc123",
    fetch: async (url, opt) => {
      if (opt?.method === "POST") calls.push([url, opt.body.toString()]);
      return { ok: true, status: 200, text: async () => "", json: async () => ({ success: true }) };
    },
  });
}

test("row content is blurred, controls stay usable", async () => {
  const w = wishlistPage([]);
  await start(w, { 111: entry(["art"]) });
  const dimmed = [...w.document.querySelectorAll(".unslop-dim")].map(e =>
    e.className.replace(" unslop-dim", ""),
  );
  assert.deepEqual(dimmed, ["rank", "title", "tags", "date", "price"]);
});

test("ignore on the wishlist asks first, then ignores, removes and hides the row", async () => {
  const calls = [];
  const w = wishlistPage(calls);
  await start(w, { 111: entry(["art"]) });
  const btn = w.document.querySelector('[data-tile-action="ignore"]');
  btn.click();
  assert.equal(calls.length, 0, "first click only asks for confirmation");
  btn.click();
  await sleep(20);
  assert.deepEqual(calls, [
    [
      "https://store.steampowered.com/recommended/ignorerecommendation/",
      "sessionid=abc123&appid=111&remove=0",
    ],
    ["https://store.steampowered.com/api/removefromwishlist", "sessionid=abc123&appid=111"],
  ]);
  assert.ok(w.document.querySelector("#row1").classList.contains("unslop-gone"));
});
