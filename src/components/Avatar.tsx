import { useState } from "react";
import { avatarHue, initial } from "../util/format";

interface Props {
  name: string;
  // The uploaded picture (avatar_url); without one, or when it fails to load,
  // the name's initial shows instead.
  src?: string | null;
  size?: number;
  // live draws Twitch's red ring around the picture.
  live?: boolean;
}

// Avatar is the account's picture, or a placeholder: the name's initial on a
// stable color.
export default function Avatar({ name, src, size = 30, live = false }: Props) {
  const hue = avatarHue(name);
  // The URL that failed, so a new picture gets its own chance.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = Boolean(src) && failed !== src;
  return (
    <span
      className={`avatar${live ? " avatar--live" : ""}`}
      style={{
        // Size through a variable, so CSS can resize it (the letter follows).
        ["--avatar-size" as string]: `${size}px`,
        background: `hsl(${hue} 55% 42%)`,
      }}
      aria-hidden
    >
      {showImage ? (
        <img
          className="avatar-img"
          src={src!}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailed(src ?? null)}
        />
      ) : (
        initial(name)
      )}
    </span>
  );
}
