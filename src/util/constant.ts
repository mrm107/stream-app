

export const API_URL = import.meta.env.VITE_API_URL ?? '';

export const HLS_URL = import.meta.env.VITE_HLS_URL ?? '';

export const RTMP_URL = import.meta.env.VITE_RTMP_URL ?? '';

// hlsUrl builds the playlist URL for a channel. The stream is published under
// the channel id (never the secret key), so playback is keyed by id.
export function hlsUrl(channelId: number | string): string {
  return `${HLS_URL}/${channelId}.m3u8`;
}

// A lower-quality copy of the live stream, made on the server by SRS's
// transcode and published under the "abr" app as <channelID>_<name>.
export interface Rendition {
  name: string; // shown in the quality menu
  url: string;
  bandwidth: number; // bits/s, for the master playlist's BANDWIDTH
  width: number;
  height: number;
}

// HLS_ABR_URL is where those copies live. Defaults to the sibling of HLS_URL
// (".../live" -> ".../abr"); set VITE_HLS_ABR_URL to override.
export const HLS_ABR_URL =
  import.meta.env.VITE_HLS_ABR_URL ?? HLS_URL.replace(/\/live\/?$/, "/abr");

// Must match the transcode engines in srs.conf. The player only offers the
// ones whose playlist actually exists, so removing an engine there is safe.
const ABR_LADDER = [
  { name: "480p", suffix: "480", bandwidth: 900_000, width: 854, height: 480 },
  { name: "360p", suffix: "360", bandwidth: 470_000, width: 640, height: 360 },
];

// hlsRenditions lists a channel's lower-quality copies (none if ABR is not
// configured, i.e. HLS_URL doesn't end in /live and no override is set).
export function hlsRenditions(channelId: number | string): Rendition[] {
  if (!HLS_ABR_URL || HLS_ABR_URL === HLS_URL) return [];
  return ABR_LADDER.map(({ suffix, ...r }) => ({
    ...r,
    url: `${HLS_ABR_URL}/${channelId}_${suffix}.m3u8`,
  }));
}

// flvUrl builds the HTTP-FLV URL for a channel. FLV is served from the same
// SRS base as HLS and has much lower latency (~1-2s vs ~5-15s), but needs
// mpegts.js to play in the browser (see FlvPlayer).
export function flvUrl(channelId: number | string): string {
  return `${HLS_URL}/${channelId}.flv`;
}

// chatWsUrl builds the WebSocket URL for a channel's live chat. The read path is
// a WS on the API host (GET /ws/chat/<id>); the token rides in the query string
// because browsers can't set headers on a WS handshake (anonymous = read-only,
// so token is optional). http(s):// is rewritten to ws(s)://.
export function chatWsUrl(channelId: number | string, token?: string): string {
  const base = API_URL || window.location.origin;
  const wsBase = base.replace(/^http/, "ws"); // http->ws, https->wss
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${wsBase}/ws/chat/${channelId}${query}`;
}

// obsStreamKey composes what the broadcaster pastes into OBS's "Stream Key"
// field: the channel id plus the secret key as a query param. Keeping the key
// in the query string is what stops it leaking into the public HLS path.
export function obsStreamKey(channelId: number | string, streamKey: string): string {
  return `${channelId}?key=${streamKey}`;
}
