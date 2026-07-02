import { useEffect, useRef, useState } from "react";
import type HlsJs from "hls.js";

export type PlayerStatus = "loading" | "playing" | "offline" | "error";

interface Props {
  src: string; // HLS playlist URL (.m3u8)
  poster?: string;
  onStatus?: (status: PlayerStatus) => void;
}

// While a channel isn't live the manifest 404s; poll for it to appear so the
// player recovers on its own when the broadcaster starts.
const RETRY_MS = 4000;

// HlsPlayer plays a live HLS stream cross-browser: native HLS on Safari/iOS,
// hls.js everywhere else. hls.js is imported dynamically so it is only fetched
// when actually needed (a separate chunk, and never on Safari). It reports
// status and treats a missing manifest as "offline", retrying until it appears.
export default function HlsPlayer({ src, poster, onStatus }: Props) {
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

      hls = new Hls({
        lowLatencyMode: true,
        liveSyncDurationCount: 3, // ~3 segments behind the live edge
        backBufferLength: 30,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        // No manifest == stream isn't live yet. Go offline and poll.
        if (
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR
        ) {
          hls?.destroy();
          hls = null;
          scheduleRetry();
          return;
        }

        // Try to recover transient network/media errors before giving up.
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls?.recoverMediaError();
            break;
          default:
            hls?.destroy();
            hls = null;
            scheduleRetry();
        }
      });
    };

    const onPlaying = () => report("playing");
    const onWaiting = () => report("loading");
    // Native-path error (hls.js reports via its own ERROR event above).
    const onError = () => {
      if (!hls) scheduleRetry();
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onError);

    void setup();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
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
