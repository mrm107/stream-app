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
import type { Channel, Mirror } from "../api/types";

// Playback protocol the viewer can toggle between. HLS is more compatible and
// robust; FLV is lower-latency (~1-2s) where the SRS http_remux is enabled.
type Protocol = "hls" | "flv";

// The server the viewer watches from: "origin" is our own media server, any
// other id is a mirror the API lists (e.g. "eitaa").
const ORIGIN = "origin";
const SOURCE_LABELS: Record<string, string> = { [ORIGIN]: "Main", eitaa: "Eitaa" };
const SOURCE_KEY = "watch.source";

// Mirrors appear a few seconds after a broadcast starts, so poll quickly until
// one shows up, then just often enough to notice it going away.
const MIRROR_POLL_MS = 10_000;
const MIRROR_REFRESH_MS = 30_000;

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
  const [chosen, setChosen] = useState(readSource);
  const mirrors = useMirrors(id, Boolean(live));
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

  // A remembered mirror that isn't listed (not live there, or not yet) falls
  // back to our own server.
  const mirror = mirrors.find((m) => m.id === chosen);
  const sources = [ORIGIN, ...mirrors.map((m) => m.id)];
  const choose = (source: string) => {
    setChosen(source);
    try {
      localStorage.setItem(SOURCE_KEY, source);
    } catch {
      // storage unavailable: the choice just won't persist
    }
  };

  return (
    <main className="watch">
      <section className="watch-main">
        <div className="player-frame">
          {channelId &&
            (mirror ? (
              <HlsPlayer src={mirror.hls_url} title={title} onStatus={setPlayerStatus} />
            ) : protocol === "hls" ? (
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
            {sources.length > 1 && (
              <div className="source-switch" role="group" aria-label="Playback server">
                {sources.map((s) => {
                  const active = (mirror?.id ?? ORIGIN) === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={active ? "active" : undefined}
                      aria-pressed={active}
                      onClick={() => choose(s)}
                    >
                      {SOURCE_LABELS[s] ?? s}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Low latency = HTTP-FLV (~1-2s); off = HLS (compatible, ~5-15s).
                Only our own server serves FLV; mirrors are HLS only. */}
            {!mirror && (
              <label className="switch" title="Lower delay; needs HTTP-FLV on the server">
                <input
                  type="checkbox"
                  checked={protocol === "flv"}
                  onChange={(e) => setProtocol(e.target.checked ? "flv" : "hls")}
                />
                <span className="switch-track" aria-hidden />
                Low latency
              </label>
            )}
          </div>
        </div>
      </section>

      <ChatBox channelId={channelId} onViewers={setViewers} />
    </main>
  );
}

function readSource(): string {
  try {
    return localStorage.getItem(SOURCE_KEY) ?? ORIGIN;
  } catch {
    return ORIGIN;
  }
}

// useMirrors polls the channel's mirrors while it is live. A failed poll keeps
// the last list: a mirror is a nice-to-have, never a reason to show an error.
function useMirrors(channelId: number, live: boolean): Mirror[] {
  const [mirrors, setMirrors] = useState<Mirror[]>([]);
  useEffect(() => {
    setMirrors([]);
    if (!live || !channelId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (listed: boolean) => {
      timer = setTimeout(poll, listed ? MIRROR_REFRESH_MS : MIRROR_POLL_MS);
    };
    const poll = () => {
      api.channels
        .mirrors(channelId)
        .then((r) => {
          if (stopped) return;
          setMirrors(r.mirrors);
          schedule(r.mirrors.length > 0);
        })
        .catch(() => {
          if (!stopped) schedule(false);
        });
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [channelId, live]);
  return mirrors;
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
