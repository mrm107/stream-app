import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import { useI18n } from "../i18n";
import { rich } from "../i18n/rich";
import { useLiveStreams } from "../live/LiveStreamsContext";
import { avatarHue, initial, viewersLabel } from "../util/format";
import type { LiveStream } from "../api/types";

// Public landing page: the grid of live channels, filtered by the top-nav
// search (?q=). No auth required.
export default function Browse() {
  const { streams, error } = useLiveStreams();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim().toLowerCase();

  const shown = q
    ? streams?.filter((s) =>
        [s.title, s.display_name, s.username].some((v) => v.toLowerCase().includes(q))
      )
    : streams;

  return (
    <main className="page">
      <h1 className="page-title">
        {q
          ? rich(t, "browse.resultsFor", {
              q: <bdi className="accent">“{params.get("q")}”</bdi>,
            })
          : rich(t, "browse.heading", {
              accent: <span className="accent">{t("browse.headingAccent")}</span>,
            })}
      </h1>

      {error && <p className="error">{error}</p>}

      {shown === null || shown === undefined ? (
        !error && <SkeletonGrid />
      ) : shown.length === 0 ? (
        <div className="empty">
          <div className="empty-title">{t(q ? "browse.noMatch" : "browse.noneLive")}</div>
          <p className="muted">
            {q
              ? t("browse.tryAnother")
              : rich(t, "browse.beFirst", {
                  link: (
                    <Link to="/studio" className="link">
                      {t("browse.openStudio")}
                    </Link>
                  ),
                })}
          </p>
        </div>
      ) : (
        <div className="grid">
          {shown.map((s) => (
            <StreamCard key={s.stream_id} s={s} />
          ))}
        </div>
      )}
    </main>
  );
}

// StreamCard is Twitch's live card: a 16:9 thumbnail that lifts onto a purple
// offset on hover, then the avatar, title and channel name.
function StreamCard({ s }: { s: LiveStream }) {
  const { t } = useI18n();
  const hue = avatarHue(s.display_name);
  return (
    <article className="card-stream">
      <Link to={`/watch/${s.channel_id}`} className="thumb-wrap" aria-label={t("browse.watch", { name: s.display_name })}>
        <div
          className="thumb"
          style={{
            background: `radial-gradient(circle at 30% 20%, hsl(${hue} 60% 32%), hsl(${(hue + 40) % 360} 55% 12%))`,
          }}
        >
          <span className="thumb-initial">{initial(s.display_name)}</span>
          <span className="badge-live">{t("common.live")}</span>
          <span className="thumb-viewers">{viewersLabel(s.viewers)}</span>
        </div>
      </Link>
      <div className="card-meta">
        <Link to={`/watch/${s.channel_id}`} aria-hidden tabIndex={-1}>
          <Avatar name={s.display_name} src={s.avatar_url} size={40} />
        </Link>
        <div className="card-text">
          <Link to={`/watch/${s.channel_id}`} className="card-title" title={s.title}>
            {s.title}
          </Link>
          <Link to={`/watch/${s.channel_id}`} className="card-channel">
            {s.display_name}
          </Link>
        </div>
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid" aria-busy>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="card-stream">
          <div className="thumb skeleton" />
          <div className="card-meta">
            <span className="skeleton skeleton-avatar" />
            <div className="card-text">
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line short" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
