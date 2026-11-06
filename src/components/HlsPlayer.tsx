import { useCallback, useEffect, useRef, useState } from "react";
import type HlsJs from "hls.js";
import PlayerOverlay from "./PlayerOverlay";
import PlayerControls from "./player/PlayerControls";
import type { PlayerUi, SettingGroup } from "./player/PlayerControls";
import { useI18n } from "../i18n";
import type { Rendition } from "../util/constant";

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
  banner?: string | null; // the channel's banner, behind the offline card
  onStatus?: (status: PlayerStatus) => void;
  // Lower-quality copies of src. Only the ones that exist are offered, so an
  // empty or partly missing list just means fewer qualities (src alone works
  // exactly as without ABR). Keep the array stable (useMemo): it re-inits the
  // player. Ignored on the native-HLS fallback, which can't play a blob master.
  renditions?: Rendition[];
  // The watch page's additions to the controls (settings, fullscreen, chat).
  ui?: PlayerUi;
}

// The source's own entry in the generated master playlist. Its real bitrate
// and size are whatever the broadcaster's OBS sends; these are the OBS
// settings we recommend, and only steer hls.js's ABR and capLevelToPlayerSize.
const SOURCE_LEVEL = { name: "Source", bandwidth: 2_800_000, width: 1280, height: 720 };

type LevelInfo = { name: string; bandwidth: number; width: number; height: number };

// One entry of the quality menu: hls.js level index + label.
interface QualityOption {
  index: number;
  name: string;
}

// httpStatus returns the HTTP status of a GET to url, or 0 when it didn't
// answer (network error / timeout). Used to probe playlists before playing.
async function httpStatus(url: string): Promise<number> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.status;
  } catch {
    return 0;
  }
}

const isOK = (code: number) => code >= 200 && code < 300;

// masterPlaylist lists src plus the given renditions as one ABR master.
// URLs must be absolute: a blob: playlist has no base to resolve against.
function masterPlaylist(src: string, renditions: Rendition[]): string {
  const abs = (u: string) => new URL(u, window.location.href).href;
  const entry = (r: LevelInfo, url: string) =>
    `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height},NAME="${r.name}"\n${abs(url)}`;
  return ["#EXTM3U", entry(SOURCE_LEVEL, src), ...renditions.map((r) => entry(r, r.url)), ""].join("\n");
}

// While a channel isn't live the manifest 404s; poll for it to appear so the
// player recovers on its own when the broadcaster starts.
const RETRY_MS = 4000;

