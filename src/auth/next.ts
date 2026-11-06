import { useSearchParams } from "react-router-dom";

// Sign-in pages take ?next=<path>: where to go once signed in (e.g. back to
// the stream whose Follow button sent the guest there). Only same-site paths
// are honored, so a crafted link can't send anyone elsewhere.
function safe(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** The login page's link to path, sending the user back to next afterwards. */
export function loginPath(next: string, path = "/login"): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}

/** Where to go after signing in, and how to keep that across the auth tabs. */
export function useNext() {
  const [params] = useSearchParams();
  const next = safe(params.get("next"));
  return {
    to: next ?? "/",
    // The same page's links (login ↔ sign up ↔ password) keep the return path.
    link: (path: string) => (next ? loginPath(next, path) : path),
  };
}
