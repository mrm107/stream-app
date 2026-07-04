import type {
  AuthResponse,
  ChatBatchFrame,
  ChatSendResponse,
  Channel,
  CreateChannelResponse,
  LiveStream,
  Stream,
} from "./types";

import { API_URL } from "../util/constant";

// All requests go through Vite's /api proxy to the Go backend (see
// vite.config.ts), so there is no CORS and no hardcoded host here. The base
// path is centralized in util/constant.ts and sourced from env.
const BASE = API_URL;

// ApiRequestError carries the backend's stable error code plus a human message.
export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

// Access + refresh tokens are held in memory and mirrored to localStorage by
// the auth store. The access token is sent on every request; the refresh token
// is used only to mint a new access token when the current one expires (401).
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(t: { token: string; refresh: string } | null) {
  accessToken = t?.token ?? null;
  refreshToken = t?.refresh ?? null;
}

// Callbacks let the auth store react to token rotation (persist the new pair)
// and to an unrecoverable session (refresh rejected → sign the user out).
let onTokensRotated: ((r: AuthResponse) => void) | null = null;
let onSessionExpired: (() => void) | null = null;
export function setAuthCallbacks(cbs: {
  onTokensRotated?: (r: AuthResponse) => void;
  onSessionExpired?: () => void;
}) {
  onTokensRotated = cbs.onTokensRotated ?? null;
  onSessionExpired = cbs.onSessionExpired ?? null;
}

// The auth endpoints must never trigger the refresh-on-401 interceptor: a 401
// from login is a real credential error, and refresh/logout manage tokens
// themselves. A 401 from any OTHER path means "access token expired → refresh".
const AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
]);

// Single-flight: many requests can 401 at once, but only one refresh should run.
// Concurrent callers await the same in-flight promise.
let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(BASE + "/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
          // 401/invalid → refresh token is dead; the session is over.
          setTokens(null);
          onSessionExpired?.();
          return false;
        }
        const data = (await res.json()) as AuthResponse;
        setTokens({ token: data.token, refresh: data.refresh_token });
        onTokensRotated?.(data);
        return true;
      } catch {
        // Network blip: don't destroy the session, just fail this attempt.
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Access token expired → transparently refresh once and replay the request.
  if (res.status === 401 && !isRetry && refreshToken && !AUTH_PATHS.has(path)) {
    if (await refreshAccessToken()) {
      return request<T>(method, path, body, true);
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const code = data?.error ?? "error";
    const message = data?.message ?? res.statusText;
    throw new ApiRequestError(res.status, code, message);
  }
  return data as T;
}

// --- typed endpoint wrappers, grouped by backend feature ---

export const api = {
  auth: {
    register: (input: {
      username: string;
      email: string;
      password: string;
      display_name?: string;
    }) => request<AuthResponse>("POST", "/auth/register", input),

    login: (input: { identifier: string; password: string }) =>
      request<AuthResponse>("POST", "/auth/login", input),

    // Exchange a refresh token for a fresh pair (also called automatically by
    // the 401 interceptor above).
    refresh: (refresh_token: string) =>
      request<AuthResponse>("POST", "/auth/refresh", { refresh_token }),

    // Revoke a refresh token server-side. Idempotent; safe to ignore failures.
    logout: (refresh_token: string) =>
      request<null>("POST", "/auth/logout", { refresh_token }),
  },

  streams: {
    // Public — the browse page.
    listLive: () => request<LiveStream[]>("GET", "/streams"),
  },

  channels: {
    get: (id: number) => request<Channel>("GET", `/channels/${id}`),

    // Auth — the caller's own channel (404 if not created yet).
    getMine: () => request<Channel>("GET", "/channels/me"),

    // Auth — create my channel; returns the one-time stream key.
    createMine: () => request<CreateChannelResponse>("POST", "/channels"),

    startStream: (id: number, input: { title: string; category_id?: number }) =>
      request<Stream>("POST", `/channels/${id}/stream/start`, input),

    stopStream: (id: number) =>
      request<Stream>("POST", `/channels/${id}/stream/stop`),
  },

  chat: {
    // Send a message (auth required). Returns the assigned seq/id/ts so the
    // client can reconcile its optimistic echo. Reading is the WebSocket path.
    send: (channelId: number | string, text: string) =>
      request<ChatSendResponse>(
        "POST",
        `/channels/${channelId}/chat/messages`,
        { text }
      ),

    // Public scrollback — used to seed / re-anchor history.
    recent: (channelId: number | string) =>
      request<ChatBatchFrame>("GET", `/channels/${channelId}/chat/recent`),
  },
};
