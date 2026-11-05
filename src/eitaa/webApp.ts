// public/scripts/miniapp.js loads before the app, so window.Eitaa is always
// there. Outside Eitaa it has no initData, and every call here does nothing.

export function eitaa(): EitaaWebApp | null {
  const app = window.Eitaa?.WebApp;
  return app?.initData ? app : null;
}

/** True when the page runs inside the Eitaa mini-app. */
export function inEitaa(): boolean {
  return eitaa() !== null;
}

export function supports(version: string): boolean {
  return eitaa()?.isVersionAtLeast(version) ?? false;
}

/** The signed initData to sign in with, or "" outside Eitaa. */
export function getInitData(): string {
  const fromHost = eitaa()?.initData;
  if (fromHost) return fromHost;
  if (import.meta.env.DEV) return import.meta.env.VITE_DEV_EITAA_INIT_DATA ?? "";
  return "";
}

/** The Eitaa user the mini-app was opened by, unverified: only to notice an account switch. */
export function eitaaUserId(): number | null {
  return eitaa()?.initDataUnsafe?.user?.id ?? null;
}

/**
 * Called once at startup. The app takes the whole height, and vertical swipes
 * no longer close it: without that, scrolling up a page (or the chat) drags
 * the mini-app down and shuts it.
 */
export function startEitaa() {
  const app = eitaa();
  if (!app) return;
  document.documentElement.classList.add("in-eitaa");
  app.ready();
  app.expand();
  try {
    app.disableVerticalSwipes();
  } catch {
    // Older Eitaa: the method is missing; nothing to turn off.
  }
}

/** Eitaa's header, the area behind the app and its bottom bar take the app's background. */
export function setHostColor(color: string) {
  const app = eitaa();
  if (!app || !supports("1.0")) return;
  app.setHeaderColor(color);
  app.setBackgroundColor(color);
  if (supports("1.3")) app.setBottomBarColor(color);
}
