import { useEffect, useRef, useState } from "react";
import type { PlayerStatus } from "./HlsPlayer";

// mpegts.js exposes its Player type only inside a non-exported namespace, so we
// recover it from createPlayer's return type.
type MpegtsPlayer = ReturnType<
  (typeof import("mpegts.js"))["default"]["createPlayer"]
>;

interface Props {
  src: string; // HTTP-FLV URL (.flv)
  poster?: string;
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
export default function FlvPlayer({ src, poster, onStatus }: Props) {
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
    let cancelled = false;

    const report = (s: PlayerStatus) => {
      if (cancelled) return;
      setStatus(s);
      statusCb.current?.(s);
    };

    const scheduleRetry = () => {
      if (cancelled || retry) return;
      report("offline");
      retry = setTimeout(() => {
        retry = null;
        void setup();
      }, RETRY_MS);
    };

    const setup = async () => {
      if (cancelled) return;
      report("loading");
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

      // A missing stream surfaces as a network/loading error → treat as offline.
      player.on(mpegts.Events.ERROR, (type: string) => {
        player?.destroy();
        player = null;
        if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
          scheduleRetry();
        } else {
          report("error");
        }
      });

      player.load();
      video.play().catch(() => {}); // autoplay may be blocked; controls remain
    };

    const onPlaying = () => report("playing");
    const onWaiting = () => report("loading");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);

    void setup();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
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
      {status !== "playing" && (
        <div className="player-overlay">
          {status === "loading" && <span className="muted">Connecting…</span>}
          {status === "offline" && (
            <span className="muted">🔌 Channel is offline</span>
          )}
          {status === "error" && (
            <span className="muted">Can't play this stream in your browser</span>
          )}
        </div>
      )}
    </div>
  );
}
