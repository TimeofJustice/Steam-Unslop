// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { page, start, entry, disclosure, memoryStorage, sleep } from "./helpers.mjs";

const tiles = `
  <a id="low" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>
  <a id="high" data-r="0,200,300,140" href="https://store.steampowered.com/app/222/"><img src="b.jpg"></a>`;
const cache = { 111: entry(["transl"]), 222: entry(["live", "art"]) };
const gamePage = `<div id="appHubAppName">T</div>${disclosure("AI translation.")}`;
const blurred = (w, sel) => w.document.querySelector(sel).classList.contains("unslop-blur");
const settingsDialog = w => w.document.querySelector(".unslop-settings-dialog");

function choose(w, level) {
  const d = w.document;
  d.querySelector(`.unslop-settings-dialog input[value="${level}"]`).checked = true;
  d.querySelector(".unslop-settings-dialog [data-save]").click();
}

test("the gear button opens the settings; saving a higher level unblurs lower rated games", async () => {
  const w = page({ html: tiles });
  const storage = await start(w, cache);
  const d = w.document;
  assert.ok(blurred(w, "#low") && blurred(w, "#high"));

  d.querySelector('#high [data-tile-action="why"]').click();
  d.querySelector(".unslop-dialog [data-settings]").click();
  assert.ok(settingsDialog(w), "settings open on top of the reason dialog");
  assert.equal(d.querySelectorAll(".unslop-settings-dialog .unslop-choice").length, 4);
  assert.ok(
    d.querySelector('.unslop-settings-dialog input[value="0"]').checked,
    "current level is preselected",
  );

  choose(w, 2);
  assert.equal(settingsDialog(w), null);
  assert.ok(d.querySelector(".unslop-modal"), "the reason dialog stays open");
  assert.ok(!blurred(w, "#low"));
  assert.ok(blurred(w, "#high"));
  assert.equal(storage.data.unslopSettings.minLevel, 2);
});

test("cancel keeps the level", async () => {
  const w = page({ html: tiles });
  const storage = await start(w, cache);
  const d = w.document;
  d.querySelector('#low [data-tile-action="why"]').click();
  d.querySelector("[data-settings]").click();
  d.querySelector('.unslop-settings-dialog input[value="3"]').checked = true;
  d.querySelector(".unslop-settings-dialog [data-close].unslop-btn").click();
  assert.equal(settingsDialog(w), null);
  assert.ok(blurred(w, "#low"));
  assert.equal(storage.data.unslopSettings.minLevel, 0);
});

const tutorial = w => w.document.querySelector(".unslop-tutorial");
const next = w => tutorial(w).querySelector("[data-next]").click();

test("the first start opens the tutorial; skipping it keeps the default and it does not come back", async () => {
  const storage = memoryStorage({ unslopSettings: undefined, unslopCache: cache });
  const w = page({ html: tiles });
  await w.SteamUnslop.start(storage);
  assert.ok(tutorial(w), "tutorial is shown");
  assert.ok(
    tutorial(w).querySelector(".unslop-demo-tile .unslop-level"),
    "first step shows a sample tile",
  );
  assert.ok(tutorial(w).querySelector("[data-back]").hidden, "no back button on the first step");
  tutorial(w).querySelector(".unslop-dialog-tools [data-close]").click();
  assert.equal(storage.data.unslopSettings.minLevel, 0);

  const w2 = page({ html: tiles });
  await w2.SteamUnslop.start(storage);
  assert.equal(tutorial(w2), null);
});

test("the tutorial walks through four steps and saves the level picked at the end", async () => {
  const storage = memoryStorage({ unslopSettings: undefined, unslopCache: cache });
  const w = page({ html: tiles });
  await w.SteamUnslop.start(storage);
  next(w);
  next(w);
  next(w);
  const t = tutorial(w);
  assert.equal(t.querySelectorAll(".unslop-choice").length, 4, "last step has the level choices");
  assert.ok(t.querySelectorAll(".unslop-dots i")[3].classList.contains("on"));
  t.querySelector('input[value="2"]').checked = true;
  t.querySelector("[data-back]").click();
  next(w);
  assert.ok(
    tutorial(w).querySelector('input[value="2"]').checked,
    "the choice survives going back",
  );
  next(w);
  assert.equal(tutorial(w), null);
  assert.equal(storage.data.unslopSettings.minLevel, 2);
  assert.ok(!blurred(w, "#low"));
  assert.ok(blurred(w, "#high"));
});