// HlsPlayer plays a live HLS stream cross-browser: hls.js wherever MSE (or
// ManagedMediaSource) exists, native HLS only where it doesn't (older iPhones).
// hls.js is imported dynamically so it is a separate chunk. It reports
// status and treats a missing manifest as "offline", retrying until it appears.
export default function HlsPlayer({ src, poster, title, banner, onStatus, renditions, ui }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsJs | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  // Quality menu: the levels on offer (empty = single quality, no menu), the
  // viewer's choice (-1 = auto) and the level hls.js is playing right now.
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [choice, setChoice] = useState(-1);
  const [playing, setPlaying] = useState(-1);

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
    let master: string | null = null; // blob: URL of the generated master

    const dropMaster = () => {
      if (master) URL.revokeObjectURL(master);
      master = null;
    };
    // dropHls tears down one playback attempt (before a retry).
    const dropHls = () => {
      hls?.destroy();
      hls = null;
      hlsRef.current = null;
      dropMaster();
      setQualities([]);
      setChoice(-1);
      setPlaying(-1);
    };

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

      // hls.js FIRST, native HLS only as the fallback (hls.js's own advice).
      // Newer Chrome/Edge also answer canPlayType("application/vnd.apple.mpegurl"),
      // and native playback has none of our tuning: no quality menu, no ABR
      // over the renditions, no retry policy. Native is left for browsers
      // without MSE/ManagedMediaSource (older iPhones).
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
          video.play().catch(() => {}); // autoplay may be blocked; controls remain
        } else {
          report("error");
        }
        return;
      }

      // With renditions, probe before playing: first the source (a 404 means
      // not live — keep polling without spinning up hls.js, so being offline
      // still costs one request per poll), then the copies, offering only
      // those that exist. Copies start a few seconds after the source, so a
      // viewer who joins in that gap gets the source alone until a reconnect.
      let manifest = src;
      if (renditions?.length) {
        const code = await httpStatus(src);
        if (cancelled) return;
        if (code === 404 || code === 410) {
          scheduleRetry("offline");
          return;
        }
        if (isOK(code)) {
          const codes = await Promise.all(renditions.map((r) => httpStatus(r.url)));
          if (cancelled) return;
          const available = renditions.filter((_, i) => isOK(codes[i]));
          if (available.length) {
            master = URL.createObjectURL(
              new Blob([masterPlaylist(src, available)], { type: "application/vnd.apple.mpegurl" })
            );
            manifest = master;
          }
        }
        // Any other answer (timeout, 5xx): play src alone and let the normal
        // error handling below decide.
      }

      // Tuned for unstable networks: stability over latency (classes, not
      // esports). SRS HLS is NOT low-latency HLS, so lowLatencyMode only adds
      // startup fragility.
      //
      // The MANIFEST retries stay LOW on purpose: before the first manifest our
      // own 4s poll (scheduleRetry) is the "wait for the stream" mechanism, and
      // a quick hand-off keeps "offline" detection fast. Once playing, a lost
      // playlist refresh or segment is almost always a network blip, so the
      // level/fragment retries are generous — retry rather than fail.
      hls = new Hls({
        lowLatencyMode: false,
        liveSyncDurationCount: 3, // ~3 segments (~12s at 4s) behind the live edge
        maxBufferLength: 30, // seconds buffered ahead to ride out dips
        backBufferLength: 30,
        // Start low and step up once bandwidth is measured. Only matters when
        // the playlist offers several qualities (ABR); harmless otherwise.
        abrEwmaDefaultEstimate: 500_000,
        capLevelToPlayerSize: true, // don't fetch 720p for a small player
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 1000,
      });

      // Per-attempt state: whether we ever loaded a manifest (⇒ stream is up)
      // and how many in-place recoveries we've tried before giving up.
      let gotManifest = false;
      let recoveries = 0;
      hlsRef.current = hls;

      hls.loadSource(manifest);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        gotManifest = true;
        recoveries = 0;
        if (data.levels.length > 1) {
          setQualities(
            data.levels
              .map((l, index) => ({ index, name: l.name || `${l.height}p`, bitrate: l.bitrate }))
              .sort((a, b) => b.bitrate - a.bitrate) // best first in the menu
              .map(({ index, name }) => ({ index, name }))
          );
        }
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => setPlaying(data.level));
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
          dropHls();
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
        dropHls();
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
      hlsRef.current = null;
      dropMaster();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, renditions]);

  // -1 = auto. currentLevel switches right away (flushes the buffer), which is
  // what a viewer picking a quality expects.
  const pick = (index: number) => {
    setChoice(index);
    if (hlsRef.current) hlsRef.current.currentLevel = index;
  };
  const playingName = qualities.find((q) => q.index === playing)?.name;
  const quality: SettingGroup | undefined =
    qualities.length > 0
      ? {
          id: "quality",
          label: t("player.quality"),
          value: String(choice),
          options: [
            { value: "-1", label: playingName ? t("player.autoWith", { name: playingName }) : t("player.auto") },
            ...qualities.map((q) => ({ value: String(q.index), label: q.name })),
          ],
          onPick: (v) => pick(Number(v)),
        }
      : undefined;
  // hls.js knows where "live" is; null on native HLS (then: end of the buffer).
  const liveEdge = useCallback(() => hlsRef.current?.liveSyncPosition ?? null, []);

  return (
    <div className="player">
      <video ref={videoRef} className="video" playsInline muted poster={poster} />
      <PlayerOverlay status={status} title={title} banner={banner} />
      <PlayerControls videoRef={videoRef} status={status} quality={quality} liveEdge={liveEdge} {...ui} />
    </div>
  );
}
