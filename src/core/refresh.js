// Copyright 2026 Jonas Oelschner (TimeofJustice). Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

/* Views that show a rating register here and are drawn again when the settings change what a
   rating counts (the excluded kinds of use), so no reload is needed. */
const redrawers = new Set();

// Returns a function that unregisters the view, e.g. when its dialog closes.
export function redrawOnRatingChange(redraw) {
  redrawers.add(redraw);
  return () => redrawers.delete(redraw);
}

export function redrawRatings() {
  for (const redraw of redrawers) redraw();
}
