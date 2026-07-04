import type { PlayerStatus } from "./HlsPlayer";

interface Props {
  status: PlayerStatus;
  title?: string;
}

// PlayerOverlay is the shared non-playing state shown over the video: a spinner
// while connecting, a polished "offline" card while waiting for a broadcast,
// and an error note. It renders nothing while playing. Kept stable (fixed,
// centered layout) so background reconnect attempts never cause a visible jump.
export default function PlayerOverlay({ status, title }: Props) {
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

  return (
    <div className="player-overlay">
      {status === "loading" && (
        <div className="player-state">
          <span className="player-spinner" aria-hidden />
          <span className="muted">Connecting…</span>
        </div>
      )}

      {status === "offline" && (
        <div className="player-state">
          <div className="offline-badge">
            <span className="offline-dot" />
            OFFLINE
          </div>
          <div className="offline-title">{title || "This channel"}</div>
          <div className="muted small">Waiting for the broadcast to start…</div>
        </div>
      )}

      {status === "error" && (
        <div className="player-state">
          <div className="offline-title">Can’t play this stream</div>
          <div className="muted small">Your browser may not support this format.</div>
        </div>
      )}
    </div>
  );
}
