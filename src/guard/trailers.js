// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* Holds the trailers of AI games before they start. It runs in the page's own JavaScript world,
   where it can answer the store player's play() like a browser that blocks autoplay: the player
   then shows its Play button and knows the video is stopped, so one click starts it. Pausing a
   video from outside instead leaves the player believing it plays.
   The core decides through <html data-unslop-trailers>: "pending" until it has rated the game,
   then "hold" or "allow". Starts the user asks for (a click or key on the player) always play. */
(() => {
  if (globalThis.__unslopTrailerGuard) return;
  globalThis.__unslopTrailerGuard = true;

  const DECISION_WAIT = 8000;
  const INTENT_LIFETIME = 1500;

  const originalPlay = HTMLMediaElement.prototype.play;
  const stateOf = () => document.documentElement?.dataset.unslopTrailers;

  let lastIntent = { target: null, time: 0 };
  for (const type of ["pointerdown", "keydown"]) {
    addEventListener(
      type,
      event => (lastIntent = { target: event.target, time: Date.now() }),
      true,
    );
  }

  // The player around a video holds its Play button and controls.
  function startedByUser(video) {
    const { target, time } = lastIntent;
    if (!(target instanceof Node) || Date.now() - time > INTENT_LIFETIME) return false;

    const player =
      video.closest(".highlight_ctn, .highlight_player_area") || video.parentElement?.parentElement;
    return video.contains(target) || !!player?.contains(target);
  }

  function waitForDecision() {
    return new Promise(resolve => {
      if (stateOf() !== "pending") return resolve();

      const observer = new MutationObserver(() => {
        if (stateOf() === "pending") return;
        observer.disconnect();
        resolve();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-unslop-trailers"],
      });

      // Never hold a video for good if the core does not decide.
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, DECISION_WAIT);
    });
  }

  const refuse = () =>
    Promise.reject(new DOMException("Steam Unslop holds trailers of AI games", "NotAllowedError"));

  HTMLMediaElement.prototype.play = function play() {
    if (!(this instanceof HTMLVideoElement) || startedByUser(this)) {
      return originalPlay.call(this);
    }

    const state = stateOf();
    if (state === "hold") return refuse();
    if (state !== "pending") return originalPlay.call(this);

    return waitForDecision().then(() =>
      stateOf() === "hold" ? refuse() : originalPlay.call(this),
    );
  };
})();