test("on a game page the tutorial comes first and a raised level releases the page", async () => {
  const w = page({ url: "https://store.steampowered.com/app/123/", html: gamePage });
  await w.SteamUnslop.start(memoryStorage({ unslopSettings: undefined }));
  const d = w.document;
  assert.equal(d.querySelectorAll(".unslop-modal").length, 2, "question and tutorial on top of it");
  assert.ok([...d.querySelectorAll(".unslop-modal")].at(-1).querySelector(".unslop-tutorial"));
  next(w);
  next(w);
  next(w);
  tutorial(w).querySelector('input[value="2"]').checked = true;
  next(w);
  assert.equal(d.querySelector(".unslop-modal"), null);
  assert.ok(!d.documentElement.hasAttribute("data-unslop-page"));
  assert.ok(d.querySelector(".unslop-badge"));
});

test("a stored minimum level applies from the start and survives a page change", async () => {
  const storage = memoryStorage({ unslopCache: cache, unslopSettings: { minLevel: 3 } });
  const w = page({ html: tiles });
  await w.SteamUnslop.start(storage);
  assert.ok(!blurred(w, "#low"));
  assert.ok(blurred(w, "#high"));
  const session = { unslopSettings: w.sessionStorage.getItem("unslopSettings") };

  const w2 = page({ html: tiles, session });
  const started = w2.SteamUnslop.start(
    memoryStorage({ unslopCache: cache, unslopSettings: { minLevel: 3 } }, 500),
  );
  await sleep(20);
  assert.ok(!blurred(w2, "#low"), "the session copy is used before storage has loaded");
  await started;
});

test("game pages below the minimum level only get the badge", async () => {
  const w = page({ url: "https://store.steampowered.com/app/123/", html: gamePage });
  await w.SteamUnslop.start(memoryStorage({ unslopSettings: { minLevel: 2 } }));
  const d = w.document;
  assert.equal(d.querySelector(".unslop-modal"), null);
  assert.ok(!d.documentElement.hasAttribute("data-unslop-page"));
  assert.ok(d.querySelector(".unslop-badge"));
});

test("the game page question has a gear button too", async () => {
  const w = page({ url: "https://store.steampowered.com/app/123/", html: gamePage });
  await start(w);
  const d = w.document;
  d.querySelector("[data-settings]").click();
  choose(w, 2);
  assert.equal(d.querySelector(".unslop-modal"), null, "the question is released");
  assert.ok(d.querySelector(".unslop-badge"));
});

test("settings changed elsewhere are applied live", async () => {
  const w = page({ html: tiles });
  await start(w, cache);
  w.SteamUnslop.applySettings({ minLevel: 3 });
  assert.ok(!blurred(w, "#low"));
  w.SteamUnslop.applySettings({ minLevel: 7 });
  assert.ok(blurred(w, "#low"), "invalid values fall back to the default");
});

test("the button next to the store search opens the settings and comes back after a re-render", async () => {
  const w = page({
    html: `<div id="nav"><form role="search" data-r="0,0,400,34"><input name="term"></form></div>${tiles}`,
  });
  await start(w, cache);
  const d = w.document;
  const btn = d.querySelector("#nav > .unslop-nav-btn");
  assert.ok(btn, "inserted after the search form");
  btn.click();
  assert.ok(settingsDialog(w));
  d.querySelector(".unslop-settings-dialog .unslop-actions [data-close]").click();

  btn.remove(); // React re-rendered the header
  await sleep(1100);
  assert.equal(d.querySelectorAll(".unslop-nav-btn").length, 1);
});

test("signed in, the header button sits before the wishlist link and takes over its classes", async () => {
  const w = page({
    html: `<div id="nav"><form role="search" data-r="0,0,400,34"></form>
    <a id="wl" class="Hdr_link xyz" data-r="700,10,120,34" href="https://store.steampowered.com/wishlist/"><svg></svg>Wishlist 464</a></div>${tiles}`,
  });
  await start(w, cache);
  const btn = w.document.querySelector(".unslop-nav-btn");
  assert.equal(btn.nextElementSibling.id, "wl");
  assert.ok(btn.classList.contains("Hdr_link") && btn.classList.contains("xyz"));
  assert.equal(btn.textContent, "Unslop");
});

