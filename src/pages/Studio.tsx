import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Channel, Stream } from "../api/types";

// Creator studio (auth-gated). Two states:
//   - no channel yet  -> show "Create your channel" (lazy channel creation)
//   - has a channel   -> show go-live controls
export default function Studio() {
  const { session } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // On mount, ask whether the caller already has a channel.
  useEffect(() => {
    api.channels
      .getMine()
      .then(setChannel)
      .catch((err) => {
        // "no_channel" is expected for viewers — not an error to show.
        if (!(err instanceof ApiRequestError && err.code === "no_channel")) {
          setError(msg(err));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function createChannel() {
    setError("");
    setBusy(true);
    try {
      const res = await api.channels.createMine();
      setChannel(res.channel);
      setStreamKey(res.stream_key); // show once
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  async function go(live: boolean) {
    if (!channel) return;
    setError("");
    setBusy(true);
    try {
      const s = live
        ? await api.channels.startStream(channel.id, { title })
        : await api.channels.stopStream(channel.id);
      setStream(s);
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="page"><p className="muted">Loading…</p></main>;

  return (
    <main className="page narrow">
      <h1>Creator studio</h1>
      <p className="muted">Signed in as {session?.user.username}</p>

      {!channel ? (
        <section className="card">
          <h2>Start broadcasting</h2>
          <p className="muted">
            You don't have a channel yet. Create one to get a stream key and go live.
          </p>
          <button disabled={busy} onClick={createChannel}>
            {busy ? "Creating…" : "Create my channel"}
          </button>
        </section>
      ) : (
        <>
          {streamKey && (
            <section className="card highlight">
              <h2>Your stream key</h2>
              <p className="muted">Shown only once — save it in OBS now.</p>
              <code className="streamkey">{streamKey}</code>
            </section>
          )}

          <section className="card">
            <h2>Go live</h2>
            <label>Stream title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you playing?" />
            </label>
            <div className="row">
              <button disabled={busy || !title} onClick={() => go(true)}>Start stream</button>
              <button className="ghost" disabled={busy} onClick={() => go(false)}>Stop stream</button>
            </div>
            {stream && (
              <p className={stream.live ? "live" : "muted"}>
                {stream.live ? `🔴 LIVE — "${stream.title}"` : `⏹ Ended stream #${stream.id}`}
              </p>
            )}
          </section>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}

function msg(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : "network error";
}
