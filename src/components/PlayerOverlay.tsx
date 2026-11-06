import type { PlayerStatus } from "./HlsPlayer";
import { useI18n } from "../i18n";

interface Props {
  status: PlayerStatus;
  title?: string;
  // The channel's banner: the offline card's background when it has one.
  banner?: string | null;
}

// PlayerOverlay is the shared non-playing state shown over the video: a spinner
// while connecting, a polished "offline" card while waiting for a broadcast,
// and an error note. It renders nothing while playing. Kept stable (fixed,
// centered layout) so background reconnect attempts never cause a visible jump.
export default function PlayerOverlay({ status, title, banner }: Props) {
  const { t } = useI18n();
  if (status === "playing") return null;

  // Mid-playback buffering: the video element still shows the last decoded
  // frame, so DON'T cover it with the dark backdrop — just float a spinner
  // over it (the Twitch/YouTube pattern).
  if (status === "buffering") {
    return (
      <div className="player-overlay player-overlay--buffering">
        <span className="player-spinner" aria-hidden />
      </div>
    );
  }

  // Only the offline card shows the banner; connecting and errors keep the
  // plain backdrop. The dimming lives in CSS, layered over the picture.
  const withBanner = status === "offline" && Boolean(banner);
  return (
    <div
      className={`player-overlay${withBanner ? " player-overlay--banner" : ""}`}
      style={withBanner ? { ["--banner" as string]: `url("${cssUrl(banner!)}")` } : undefined}
    >
      {status === "loading" && (
        <div className="player-state">
          <span className="player-spinner" aria-hidden />
          <span className="muted">{t("player.connecting")}</span>
        </div>
      )}

      {status === "offline" && (
        <div className="player-state">
          <div className="offline-badge">
            <span className="offline-dot" />
            {t("player.offlineBadge")}
          </div>
          <div className="offline-title">{title || t("player.offlineTitle")}</div>
          <div className="muted small">{t("player.waiting")}</div>
        </div>
      )}

      {status === "error" && (
        <div className="player-state">
          <div className="offline-title">{t("player.cantPlay")}</div>
          <div className="muted small">{t("player.cantPlayHint")}</div>
        </div>
      )}
    </div>
  );
}

// cssUrl keeps a URL from closing the url("…") it is written into.
function cssUrl(url: string): string {
  return url.replace(/["\\\n]/g, (c) => encodeURIComponent(c));
}
