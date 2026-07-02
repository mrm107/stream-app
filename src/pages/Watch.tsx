import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Channel } from "../api/types";

// Public watch page. Anyone can watch. Only the chat box requires a login —
// that is the core rule from the product spec.
export default function Watch() {
  const { channelId } = useParams();
  const { session } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
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

  return (
    <main className="watch">
      <section className="player-col">
        <div className="player">
          {/* Real HLS player goes here once the media plane is wired. */}
          <span className="muted">▶ video stream (HLS player placeholder)</span>
        </div>
        <div className="watch-meta">
          <h1>{channel?.title || "Untitled stream"}</h1>
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
