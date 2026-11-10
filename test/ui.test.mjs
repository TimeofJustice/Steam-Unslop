// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, start, disclosure, entry, overlayMode, sleep, hover } from "./helpers.mjs";

const gameHtml = disclosure(
  "AI generation tools were used only as a starting point for some visual assets, every one was edited by our art team. Japanese uses AI-assisted translation as a provisional measure.",
);
const text = (w, sel) => w.document.querySelector(sel).textContent.replace(/\s+/g, " ");

for (const [lang, title, lowered] of [
  ["de", "KI-generiertes Spiel", "von Mittel auf Gering gesenkt"],
  ["en", "AI-generated game", "lowered from Medium to Low"],
]) {
  test(`game page gate follows the Steam language (${lang})`, async () => {
    const w = page({
      lang,
      url: "https://store.steampowered.com/app/123/",
      html: `<div id="appHubAppName">Test</div>${gameHtml}`,
    });
    await start(w);
    const d = text(w, ".unslop-dialog");
    assert.ok(d.includes(title));
    assert.ok(d.includes(lowered));
    assert.ok(w.document.documentElement.hasAttribute("data-unslop-page"));
  });
}

test("only real images make a tile, not platform icons", async () => {
  const w = page({
    html: `
    <a id="cap" href="https://store.steampowered.com/app/111/"><img src="cap.jpg"></a>
    <a id="info" href="https://store.steampowered.com/app/111/"><span>Date</span><img src="https://cdn/icon_platform_win.png"></a>`,
  });
  await start(w, { 111: entry(["art"]) });
  assert.ok(w.document.querySelector("#cap").classList.contains("unslop-blur"));
  assert.ok(!w.document.querySelector("#info").classList.contains("unslop-blur"));
});

for (const order of ["image first", "strip first"]) {
  test(`same game twice in a card: info on image, actions on strip (${order})`, async () => {
    const big = `<a id="big" data-r="0,0,420,230" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`;
    const strip = `<a id="strip" data-r="0,230,420,50" href="https://store.steampowered.com/app/111/"><img src="v.jpg"></a>`;
    const w = page({
      html: `<div class="card"><div>${order === "image first" ? big + strip : strip + big}</div></div>
      <div><a id="solo" data-r="0,400,300,140" href="https://store.steampowered.com/app/222/"><img src="o.jpg"></a></div>`,
    });
    await start(w, { 111: entry(["live"]), 222: entry(["art"]) });
    assert.equal(overlayMode(w, "#big"), "info");
    assert.equal(overlayMode(w, "#strip"), "actions");
    assert.equal(overlayMode(w, "#solo"), "full");
    w.document.querySelector('#strip [data-tile-action="show"]').click();
    assert.ok(!w.document.querySelector("#big").classList.contains("unslop-blur"));
    assert.ok(!w.document.querySelector("#strip").classList.contains("unslop-blur"));
  });
}

test("tiles covered by a hover card lose their actions", async () => {
  const w = page({
    html: `
      <div class="Carousel_row">
        <a class="Capsule_tile" id="t1" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>
        <a class="Capsule_tile" id="t2" data-r="310,0,300,140" href="https://store.steampowered.com/app/222/"><img src="b.jpg"></a>
      </div>
      <div><a class="search_result_row" id="s1" data-r="0,400,900,45" href="https://store.steampowered.com/app/333/"><img src="c.jpg"></a></div>
      <div id="card" class="HoverCard" style="position:absolute" data-r="-10,-10,320,300" hidden>
        <a class="Card_media" id="cm" data-r="-10,-10,320,180" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>
      </div>`,
    elementFromPoint: d => (x, y) =>
      !d.querySelector("#card").hidden && x < 310 && y < 290
        ? d.querySelector("#cm img")
        : [...d.querySelectorAll("a")].find(a => {
            const b = a.getBoundingClientRect();
            return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
          }),
  });
  await start(w, { 111: entry(["art"]), 222: entry(["voice"]), 333: entry(["music"]) });
  assert.equal(overlayMode(w, "#t1"), "full");
  w.document.querySelector("#card").hidden = false;
  hover(w, "#t1 img");
  await sleep(400);
  assert.equal(overlayMode(w, "#t1"), "info");
  assert.equal(overlayMode(w, "#t2"), "info", "same tile shape is learned");
  assert.equal(overlayMode(w, "#s1"), "full", "other tiles keep their actions");
});

