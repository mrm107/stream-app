import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { eitaa, useBackHandler } from "../../eitaa";
import { supports } from "../../eitaa/webApp";

// The watch page's fullscreen: the player and its chat side panel together
// (Twitch-style), not the bare <video>, so chat can sit beside the video.
//
// Where the browser lets an element go fullscreen it does, and asks to lock
// landscape. Where it doesn't (Eitaa's WebView, iPhone Safari) the page fakes
// it: the container covers the viewport (CSS .watch--fs) and, inside Eitaa,
// the mini-app is asked to hide its own header. Turning a phone to landscape
// enters it the same way; turning back leaves it, if turning is what entered.
export function useWatchFullscreen(target: RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  const native = useRef(false); // entered through the Fullscreen API
  const byRotation = useRef(false);

  const enter = useCallback(async (rotated = false) => {
    const el = target.current;
    if (!el) return;
    byRotation.current = rotated;
    const app = eitaa();
    if (!app && el.requestFullscreen && document.fullscreenEnabled) {
      try {
        await el.requestFullscreen({ navigationUI: "hide" });
        native.current = true;
        setOn(true);
        // Only after a real fullscreen; fails quietly elsewhere.
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (!rotated) await orientation.lock?.("landscape").catch(() => {});
        return;
      } catch {
        // fall through to the in-page version
      }
    }
    native.current = false;
    setOn(true);
    if (app && supports("1.3")) {
      try {
        app.requestFullscreen?.();
      } catch {
        // older Eitaa: the page alone covers the screen
      }
    }
  }, [target]);

  const exit = useCallback(() => {
    byRotation.current = false;
    if (native.current && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    native.current = false;
    setOn(false);
    const app = eitaa();
    if (app && supports("1.3") && app.isFullscreen) {
      try {
        app.exitFullscreen?.();
      } catch {
        // nothing to undo
      }
    }
  }, []);

  // Esc, the system back gesture, or the browser leaving fullscreen.
  useEffect(() => {
    const sync = () => {
      if (native.current && !document.fullscreenElement) {
        native.current = false;
        byRotation.current = false;
        setOn(false);
      }
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Phones: landscape enters, portrait leaves (when landscape is what entered).
  const onRef = useRef(on);
  onRef.current = on;
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 540px) and (pointer: coarse)");
    const change = () => {
      if (mq.matches && !onRef.current) void enter(true);
      else if (!mq.matches && onRef.current && byRotation.current) exit();
    };
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, [enter, exit]);

  // Leaving the page must not leave the mini-app without its header.
  useEffect(() => () => exit(), [exit]);

  // Eitaa's back button leaves fullscreen first.
  useBackHandler(on ? exit : undefined);

  const toggle = useCallback(() => (on ? exit() : void enter()), [on, enter, exit]);
  return { fullscreen: on, toggle, exit };
}
