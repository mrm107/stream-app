import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import HlsPlayer, { type PlayerStatus } from "../components/HlsPlayer";
import ChatBox from "../components/ChatBox";
import Avatar from "../components/Avatar";
import ShareButton from "../components/ShareButton";
import FollowButton, { useFollow } from "../components/FollowButton";
import { ChannelAbout, ChannelSheet } from "../components/ChannelAbout";
import { PersonIcon } from "../components/Icons";
import type { PlayerUi, SettingGroup } from "../components/player/PlayerControls";
import { useWatchFullscreen } from "../components/player/useFullscreen";
import { useLiveStreams } from "../live/LiveStreamsContext";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n";
import { hlsRenditions, hlsUrl } from "../util/constant";
import { formatCount, uptime } from "../util/format";
import { useMediaQuery } from "../util/useMediaQuery";
import type { Channel, Mirror } from "../api/types";

// The server the viewer watches from: "origin" is our own media server, any
// other id is a mirror the API lists (e.g. "eitaa").
const ORIGIN = "origin";
const SOURCE_LABELS: Record<string, MessageKey> = { [ORIGIN]: "player.sourceMain", eitaa: "player.sourceEitaa" };
const SOURCE_KEY = "watch.source";

// Mirrors appear a few seconds after a broadcast starts, so poll quickly until
// one shows up, then just often enough to notice it going away.
const MIRROR_POLL_MS = 10_000;
const MIRROR_REFRESH_MS = 30_000;