test("screenshots next to the tile in the same card are blurred too", async () => {
  const w = page({
    html: `
    <div class="rec" data-r="0,0,1200,460">
      <div class="head"><a href="https://store.steampowered.com/app/111/">Demonologist</a>
        Because you recently played <a href="https://store.steampowered.com/app/999/">Phasmophobia</a></div>
      <div class="media" data-r="0,100,1200,290">
        <a id="vid" data-r="0,100,620,290" href="https://store.steampowered.com/app/111/"><img src="v.jpg"></a>
        <div class="shots"><img id="s1" src="1.jpg"><div id="s2" style="background-image:url(2.jpg)"></div></div>
      </div>
    </div>
    <div class="rec2" data-r="0,500,1200,460"><img id="other" src="o.jpg"></div>`,
  });
  await start(w, { 111: entry(["art"]) });
  const d = w.document;
  assert.ok(d.querySelector("#vid").classList.contains("unslop-blur"));
  assert.ok(d.querySelector("#s1").classList.contains("unslop-media"));
  assert.ok(d.querySelector("#s2").classList.contains("unslop-media"));
  assert.ok(!d.querySelector("#other").classList.contains("unslop-media"));

  const late = Object.assign(d.createElement("img"), { id: "s3", src: "3.jpg" });
  d.querySelector(".shots").append(late);
  await sleep(1100);
  assert.ok(late.classList.contains("unslop-media"), "media rendered later is caught");

  d.querySelector('#vid [data-tile-action="show"]').click();
  assert.equal(d.querySelectorAll(".unslop-media").length, 0, "show anyway reveals the whole card");
});

test("GitHub star banner shows from the third dialog and comes back after 15 more", async () => {
  const w = page({
    html: `<a id="t" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`,
  });
  const storage = await start(w, { 111: entry(["art"]) });
  const d = w.document;
  const open = () => {
    d.querySelector('#t [data-tile-action="why"]').click();
    const b = d.querySelector(".unslop-star");
    return { b, close: () => d.querySelector("[data-close]").click() };
  };
  for (let i = 1; i <= 2; i++) {
    const o = open();
    assert.ok(o.b.hidden, `not on dialog ${i}`);
    o.close();
  }
  const third = open();
  assert.ok(!third.b.hidden, "third dialog shows it");
  assert.equal(third.b.querySelector("a").href, "https://github.com/TimeofJustice/Steam-Unslop");
  third.b.querySelector("[data-star-hide]").click();
  assert.ok(third.b.hidden);
  assert.ok(d.querySelector(".unslop-modal"), "closing the banner does not close the dialog");
  third.close();
  assert.deepEqual({ ...storage.data.unslopStar }, { opens: 3, modalAt: 18, pages: 1, toastAt: 5 });
  for (let i = 4; i < 18; i++) {
    const o = open();
    assert.ok(o.b.hidden);
    o.close();
  }
  assert.ok(!open().b.hidden, "back after 15 more dialogs");
});

test("star toast: shown on a page with blurred games when due, once per session", async () => {
  const html = `<a id="t" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`;
  const w = page({ html });
  const storage = await start(w, { 111: entry(["art"]) });
  storage.data.unslopStar = { opens: 0, modalAt: 3, pages: 4, toastAt: 5 };
  const w2 = page({ html });
  await w2.SteamUnslop.start(storage);
  assert.equal(storage.data.unslopStar.pages, 5);
  await sleep(6200);
  const t = w2.document.querySelector(".unslop-toast");
  assert.ok(t, "toast is shown after a short delay");
  assert.equal(storage.data.unslopStar.toastAt, 35, "next one 30 pages later");
  t.querySelector("[data-star-link]").click();
  assert.ok(
    storage.data.unslopStar.modalAt >= 75 && storage.data.unslopStar.toastAt >= 155,
    "starring pauses both much longer",
  );
  await sleep(300);
  assert.equal(w2.document.querySelector(".unslop-toast"), null);
});

