// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, start, entry, disclosure, memoryStorage, sleep } from "./helpers.mjs";

const GAME_URL = "https://store.steampowered.com/app/111/";
const gamePageHTML = `<div id="appHubAppName">AI Game</div>${disclosure("AI voices.")}`;
const tile = `<a id="t" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`;

const startWith = (w, settings, cache = {}) =>
  w.SteamUnslop.start(
    memoryStorage({ unslopCache: cache, unslopSettings: { minLevel: 0, ...settings } }),
  );

const isGated = w => "unslopPage" in w.document.documentElement.dataset;

test("without blurring, tiles keep their info sign but nothing is blurred", async () => {
  const w = page({ html: tile });
  await startWith(w, { blur: false }, { 111: entry(["art"]) });
  await sleep(50);
  const d = w.document;

  assert.ok(d.documentElement.hasAttribute("data-unslop-no-blur"), "the styles drop the blur");
  assert.ok(d.querySelector("#t .unslop-overlay .unslop-level"), "level and tags still show");

  w.SteamUnslop.applySettings({ minLevel: 0, blur: true });
  assert.ok(!d.documentElement.hasAttribute("data-unslop-no-blur"));
});

test("without blurring, nothing is held blurred at the start of a page", async () => {
  const w = page({
    html: tile,
    session: { unslopSettings: JSON.stringify({ minLevel: 0, blur: false }) },
  });
  w.SteamUnslop.hold();

  assert.ok(!("unslopHold" in w.document.documentElement.dataset));
  assert.ok(w.document.documentElement.hasAttribute("data-unslop-no-blur"));
});

test("without the question, an AI game page opens at once with its rating", async () => {
  const w = page({ url: GAME_URL, html: gamePageHTML });
  await startWith(w, { gatePages: false });
  await sleep(50);

  assert.ok(!isGated(w));
  assert.ok(w.document.querySelector(".unslop-badge"));
});

test("a game shown on a tile a moment ago opens without asking again", async () => {
  const w = page({ url: GAME_URL, html: gamePageHTML });
  w.localStorage.setItem("unslopShown", JSON.stringify({ 111: Date.now() - 60 * 1000 }));
  await startWith(w, {});
  await sleep(50);

  assert.ok(!isGated(w));
  assert.ok(w.document.querySelector(".unslop-badge"));
});

test("a game shown on a tile long ago asks again", async () => {
  const w = page({ url: GAME_URL, html: gamePageHTML });
  w.localStorage.setItem("unslopShown", JSON.stringify({ 111: Date.now() - 10 * 60 * 1000 }));
  await startWith(w, {});
  await sleep(50);

  assert.ok(isGated(w));
});

test("showing a tile is remembered for its game page", async () => {
  const w = page({ html: tile });
  await start(w, { 111: entry(["art"]) });
  await sleep(50);

  w.document.querySelector('#t [data-tile-action="show"]').click();
  const shown = JSON.parse(w.localStorage.getItem("unslopShown"));
  assert.ok(Date.now() - shown[111] < 1000);
});

const trailerState = w => w.document.documentElement.dataset.unslopTrailers;

test("the page of an AI game tells the trailer guard to hold its trailers", async () => {
  const w = page({ url: GAME_URL, html: `${gamePageHTML}<video id="trailer" autoplay></video>` });
  const trailer = w.document.querySelector("#trailer");
  trailer.pause = () => {};

  w.SteamUnslop.hold();
  assert.equal(trailerState(w), "pending", "held from the start, before the rating");

  await startWith(w, {});
  await sleep(50);
  assert.equal(trailerState(w), "hold");
  assert.equal(trailer.autoplay, false, "autoplay by attribute is stopped too");
});

test("trailers are allowed when stopping them is off or the game has no disclosure", async () => {
  const optedOut = page({ url: GAME_URL, html: gamePageHTML });
  await startWith(optedOut, { pauseTrailers: false });
  await sleep(50);
  assert.equal(trailerState(optedOut), "allow");

  const noDisclosure = page({ url: GAME_URL, html: '<div id="appHubAppName">Game</div>' });
  await startWith(noDisclosure, {});
  await sleep(50);
  assert.equal(trailerState(noDisclosure), "allow");
});

test("without the cart warning, paying goes ahead at once", async () => {
  const fetch = async url =>
    String(url).includes("/dynamicstore/userdata/")
      ? { ok: true, status: 200, json: async () => ({ rgAppsInCart: [111] }) }
      : { ok: false, status: 404 };
  const w = page({
    url: "https://store.steampowered.com/cart/",
    fetch,
    html: '<a id="pay" href="#checkout">Continue to payment</a>',
  });
  let paymentOpened = 0;
  w.document.querySelector("#pay").addEventListener("click", () => paymentOpened++);

  await startWith(w, { warnCart: false }, { 111: entry(["art"]) });
  w.document.querySelector("#pay").click();
  await sleep(50);

  assert.equal(paymentOpened, 1);
  assert.equal(w.document.querySelector(".unslop-cart-warning"), null);
});

