// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, start, disclosure, sleep } from "./helpers.mjs";

const GAME_URL = "https://store.steampowered.com/app/111/";

// Stands in for Steam's "Report this Product" button; the clicks are counted.
function gamePage({ withDisclosure = false, reported = false } = {}) {
  const w = page({
    url: GAME_URL,
    mo: true,
    html:
      `<div id="appHubAppName">Game</div>` +
      `<a id="ReportAppBtn" class="${reported ? "btn_active" : ""}" href="#"></a>` +
      (withDisclosure ? disclosure("AI voices.") : ""),
  });

  w.reportClicks = 0;
  w.document.querySelector("#ReportAppBtn").addEventListener("click", () => w.reportClicks++);
  return w;
}

test("game pages without a disclosure offer to report undisclosed AI", async () => {
  const w = gamePage();
  await start(w);
  const d = w.document;

  const banner = d.querySelector(".unslop-report");
  assert.ok(banner, "the banner is shown below the title");
  assert.equal(d.querySelector("#appHubAppName").nextElementSibling, banner);

  banner.querySelector("button").click();
  assert.equal(w.reportClicks, 1, "Steam's own report dialog opens");

  // Steam marks its own button once the report was sent.
  d.querySelector("#ReportAppBtn").classList.add("btn_active");
  await sleep(50);
  assert.equal(banner.querySelector("button").disabled, true);
});

test("game pages with a disclosure get no report banner", async () => {
  const w = gamePage({ withDisclosure: true });
  await start(w);

  assert.equal(w.document.querySelector(".unslop-report"), null);
});

test("an already reported game shows the banner as reported", async () => {
  const w = gamePage({ reported: true });
  await start(w);

  const button = w.document.querySelector(".unslop-report button");
  assert.equal(button.disabled, true);
});
