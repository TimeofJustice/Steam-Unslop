// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { storePage, entry } from "./browser.mjs";

// What an overlay shows at the tile sizes Steam uses; the level must always be fully visible.
const SIZES = [
  [120, 45, { tags: false, btns: false }], // bundle items
  [184, 69, { tags: false, btns: true }], // small capsules
  [231, 87, { tags: false, btns: true }],
  [300, 140, { tags: true, btns: true }],
  [460, 215, { tags: true, btns: true }], // header capsules
  [900, 45, { tags: true, btns: true }], // search result rows
  [350, 60, { tags: true, btns: true }], // search suggestions
];

test("overlays show the level at every tile size and hide the rest step by step", async () => {
  const html = SIZES.map(
    (
      [w, h],
      i,
    ) => `<a href="https://store.steampowered.com/app/${100 + i}/" style="display:block;width:${w}px;height:${h}px;margin-bottom:8px">
    <img style="display:block;width:${w}px;height:${h}px"></a>`,
  ).join("");
  const cache = Object.fromEntries(
    SIZES.map((_, i) => [100 + i, entry(["art", "model", "music"])]),
  );
  const page = await storePage(html, { cache });
  const seen = await page.evaluate(() =>
    [...document.querySelectorAll("a.unslop-blur")].map(a => {
      const o = a.querySelector(".unslop-overlay");
      const box = o.getBoundingClientRect();
      const lvl = o.querySelector(".unslop-level").getBoundingClientRect();
      const shown = sel => {
        const e = o.querySelector(sel);
        return !!e && getComputedStyle(e).display !== "none";
      };
      return {
        level: lvl.top >= box.top - 1 && lvl.bottom <= box.bottom + 1 && lvl.left >= box.left - 1,
        tags: shown(".unslop-tags"),
        btns: shown(".unslop-btns"),
      };
    }),
  );
  SIZES.forEach(([w, h, want], i) =>
    assert.deepEqual(seen[i], { level: true, ...want }, `${w}x${h}`),
  );
});

test("a row without a box of its own gets the overlay inside its row, not across the dropdown", async () => {
  const page = await storePage(
    `<div style="position:relative;width:360px;height:400px">
      <a id="row" href="https://store.steampowered.com/app/111/" style="display:contents">
        <div style="display:flex;height:60px"><img style="width:120px;height:45px"><span>Name</span></div></a></div>`,
    { cache: { 111: entry(["transl"]) } },
  );
  const { overlay, row } = await page.evaluate(() => ({
    overlay: document.querySelector(".unslop-overlay").getBoundingClientRect().height,
    row: document.querySelector("#row > div").getBoundingClientRect().height,
  }));
  assert.equal(overlay, row);
});

test("dialog titles use the full width next to the header buttons", async () => {
  const page = await storePage(
    `<a id="t" href="https://store.steampowered.com/app/111/" style="display:block;width:300px;height:140px">
    <img style="width:300px;height:140px"></a>`,
    { cache: { 111: entry(["art"]) }, viewport: { width: 640, height: 700 } },
  );
  await page.click('#t [data-tile-action="why"]');
  const r = await page.evaluate(() => {
    const title = document.querySelector(".unslop-dialog-title").getBoundingClientRect();
    const tools = document.querySelector(".unslop-dialog-tools").getBoundingClientRect();
    return {
      lines: Math.round(
        title.height /
          parseFloat(getComputedStyle(document.querySelector(".unslop-dialog-title")).lineHeight),
      ),
      overlap: title.right > tools.left,
    };
  });
  assert.equal(r.lines, 1);
  assert.equal(r.overlap, false);
});

test("the tutorial lists keep their buttons evenly spaced when a text wraps", async () => {
  const page = await storePage("", { settings: null, viewport: { width: 560, height: 700 } });
  await page.click(".unslop-tutorial [data-next]");
  const gaps = await page.evaluate(() => {
    const r = [...document.querySelectorAll(".unslop-demo-list dt")].map(d =>
      d.getBoundingClientRect(),
    );
    return r.slice(1).map((x, i) => Math.round(x.top - r[i].bottom));
  });
  assert.equal(new Set(gaps).size, 1, `gaps ${gaps}`);
});

