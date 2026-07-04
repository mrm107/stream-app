import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import HlsPlayer, { type PlayerStatus } from "../components/HlsPlayer";
import FlvPlayer from "../components/FlvPlayer";
import ChatBox from "../components/ChatBox";
import { flvUrl, hlsUrl } from "../util/constant";
import type { Channel } from "../api/types";

// Playback protocol the viewer can toggle between. HLS is more compatible and
// robust; FLV is lower-latency (~1-2s) where the SRS http_remux is enabled.
type Protocol = "hls" | "flv";

// Public watch page. Anyone can watch. Only the chat box requires a login —
// that is the core rule from the product spec.
export default function Watch() {
  const { channelId } = useParams();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  const [protocol, setProtocol] = useState<Protocol>("hls");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!channelId) return;
    api.channels
      .get(Number(channelId))
      .then(setChannel)
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : "network error")
      );
  }, [channelId]);

  // Buffering is still "live" — a brief stall must not flicker the LIVE pill.
  const isLive = playerStatus === "playing" || playerStatus === "buffering";

  return (
    <main className="watch">
      <section className="player-col">
        {channelId ? (
          protocol === "hls" ? (
            <HlsPlayer
              src={hlsUrl(channelId)}
              title={channel?.title}
              onStatus={setPlayerStatus}
            />
          ) : (
            <FlvPlayer
              src={flvUrl(channelId)}
              title={channel?.title}
              onStatus={setPlayerStatus}
            />
          )
        ) : (
          <div className="player">
            <div className="player-overlay">
              <span className="muted">No channel selected</span>
            </div>
          </div>
        )}

        {/* Protocol toggle: HLS (compatible, higher latency) vs FLV (low latency). */}
        {channelId && (
          <div className="player-controls">
            <span className="muted small">Playback:</span>
            <div className="protocol-toggle">
              <button
                className={`small${protocol === "hls" ? "" : " ghost"}`}
                onClick={() => setProtocol("hls")}
              >
                HLS
              </button>
              <button
                className={`small${protocol === "flv" ? "" : " ghost"}`}
                onClick={() => setProtocol("flv")}
              >
                FLV · low latency
              </button>
            </div>
          </div>
        )}
        <div className="watch-meta">
          <h1>
            {isLive && <span className="live-pill">LIVE</span>}
            {channel?.title || "Untitled stream"}
          </h1>
          {error && <p className="error">{error}</p>}
          {channel && (
            <p className="muted">{channel.follower_count} followers</p>
          )}
        </div>
      </section>

      <ChatBox channelId={channelId} />
    </main>
  );
}
