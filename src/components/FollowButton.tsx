import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { errorText } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { loginPath } from "../auth/next";
import { useI18n } from "../i18n";
import { HeartIcon } from "./Icons";
import type { Channel, FollowState } from "../api/types";

export interface Follow {
  // False on your own channel: there is nothing to follow.
  available: boolean;
  following: boolean;
  followerCount: number;
  toggle: () => void;
  // The last failed change, cleared after a few seconds.
  error: string;
}

// useFollow is the viewer's follow state for a channel. Signed in, it asks the
// server once the channel is known; a change shows at once (the button and
// the count) and is undone if the server refuses it. Guests are sent to sign
// in, then back to this channel.
export function useFollow(channel: Channel | null): Follow {
  const { session } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [state, setState] = useState<FollowState | null>(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const id = channel?.id;
  const userId = session?.user.id;
  const own = userId !== undefined && channel !== null && userId === channel.user_id;

  useEffect(() => {
    setState(null);
    setError("");
    if (id === undefined || userId === undefined || own) return;
    let stale = false;
    api.channels
      .followState(id)
      .then((s) => !stale && setState(s))
      .catch(() => {}); // the button still works; the server knows the truth
    return () => {
      stale = true;
    };
  }, [id, userId, own]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const following = state?.following ?? false;
  const followerCount = state?.follower_count ?? channel?.follower_count ?? 0;

  const toggle = () => {
    if (id === undefined || own) return;
    if (!session) {
      navigate(loginPath(`/watch/${id}`));
      return;
    }
    // One change at a time; a tap meanwhile is ignored.
    if (inFlight.current) return;
    inFlight.current = true;
    const before: FollowState = { following, follower_count: followerCount };
    const want = !following;
    setError("");
    setState({ following: want, follower_count: Math.max(0, followerCount + (want ? 1 : -1)) });
    (want ? api.channels.follow(id) : api.channels.unfollow(id))
      .then(setState)
      .catch((err) => {
        setState(before);
        setError(errorText(err, t));
      })
      .finally(() => {
        inFlight.current = false;
      });
  };

  return { available: channel !== null && !own, following, followerCount, toggle, error };
}

// FollowButton is Follow / Following; pointing at (or pressing) Following
// offers Unfollow. Right after a click the label stays put until the pointer
// leaves, so following doesn't instantly read "Unfollow" under the cursor.
export default function FollowButton({ follow }: { follow: Follow }) {
  const { t } = useI18n();
  const [fresh, setFresh] = useState(false);
  if (!follow.available) return null;
  const on = follow.following;
  return (
    <button
      type="button"
      className={["btn btn--sm follow-btn", on ? "follow-btn--on" : "btn--primary", fresh && "follow-btn--fresh"]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={on}
      onClick={() => {
        setFresh(true);
        follow.toggle();
      }}
      onMouseLeave={() => setFresh(false)}
    >
      <HeartIcon size={16} filled={on} />
      {on ? (
        <>
          <span className="follow-label">{t("watch.following")}</span>
          <span className="follow-label-hover">{t("watch.unfollow")}</span>
        </>
      ) : (
        <span>{t("watch.follow")}</span>
      )}
    </button>
  );
}
