// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { test } from "node:test";
import assert from "node:assert/strict";
import { page, start, entry, sleep } from "./helpers.mjs";

const CART_URL = "https://store.steampowered.com/cart/";

// 111 discloses AI art, 222 has no disclosure.
const cache = { 111: entry(["art"], { name: "AI Game" }), 222: { ...entry([]), ai: false } };

// A cart page with Steam's payment link; the user data says which games are in the cart.
function cartPage(appsInCart, { userDataFails = false } = {}) {
  const fetch = async url => {
    if (!String(url).includes("/dynamicstore/userdata/")) return { ok: false, status: 404 };
    if (userDataFails) throw new Error("offline");
    return { ok: true, status: 200, json: async () => ({ rgAppsInCart: appsInCart }) };
  };

  const w = page({
    url: CART_URL,
    fetch,
    html: '<a id="pay" href="#checkout">Continue to payment</a>',
  });

  // Stands in for Steam's own handler, which opens the payment page.
  w.paymentOpened = 0;
  w.document.querySelector("#pay").addEventListener("click", () => w.paymentOpened++);
  return w;
}

const warning = w => w.document.querySelector(".unslop-cart-warning");

test("paying for a cart with an AI game asks first", async () => {
  const w = cartPage([111, 222]);
  await start(w, cache);
  const d = w.document;

  d.querySelector("#pay").click();
  await sleep(50);

  assert.equal(w.paymentOpened, 0, "the payment page waits for the answer");
  assert.ok(warning(w));
  assert.deepEqual(
    [...warning(w).querySelectorAll(".unslop-game-name")].map(name => name.textContent),
    ["AI Game"],
    "only the AI game is listed",
  );

  warning(w).querySelector("[data-cart-continue]").click();
  assert.equal(w.paymentOpened, 1, "continuing opens the payment page");
  assert.equal(warning(w), null);
});

test("going back to the cart does not open the payment page", async () => {
  const w = cartPage([111]);
  await start(w, cache);

  w.document.querySelector("#pay").click();
  await sleep(50);
  warning(w).querySelector("[data-close]").click();

  assert.equal(w.paymentOpened, 0);
  assert.equal(warning(w), null);
});

test("a cart without AI games goes straight to the payment page", async () => {
  const w = cartPage([222]);
  await start(w, cache);

  w.document.querySelector("#pay").click();
  await sleep(50);

  assert.equal(w.paymentOpened, 1);
  assert.equal(warning(w), null);
});

test("AI games the user always shows do not stop the payment", async () => {
  const w = cartPage([111]);
  await start(w, cache);
  w.SteamUnslop.applySettings({ minLevel: 0, allow: [{ id: "111", name: "AI Game" }] });

  w.document.querySelector("#pay").click();
  await sleep(50);

  assert.equal(w.paymentOpened, 1);
});

test("the payment is never blocked when the cart cannot be checked", async () => {
  const w = cartPage([111], { userDataFails: true });
  await start(w, cache);

  w.document.querySelector("#pay").click();
  await sleep(50);

  assert.equal(w.paymentOpened, 1);
  assert.equal(warning(w), null);
});

test("games in a bundle in the cart are checked, bundles only offered are not", async () => {
  const bundleApps = { 500: [222, 111], 600: [333] };
  const fetch = async url => {
    const address = String(url);
    if (address.includes("/dynamicstore/userdata/")) {
      return { ok: true, status: 200, json: async () => ({ rgAppsInCart: [] }) };
    }
    if (address.includes("/IStoreBrowseService/GetItems/")) {
      const input = JSON.parse(new URL(address).searchParams.get("input_json"));
      const storeItems = input.ids.map(({ bundleid }) => ({
        id: bundleid,
        included_appids: bundleApps[bundleid],
      }));
      return {
        ok: true,
        status: 200,
        json: async () => ({ response: { store_items: storeItems } }),
      };
    }
    return { ok: false, status: 404 };
  };

  const w = page({
    url: CART_URL,
    fetch,
    html:
      '<a href="https://store.steampowered.com/bundle/500/Pack/"><img src="pack.jpg"></a>' +
      '<p>Also part of <a href="https://store.steampowered.com/bundle/600/Offer/">Offer</a></p>' +
      '<a id="pay" href="#checkout">Continue to payment</a>',
  });
  w.paymentOpened = 0;
  w.document.querySelector("#pay").addEventListener("click", () => w.paymentOpened++);

  await start(w, { ...cache, 333: entry(["voice"], { name: "Offered Game" }) });
  w.document.querySelector("#pay").click();
  await sleep(50);

  assert.equal(w.paymentOpened, 0);
  assert.deepEqual(
    [...warning(w).querySelectorAll(".unslop-game-name")].map(name => name.textContent),
    ["AI Game"],
    "the AI game of the bundle in the cart, not the one of the offered bundle",
  );
});
