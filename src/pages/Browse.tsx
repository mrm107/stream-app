import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import type { LiveStream } from "../api/types";

// Public landing page: the grid of live streams. No auth required.
export default function Browse() {
  const [streams, setStreams] = useState<LiveStream[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.streams
      .listLive()
      .then(setStreams)
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : "network error")
      );
  }, []);

  return (
    <main className="page">
      <h1>Live channels</h1>

      {error && <p className="error">{error}</p>}
      {streams === null && !error && <p className="muted">Loading…</p>}
      {streams?.length === 0 && (
        <p className="muted">No one is live right now. Be the first — open the creator studio.</p>
      )}

      <div className="grid">
        {streams?.map((s) => (
          <Link key={s.stream_id} to={`/watch/${s.channel_id}`} className="stream-card">
            <div className="thumb">
              <span className="live-badge">LIVE</span>
              <span className="viewers">{s.viewers} viewers</span>
            </div>
            <div className="stream-meta">
              <strong className="title">{s.title}</strong>
              <span className="muted">{s.display_name}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
