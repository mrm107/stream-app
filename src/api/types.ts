// Mirrors the Go DTOs exactly (internal/auth/dto.go, internal/channel/dto.go).
// Keep in sync with the backend wire contract.

export interface User {
  id: number;
  username: string;
  email?: string;
  display_name?: string;
  role: number; // 0 = user, 1 = admin
  // Absolute URL of the uploaded picture; null without one. Optional only
  // because sessions saved before pictures existed lack both fields.
  avatar_url?: string | null;
  bio?: string; // at most 300 characters
}

// PATCH /users/me: fields left out keep their value.
export interface ProfileUpdate {
  display_name?: string;
  bio?: string;
}

// Both durations are in seconds.
export interface OtpResponse {
  expires_in: number;
  retry_after: number;
}

// OTP verify, login, and refresh all return the same shape: a short-lived access
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
  avatar_url: string | null;
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
  // The owner's username: the channel's public handle.
  username: string;
  // The owner's profile, as shown on the channel.
  display_name: string | null;
  avatar_url: string | null;
  bio: string;
  // Wide (5:2) picture behind the player while the channel is offline.
  banner_url: string | null;
}

// GET / PUT / DELETE /channels/{id}/follow: the caller's follow state and the
// channel's follower count after the change.
export interface FollowState {
  following: boolean;
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
  closed?: boolean; // the channel owner closed the chat; only they may post
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
// Sent when the room's mode changes, e.g. the owner closes or reopens chat.
export interface ChatModeFrame {
  type: "mode";
  mode: RoomMode;
}
// Sent when the owner clears the chat: drop every message with seq ≤ up_to.
export interface ChatClearFrame {
  type: "clear";
  up_to: number;
}
export type ChatFrame =
  | ChatHelloFrame
  | ChatBatchFrame
  | ChatPresenceFrame
  | ChatModeFrame
  | ChatClearFrame;

// POST /channels/{id}/chat/messages → 202 with the assigned seq/id/ts so the
// client can reconcile its optimistic local echo.
export interface ChatSendResponse {
  seq: number;
  id: string;
  ts: number;
}
