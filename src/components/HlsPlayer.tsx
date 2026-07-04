import { useEffect, useRef, useState } from "react";
import type HlsJs from "hls.js";
import PlayerOverlay from "./PlayerOverlay";

// "loading"   = first connect, nothing decoded yet (dark backdrop + spinner)
// "buffering" = mid-playback stall — the last frame stays visible, spinner on
//               top (Twitch/YouTube pattern); never a black screen
export type PlayerStatus =
  | "loading"
  | "buffering"
  | "playing"
  | "offline"
  | "error";

interface Props {
  src: string; // HLS playlist URL (.m3u8)
  poster?: string;
  title?: string; // shown on the offline card
  onStatus?: (status: PlayerStatus) => void;
}

// While a channel isn't live the manifest 404s; poll for it to appear so the
// player recovers on its own when the broadcaster starts.
const RETRY_MS = 4000;

// HlsPlayer plays a live HLS stream cross-browser: native HLS on Safari/iOS,
// hls.js everywhere else. hls.js is imported dynamically so it is only fetched
// when actually needed (a separate chunk, and never on Safari). It reports
// status and treats a missing manifest as "offline", retrying until it appears.
export default function HlsPlayer({ src, poster, title, onStatus }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");

  // Hold the latest callback in a ref so changing it doesn't re-init the player.
  const statusCb = useRef(onStatus);
  useEffect(() => {
    statusCb.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: HlsJs | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stall: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    // current mirrors the reported status synchronously (state is async) so
    // event handlers can make decisions without a stale closure.
    let current: PlayerStatus = "loading";
    const report = (s: PlayerStatus) => {
      if (cancelled || s === current) return; // no-op when unchanged → no flicker
      current = s;
      setStatus(s);
      statusCb.current?.(s);
    };

    // scheduleRetry tears down to a slow 4s re-probe of the source. `as` is
    // what the overlay shows meanwhile — the rule: "offline" ONLY when the
    // server positively said the playlist doesn't exist (HTTP 404/410 ⇒ nothing
    // is being published). Every other failure (timeout, network blip, 5xx) is
    // indistinguishable from "still starting up", so it keeps showing loading.
    // Re-probes are silent: the status set here holds steady between attempts.
    const scheduleRetry = (as: "offline" | "loading") => {
      if (cancelled || retry) return;
      report(as);
      retry = setTimeout(() => {
        retry = null;
        void setup({ silent: true });
      }, RETRY_MS);
    };

    const setup = async (opts?: { silent?: boolean }) => {
      if (cancelled) return;
      if (!opts?.silent) report("loading"); // stay "offline" on background retries
      video.muted = true; // required for autoplay

      // Native HLS (Safari, iOS): let the browser handle everything; no hls.js.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.play().catch(() => {}); // autoplay may be blocked; controls remain
        return;
      }

      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (!Hls.isSupported()) {
        report("error");
        return;
      }

      // Note: SRS HLS is NOT low-latency HLS, so lowLatencyMode only adds
      // startup fragility. Keep the loader retries LOW: our own 4s poll
      // (scheduleRetry) is the "wait for the stream" mechanism, so hls.js should
      // hand off quickly instead of hammering a dead URL.
      hls = new Hls({
        lowLatencyMode: false,
        liveSyncDurationCount: 3, // ~3 segments behind the live edge
        backBufferLength: 30,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 2,
        levelLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1000,
      });

      // Per-attempt state: whether we ever loaded a manifest (⇒ stream is up)
      // and how many in-place recoveries we've tried before giving up.
      let gotManifest = false;
      let recoveries = 0;

      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        gotManifest = true;
        recoveries = 0;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        recoveries = 0; // playback is healthy again
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        // A load error on the PLAYLIST (manifest or level) — not a segment.
        const isPlaylistLoad =
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT;
        const gone =
          data.response?.code === 404 || data.response?.code === 410;

        // The playlist is unavailable. Stop hammering and fall back to the
        // slow poll — showing "offline" ONLY on a definitive 404/410 (the
        // stream is not published / has ended and hls_dispose cleaned up);
        // anything else (timeout, network, 5xx) keeps the loading state.
        if (isPlaylistLoad && (gone || !gotManifest)) {
          hls?.destroy();
          hls = null;
          scheduleRetry(gone ? "offline" : "loading");
          return;
        }

        // Otherwise the stream EXISTS but is hiccupping (partial playlist, a
        // late segment, buffer stall). Recover IN PLACE — same session — rather
        // than churning a fresh SRS session each time.
        if (recoveries < 6) {
          recoveries += 1;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
          } else {
            hls?.startLoad();
          }
          return;
        }

        // Recovery exhausted → full reconnect as a last resort. Not a 404, so
        // the stream may well be up — keep showing loading, not offline.
        hls?.destroy();
        hls = null;
        scheduleRetry("loading");
      });
    };

    const onPlaying = () => {
      if (stall) {
        clearTimeout(stall);
        stall = null;
      }
      report("playing");
    };
    // A mid-playback stall = "buffering": the last frame stays on screen and
    // the overlay only floats a spinner over it — never the dark backdrop.
    // Debounced 300ms so micro-stalls don't flash the spinner. "waiting" fired
    // while offline/connecting is ignored (that's the retry loop attaching,
    // not a real stall).
    const onWaiting = () => {
      if (current !== "playing" || stall) return;
      stall = setTimeout(() => {
        stall = null;
        if (current === "playing") report("buffering");
      }, 300);
    };
    // Native-path error (hls.js reports via its own ERROR event above). The
    // <video> element hides the HTTP status, so probe the playlist once to
    // apply the same rule: 404/410 ⇒ offline, anything else ⇒ still loading.
    const onError = () => {
      if (hls) return;
      void fetch(src, { cache: "no-store" })
        .then((res) =>
          scheduleRetry(
            res.status === 404 || res.status === 410 ? "offline" : "loading"
          )
        )
        .catch(() => scheduleRetry("loading"));
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onError);

    void setup();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      if (stall) clearTimeout(stall);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onError);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <div className="player">
      <video
        ref={videoRef}
        className="video"
        controls
        playsInline
        muted
        poster={poster}
      />
      <PlayerOverlay status={status} title={title} />
    </div>
  );
}
