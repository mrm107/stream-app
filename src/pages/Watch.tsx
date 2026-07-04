import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import HlsPlayer, { type PlayerStatus } from "../components/HlsPlayer";
import FlvPlayer from "../components/FlvPlayer";
import { flvUrl, hlsUrl } from "../util/constant";
import type { Channel } from "../api/types";

// Playback protocol the viewer can toggle between. HLS is more compatible and
// robust; FLV is lower-latency (~1-2s) where the SRS http_remux is enabled.
type Protocol = "hls" | "flv";

// Public watch page. Anyone can watch. Only the chat box requires a login —
// that is the core rule from the product spec.
export default function Watch() {
  const { channelId } = useParams();
  const { session } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  const [protocol, setProtocol] = useState<Protocol>("hls");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!channelId) return;
    api.channels
      .get(Number(channelId))
      .then(setChannel)
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : "network error")
      );
  }, [channelId]);

  const isLive = playerStatus === "playing";

  return (
    <main className="watch">
      <section className="player-col">
        {channelId ? (
          protocol === "hls" ? (
            <HlsPlayer src={hlsUrl(channelId)} onStatus={setPlayerStatus} />
          ) : (
            <FlvPlayer src={flvUrl(channelId)} onStatus={setPlayerStatus} />
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

      <aside className="chat-col">
        <div className="chat-header">Stream chat</div>
        <div className="chat-messages">
          <p className="muted small">Chat messages will appear here.</p>
        </div>

        {/* Chat input is gated: only logged-in users can send. */}
        {session ? (
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              setDraft(""); // wiring to the chat service comes next
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Send a message"
            />
            <button className="small" disabled={!draft}>Chat</button>
          </form>
        ) : (
          <div className="chat-locked">
            <Link to="/login">Log in</Link> to chat
          </div>
        )}
      </aside>
    </main>
  );
}
