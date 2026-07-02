// Media-plane endpoints the frontend needs. Defaults match the local dev setup
// (SRS behind the Vite /hls proxy); override via .env for staging/prod.

// Base under which HLS playlists are served. Default is the same-origin Vite
// proxy (see vite.config.ts) so there is no CORS in dev. In prod set
// VITE_HLS_BASE to your CDN, e.g. https://cdn.example.com/live
export const HLS_BASE = import.meta.env.VITE_HLS_BASE ?? "/hls";

// RTMP ingest endpoint shown to broadcasters for OBS. This is the "Server"
// field; the "Stream Key" field is composed separately (see obsStreamKey).
export const RTMP_URL = import.meta.env.VITE_RTMP_URL ?? "rtmp://localhost/live";

// hlsUrl builds the playlist URL for a channel. The stream is published under
// the channel id (never the secret key), so playback is keyed by id.
export function hlsUrl(channelId: number | string): string {
  return `${HLS_BASE}/${channelId}.m3u8`;
}

// obsStreamKey composes what the broadcaster pastes into OBS's "Stream Key"
// field: the channel id plus the secret key as a query param. Keeping the key
// in the query string is what stops it leaking into the public HLS path.
export function obsStreamKey(channelId: number | string, streamKey: string): string {
  return `${channelId}?key=${streamKey}`;
}
