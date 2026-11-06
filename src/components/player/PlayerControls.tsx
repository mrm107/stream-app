import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { useI18n } from "../../i18n";
import { useBackHandler } from "../../eitaa";
import type { PlayerStatus } from "../HlsPlayer";
import {
  ChatIcon,
  CheckIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  GearIcon,
  MutedIcon,
  PauseIcon,
  PlayIcon,
  VolumeIcon,
} from "./icons";

export interface SettingOption {
  value: string;
  label: string;
  hint?: string;
}

/** One section of the settings sheet: quality, server, playback mode. */
export interface SettingGroup {
  id: string;
  label: string;
  value: string;
  options: SettingOption[];
  onPick: (value: string) => void;
}

/** What the watch page adds to the player's own controls. */
export interface PlayerUi {
  settings?: SettingGroup[];
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Fullscreen only: the chat side panel. */
  chatOpen?: boolean;
  onToggleChat?: () => void;
}

interface Props extends PlayerUi {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: PlayerStatus;
  /** The engine's quality menu, first in the sheet. */
  quality?: SettingGroup;
  /** Where "live" is, in video time; null = unknown (then: end of the buffer). */
  liveEdge?: () => number | null;
}

const HIDE_AFTER_MS = 3000;
// Further behind the live edge than this shows "go live" instead of LIVE.
const BEHIND_S = 20;

