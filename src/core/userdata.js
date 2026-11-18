// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* The signed-in user's store data: wishlist and cart. One request per page is enough for the
   wishlist; the cart asks again before paying, as it may have changed since. Signed out, the
   lists are empty. */
const USER_DATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";

let userDataRequest = null;

export function loadUserData({ fresh = false } = {}) {
  if (fresh || !userDataRequest) {
    userDataRequest = fetch(`${USER_DATA_URL}?t=${Date.now()}`, { credentials: "include" })
      .then(response => response.json())
      .catch(() => null);
  }
  return userDataRequest;
}

export async function wishlistAppIds() {
  const userData = await loadUserData();
  return (userData?.rgWishlist || []).map(String);
}

export async function cartAppIds() {
  const userData = await loadUserData({ fresh: true });
  if (!userData) throw new Error("user data unavailable");
  return (userData.rgAppsInCart || []).map(String);
}
