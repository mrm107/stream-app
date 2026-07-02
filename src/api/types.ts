// Mirrors the Go DTOs exactly (internal/auth/dto.go, internal/channel/dto.go).
// Keep in sync with the backend wire contract.

export interface User {
  id: number;
  username: string;
  email?: string;
  display_name?: string;
  role: number; // 0 = user, 1 = admin
}

// Register and login now both just authenticate — no channel is created.
export interface AuthResponse {
  token: string;
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

// POST /channels response — the only time the stream key is exposed.
export interface CreateChannelResponse {
  channel: Channel;
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

export interface Stream {
  id: number;
  channel_id: number;
  title: string;
  started_at: string;
  ended_at?: string;
  live: boolean;
}

// The uniform error envelope every endpoint returns (httpx.Error).
export interface ApiError {
  error: string;
  message?: string;
}