test("reason dialog: close button, focus returns, text is loaded with a loading state", async () => {
  let answer;
  const w = page({
    html: `<a id="t" data-r="0,0,300,140" href="https://store.steampowered.com/app/111/"><img src="a.jpg"></a>`,
    fetch: () =>
      new Promise(r => {
        answer = () =>
          r({ ok: true, status: 200, text: async () => disclosure("AI art everywhere.") });
      }),
  });
  await start(w, { 111: entry(["art"], { text: "" }) });
  const d = w.document;
  const why = d.querySelector('#t [data-tile-action="why"]');
  why.focus();
  why.click();
  const q = d.querySelector(".unslop-dialog blockquote");
  assert.ok(q.classList.contains("unslop-loading"));
  assert.equal(
    d.querySelector(".unslop-dialog").getAttribute("aria-labelledby"),
    d.querySelector(".unslop-dialog-title").id,
  );
  answer();
  await sleep(20);
  assert.equal(q.textContent, "AI art everywhere.");
  assert.ok(!q.classList.contains("unslop-loading"));
  d.querySelector("[data-close]").click();
  assert.equal(d.querySelector(".unslop-modal"), null);
  assert.equal(d.activeElement, why, "focus goes back to the opener");
});

test("game page badge opens the reason again", async () => {
  const w = page({
    url: "https://store.steampowered.com/app/123/",
    html: `<div id="appHubAppName">Test</div>${disclosure("AI voices.")}`,
  });
  await start(w);
  const d = w.document;
  d.querySelector(".unslop-actions .unslop-btn-primary").click();
  const b = d.querySelector(".unslop-badge");
  assert.equal(b.dataset.level, "2");
  b.click();
  assert.ok(d.querySelector(".unslop-modal [data-close]"));
});

test("friend avatars in a card are not blurred", async () => {
  const w = page({
    html: `
    <div class="rec" data-r="0,0,1200,400">
      <a id="vid" data-r="0,0,620,290" href="https://store.steampowered.com/app/111/"><img src="v.jpg"></a>
      <img id="shot" data-r="640,0,260,140" src="https://cdn/ss_1.jpg">
      <div class="FriendsWhoOwn"><a href="https://steamcommunity.com/id/bob/"><img id="av1" data-r="0,300,32,32" src="https://avatars.fastly.steamstatic.com/a.jpg"></a></div>
      <img id="av2" data-r="40,300,32,32" src="https://cdn/b_medium.jpg">
    </div>`,
  });
  await start(w, { 111: entry(["art"]) });
  const has = id => w.document.querySelector(id).classList.contains("unslop-media");
  assert.ok(has("#shot"));
  assert.ok(!has("#av1"), "avatar linked to a profile");
  assert.ok(!has("#av2"), "small image");
});

