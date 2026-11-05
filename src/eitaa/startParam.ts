import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { eitaa } from "./webApp";

// Opening a stream from a link in Eitaa. The link opens the mini-app with a
// start parameter ("live|<channelId>"); Eitaa hands it to the page in
// initData (start_param), and the app goes straight to that stream.
//
// The link is VITE_EITAA_APP_LINK, the mini-app's own link from Eitaa's
// developer panel, e.g. https://eitaa.com/<bot>/<app>. The parameter is added
// as ?startapp=…, or put where "{param}" stands for another link format.

const USED_KEY = "stream.startParamUsed";
// "<kind><separator><id>". Links are made with LIVE_SEPARATOR; any of "|",
// "_" or "-" is read, so links already handed out keep working if it changes.
// (Telegram allows only letters, digits, "_" and "-" here; should Eitaa drop
// "|", set LIVE_SEPARATOR to "_".)
const LIVE_SEPARATOR = "|";
const LIVE = /^(?:live|watch)[|_-](\d+)$/;

/** The start parameter the mini-app was opened with, or "" when none. */
export function startParam(): string {
  const fromHost = eitaa()?.initDataUnsafe?.start_param;
  if (fromHost) return fromHost;
  // Some clients put it on the URL instead.
  const query = new URLSearchParams(window.location.search);
  return query.get("tgWebAppStartParam") ?? query.get("startapp") ?? "";
}

/** The app route a start parameter leads to, or null for an unknown one. */
export function routeFor(param: string): string | null {
  let decoded = param;
  try {
    decoded = decodeURIComponent(param); // "live%7C1" arrives as-is from some clients
  } catch {
    // Not encoded: match it as it is.
  }
  const live = LIVE.exec(decoded);
  return live ? `/watch/${live[1]}` : null;
}

/** A link that opens this channel's stream: in the Eitaa mini-app when its link is configured, else on the web. */
export function streamShareLink(channelId: number): string {
  const param = encodeURIComponent(`live${LIVE_SEPARATOR}${channelId}`);
  const app = import.meta.env.VITE_EITAA_APP_LINK?.trim();
  if (!app) return `${window.location.origin}/watch/${channelId}`;
  if (app.includes("{param}")) return app.replace("{param}", param);
  return `${app}${app.includes("?") ? "&" : "?"}startapp=${param}`;
}

/**
 * Goes to the page the start parameter names, once per opening of the app:
 * a reload inside Eitaa keeps the same initData and must not jump again. It
 * pushes, so Eitaa's back button returns to Browse.
 */
export function useStartParamRoute() {
  const navigate = useNavigate();
  useEffect(() => {
    const param = startParam();
    const route = param ? routeFor(param) : null;
    if (!route) return;
    try {
      if (sessionStorage.getItem(USED_KEY) === param) return;
      sessionStorage.setItem(USED_KEY, param);
    } catch {
      // No storage: a reload may follow the link again, which is harmless.
    }
    if (window.location.pathname !== route) navigate(route);
  }, [navigate]);
}
