// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, start, entry, hover, sleep } from "./helpers.mjs";

test("classic and generic hover popovers get the info and blurred images", async () => {
  const w = page({
    html: `
    <a id="cap" href="https://store.steampowered.com/app/111/"><img src="cap.jpg"></a>
    <div id="global_hover" style="position:absolute"><div id="global_hover_content">
      <div id="hover_app_111"><h4 class="hover_title">Cheap Car Repair</h4><div class="hover_release">28 May</div></div>
    </div></div>
    <div class="HomePopover_abc" id="pop" style="position:fixed"><div>Cheap Car Repair, a game about repairing cars <img src="s.jpg"></div></div>`,
  });
  await start(w, { 111: entry(["voice", "music"], { name: "Cheap Car Repair" }) });
  hover(w, "#cap img");
  await sleep(400);
  const d = w.document;
  assert.ok(d.querySelector("#hover_app_111 .unslop-hoverinfo"));
  assert.ok(d.querySelector("#hover_app_111").classList.contains("unslop-hoverblur"));
  assert.equal(d.querySelectorAll("#pop .unslop-hoverinfo").length, 1);
  assert.ok(d.querySelector("#pop").classList.contains("unslop-hoverblur"));
});

for (const withId of [true, false]) {
  test(`tab list preview pane is decorated (${withId ? "with" : "without"} app id)`, async () => {
    const w = page({
      url: "https://store.steampowered.com/explore/new/",
      html: `
      <div>
        <a class="tab_item" id="r1" href="https://store.steampowered.com/app/111/"><img src="a.jpg"><div class="tab_item_name">Wing Commander</div></a>
        <a class="tab_item" id="r2" href="https://store.steampowered.com/app/222/"><img src="b.jpg"><div class="tab_item_name">Zed Zone</div></a>
      </div>
      <div class="tab_preview_container">
        <div class="tab_preview" ${withId ? 'id="tab_preview_111"' : ""} style="display:none"><h2>Wing Commander</h2><img src="s1.jpg"></div>
        <div class="tab_preview" ${withId ? 'id="tab_preview_222"' : ""} style="display:none"><h2>Zed Zone</h2><img src="z.jpg"></div>
      </div>`,
    });
    await start(w, {
      111: entry(["art"], { name: "Wing Commander" }),
      222: { ai: false, t: Date.now(), v: 3 },
    });
    const [p1, p2] = w.document.querySelectorAll(".tab_preview");
    p1.style.display = "block";
    hover(w, "#r1 .tab_item_name");
    await sleep(400);
    assert.ok(p1.querySelector(".unslop-hoverinfo"));
    assert.ok(p1.closest(".unslop-hoverblur"));
    assert.equal(w.document.querySelectorAll("#r1 .unslop-hoverinfo").length, 0);

    p1.style.display = "none";
    p2.style.display = "block";
    hover(w, "#r2 .tab_item_name");
    await sleep(400);
    assert.ok(!p2.querySelector(".unslop-hoverinfo"));
    assert.ok(!p1.closest(".unslop-hoverblur"), "previous preview is cleaned up");
  });
}
