// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* The trailer guard answers play() in the page's world. jsdom has no media playback, so play()
   is replaced by a counter before the guard is loaded, as the guard keeps the original. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { sleep } from "./helpers.mjs";

const GUARD = readFileSync(new URL("../dist/extension/trailer-guard.js", import.meta.url), "utf8");

function guardedPage(state) {
  const dom = new JSDOM(
    '<html><body><div class="highlight_ctn"><video id="trailer"></video><div id="play" role="button"></div></div><button id="elsewhere"></button></body></html>',
    { runScripts: "outside-only", url: "https://store.steampowered.com/app/111/" },
  );
  const w = dom.window;

  w.plays = 0;
  w.HTMLMediaElement.prototype.play = function () {
    w.plays++;
    return Promise.resolve();
  };
  if (state) w.document.documentElement.dataset.unslopTrailers = state;
  w.eval(GUARD);
  return w;
}

const trailerOf = w => w.document.getElementById("trailer");
const press = (w, id) =>
  w.document.getElementById(id).dispatchEvent(new w.Event("pointerdown", { bubbles: true }));

test("a held trailer is refused like blocked autoplay", async () => {
  const w = guardedPage("hold");

  await assert.rejects(trailerOf(w).play(), error => error.name === "NotAllowedError");
  assert.equal(w.plays, 0);
});

test("the user's click on the player starts a held trailer", async () => {
  const w = guardedPage("hold");

  press(w, "play");
  await trailerOf(w).play();
  assert.equal(w.plays, 1);
});

test("a click elsewhere on the page does not start a held trailer", async () => {
  const w = guardedPage("hold");

  press(w, "elsewhere");
  await assert.rejects(trailerOf(w).play());
  assert.equal(w.plays, 0);
});

test("a start before the rating waits for the core's decision", async () => {
  const held = guardedPage("pending");
  const heldStart = trailerOf(held).play();
  held.document.documentElement.dataset.unslopTrailers = "hold";
  await assert.rejects(heldStart);

  const allowed = guardedPage("pending");
  const allowedStart = trailerOf(allowed).play();
  await sleep(20);
  assert.equal(allowed.plays, 0, "still waiting");
  allowed.document.documentElement.dataset.unslopTrailers = "allow";
  await allowedStart;
  assert.equal(allowed.plays, 1);
});

test("pages without a decision play as usual", async () => {
  const w = guardedPage(null);

  await trailerOf(w).play();
  assert.equal(w.plays, 1);
});
