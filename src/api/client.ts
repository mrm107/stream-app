import type {
  AuthResponse,
  Channel,
  CreateChannelResponse,
  LiveStream,
  Stream,
} from "./types";

// All requests go through Vite's /api proxy to the Go backend (see
// vite.config.ts), so there is no CORS and no hardcoded host here.
const BASE = "/api";

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

// token is held in memory and mirrored to localStorage by the auth store.
let token: string | null = null;
export function setToken(t: string | null) {
  token = t;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
};
