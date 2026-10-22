// Display helpers shared by the browse grid, the sidebar, the watch page and
// chat. Pure functions, no React.

// formatCount shortens a number the way Twitch does: 950, 1.2K, 12K, 1.3M.
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return trim(n / 1000) + "K";
  return trim(n / 1_000_000) + "M";
}

// One decimal under 10 (1.2K), none above (12K), never a trailing ".0".
function trim(v: number): string {
  return v < 10 ? String(Math.floor(v * 10) / 10) : String(Math.floor(v));
}

// viewersLabel is "1 viewer" / "1.2K viewers".
export function viewersLabel(n: number): string {
  return `${formatCount(n)} ${n === 1 ? "viewer" : "viewers"}`;
}

// uptime is how long a stream has been live, as h:mm:ss.
export function uptime(startedAt: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Twitch's default chat name colors: a viewer without a chosen color gets one
// of these, picked stably from their name so it never changes between lines.
const NAME_COLORS = [
  "#FF0000", "#0000FF", "#008000", "#B22222", "#FF7F50",
  "#9ACD32", "#FF4500", "#2E8B57", "#DAA520", "#D2691E",
  "#5F9EA0", "#1E90FF", "#FF69B4", "#8A2BE2", "#00FF7F",
];

// Pure blue/red/green read badly on the dark chat background, so the
// rendered palette brightens them; the order stays Twitch's.
const READABLE: Record<string, string> = {
  "#FF0000": "#FF4A4A",
  "#0000FF": "#6B7BFF",
  "#008000": "#2FB344",
};

export function nameColor(name: string): string {
  const c = NAME_COLORS[hash(name) % NAME_COLORS.length];
  return READABLE[c] ?? c;
}

// avatarHue gives every channel a stable hue for its placeholder avatar and
// thumbnail, since accounts have no picture yet.
export function avatarHue(name: string): number {
  return hash(name) % 360;
}

export function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
