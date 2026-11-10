// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { JSDOM } from "jsdom";
import { after } from "node:test";
import { readFileSync } from "node:fs";

const CORE = readFileSync(new URL("../dist/core.js", import.meta.url), "utf8");

export const CACHE_KEY = "unslopCache";
export const ENTRY_VERSION = Number(/var ENTRY_VERSION = (\d+);/.exec(CORE)[1]);
export const noAiEntry = () => ({ ai: false, t: Date.now(), v: ENTRY_VERSION });
// Values from the jsdom window have a foreign Array prototype; deepStrictEqual needs plain copies.
export const plain = x => JSON.parse(JSON.stringify(x));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const disclosure = text =>
  `<h2>AI Generated Content Disclosure</h2><p>${text}</p><h2>System Requirements</h2>`;
// Entries rated by the current detection, so they are not fetched again.
export const entry = (tags, extra = {}) => ({
  ai: true,
  tags,
  text: "x",
  t: Date.now(),
  v: ENTRY_VERSION,
  ...extra,
});
export const hover = (w, sel) =>
  w.document.querySelector(sel).dispatchEvent(new w.MouseEvent("mouseover", { bubbles: true }));

// The core runs intervals; close all windows so the test process can exit.
const windows = [];
after(() => windows.forEach(w => w.close()));

const isHidden = el => {
  for (let n = el; n?.style; n = n.parentElement)
    if (n.hidden || n.style.display === "none") return true;
  return false;
};

// jsdom has no layout engine: element sizes come from data-r="left,top,width,height".
export function page({
  html = "",
  url = "https://store.steampowered.com/",
  lang = "en",
  session = {},
  cookie,
  fetch,
  elementFromPoint,
  io = true,
  mo = false,
} = {}) {
  const dom = new JSDOM(`<html lang="${lang}"><body>${html}</body></html>`, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  windows.push(w);
  w.Element.prototype.getBoundingClientRect = function () {
    if (isHidden(this)) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const [left, top, width, height] = (this.dataset?.r || "0,0,0,0").split(",").map(Number);
    return { left, top, width, height, right: left + width, bottom: top + height };
  };
  w.Element.prototype.getClientRects = function () {
    return isHidden(this) ? [] : [{}];
  };
  w.IntersectionObserver = class {
    constructor(cb) {
      this.cb = cb;
    }
    observe(el) {
      if (io) setTimeout(() => this.cb([{ isIntersecting: true, target: el }]), 0);
    }
    unobserve() {}
  };
  if (!mo)
    w.MutationObserver = class {
      observe() {}
    };
  if (elementFromPoint) w.document.elementFromPoint = elementFromPoint(w.document);
  for (const [k, v] of Object.entries(session)) w.sessionStorage.setItem(k, v);
  if (cookie) w.document.cookie = cookie;
  w.fetch = fetch || (async () => ({ ok: false, status: 404 }));
  w.eval(CORE);
  return w;
}

// Settings are stored by default, so the first start welcome does not open. Pass
// { unslopSettings: undefined } to simulate a first start.
export function memoryStorage(initial = {}, delay = 0) {
  const data = JSON.parse(JSON.stringify({ unslopSettings: { minLevel: 0 }, ...initial }));
  const saves = [];
  return {
    data,
    saves,
    load: k => new Promise(r => setTimeout(() => r(data[k]), delay)),
    save: (k, v) => {
      saves.push({ k, t: Date.now() });
      data[k] = JSON.parse(JSON.stringify(v));
    },
    remove() {},
  };
}

export async function start(w, cache = {}, opts = {}) {
  const storage = memoryStorage({ [CACHE_KEY]: cache }, opts.delay || 0);
  await w.SteamUnslop.start(storage);
  return storage;
}

export const overlayMode = (w, sel) =>
  w.document.querySelector(`${sel} > .unslop-overlay`)?.className.match(/unslop-mode-(\w+)/)?.[1] ??
  null;
