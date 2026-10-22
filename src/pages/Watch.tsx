import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import HlsPlayer, { type PlayerStatus } from "../components/HlsPlayer";
import FlvPlayer from "../components/FlvPlayer";
import ChatBox from "../components/ChatBox";
import Avatar from "../components/Avatar";
import { PersonIcon } from "../components/Icons";
import { useLiveStreams } from "../live/LiveStreamsContext";
import { flvUrl, hlsUrl } from "../util/constant";
import { formatCount, uptime } from "../util/format";
import type { Channel } from "../api/types";

// Playback protocol the viewer can toggle between. HLS is more compatible and
// robust; FLV is lower-latency (~1-2s) where the SRS http_remux is enabled.
type Protocol = "hls" | "flv";

// Public watch page, laid out like Twitch's: the player, the channel bar under
// it, and chat on the right. Anyone can watch; only chatting needs a login.
export default function Watch() {
  const { channelId } = useParams();
  const id = Number(channelId);
  const { byChannel } = useLiveStreams();
  const live = byChannel(id); // the live session, when the channel is on air

  const [channel, setChannel] = useState<Channel | null>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  const [protocol, setProtocol] = useState<Protocol>("hls");
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!channelId) return;
    setChannel(null);
    setError("");
    api.channels
      .get(id)
      .then(setChannel)
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : "network error")
      );
  }, [channelId, id]);

  // Buffering is still "live" — a brief stall must not flicker the LIVE badge.
  const isLive = playerStatus === "playing" || playerStatus === "buffering";
  const name = live?.display_name ?? `Channel ${channelId}`;
  const title = live?.title || channel?.title || "Untitled stream";
  // Chat's presence count is the freshest; the list's is up to 30s old.
  const watching = viewers || live?.viewers || 0;

  return (
    <main className="watch">
      <section className="watch-main">
        <div className="player-frame">
          {channelId &&
            (protocol === "hls" ? (
              <HlsPlayer src={hlsUrl(channelId)} title={title} onStatus={setPlayerStatus} />
            ) : (
              <FlvPlayer src={flvUrl(channelId)} title={title} onStatus={setPlayerStatus} />
            ))}
        </div>

        <div className="channel-bar">
          <Avatar name={name} size={64} live={isLive} />
          <div className="channel-info">
            <h1 className="channel-name">{name}</h1>
            <p className="channel-title" title={title}>{title}</p>
            {channel && (
              <p className="channel-sub">{formatCount(channel.follower_count)} followers</p>
            )}
            {error && <p className="error">{error}</p>}
          </div>

          <div className="channel-stats">
            {isLive ? (
              <div className="stats-row">
                <span className="stat-viewers" title="Viewers">
                  <PersonIcon size={18} />
                  {formatCount(watching)}
                </span>
                {live && <Uptime startedAt={live.started_at} />}
              </div>
            ) : (
              <span className="badge-offline">OFFLINE</span>
            )}
            {/* Low latency = HTTP-FLV (~1-2s); off = HLS (compatible, ~5-15s). */}
            <label className="switch" title="Lower delay; needs HTTP-FLV on the server">
              <input
                type="checkbox"
                checked={protocol === "flv"}
                onChange={(e) => setProtocol(e.target.checked ? "flv" : "hls")}
              />
              <span className="switch-track" aria-hidden />
              Low latency
            </label>
          </div>
        </div>
      </section>

      <ChatBox channelId={channelId} onViewers={setViewers} />
    </main>
  );
}

// Uptime ticks once a second, so only this small node re-renders.
function Uptime({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="stat-uptime" title="Stream uptime">
      {uptime(startedAt, now)}
    </span>
  );
}
