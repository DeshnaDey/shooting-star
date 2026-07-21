// Tracks the last pointer-down position so navigation transitions can originate
// the colour blob from wherever the user actually clicked (a nav item, a button,
// a link) — making each page feel like it zooms in from that point.

let last = {
  x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
  y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
};

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => { last = { x: e.clientX, y: e.clientY }; },
    true // capture, so we record it before React handlers navigate
  );
}

export function getLastPointer() {
  return last;
}
