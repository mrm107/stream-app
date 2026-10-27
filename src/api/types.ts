// Mirrors the Go DTOs exactly (internal/auth/dto.go, internal/channel/dto.go).
// Keep in sync with the backend wire contract.

export interface User {
  id: number;
  username: string;
  email?: string;
  display_name?: string;
  role: number; // 0 = user, 1 = admin
}

// Register, login, and refresh all return the same shape: a short-lived access
// token, a long-lived refresh token, and the user. No channel is created.
export interface AuthResponse {
  token: string;
  refresh_token: string;
  user: User;
}

// One card on the public browse page (GET /streams).
export interface LiveStream {
  stream_id: number;
  channel_id: number;
  title: string;
  username: string;
  display_name: string;
  viewers: number;
  category_id?: number;
  started_at: string;
}

// POST /channels response — the new channel plus its stream key.
export interface CreateChannelResponse {
  channel: Channel;
  stream_key: string;
}

// GET /channels/me/stream-key and POST /channels/me/stream-key/rotate. Only
// ever returned to the channel's owner.
export interface StreamKeyResponse {
  stream_key: string;
}

export interface Channel {
  id: number;
  user_id: number;
  title: string;
  language: string;
  category_id?: number;
  is_partner: boolean;
  follower_count: number;
}

// One extra place to watch a channel besides our own media server
// (GET /channels/:id/mirrors, internal/restream). Listed only once it plays.
export interface Mirror {
  id: string; // "eitaa"
  hls_url: string;
}

export interface MirrorsResponse {
  mirrors: Mirror[];
}

// GET /channels/me/stream — the owner's live status. The session opens when
// OBS starts publishing and closes when it stops; offline is {live: false}.
export interface CurrentStream {
  live: boolean;
  stream_id?: number;
  title?: string;
  category_id?: number;
  started_at?: string;
  viewers: number;
}

// The uniform error envelope every endpoint returns (httpx.Error).
export interface ApiError {
  error: string;
  message?: string;
}

// --- live chat (internal/chat) ---

// Room moderation state (slow mode / followers-only / subs-only).
export interface RoomMode {
  slow_seconds?: number;
  followers_only?: boolean;
  subscribers_only?: boolean;
}

// Server-resolved sender identity on a chat message (never client-supplied).
export interface ChatSender {
  id: number;
  name: string;
  color?: string;
  badges?: string[];
}

// One chat line as it arrives over the WebSocket batch.
export interface ChatMessage {
  seq: number;
  user: ChatSender;
  text: string;
  ts: number; // unix millis
}

// Downstream WS frames (tagged by `type`).
export interface ChatHelloFrame {
  type: "hello";
  version: number;
  room: number;
  mode: RoomMode;
  recent: ChatMessage[];
  count: number;
  you?: ChatSender | null;
}
export interface ChatBatchFrame {
  type: "batch";
  messages: ChatMessage[];
}
export interface ChatPresenceFrame {
  type: "presence";
  count: number;
}
export type ChatFrame = ChatHelloFrame | ChatBatchFrame | ChatPresenceFrame;

// POST /channels/{id}/chat/messages → 202 with the assigned seq/id/ts so the
// client can reconcile its optimistic local echo.
export interface ChatSendResponse {
  seq: number;
  id: string;
  ts: number;
}
