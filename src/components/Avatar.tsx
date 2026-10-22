import { avatarHue, initial } from "../util/format";

interface Props {
  name: string;
  size?: number;
  // live draws Twitch's red ring around the picture.
  live?: boolean;
}

// Avatar is a placeholder picture: the name's initial on a stable color, since
// accounts have no uploaded picture yet.
export default function Avatar({ name, size = 30, live = false }: Props) {
  const hue = avatarHue(name);
  return (
    <span
      className={`avatar${live ? " avatar--live" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        background: `hsl(${hue} 55% 42%)`,
      }}
      aria-hidden
    >
      {initial(name)}
    </span>
  );
}