test("discovery carousel: screenshots and trailer of the AI game are blurred and get the info", async () => {
  const SS = id =>
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/ss_abc.600x338.jpg`;
  const w = page({
    html: `
    <div class="Queue">
      <div class="Big" data-r="0,0,900,400">
        <video id="vid" data-r="0,0,640,360" poster="https://video.fastly.steamstatic.com/store_trailers/111/999/abc/movie.jpg"></video>
        <div><img id="ss1" data-r="650,0,240,135" src="${SS(111)}"></div>
      </div>
      <div class="Thumbs">
        <a id="th1" data-r="0,410,180,80" href="https://store.steampowered.com/app/111/"><img src="${SS(111)}"></a>
        <a id="th2" data-r="190,410,180,80" href="https://store.steampowered.com/app/222/"><img src="${SS(222)}"></a>
      </div>
      <img id="ss2" data-r="0,500,240,135" src="${SS(222)}">
      <img id="av" data-r="0,700,240,135" src="https://avatars.fastly.steamstatic.com/steam/apps/111/x.jpg">
    </div>`,
  });
  await start(w, { 111: entry(["art"], { name: "AI Game" }), 222: { ai: false, t: Date.now() } });
  const d = w.document;
  const cls = (s, c) => d.querySelector(s).classList.contains(c);
  assert.ok(cls("#th1", "unslop-blur"), "thumbnail");
  assert.ok(cls("#vid", "unslop-gmedia"), "trailer");
  assert.ok(cls("#ss1", "unslop-gmedia"), "screenshot");
  assert.ok(!cls("#ss2", "unslop-gmedia"), "other game");
  assert.ok(!cls("#av", "unslop-gmedia"), "avatar");
  const badge = d.querySelector(".Big > .unslop-mediainfo");
  assert.ok(badge, "large trailer shows the info");
  assert.equal(badge.style.width, "640px");

  badge.querySelector('[data-tile-action="why"]').click();
  assert.equal(d.querySelector(".unslop-dialog-sub").textContent, "AI Game");
  d.querySelector("[data-close]").click();

  d.querySelector('#th1 [data-tile-action="show"]').click();
  assert.ok(
    !cls("#vid", "unslop-gmedia") && !cls("#ss1", "unslop-gmedia"),
    "show on the thumbnail reveals the media",
  );
  assert.equal(d.querySelector(".unslop-mediainfo"), null);
});

test("media of unknown games wait for their rating", async () => {
  let answer;
  const w = page({
    fetch: () =>
      new Promise(r => {
        answer = () => r({ ok: true, status: 200, text: async () => disclosure("AI art.") });
      }),
    html: `<div><img id="ss" data-r="0,0,600,338" src="https://cdn.akamai.steamstatic.com/steam/apps/333/ss_1.jpg"></div>`,
  });
  await w.SteamUnslop.start((await import("./helpers.mjs")).memoryStorage());
  const ss = w.document.querySelector("#ss");
  assert.ok(ss.classList.contains("unslop-gwait"));
  answer();
  await sleep(100);
  assert.ok(ss.classList.contains("unslop-gmedia"));
  assert.ok(w.document.querySelector(".unslop-mediainfo"));
});

test("dialogs are native modal dialogs, Escape only closes dismissable ones", async () => {
  const w = page({
    url: "https://store.steampowered.com/app/123/",
    html: `<div id="appHubAppName">T</div>${disclosure("AI art.")}`,
  });
  await start(w);
  const d = w.document;
  const m = d.querySelector(".unslop-modal");
  assert.equal(m.tagName, "DIALOG");
  assert.ok(m.open);
  m.dispatchEvent(new w.Event("cancel", { cancelable: true }));
  assert.ok(m.isConnected, "the gate cannot be dismissed with Escape");
  d.querySelector(".unslop-actions .unslop-btn-primary").click();
  d.querySelector(".unslop-badge").click();
  const m2 = d.querySelector(".unslop-modal");
  m2.dispatchEvent(new w.Event("cancel", { cancelable: true }));
  assert.ok(!m2.isConnected);
});

test("gate dialogs opened before the storage has loaded count for the star banner", async () => {
  const gate = `<div id="appHubAppName">T</div>${disclosure("AI art.")}`;
  const { memoryStorage } = await import("./helpers.mjs");
  const storage = memoryStorage({}, 30);
  for (let i = 1; i <= 3; i++) {
    const w = page({ url: `https://store.steampowered.com/app/${100 + i}/`, html: gate });
    await w.SteamUnslop.start(storage);
    const b = w.document.querySelector(".unslop-star");
    assert.equal(b.hidden, i < 3, `gate ${i}`);
  }
  assert.equal(storage.data.unslopStar.opens, 3);
});

