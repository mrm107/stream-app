import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiRequestError } from "../api/client";
import type { LiveStream } from "../api/types";

// How often the live list refreshes. The server's viewer counts move every few
// seconds, but a browse page that reshuffles under the cursor is worse than
// one that is half a minute stale.
const REFRESH_MS = 30_000;

interface LiveStreamsState {
  streams: LiveStream[] | null; // null until the first load
  error: string;
  refresh: () => void;
  // byChannel finds a channel's live session, if it is live.
  byChannel: (channelId: number) => LiveStream | undefined;
}

const LiveStreamsContext = createContext<LiveStreamsState | null>(null);

// LiveStreamsProvider loads GET /streams once for the whole app — the sidebar,
// the browse grid and the watch page all read the same list — and keeps it
// fresh while the tab is visible.
export function LiveStreamsProvider({ children }: { children: ReactNode }) {
  const [streams, setStreams] = useState<LiveStream[] | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    api.streams
      .listLive()
      .then((s) => {
        setStreams(s);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : "network error")
      );
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const byChannel = useCallback(
    (channelId: number) => streams?.find((s) => s.channel_id === channelId),
    [streams]
  );

  return (
    <LiveStreamsContext.Provider value={{ streams, error, refresh, byChannel }}>
      {children}
    </LiveStreamsContext.Provider>
  );
}

export function useLiveStreams(): LiveStreamsState {
  const ctx = useContext(LiveStreamsContext);
  if (!ctx) throw new Error("useLiveStreams outside LiveStreamsProvider");
  return ctx;
}
