import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import type { Lang } from "../i18n";
import { rich } from "../i18n/rich";
import { RTMP_URL, obsStreamKey } from "../util/constant";
import ProfilePanel from "../components/ProfilePanel";
import type { Channel, CurrentStream } from "../api/types";

// How often the dashboard asks whether OBS has us live.
const STATUS_POLL_MS = 10_000;

// Creator studio (auth-gated). Two states:
//   - no channel yet  -> show "Create your channel" (lazy channel creation)
//   - has a channel   -> show the OBS setup (with the stream key), the stream
//     info, and the live status
// Either way the profile panel (picture, name, bio; the banner once there is
// a channel) comes after.
//
// There is no "Go live" button, as on Twitch: starting to stream in OBS puts
// the channel live, stopping ends it. The title is set ahead of time and
// snapshotted by each new session.
export default function Studio() {
  const { session } = useAuth();
  const { t, lang } = useI18n();
  // API errors come with the server's message; only the fallback is ours.
  const msg = (err: unknown) => (err instanceof ApiRequestError ? err.message : t("common.networkError"));
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  // null = not loaded yet; "unavailable" = the channel predates encrypted key
  // storage, so the key can't be shown and must be rotated.
  const [streamKey, setStreamKey] = useState<string | "unavailable" | null>(null);
  const [status, setStatus] = useState<CurrentStream | null>(null);
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // On mount, ask whether the caller already has a channel, and if so fetch
  // its stream key for the OBS setup card.
  useEffect(() => {
    api.channels
      .getMine()
      .then(async (ch) => {
        setChannel(ch);
        setTitle(ch.title);
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

  // Live status follows the encoder, so poll it while the page is open.
  const hasChannel = channel !== null;
  useEffect(() => {
    if (!hasChannel) return;
    let cancelled = false;
    const poll = () =>
      api.channels
        .currentStream()
        .then((s) => !cancelled && setStatus(s))
        .catch(() => {}); // a missed poll just keeps the last status
    poll();
    const id = setInterval(poll, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hasChannel]);

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
      !confirm(t("studio.confirmReset"))
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

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!channel) return;
    setError("");
    setBusy(true);
    try {
      const ch = await api.channels.updateStreamInfo({
        title,
        category_id: channel.category_id ?? null, // keep the category as is
      });
      setChannel(ch);
      setTitle(ch.title);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      // A live session is retitled too; show it without waiting for a poll.
      if (status?.live) setStatus({ ...status, title: ch.title || status.title });
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="page"><p className="muted">{t("studio.loading")}</p></main>;

  return (
    <main className="page dashboard">
      <header className="dash-head">
        <h1 className="page-title">{t("studio.title")}</h1>
        <p className="muted">
          {rich(t, "studio.signedInAs", {
            name: <bdi>{session?.user.display_name || session?.user.username}</bdi>,
          })}
        </p>
      </header>

      {!channel ? (
        <>
          <section className="panel panel--hero">
            <h2 className="panel-title">{t("studio.startTitle")}</h2>
            <p className="muted">{t("studio.noChannel")}</p>
            <button className="btn btn--primary" disabled={busy} onClick={createChannel}>
              {busy ? t("studio.creating") : t("studio.create")}
            </button>
          </section>
          <div className="dash-grid dash-grid--after">
            <ProfilePanel channel={null} onChannel={setChannel} />
          </div>
        </>
      ) : (
        <div className="dash-grid">
          <section className="panel">
            <h2 className="panel-title">{t("studio.status")}</h2>
            {status?.live ? (
              <>
                <p className="dash-status">
                  <span className="badge-live">{t("common.live")}</span> <bdi>{status.title}</bdi>
                </p>
                <p className="muted small">
                  {t("studio.watchingSince", {
                    n: status.viewers,
                    time: status.started_at ? clockTime(status.started_at, lang) : "",
                  })}
                </p>
                <Link className="link" to={`/watch/${channel.id}`}>
                  {t("studio.watchYours")}
                </Link>
              </>
            ) : (
              <p className="dash-status muted">{t("studio.offline")}</p>
            )}

            <form onSubmit={saveInfo}>
              <label className="field">
                <span>{t("studio.streamTitle")}</span>
                <input
                  dir="auto"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("studio.titlePlaceholder")}
                  maxLength={140}
                />
              </label>
              <div className="row">
                <button type="submit" className="btn btn--primary" disabled={busy || title === channel.title}>
                  {saved ? t("studio.saved") : t("studio.save")}
                </button>
              </div>
            </form>
            <p className="muted small">{t("studio.titleHint")}</p>
          </section>

          <section className="panel" id="obs">
            <h2 className="panel-title">{t("studio.setup")}</h2>
            <p className="muted">
              {rich(t, "studio.setupHelp", {
                // OBS's own menu names, in English whatever the page language.
                path: <bdi dir="ltr">OBS → Settings → Stream</bdi>,
                custom: <strong dir="ltr">Custom…</strong>,
              })}
            </p>
            <CopyRow label={t("studio.server")} value={RTMP_URL} />
            {streamKey === "unavailable" ? (
              <p className="muted small">{t("studio.keyUnavailable")}</p>
            ) : streamKey ? (
              <CopyRow label={t("studio.streamKey")} value={obsStreamKey(channel.id, streamKey)} secret />
            ) : (
              <p className="muted small">{t("studio.loadingKey")}</p>
            )}
            <div className="row">
              <button type="button" className="btn btn--secondary btn--sm" disabled={busy || !streamKey} onClick={rotateKey}>
                {t(streamKey === "unavailable" ? "studio.generateKey" : "studio.resetKey")}
              </button>
            </div>
            <p className="muted small">{t("studio.keyPrivate")}</p>
          </section>

          <ProfilePanel channel={channel} onChannel={setChannel} />
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}

// clockTime is a time of day in the page language (Persian digits in fa).
function clockTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(lang === "fa" ? "fa-IR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// CopyRow shows a labelled, monospaced value with a one-click copy button. A
// secret value is masked until revealed, so it doesn't leak on a shared or
// recorded screen; copying always copies the real value.
function CopyRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const { t } = useI18n();
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
        <code className="copy-value" dir="ltr">{shown ? value : "•".repeat(24)}</code>
        {secret && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setShown((v) => !v)}>
            {t(shown ? "studio.hide" : "studio.show")}
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--sm" onClick={copy}>
          {t(copied ? "studio.copied" : "studio.copy")}
        </button>
      </div>
    </div>
  );
}
