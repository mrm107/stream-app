import { useEffect, useRef } from "react";
import { useBackHandler } from "../eitaa";
import { useI18n } from "../i18n";
import { rich } from "../i18n/rich";
import { formatCount } from "../util/format";
import Avatar from "./Avatar";

interface Info {
  username: string;
  avatarUrl: string | null | undefined;
  bio: string;
  followerCount: number;
}

// Bio shows the channel owner's text as written: each line its own paragraph
// with its own direction (a Persian line and an English one side by side),
// blank lines kept.
export function Bio({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return (
    <div className="bio">
      {trimmed.split("\n").map((line, i) => (
        <p key={i} dir="auto">
          {line || " "}
        </p>
      ))}
    </div>
  );
}

function Followers({ n }: { n: number }) {
  const { t } = useI18n();
  return <p className="about-followers">{t("watch.followers", { n: formatCount(n), count: n })}</p>;
}

// ChannelAbout is the wide layout's "About {name}" under the channel bar.
export function ChannelAbout({ username, bio, followerCount }: Info) {
  const { t } = useI18n();
  return (
    <section className="channel-about">
      <h2 className="about-title">{rich(t, "watch.about", { name: <bdi dir="ltr">{username}</bdi> })}</h2>
      <Followers n={followerCount} />
      <Bio text={bio} />
    </section>
  );
}

// ChannelSheet is the phone layout's channel card, opened from the name or
// avatar in the one-row bar. Closes on a tap outside it (taps on the opener
// are left to the opener), Escape, and Eitaa's back button.
export function ChannelSheet({ username, avatarUrl, bio, followerCount, onClose }: Info & { onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useBackHandler(onClose);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (ref.current?.contains(target) || target.closest?.("[data-sheet-opener]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="channel-sheet" ref={ref} role="dialog" aria-label={t("watch.channelInfo")}>
      <div className="sheet-head">
        <Avatar name={username || " "} src={avatarUrl} size={52} />
        <div className="sheet-who">
          <strong className="sheet-name">
            <bdi dir="ltr">{username}</bdi>
          </strong>
          <Followers n={followerCount} />
        </div>
      </div>
      <Bio text={bio} />
    </div>
  );
}