test("dialog shows the game name from the store page, not the curator name on the tile", async () => {
  const tile = id =>
    `<a id="t${id}" data-r="0,${id * 200},300,140" href="https://store.steampowered.com/app/${id}/"><img src="a.jpg"><div class="curator_name">PC Gamer</div></a>`;
  const w = page({
    html: tile(1) + tile(2),
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => `<div id="appHubAppName">Real Game</div>${disclosure("AI art.")}`,
    }),
  });
  await start(w, { 1: entry(["art"], { name: "Known Game" }), 2: entry(["art"]) });
  const d = w.document;
  const sub = () => d.querySelector(".unslop-dialog-sub")?.textContent;
  d.querySelector('#t1 [data-tile-action="why"]').click();
  assert.equal(sub(), "Known Game");
  d.querySelector("[data-close]").click();
  d.querySelector('#t2 [data-tile-action="why"]').click();
  await sleep(20);
  assert.equal(sub(), "Real Game", "missing name is loaded from the store page");
});

test("search suggestion rows with display: contents get the overlay on their own box", async () => {
  const w = page({
    html: `
    <div id="drop" style="position:absolute" data-r="0,0,360,500">
      <a id="row" style="display:contents" href="https://store.steampowered.com/app/111/">
        <div id="box" data-r="0,200,350,60"><img src="cap.jpg" data-r="0,200,120,45"><div>Dungeon Alchemist</div></div>
      </a>
      <a id="other" data-r="0,270,350,60" href="https://store.steampowered.com/app/222/"><img src="b.jpg"></a>
    </div>`,
  });
  await start(w, { 111: entry(["transl"]), 222: { ai: false, t: Date.now() } });
  const d = w.document;
  assert.ok(d.querySelector("#row").classList.contains("unslop-blur"));
  assert.ok(
    d.querySelector("#box > .unslop-overlay"),
    "overlay inside the row's box, not across the dropdown",
  );
  assert.equal(d.querySelector("#row > .unslop-overlay"), null);
  assert.equal(d.querySelector("#box").dataset.unslopTileHost, "static");
  d.querySelector('#box [data-tile-action="show"]').click();
  assert.equal(d.querySelector(".unslop-overlay"), null);
  assert.equal(d.querySelector("#box").dataset.unslopTileHost, undefined);
});

test("search row that is laid out late or re-rendered on hover gets its overlay moved back", async () => {
  const w = page({
    html: `
    <div id="drop" style="position:absolute" data-r="0,0,360,500">
      <a id="row" style="display:contents" href="https://store.steampowered.com/app/111/"><div id="box"><img src="cap.jpg"><div>Dungeon Alchemist</div></div></a>
    </div>`,
  });
  await start(w, { 111: entry(["transl"]) });
  const d = w.document;
  const row = d.querySelector("#row");
  // Not laid out yet when blurred: the unsized child still hosts the overlay, never the link.
  assert.ok(d.querySelector("#box > .unslop-overlay"));
  assert.equal(d.querySelector("#row > .unslop-overlay"), null);

  // Steam re-renders the row on hover: the child is replaced.
  const fresh = Object.assign(d.createElement("div"), {
    id: "box2",
    innerHTML: `<img src="cap.jpg"><div>Dungeon Alchemist</div>`,
  });
  fresh.dataset.r = "0,200,350,60";
  row.replaceChildren(fresh);
  await sleep(1100);
  assert.ok(d.querySelector("#box2 > .unslop-overlay"), "overlay restored inside the new row box");
  assert.equal(d.querySelectorAll(".unslop-overlay").length, 1);
});

test("inline links around block rows also get the overlay on their row box", async () => {
  const w = page({
    html: `
    <div style="position:absolute" data-r="0,0,360,500">
      <a id="row" style="display:inline" href="https://store.steampowered.com/app/111/"><div id="box" style="display:flex" data-r="0,200,350,60"><img src="cap.jpg"><div>Name</div></div></a>
      <a id="cap" style="display:inline" href="https://store.steampowered.com/app/222/"><img src="b.jpg" data-r="0,300,184,69"></a>
    </div>`,
  });
  await start(w, { 111: entry(["art"]), 222: entry(["art"]) });
  const d = w.document;
  assert.ok(d.querySelector("#box > .unslop-overlay"));
  assert.ok(
    d.querySelector("#cap > .unslop-overlay"),
    "a plain inline capsule keeps the overlay itself",
  );
});

