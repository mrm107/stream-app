import { useEffect, useRef, useState } from "react";
import type { PlayerStatus } from "./HlsPlayer";
import PlayerOverlay from "./PlayerOverlay";

// mpegts.js exposes its Player type only inside a non-exported namespace, so we
// recover it from createPlayer's return type.
type MpegtsPlayer = ReturnType<
  (typeof import("mpegts.js"))["default"]["createPlayer"]
>;

interface Props {
  src: string; // HTTP-FLV URL (.flv)
  poster?: string;
  title?: string; // shown on the offline card
  onStatus?: (status: PlayerStatus) => void;
}

// While a channel isn't live the .flv 404s; poll for it to appear so the
// player recovers on its own when the broadcaster starts.
const RETRY_MS = 4000;

// FlvPlayer plays a live HTTP-FLV stream via mpegts.js. FLV has much lower
// latency than HLS (~1-2s), but no browser plays it natively, so mpegts.js is
// always required — it is imported dynamically so its chunk only loads when the
// viewer actually switches to FLV. Interface mirrors HlsPlayer (same status
// reporting and offline-retry) so the two are drop-in interchangeable.
export default function FlvPlayer({ src, poster, title, onStatus }: Props) {
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

    let player: MpegtsPlayer | null = null;
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

    // scheduleRetry tears down to a slow 4s re-probe. `as` is what the overlay
    // shows meanwhile — "offline" ONLY on a definitive HTTP 404/410 (nothing is
    // published); any other failure keeps showing loading. Re-probes are
    // silent: the status set here holds steady between attempts.
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

      const mpegts = (await import("mpegts.js")).default;
      if (cancelled) return;
      if (!mpegts.getFeatureList().mseLivePlayback) {
        report("error");
        return;
      }

      player = mpegts.createPlayer(
        { type: "flv", url: src, isLive: true },
        // Low-latency live tuning: chase the live edge, don't buffer far ahead.
        { enableWorker: true, liveBufferLatencyChasing: true, lazyLoad: false }
      );
      player.attachMediaElement(video);

      // A missing stream surfaces as a network error carrying the HTTP status
      // in `info.code`. Offline ONLY on a definitive 404/410; every other
      // network failure keeps the loading state while we re-probe.
      player.on(
        mpegts.Events.ERROR,
        (type: string, _detail: string, info?: { code?: number }) => {
          player?.destroy();
          player = null;
          if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
            const gone = info?.code === 404 || info?.code === 410;
            scheduleRetry(gone ? "offline" : "loading");
          } else {
            report("error");
          }
        }
      );

      player.load();
      video.play().catch(() => {}); // autoplay may be blocked; controls remain
    };

    const onPlaying = () => {
      if (stall) {
        clearTimeout(stall);
        stall = null;
      }
      report("playing");
    };
    // A mid-playback stall = "buffering": keep the last frame, float a spinner
    // over it (see PlayerOverlay). Debounced 300ms so micro-stalls don't flash;
    // "waiting" while offline/connecting is ignored.
    const onWaiting = () => {
      if (current !== "playing" || stall) return;
      stall = setTimeout(() => {
        stall = null;
        if (current === "playing") report("buffering");
      }, 300);
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);

    void setup();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      if (stall) clearTimeout(stall);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      player?.destroy();
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