test("a game shown with 'Show' stays sharp but keeps its info sign", async () => {
  const w = page({ html: tile });
  await start(w, { 111: entry(["art"]) });
  await sleep(50);
  const d = w.document;

  d.querySelector('#t [data-tile-action="show"]').click();
  const link = d.querySelector("#t");
  const sign = link.querySelector(".unslop-overlay.unslop-sign");

  assert.ok(!link.classList.contains("unslop-blur"), "the blur is gone");
  assert.ok(sign, "the sign stays");
  assert.match(sign.querySelector(".unslop-level").textContent, /Medium|High|Low/);
  assert.equal(sign.querySelector("[data-tile-action]"), null, "no buttons on the sign");

  sign.click();
  assert.ok(d.querySelector(".unslop-dialog"), "the sign opens the reason");
});

test("tiles of a shown game rendered later get the info sign too", async () => {
  const w = page({ html: tile, mo: true });
  await start(w, { 111: entry(["art"]) });
  await sleep(50);
  const d = w.document;

  d.querySelector('#t [data-tile-action="show"]').click();
  d.body.insertAdjacentHTML(
    "beforeend",
    '<a id="again" data-r="0,200,300,140" href="https://store.steampowered.com/app/111/"><img src="b.jpg"></a>',
  );
  await sleep(300);

  const again = d.querySelector("#again");
  assert.ok(!again.classList.contains("unslop-blur"));
  assert.ok(again.querySelector(".unslop-sign"));
});

test("the sign of a shown game moves to the large trailer of an opened hover card", async () => {
  const w = page({
    html:
      '<a id="card" data-r="0,0,300,200" href="https://store.steampowered.com/app/111/">' +
      '<div id="capsule" data-r="0,120,120,45"><img src="small.jpg" data-r="0,120,120,45"></div>' +
      '<div id="preview" data-r="0,0,300,0"><video data-r="0,0,300,0"></video></div></a>',
  });
  await start(w, { 111: entry(["art"]) });
  await sleep(50);
  const d = w.document;

  d.querySelector('#card [data-tile-action="show"]').click();
  assert.ok(d.querySelector("#capsule > .unslop-sign"), "first on the capsule");

  // Hovering opens the card: the trailer gets its size.
  d.querySelector("#preview").dataset.r = "0,0,300,110";
  d.querySelector("#preview video").dataset.r = "0,0,300,110";
  d.querySelector("#card").dispatchEvent(new w.MouseEvent("mouseover", { bubbles: true }));
  await sleep(400);

  assert.ok(d.querySelector("#preview > .unslop-sign"), "then on the large trailer");
  assert.equal(d.querySelectorAll("#card .unslop-sign").length, 1);
});

test("a hover card with its own screenshot link shows one sign, on the large screenshot", async () => {
  const w = page({
    html:
      '<div id="card" data-r="0,0,300,260">' +
      '<a id="shot" data-r="0,0,300,170" href="https://store.steampowered.com/app/111/">' +
      '<div id="screenshot" data-r="0,0,300,170" style="background-image:url(https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/111/ss_1.jpg)"></div></a>' +
      '<a id="capsule" data-r="0,170,120,45" href="https://store.steampowered.com/app/111/"><img src="small.jpg" data-r="0,170,120,45"></a>' +
      "</div>",
  });
  await start(w, { 111: entry(["art"]) });
  await sleep(50);
  const d = w.document;

  d.querySelector('#card [data-tile-action="show"]').click();
  w.SteamUnslop.applySettings({ minLevel: 0 });

  assert.equal(d.querySelectorAll("#card .unslop-sign").length, 1, "no second sign");
  assert.ok(d.querySelector("#screenshot > .unslop-sign"), "on the large background image");
});

test("a wrong rating can be reported on GitHub with the form filled in", async () => {
  const w = page({ html: tile });
  await start(w, {
    111: entry(["art", "transl"], { name: "AI Game", text: "AI art and AI translation." }),
  });
  await sleep(50);
  const d = w.document;

  let opened;
  w.open = url => (opened = new URL(url));

  d.querySelector('#t [data-tile-action="why"]').click();
  d.querySelector(".unslop-dialog [data-report-rating]").click();

  assert.equal(
    opened.origin + opened.pathname,
    "https://github.com/TimeofJustice/Steam-Unslop/issues/new",
  );
  const field = name => opened.searchParams.get(name);
  assert.equal(field("template"), "wrong-rating.yml");
  assert.equal(field("game"), "AI Game");
  assert.equal(field("store-page"), "https://store.steampowered.com/app/111/");
  assert.match(field("shown-rating"), /^(Low|Medium|High): Art, Translation$/);
  assert.equal(field("statement"), "AI art and AI translation.");
  assert.match(field("version"), /^\d+\.\d+\.\d+$/);
});

test("the issue form matches the fields the dialog fills in", async () => {
  const { readFileSync } = await import("node:fs");
  const form = readFileSync(".github/ISSUE_TEMPLATE/wrong-rating.yml", "utf8");
  for (const id of ["game", "store-page", "shown-rating", "expected", "statement", "version"]) {
    assert.ok(
      form.split("\n").some(line => line.trim() === `id: ${id}`),
      `field ${id}`,
    );
  }
});
