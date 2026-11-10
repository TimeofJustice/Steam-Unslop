// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Runs the built core in Chromium on a local page served under the store's origin, for the
// layout checks jsdom cannot do (container queries, real sizes, wrapping).
import { chromium } from "playwright";
import { after } from "node:test";
import { readFileSync } from "node:fs";

const CORE = readFileSync(new URL("../../dist/core.js", import.meta.url), "utf8");
let browser;
after(() => browser?.close());

export async function storePage(
  html,
  { cache = {}, settings = { minLevel: 0 }, viewport = { width: 1000, height: 800 } } = {},
) {
  browser ||= await chromium.launch();
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  await page.route("https://store.steampowered.com/test", r =>
    r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><body style="margin:0;padding:16px;background:#1b2838;font-family:Arial">${html}</body></html>`,
    }),
  );
  await page.goto("https://store.steampowered.com/test");
  await page.addScriptTag({ content: CORE });
  await page.evaluate(
    ({ cache, settings }) => {
      const mem = { unslopCache: cache, unslopSettings: settings };
      return SteamUnslop.start({
        load: async k => mem[k],
        save: async (k, v) => {
          mem[k] = v;
        },
        remove: async () => {},
      });
    },
    { cache, settings },
  );
  return page;
}

export const entry = (tags, extra = {}) => ({
  ai: true,
  tags,
  text: "x",
  name: "Game",
  t: Date.now(),
  v: 2,
  ...extra,
});