test("games that only use AI for ignored kinds are not blurred", async () => {
  const html = `${tiles}<a id="mixed" data-r="0,400,300,140" href="https://store.steampowered.com/app/333/"><img src="c.jpg"></a>`;
  const w = page({ html });
  const storage = await start(w, { ...cache, 333: entry(["transl", "art"]) });
  const d = w.document;
  d.querySelector('#low [data-tile-action="why"]').click();
  d.querySelector("[data-settings]").click();
  d.querySelector(
    '.unslop-settings-dialog input[name="unslop-ignore-tag"][value="transl"]',
  ).checked = true;
  d.querySelector(".unslop-settings-dialog [data-save]").click();
  assert.deepEqual([...storage.data.unslopSettings.ignoreTags], ["transl"]);
  assert.ok(!blurred(w, "#low"), "translation only");
  assert.ok(blurred(w, "#mixed"), "translation and art");
  assert.ok(blurred(w, "#high"));
});

test("'Always show' keeps a game visible until it is removed in the settings", async () => {
  const w = page({ html: tiles });
  const storage = await start(w, { ...cache, 222: entry(["live", "art"], { name: "Live Game" }) });
  const d = w.document;
  d.querySelector('#high [data-tile-action="why"]').click();
  d.querySelector(".unslop-dialog [data-allow]").click();
  assert.equal(d.querySelector(".unslop-modal"), null);
  assert.ok(!blurred(w, "#high"));
  assert.deepEqual(JSON.parse(JSON.stringify(storage.data.unslopSettings.allow)), [
    { id: "222", name: "Live Game" },
  ]);

  const w2 = page({ html: tiles });
  await w2.SteamUnslop.start(memoryStorage(storage.data));
  assert.ok(!blurred(w2, "#high"), "still shown on the next page");
  const d2 = w2.document;
  d2.querySelector('#low [data-tile-action="why"]').click();
  d2.querySelector("[data-settings]").click();
  assert.equal(
    d2.querySelector(".unslop-allow li[data-id] .unslop-allow-name").textContent,
    "Live Game",
  );
  d2.querySelector("[data-allow-remove]").click();
  d2.querySelector(".unslop-settings-dialog [data-save]").click();
  assert.ok(blurred(w2, "#high"), "blurred again after removing it");
});

test("'Always show' on the game page question releases the page", async () => {
  const w = page({ url: "https://store.steampowered.com/app/123/", html: gamePage });
  const storage = await start(w);
  const d = w.document;
  d.querySelector("[data-allow]").click();
  assert.equal(d.querySelector(".unslop-modal"), null);
  assert.ok(!d.documentElement.hasAttribute("data-unslop-page"));
  assert.ok(d.querySelector(".unslop-badge"));
  assert.equal(storage.data.unslopSettings.allow[0].id, "123");
});

test("the always shown games have their own tab with a search and five games at a time", async () => {
  const allow = Array.from({ length: 8 }, (_, i) => ({
    id: String(500 + i),
    name: i < 6 ? `Puzzle ${i}` : `Racer ${i}`,
  }));
  const storage = memoryStorage({
    unslopCache: cache,
    unslopSettings: { minLevel: 0, ignoreTags: [], allow },
  });
  const w = page({ html: tiles });
  await w.SteamUnslop.start(storage);
  const d = w.document;
  d.querySelector('#low [data-tile-action="why"]').click();
  d.querySelector("[data-settings]").click();
  const tab = d.querySelector('[data-tab="allow"]');
  const panel = d.querySelector('[data-panel="allow"]');
  assert.equal(tab.textContent, "Always shown (8)");
  assert.ok(panel.hidden, "the blur tab comes first");
  tab.click();
  assert.ok(!panel.hidden);
  const names = () =>
    [...d.querySelectorAll(".unslop-allow .unslop-allow-name")].map(n => n.textContent);
  assert.equal(names().length, 5);
  assert.equal(d.querySelector(".unslop-allow-more").textContent, "3 more, refine the search");

  const search = d.querySelector(".unslop-search");
  search.value = "racer";
  search.dispatchEvent(new w.Event("input"));
  assert.deepEqual(names(), ["Racer 6", "Racer 7"]);
  assert.equal(d.querySelector(".unslop-allow-more").textContent, "");
  d.querySelector("[data-allow-remove]").click();
  assert.deepEqual(names(), ["Racer 7"]);
  assert.equal(tab.textContent, "Always shown (7)");
  search.value = "nothing like this";
  search.dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelector(".unslop-allow-empty").textContent, "No game matches the search.");

  d.querySelector(".unslop-settings-dialog [data-save]").click();
  assert.equal(storage.data.unslopSettings.allow.length, 7);
  assert.ok(!storage.data.unslopSettings.allow.some(a => a.id === "506"));
});