test("the quiz summary lines up levels, texts and states in columns", async () => {
  const page = await storePage(
    `<a id="t" href="https://store.steampowered.com/app/111/" style="display:block;width:300px;height:140px">
    <img style="width:300px;height:140px"></a>`,
    { cache: { 111: entry(["art"]) } },
  );
  await page.click('#t [data-tile-action="why"]');
  await page.click(".unslop-dialog [data-settings]");
  await page.click(".unslop-settings-dialog [data-quiz]");
  for (let i = 0; i < 8; i++) await page.click(`.unslop-quiz [data-answer="${i < 4 ? 0 : 1}"]`);
  const cols = await page.evaluate(() =>
    [".unslop-level", ".unslop-quiz-text", ".unslop-quiz-state"].map(sel =>
      [...document.querySelectorAll(`.unslop-quiz-summary ${sel}`)].map(e =>
        Math.round(e.getBoundingClientRect().left),
      ),
    ),
  );
  for (const col of cols) assert.equal(new Set(col).size, 1, `column starts at ${col}`);
  const states = await page.evaluate(() =>
    [...document.querySelectorAll(".unslop-quiz-state")].map(e => getComputedStyle(e).textAlign),
  );
  assert.ok(states.every(a => a === "center"));
});

test("long German action labels stay inside the dialog padding", async () => {
  const page = await storePage(
    `<a id="t" href="https://store.steampowered.com/app/111/" style="display:block;width:300px;height:140px">
    <img style="width:300px;height:140px"></a>`,
    { cache: { 111: entry(["text", "transl"]) }, language: "de" },
  );
  await page.click('#t [data-tile-action="why"]');

  const overflow = await page.evaluate(() => {
    const body = document.querySelector(".unslop-dialog-body");
    const style = getComputedStyle(body);
    const bounds = body.getBoundingClientRect();
    const contentLeft = bounds.left + parseFloat(style.paddingLeft);
    const contentRight = bounds.right - parseFloat(style.paddingRight);

    return [...body.querySelectorAll(".unslop-actions .unslop-btn")]
      .map(button => button.getBoundingClientRect())
      .filter(button => button.left < contentLeft - 0.5 || button.right > contentRight + 0.5)
      .map(button => `${Math.round(button.left)}-${Math.round(button.right)}`);
  });
  assert.deepEqual(overflow, []);
});

test("tags that do not fit a low tile are summed up as +N, strongest first", async () => {
  const lowTile = (id, appId) =>
    `<a id="${id}" href="https://store.steampowered.com/app/${appId}/" style="display:block;width:200px;height:94px;margin:8px">` +
    `<img style="width:200px;height:94px"></a>`;
  const page = await storePage(lowTile("many", 111) + lowTile("one", 222), {
    cache: { 111: entry(["model", "video", "transl"]), 222: entry(["transl"]) },
    language: "de",
  });
  await page.waitForTimeout(300);

  const tagsOf = id =>
    page.evaluate(tileId => {
      const tagList = document.querySelector(`#${tileId} .unslop-tags`);
      const visible = [...tagList.children].filter(tag => !tag.hidden);
      return {
        texts: visible.map(tag => tag.textContent),
        fits: tagList.scrollWidth <= tagList.clientWidth,
        lines: new Set(visible.map(tag => Math.round(tag.getBoundingClientRect().top))).size,
      };
    }, id);

  const many = await tagsOf("many");
  assert.ok(many.fits, "nothing is cut off");
  assert.equal(many.lines, 1);
  assert.equal(many.texts[0], "3D-Modelle", "the strongest tag stays");
  assert.match(many.texts.at(-1), /^\+\d$/);

  const one = await tagsOf("one");
  assert.deepEqual(one.texts, ["\u00dcbersetzung"], "a single tag that fits gets no +N");
});
