import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RTMP_URL, obsStreamKey } from "../config";
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
          {streamKey ? (
            <section className="card highlight">
              <h2>Set up OBS</h2>
              <p className="muted">
                In OBS → Settings → Stream, pick <strong>Custom…</strong> and paste
                these. The stream key is shown only once — save it now.
              </p>
              <CopyRow label="Server" value={RTMP_URL} />
              <CopyRow label="Stream key" value={obsStreamKey(channel.id, streamKey)} />
              <p className="muted small">
                The key travels inside the RTMP URL, so it never appears in the
                public playback link.
              </p>
            </section>
          ) : (
            <section className="card">
              <h2>Set up OBS</h2>
              <CopyRow label="Server" value={RTMP_URL} />
              <p className="muted small">
                Your stream key is shown only once, at channel creation. In OBS the
                “Stream Key” field must be{" "}
                <code>{`${channel.id}?key=<your-key>`}</code>.
              </p>
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
            {stream?.live && (
              <p>
                <Link className="navlink" to={`/watch/${channel.id}`}>
                  ▶ Watch your stream
                </Link>
              </p>
            )}
            <p className="muted small">
              Tip: start streaming in OBS first, then click “Start stream”. Your
              encoder connecting is what actually puts you live.
            </p>
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

// CopyRow shows a labelled, monospaced value with a one-click copy button.
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API needs a secure context; the user can still select manually.
    }
  }
  return (
    <div className="copy-field">
      <span className="copy-label">{label}</span>
      <div className="copy-row">
        <code className="streamkey">{value}</code>
        <button type="button" className="ghost small" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