test("classes dropped by a React re-render (hover) are restored", async () => {
  const w = page({
    html: `
    <div id="drop" style="position:absolute" data-r="0,0,360,500">
      <a id="row" class="QHiQcR8jG10- Focusable" data-r="0,100,350,60" href="https://store.steampowered.com/app/111/"><div data-r="0,100,120,45"><img src="cap.jpg"></div><div>Dungeon Settlers</div></a>
    </div>`,
  });
  await start(w, { 111: entry(["transl"]) });
  const row = w.document.querySelector("#row");
  assert.ok(row.classList.contains("unslop-blur"));
  row.className = "QHiQcR8jG10- Focusable is-hovered"; // what React does on hover
  await sleep(1100); // the scan fallback (the MutationObserver is stubbed in tests)
  assert.ok(row.classList.contains("unslop-blur"), "our class is back");
  assert.ok(row.classList.contains("is-hovered"), "Steam's own classes are kept");
  assert.equal(w.document.querySelectorAll(".unslop-overlay").length, 1);
});

test("the MutationObserver restores dropped classes before the next paint", async () => {
  const w = page({
    mo: true,
    html: `<a id="row" class="Row" data-r="0,100,350,60" href="https://store.steampowered.com/app/111/"><div><img src="cap.jpg"></div></a>`,
  });
  await start(w, { 111: entry(["art"]) });
  const row = w.document.querySelector("#row");
  row.className = "Row hovered";
  await Promise.resolve();
  await Promise.resolve(); // MutationObserver callbacks are microtasks
  assert.ok(row.classList.contains("unslop-blur"));
});

test("search suggestions stay open while the reason dialog is shown", async () => {
  const w = page({
    html: `
    <form><input id="q" value="dungeon"></form>
    <div id="sugg"><a id="row" data-r="0,100,350,60" href="https://store.steampowered.com/app/111/"><div><img src="cap.jpg"></div></a></div>`,
  });
  await start(w, { 111: entry(["art"], { name: "Dungeon Alchemist" }) });
  const d = w.document;
  const q = d.querySelector("#q");
  let closedBySteam = 0;
  // Typical popup logic: close on blur of the input and on clicks outside of the popup.
  q.addEventListener("blur", () => closedBySteam++);
  d.addEventListener("focusout", e => {
    if (e.target === q) closedBySteam++;
  });
  d.addEventListener("mousedown", e => {
    if (!d.querySelector("#sugg").contains(e.target)) closedBySteam++;
  });
  q.focus();

  const why = d.querySelector('#row [data-tile-action="why"]');
  const md = new w.MouseEvent("mousedown", { bubbles: true, cancelable: true });
  why.dispatchEvent(md);
  assert.ok(md.defaultPrevented, "pressing the button keeps the focus in the search field");
  why.click();
  assert.ok(d.querySelector(".unslop-modal"));
  d.querySelector(".unslop-dialog").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true }));
  assert.equal(
    closedBySteam,
    0,
    "neither the focus move nor clicks in the dialog close the suggestions",
  );

  d.querySelector("[data-close]").click();
  assert.equal(d.activeElement, q, "focus is back in the search field");
  q.blur();
  assert.ok(closedBySteam > 0, "normal blur works again after the dialog");
});

test("the same game listed twice in a result list gets two full overlays", async () => {
  const row = (n, id) =>
    `<a id="r${n}" class="search_result_row" data-r="0,${n * 50},900,45" href="https://store.steampowered.com/app/${id}/"><img src="${id}.jpg"></a>`;
  const w = page({ html: `<div id="rows">${row(1, 111)}${row(2, 222)}${row(3, 111)}</div>` });
  await start(w, { 111: entry(["art"]), 222: { ai: false, t: Date.now() } });
  assert.equal(overlayMode(w, "#r1"), "full");
  assert.equal(overlayMode(w, "#r3"), "full");
});