// Public watch page. Wide screens: the player and channel bar, chat beside
// them (Twitch's layout). Phones and the Eitaa mini-app: the player pinned on
// top, a one-row channel bar, and chat filling the rest of the screen with the
// composer at the bottom, above the keyboard. Fullscreen covers the screen
// with the video and an optional chat side panel; turning a phone sideways
// enters it. Anyone can watch; chatting and following need a login. Wide
// screens show the owner's bio under the bar; on phones tapping the channel
// name or avatar opens it in a small sheet.
export default function Watch() {
  const { t } = useI18n();
  const { channelId } = useParams();
  const id = Number(channelId);
  const { byChannel } = useLiveStreams();
  const live = byChannel(id); // the live session, when the channel is on air

  const [channel, setChannel] = useState<Channel | null>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  const [chosen, setChosen] = useState(readSource);
  const mirrors = useMirrors(id, Boolean(live));
  // Stable per channel: a new array would re-init the player.
  const renditions = useMemo(() => (channelId ? hlsRenditions(channelId) : []), [channelId]);
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState("");

  const stageRef = useRef<HTMLElement>(null);
  const { fullscreen, toggle: toggleFullscreen } = useWatchFullscreen(stageRef);
  const [fsChat, setFsChat] = useState(false);
  useWatchPageChrome();

  const follow = useFollow(channel);
  // The phone layout (see watch.css): the bar is one row, the bio a sheet.
  const narrow = useMediaQuery("(max-width: 999px)");
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const showSheet = sheetOpen && narrow && !fullscreen && channel !== null;
  useEffect(() => setSheetOpen(false), [id, fullscreen]);

  useEffect(() => {
    if (!channelId) return;
    setChannel(null);
    setError("");
    api.channels
      .get(id)
      .then(setChannel)
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : t("common.networkError")));
  }, [channelId, id, t]);

  // Buffering is still "live" — a brief stall must not flicker the LIVE badge.
  const isLive = playerStatus === "playing" || playerStatus === "buffering";
  // The channel's handle, and nothing else; empty until it has loaded.
  const name = live?.username || channel?.username || "";
  const title = live?.title || channel?.title || t("watch.untitled");
  // Chat's presence count is the freshest; the list's is up to 30s old.
  const watching = viewers || live?.viewers || 0;
  const avatarUrl = channel?.avatar_url ?? live?.avatar_url ?? null;
  const banner = channel?.banner_url ?? null;
  const about = channel && {
    username: name,
    avatarUrl,
    bio: channel.bio ?? "",
    followerCount: follow.followerCount,
  };

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

  // The player's settings sheet: the server, when mirrored. Quality comes
  // from the HLS player itself. (Low-latency FLV playback is off for now;
  // FlvPlayer is kept for when it comes back.)
  const settings: SettingGroup[] = [];
  if (sources.length > 1) {
    settings.push({
      id: "source",
      label: t("player.source"),
      value: mirror?.id ?? ORIGIN,
      options: sources.map((s) => ({ value: s, label: SOURCE_LABELS[s] ? t(SOURCE_LABELS[s]) : s })),
      onPick: choose,
    });
  }
  const ui: PlayerUi = {
    settings,
    fullscreen,
    onToggleFullscreen: toggleFullscreen,
    chatOpen: fsChat,
    onToggleChat: () => setFsChat((v) => !v),
  };

  const stageClass = ["watch", fullscreen && "watch--fs", fullscreen && !fsChat && "watch--fs-nochat"]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={stageClass} ref={stageRef}>
      <section className="watch-main">
        <div className="player-frame">
          {channelId &&
            (mirror ? (
              <HlsPlayer src={mirror.hls_url} title={title} banner={banner} onStatus={setPlayerStatus} ui={ui} />
            ) : (
              <HlsPlayer
                src={hlsUrl(channelId)}
                renditions={renditions}
                title={title}
                banner={banner}
                onStatus={setPlayerStatus}
                ui={ui}
              />
            ))}
        </div>

        <div className="channel-bar">
          {narrow && about ? (
            // On phones the avatar and name open the channel sheet.
            <button
              type="button"
              className="channel-opener"
              data-sheet-opener
              tabIndex={-1}
              aria-hidden
              onClick={() => setSheetOpen((v) => !v)}
            >
              <Avatar name={name || " "} src={avatarUrl} size={48} live={isLive} />
            </button>
          ) : (
            <Avatar name={name || " "} src={avatarUrl} size={48} live={isLive} />
          )}
          <div className="channel-info">
            <h1 className="channel-name">
              {narrow && about ? (
                <button
                  type="button"
                  className="channel-opener"
                  data-sheet-opener
                  aria-expanded={showSheet}
                  aria-label={t("watch.channelInfo")}
                  onClick={() => setSheetOpen((v) => !v)}
                >
                  <bdi dir="ltr">{name}</bdi>
                </button>
              ) : (
                <bdi dir="ltr">{name}</bdi>
              )}
            </h1>
            <p className="channel-title" title={title}>
              {/* The line follows the page; only the text keeps its own direction. */}
              <bdi>{title}</bdi>
            </p>
            {channel && (
              <p className="channel-sub">
                {t("watch.followers", { n: formatCount(follow.followerCount), count: follow.followerCount })}
              </p>
            )}
            {(error || follow.error) && <p className="error">{error || follow.error}</p>}
          </div>

          <div className="channel-stats">
            {isLive ? (
              <div className="stats-row">
                <span className="stat-viewers" title={t("watch.viewers")}>
                  <PersonIcon size={16} />
                  {formatCount(watching)}
                </span>
                {live && <Uptime startedAt={live.started_at} />}
              </div>
            ) : (
              <span className="badge-offline">{t("common.offline")}</span>
            )}
            <div className="channel-actions">
              <FollowButton follow={follow} />
              {id > 0 && <ShareButton channelId={id} title={title || name} compact />}
            </div>
          </div>

          {showSheet && about && <ChannelSheet {...about} onClose={closeSheet} />}
        </div>

        {about && !narrow && <ChannelAbout {...about} />}
      </section>

      <ChatBox channelId={channelId} onViewers={setViewers} ownerId={channel?.user_id} />
    </main>
  );
}

// While the watch page is up: html.watch-page lets the CSS drop our top nav
// inside Eitaa on phones (Eitaa has its own header and back button), and
// --vvh follows the visible height, so with the keyboard open the composer
// sits right above it instead of under it.
function useWatchPageChrome() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("watch-page");
    const vv = window.visualViewport;
    const sync = () => {
      if (!vv) return;
      root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
      // iOS scrolls the window to reveal a focused input; the app never scrolls.
      if (window.scrollY) window.scrollTo(0, 0);
    };
    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      root.classList.remove("watch-page");
      root.style.removeProperty("--vvh");
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, []);
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
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="stat-uptime" title={t("watch.uptime")}>
      {uptime(startedAt, now)}
    </span>
  );
}