test("the settings show the running version and who made Steam Unslop", async () => {
  const w = page({ html: tiles });
  await start(w, cache);
  const d = w.document;

  d.querySelector('#low [data-tile-action="why"]').click();
  d.querySelector(".unslop-dialog [data-settings]").click();

  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const credit = settingsDialog(w).querySelector(".unslop-credit");
  assert.equal(credit.textContent, `Steam Unslop ${version} \u00b7 by TimeofJustice`);
  assert.equal(credit.querySelector("a").href, "https://github.com/TimeofJustice");
});

test("excluded kinds of use leave the rating and are shown struck through", async () => {
  const w = page({
    html: `<a id="mixed" data-r="0,0,300,140" href="https://store.steampowered.com/app/333/"><img src="c.jpg"></a>`,
  });
  const storage = memoryStorage({
    unslopCache: { 333: entry(["live", "transl"]) },
    unslopSettings: { minLevel: 0, ignoreTags: ["live"] },
  });
  await w.SteamUnslop.start(storage);
  await sleep(50);
  const d = w.document;

  // Without live AI only the translation counts: Low instead of High.
  assert.ok(blurred(w, "#mixed"));
  assert.match(d.querySelector("#mixed .unslop-level").textContent, /Low/);

  const tags = [...d.querySelectorAll("#mixed .unslop-tags em")];
  assert.deepEqual(
    tags.map(tag => [tag.textContent, tag.classList.contains("unslop-tag-excluded")]),
    [
      ["Translation", false],
      ["Live AI in game", true],
    ],
    "the excluded tag comes last and is marked",
  );

  // Excluding the translation too leaves nothing to blur for.
  w.SteamUnslop.applySettings({ minLevel: 0, ignoreTags: ["live", "transl"] });
  assert.ok(!blurred(w, "#mixed"));
});

test("a game whose uses are all left out reads as left out, not as denied", async () => {
  const statement =
    "All of our quests are written by human authors. During play, an optional AI Dungeon Master " +
    "narrates the story: its dialogue is generated live by language models. You can disable it.";
  const w = page({
    url: "https://store.steampowered.com/app/444/",
    html: `<div id="appHubAppName">Dungeon Game</div>${disclosure(statement)}`,
  });
  await w.SteamUnslop.start(
    memoryStorage({ unslopSettings: { minLevel: 0, ignoreTags: ["live"] } }),
  );
  await sleep(50);
  const d = w.document;

  assert.equal(settingsDialog(w), null);
  assert.ok(!("unslopPage" in d.documentElement.dataset), "the page is not held back");

  d.querySelector(".unslop-badge").click();
  const dialogText = d.querySelector(".unslop-dialog").textContent;
  assert.match(d.querySelector(".unslop-dialog .unslop-level").textContent, /Left out/);
  assert.match(dialogText, /Optional/, "the developer's qualifier stays");
  assert.doesNotMatch(dialogText, /Denies/, "leaving out a tag is no denial");
});

test("changing the left out kinds redraws the page badge and an open dialog at once", async () => {
  const w = page({
    url: "https://store.steampowered.com/app/555/",
    html:
      '<div id="appHubAppName">Mixed Game</div>' +
      disclosure(
        "NPCs answer in real time using a large language model. We used AI for translation.",
      ),
  });
  await w.SteamUnslop.start(
    memoryStorage({ unslopSettings: { minLevel: 2, ignoreTags: ["live"] } }),
  );
  await sleep(50);
  const d = w.document;
  const badgeLevel = () => d.querySelector(".unslop-badge .unslop-level b").textContent;

  // Only the translation counts, which is below the blur level: the page shows with Low.
  assert.equal(badgeLevel(), "Low");

  d.querySelector(".unslop-badge").click();
  const dialogLevel = () => d.querySelector(".unslop-dialog .unslop-level b").textContent;
  assert.equal(dialogLevel(), "Low");

  w.SteamUnslop.applySettings({ minLevel: 2, ignoreTags: [] });
  assert.equal(badgeLevel(), "High", "the badge counts live AI again without a reload");
  assert.equal(dialogLevel(), "High", "so does the open dialog");
  assert.equal(
    d.querySelector(".unslop-dialog .unslop-tags em.unslop-tag-excluded"),
    null,
    "no tag is struck through any more",
  );
});
