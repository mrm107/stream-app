import { useEffect, useRef } from "react";
import { eitaa, supports } from "./webApp";

// Eitaa has one back button. What it does depends on what is on screen: an
// open menu or a step goes first, the latest one on top, then the page's own
// back. With neither, the page is a first page: the button is hidden and Eitaa
// shows close. A video in fullscreen is left before any of these.

type Entry = { run: () => void };
type Layer = "overlay" | "page";

const layers: Record<Layer, Entry[]> = { overlay: [], page: [] };
const listeners = new Set<() => void>();

function changed() {
  listeners.forEach((listener) => listener());
}

/** Adds a handler on its layer and returns its removal. The hooks below are the usual way in. */
export function registerBack(layer: Layer, run: () => void) {
  const list = layers[layer];
  const entry = { run };
  list.push(entry);
  changed();
  return () => {
    const index = list.indexOf(entry);
    if (index >= 0) list.splice(index, 1);
    changed();
  };
}

/** What back does now, or null on a first page. */
export function currentBack(): (() => void) | null {
  if (document.fullscreenElement) return () => void document.exitFullscreen().catch(() => {});
  const { overlay, page } = layers;
  const entry = overlay[overlay.length - 1] ?? page[page.length - 1];
  return entry ? entry.run : null;
}

export function subscribeBack(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useEntry(layer: Layer, handler: (() => void) | undefined) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  const active = handler !== undefined;
  useEffect(() => {
    if (!active) return;
    return registerBack(layer, () => latest.current?.());
  }, [layer, active]);
}

/** While set, back runs this instead of leaving the page: for a menu or a step. */
export function useBackHandler(handler: (() => void) | undefined) {
  useEntry("overlay", handler);
}

/** Back for the page itself. Without one, the page counts as a first page. */
export function usePageBack(handler: (() => void) | undefined) {
  useEntry("page", handler);
}

/** Connects the stack to Eitaa's button. Called once at startup. */
export function connectBackButton() {
  const app = eitaa();
  if (!app || !supports("1.0")) return;
  const sync = () => (currentBack() ? app.BackButton.show() : app.BackButton.hide());
  subscribeBack(sync);
  document.addEventListener("fullscreenchange", sync);
  app.BackButton.onClick(() => currentBack()?.());
  sync();
}
