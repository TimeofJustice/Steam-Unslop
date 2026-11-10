// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

import { texts } from "./i18n.js";
import { cache, saveCache } from "./cache.js";

// The endpoints the store's own buttons use, authenticated by the sessionid cookie.
async function postToStore(path, parameters) {
  const sessionId = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/)?.[1];
  if (!sessionId) throw "login";

  const response = await fetch(`https://store.steampowered.com${path}`, {
    method: "POST",
    credentials: "include",
    body: new URLSearchParams({ sessionid: sessionId, ...parameters }),
  });

  if (response.status === 401 || response.status === 403) throw "login";
  if (!response.ok) throw response.status;

  const result = await response.json().catch(() => null);
  if (result === false || result?.success === false) throw "fail";
}

export const removedFromWishlist = new Set();

async function ignoreGame(appId, alsoFromWishlist) {
  await postToStore("/recommended/ignorerecommendation/", { appid: appId, remove: 0 });

  if (alsoFromWishlist) {
    await postToStore("/api/removefromwishlist", { appid: appId });
    removedFromWishlist.add(appId);
  }

  if (cache[appId]) {
    cache[appId].ignored = true;
    saveCache();
  }
}

// Removing from the wishlist loses the rank and cannot be undone, so it needs a second click.
export function handleIgnoreClick(button, appId, alsoFromWishlist, onDone) {
  if (button.disabled) return;

  const originalLabel = button.dataset.original || (button.dataset.original = button.textContent);
  const resetLabel = () => {
    if (button.disabled) return;
    delete button.dataset.confirm;
    button.textContent = originalLabel;
  };

  if (alsoFromWishlist && !button.dataset.confirm) {
    button.dataset.confirm = "1";
    button.textContent = texts.ignoreConfirm;
    setTimeout(resetLabel, 4000);
    return;
  }

  button.disabled = true;
  button.textContent = "...";

  ignoreGame(appId, alsoFromWishlist)
    .then(() => {
      button.textContent = alsoFromWishlist ? texts.ignoredRemoved : texts.ignored;
      onDone?.();
    })
    .catch(error => {
      button.disabled = false;
      delete button.dataset.confirm;
      button.textContent = error === "login" ? texts.errLogin : texts.errFail;
      setTimeout(resetLabel, 3000);
    });
}
