// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* Trailers on the page of an AI game do not start on their own. The holding itself is done by
   the trailer guard (src/guard/trailers.js) in the page's own JavaScript world; the core tells it
   through <html data-unslop-trailers> what to do: "pending" until the game is rated, then
   "hold" or "allow". */
const TRAILER_STATE = "unslopTrailers";

// At document_start on a game page: the store player may try to start before the rating.
export function holdTrailersUntilRated() {
  document.documentElement.dataset[TRAILER_STATE] = "pending";
}

export function decideTrailers(hold) {
  document.documentElement.dataset[TRAILER_STATE] = hold ? "hold" : "allow";
}

// Videos that start by their autoplay attribute call no play(); they are stopped here.
export function stopAutoplayingVideos() {
  for (const video of document.querySelectorAll("video[autoplay]")) {
    video.autoplay = false;
    try {
      video.pause();
    } catch {
      // No media support.
    }
  }
}
