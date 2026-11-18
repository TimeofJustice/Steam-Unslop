// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* On the page of an AI game, trailers do not start on their own: a video only plays after the
   user's own click. Media events do not bubble, but a capturing listener on the document still
   sees them before the player does. */
const startedByUser = () => !!navigator.userActivation?.isActive;

function pause(video) {
  try {
    video.pause();
  } catch {
    // No media support.
  }
}

function stopAutoplay(event) {
  if (event.target instanceof HTMLVideoElement && !startedByUser()) pause(event.target);
}

export function holdTrailers() {
  document.addEventListener("play", stopAutoplay, true);

  for (const video of document.querySelectorAll("video")) {
    video.autoplay = false;
    if (!video.paused) pause(video);
  }
}
