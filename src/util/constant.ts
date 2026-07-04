

export const API_URL = import.meta.env.VITE_API_URL ?? '';

export const HLS_URL = import.meta.env.VITE_HLS_URL ?? '';

export const RTMP_URL = import.meta.env.VITE_RTMP_URL ?? '';

// hlsUrl builds the playlist URL for a channel. The stream is published under
// the channel id (never the secret key), so playback is keyed by id.
export function hlsUrl(channelId: number | string): string {
  return `${HLS_URL}/${channelId}.m3u8`;
}

// flvUrl builds the HTTP-FLV URL for a channel. FLV is served from the same
// SRS base as HLS and has much lower latency (~1-2s vs ~5-15s), but needs
// mpegts.js to play in the browser (see FlvPlayer).
export function flvUrl(channelId: number | string): string {
  return `${HLS_URL}/${channelId}.flv`;
}

// obsStreamKey composes what the broadcaster pastes into OBS's "Stream Key"
// field: the channel id plus the secret key as a query param. Keeping the key
// in the query string is what stops it leaking into the public HLS path.
export function obsStreamKey(channelId: number | string, streamKey: string): string {
  return `${channelId}?key=${streamKey}`;
}
