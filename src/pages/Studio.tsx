import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RTMP_URL, obsStreamKey } from "../util/constant";
import type { Channel, Stream } from "../api/types";

// Creator studio (auth-gated). Two states:
//   - no channel yet  -> show "Create your channel" (lazy channel creation)
//   - has a channel   -> show the OBS setup (with the stream key) and go-live
//     controls
export default function Studio() {
  const { session } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  // null = not loaded yet; "unavailable" = the channel predates encrypted key
  // storage, so the key can't be shown and must be rotated.
  const [streamKey, setStreamKey] = useState<string | "unavailable" | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // On mount, ask whether the caller already has a channel, and if so fetch
  // its stream key for the OBS setup card.
  useEffect(() => {
    api.channels
      .getMine()
      .then(async (ch) => {
        setChannel(ch);
        try {
          const res = await api.channels.getStreamKey();
          setStreamKey(res.stream_key);
        } catch (err) {
          if (err instanceof ApiRequestError && err.code === "key_unavailable") {
            setStreamKey("unavailable");
          } else {
            setError(msg(err));
          }
        }
      })
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
      setStreamKey(res.stream_key);
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  // Rotating cuts off any encoder using the old key, so it asks first.
  async function rotateKey() {
    if (
      streamKey !== "unavailable" &&
      !confirm("Generate a new stream key? OBS will stop working until you paste the new one.")
    ) {
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await api.channels.rotateStreamKey();
      setStreamKey(res.stream_key);
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
    <main className="page dashboard">
      <header className="dash-head">
        <h1 className="page-title">Creator Dashboard</h1>
        <p className="muted">Signed in as {session?.user.display_name || session?.user.username}</p>
      </header>

      {!channel ? (
        <section className="panel panel--hero">
          <h2 className="panel-title">Start broadcasting</h2>
          <p className="muted">
            You don't have a channel yet. Create one to get a stream key and go live.
          </p>
          <button className="btn btn--primary" disabled={busy} onClick={createChannel}>
            {busy ? "Creating…" : "Create my channel"}
          </button>
        </section>
      ) : (
        <div className="dash-grid">
          <section className="panel">
            <h2 className="panel-title">Go live</h2>
            <label className="field">
              <span>Stream title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you streaming today?" maxLength={140} />
            </label>
            <div className="row">
              <button className="btn btn--primary" disabled={busy || !title} onClick={() => go(true)}>Start stream</button>
              <button className="btn btn--secondary" disabled={busy} onClick={() => go(false)}>Stop stream</button>
            </div>
            {stream && (
              <p className="dash-status">
                {stream.live ? (
                  <>
                    <span className="badge-live">LIVE</span> {stream.title}
                  </>
                ) : (
                  <span className="muted">Stream #{stream.id} ended.</span>
                )}
              </p>
            )}
            {stream?.live && (
              <Link className="link" to={`/watch/${channel.id}`}>
                Watch your stream →
              </Link>
            )}
            <p className="muted small">
              Tip: start streaming in OBS first, then click “Start stream”. Your
              encoder connecting is what actually puts you live.
            </p>
          </section>

          <section className="panel" id="obs">
            <h2 className="panel-title">Stream setup</h2>
            <p className="muted">
              In OBS → Settings → Stream, pick <strong>Custom…</strong> and paste
              these.
            </p>
            <CopyRow label="Server" value={RTMP_URL} />
            {streamKey === "unavailable" ? (
              <p className="muted small">
                This channel's key was created before keys could be shown again.
                Generate a new one to see it here.
              </p>
            ) : streamKey ? (
              <CopyRow label="Stream key" value={obsStreamKey(channel.id, streamKey)} secret />
            ) : (
              <p className="muted small">Loading stream key…</p>
            )}
            <div className="row">
              <button type="button" className="btn btn--secondary btn--sm" disabled={busy || !streamKey} onClick={rotateKey}>
                {streamKey === "unavailable" ? "Generate stream key" : "Reset stream key"}
              </button>
            </div>
            <p className="muted small">
              Keep the key private: anyone with it can stream on your channel. It
              travels inside the RTMP URL, so it never appears in the public
              playback link. If it leaks, reset it.
            </p>
          </section>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}

function msg(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : "network error";
}

// CopyRow shows a labelled, monospaced value with a one-click copy button. A
// secret value is masked until revealed, so it doesn't leak on a shared or
// recorded screen; copying always copies the real value.
function CopyRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
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
        <code className="copy-value">{shown ? value : "•".repeat(24)}</code>
        {secret && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setShown((v) => !v)}>
            {shown ? "Hide" : "Show"}
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--sm" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
