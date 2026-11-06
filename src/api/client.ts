import type {
  AuthResponse,
  ChatBatchFrame,
  ChatSendResponse,
  Channel,
  CreateChannelResponse,
  CurrentStream,
  FollowState,
  LiveStream,
  MirrorsResponse,
  OtpResponse,
  ProfileUpdate,
  RoomMode,
  StreamKeyResponse,
  User,
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
  "/auth/eitaa",
  "/auth/otp/request",
  "/auth/otp/verify",
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

// errorFrom turns a failed response body into an ApiRequestError.
function errorFrom(status: number, statusText: string, text: string): ApiRequestError {
  let data: { error?: string; message?: string } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // not JSON (e.g. a proxy's error page)
  }
  return new ApiRequestError(status, data?.error ?? "error", data?.message ?? statusText);
}

/** Upload progress, 0..1. */
export type OnProgress = (fraction: number) => void;

// upload sends a file as the raw request body (not multipart), with its own
// type as Content-Type. It uses XMLHttpRequest because fetch cannot report
// upload progress; auth and the refresh-on-401 replay match request().
function upload<T>(
  method: string,
  path: string,
  file: Blob,
  onProgress?: OnProgress,
  isRetry = false
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, BASE + path);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
    }
    xhr.onerror = () => reject(new TypeError("network error"));
    xhr.onload = () => {
      if (xhr.status === 401 && !isRetry && refreshToken) {
        void refreshAccessToken().then((ok) => {
          if (ok) {
            onProgress?.(0);
            upload<T>(method, path, file, onProgress, true).then(resolve, reject);
          } else {
            reject(errorFrom(xhr.status, xhr.statusText, xhr.responseText));
          }
        });
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(errorFrom(xhr.status, xhr.statusText, xhr.responseText));
        return;
      }
      try {
        resolve((xhr.responseText ? JSON.parse(xhr.responseText) : null) as T);
      } catch (err) {
        reject(err);
      }
    };
    xhr.send(file);
  });
}

// --- typed endpoint wrappers, grouped by backend feature ---

export const api = {
  auth: {
    // Text a sign-in code to a mobile number.
    requestOtp: (phone: string) =>
      request<OtpResponse>("POST", "/auth/otp/request", { phone }),

    // Sign in with the code; the first time for a number creates the account.
    verifyOtp: (input: { phone: string; code: string; display_name?: string }) =>
      request<AuthResponse>("POST", "/auth/otp/verify", input),

    // Sign in from the Eitaa mini-app with the initData Eitaa opened it with;
    // the first time for an Eitaa user creates the account.
    eitaa: (init_data: string) =>
      request<AuthResponse>("POST", "/auth/eitaa", { init_data }),

    // For accounts made before phone sign-in.
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

  users: {
    // Auth — my own account, fresh from the server.
    me: () => request<User>("GET", "/users/me"),

    // Auth — change my display name and/or bio (≤ 300 characters).
    updateMe: (change: ProfileUpdate) => request<User>("PATCH", "/users/me", change),

    // Auth — replace my picture; the body is the image itself. Returns me
    // with the new avatar_url.
    uploadAvatar: (file: Blob, onProgress?: OnProgress) =>
      upload<User>("PUT", "/users/me/avatar", file, onProgress),

    // Auth — remove my picture (back to the initial).
    deleteAvatar: () => request<User>("DELETE", "/users/me/avatar"),
  },

  streams: {
    // Public — the browse page.
    listLive: () => request<LiveStream[]>("GET", "/streams"),
  },

  channels: {
    get: (id: number) => request<Channel>("GET", `/channels/${id}`),

    // Public — other places the channel plays right now (e.g. Eitaa).
    mirrors: (id: number) =>
      request<MirrorsResponse>("GET", `/channels/${id}/mirrors`),

    // Auth — the caller's own channel (404 if not created yet).
    getMine: () => request<Channel>("GET", "/channels/me"),

    // Auth — create my channel; returns it with its stream key.
    createMine: () => request<CreateChannelResponse>("POST", "/channels"),

    // Auth — my current stream key. 409 "key_unavailable" for channels made
    // before keys were stored encrypted: rotating is the only way to get one.
    getStreamKey: () =>
      request<StreamKeyResponse>("GET", "/channels/me/stream-key"),

    // Auth — replace my stream key; the old one stops working immediately.
    rotateStreamKey: () =>
      request<StreamKeyResponse>("POST", "/channels/me/stream-key/rotate"),

    // Auth — save the title/category my next (or current) stream uses. Both
    // fields are replaced: send the current category_id to keep it.
    updateStreamInfo: (input: { title: string; category_id: number | null }) =>
      request<Channel>("PUT", "/channels/me/stream-info", input),

    // Auth — am I live right now? Going live happens in OBS, not here.
    currentStream: () => request<CurrentStream>("GET", "/channels/me/stream"),

    // Auth — my channel's banner; the body is the image itself.
    uploadBanner: (file: Blob, onProgress?: OnProgress) =>
      upload<Channel>("PUT", "/channels/me/banner", file, onProgress),
    deleteBanner: () => request<Channel>("DELETE", "/channels/me/banner"),

    // Auth — do I follow the channel, and its follower count.
    followState: (id: number) => request<FollowState>("GET", `/channels/${id}/follow`),
    follow: (id: number) => request<FollowState>("PUT", `/channels/${id}/follow`),
    unfollow: (id: number) => request<FollowState>("DELETE", `/channels/${id}/follow`),
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

    // Owner only — change the chat's mode. Fields left out keep their value;
    // the reply is the whole new mode, and viewers get a "mode" frame.
    setMode: (
      channelId: number | string,
      change: { closed?: boolean; slow_seconds?: number }
    ) => request<RoomMode>("PUT", `/channels/${channelId}/chat/mode`, change),

    // Owner only — remove every message in the chat, for everyone. Viewers
    // (the owner included) learn of it from a "clear" frame.
    clear: (channelId: number | string) =>
      request<{ up_to: number }>("DELETE", `/channels/${channelId}/chat/messages`),

    // Public scrollback — used to seed / re-anchor history.
    recent: (channelId: number | string) =>
      request<ChatBatchFrame>("GET", `/channels/${channelId}/chat/recent`),
  },
};