// PlayerControls is the live player's own chrome, over the <video>: tap to
// show/hide (mouse click toggles play), play/pause, an unmute prompt (the
// stream starts muted for autoplay), LIVE / go-live, a settings sheet, the
// chat toggle in fullscreen, and fullscreen. No timeline: it is live.
export default function PlayerControls({
  videoRef,
  status,
  quality,
  liveEdge,
  settings = [],
  fullscreen = false,
  onToggleFullscreen,
  chatOpen,
  onToggleChat,
}: Props) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [behind, setBehind] = useState(false);
  const [shown, setShown] = useState(true);
  const [sheet, setSheet] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const active = status === "playing" || status === "buffering";

  // Follow the element, whatever changed it (native gestures, the engine).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      setPaused(v.paused);
      setMuted(v.muted || v.volume === 0);
    };
    const onTime = () => {
      const edge = liveEdge?.() ?? (v.seekable.length ? v.seekable.end(v.seekable.length - 1) : null);
      setBehind(edge != null && edge - v.currentTime > BEHIND_S);
    };
    sync();
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    v.addEventListener("volumechange", sync);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("play", sync);
      v.removeEventListener("pause", sync);
      v.removeEventListener("volumechange", sync);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [videoRef, liveEdge]);

  // Controls fade out while playing; they stay while paused or the sheet is open.
  const poke = useCallback(() => {
    setShown(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShown(false), HIDE_AFTER_MS);
  }, []);
  useEffect(() => {
    if (paused || sheet || !active) {
      clearTimeout(hideTimer.current);
      setShown(true);
    } else {
      poke();
    }
    return () => clearTimeout(hideTimer.current);
  }, [paused, sheet, active, poke]);

  const goLive = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const edge = liveEdge?.() ?? (v.seekable.length ? v.seekable.end(v.seekable.length - 1) - 3 : null);
    if (edge != null && Number.isFinite(edge)) v.currentTime = edge;
  }, [videoRef, liveEdge]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // Live: resuming after a long pause jumps back to now, as on Twitch.
      const edge = liveEdge?.() ?? (v.seekable.length ? v.seekable.end(v.seekable.length - 1) : null);
      if (edge != null && edge - v.currentTime > BEHIND_S * 2) goLive();
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [videoRef, liveEdge, goLive]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 1;
    if (!v.muted && v.paused) v.play().catch(() => {});
  }, [videoRef]);

  // A finger toggles the controls; a mouse click toggles play (desktop habit).
  const onSurface = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") {
      togglePlay();
      poke();
      return;
    }
    if (shown && active && !paused) {
      clearTimeout(hideTimer.current);
      setShown(false);
    } else {
      poke();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "m") {
      toggleMute();
    } else if (e.key === "f") {
      onToggleFullscreen?.();
    } else {
      return;
    }
    poke();
  };

  useBackHandler(sheet ? () => setSheet(false) : undefined);

  const groups = quality ? [quality, ...settings] : settings;
  const visible = shown || !active;

  return (
    <div
      className={`pc${visible ? " pc--shown" : ""}`}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerMove={(e) => e.pointerType === "mouse" && poke()}
    >
      {active && <div className="pc-surface" onPointerUp={onSurface} />}

      {active && muted && (
        <button type="button" className="pc-unmute" onClick={toggleMute}>
          <MutedIcon size={18} />
          {t("player.tapToUnmute")}
        </button>
      )}

      {active && paused && (
        <button type="button" className="pc-center" aria-label={t("player.play")} onClick={togglePlay}>
          <PlayIcon size={34} />
        </button>
      )}

      <div className="pc-bar" onPointerUp={poke}>
        {active && (
          <>
            <button
              type="button"
              className="pc-btn"
              aria-label={paused ? t("player.play") : t("player.pause")}
              title={paused ? t("player.play") : t("player.pause")}
              onClick={togglePlay}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button
              type="button"
              className="pc-btn"
              aria-label={muted ? t("player.unmute") : t("player.mute")}
              title={muted ? t("player.unmute") : t("player.mute")}
              onClick={toggleMute}
            >
              {muted ? <MutedIcon /> : <VolumeIcon />}
            </button>
            <button
              type="button"
              className={`pc-live${behind ? " pc-live--behind" : ""}`}
              onClick={behind ? goLive : undefined}
              disabled={!behind}
              title={behind ? t("player.goLive") : undefined}
            >
              <span className="pc-live-dot" aria-hidden />
              {behind ? t("player.goLive") : t("player.live")}
            </button>
          </>
        )}
        <span className="pc-spacer" />
        {fullscreen && onToggleChat && (
          <button
            type="button"
            className={`pc-btn${chatOpen ? " pc-btn--on" : ""}`}
            aria-label={chatOpen ? t("player.hideChat") : t("player.showChat")}
            aria-pressed={chatOpen}
            title={chatOpen ? t("player.hideChat") : t("player.showChat")}
            onClick={onToggleChat}
          >
            <ChatIcon />
          </button>
        )}
        {groups.length > 0 && (
          <button
            type="button"
            className="pc-btn"
            aria-label={t("player.settings")}
            aria-expanded={sheet}
            title={t("player.settings")}
            onClick={() => setSheet((s) => !s)}
          >
            <GearIcon />
          </button>
        )}
        {onToggleFullscreen && (
          <button
            type="button"
            className="pc-btn"
            aria-label={fullscreen ? t("player.exitFullscreen") : t("player.fullscreen")}
            title={fullscreen ? t("player.exitFullscreen") : t("player.fullscreen")}
            onClick={onToggleFullscreen}
          >
            {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        )}
      </div>

      {sheet && (
        <div className="pc-sheet-backdrop" onPointerUp={() => setSheet(false)}>
          <div className="pc-sheet" role="dialog" aria-label={t("player.settings")} onPointerUp={(e) => e.stopPropagation()}>
            {groups.map((g) => (
              <section key={g.id} className="pc-group">
                <h3 className="pc-group-title">{g.label}</h3>
                {g.options.map((o) => {
                  const on = o.value === g.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={`pc-option${on ? " pc-option--on" : ""}`}
                      aria-pressed={on}
                      onClick={() => {
                        g.onPick(o.value);
                        setSheet(false);
                      }}
                    >
                      <span className="pc-option-text">
                        {o.label}
                        {o.hint && <small>{o.hint}</small>}
                      </span>
                      {on && <CheckIcon size={18} />}
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
