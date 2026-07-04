import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { chatWsUrl } from "../util/constant";
import type {
  ChatFrame,
  ChatMessage,
  ChatSender,
  RoomMode,
} from "../api/types";

export type ChatStatus = "connecting" | "open" | "closed";

// UiMessage is a wire ChatMessage plus the local bookkeeping the UI needs:
// a stable client id, whether it is ours, and its optimistic-echo lifecycle
// (pending until the server acks / echoes it; failed if the send errored).
export interface UiMessage {
  clientId: string;
  seq: number | null; // null while an optimistic echo is unacked
  user: ChatSender;
  text: string;
  ts: number;
  mine: boolean;
  pending: boolean;
  failed: boolean;
}

// Keep only the last N rendered messages — the live tail is an ephemeral
// firehose, not a scrollback log (docs/live-chat.md §11.2).
const MAX_MESSAGES = 200;

// Reconnect backoff bounds (jittered). The client re-anchors from `hello` on
// every (re)connect, so a drop self-heals (§16).
const BASE_DELAY = 1000;
const MAX_DELAY = 15000;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface UseChatArgs {
  channelId: string | number | undefined;
  token?: string;
  me: ChatSender | null; // current user as a sender (null = anonymous)
}

export interface UseChatResult {
  messages: UiMessage[];
  status: ChatStatus;
  viewers: number;
  mode: RoomMode;
  canSend: boolean;
  send: (text: string) => Promise<void>;
}

// useChat owns one WebSocket to a room's live chat: it applies hello/batch/
// presence frames, dedups by seq, reconciles our own optimistic echoes, and
// reconnects with jittered backoff. Sending is a REST call (the write path);
// the sent message returns via the fan-out echo like everyone else's.
export function useChat({ channelId, token, me }: UseChatArgs): UseChatResult {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("connecting");
  const [viewers, setViewers] = useState(0);
  const [mode, setMode] = useState<RoomMode>({});

  // Keep the latest token / identity in refs so a token rotation does NOT tear
  // down an open socket (the server fixes identity at connect time).
  const tokenRef = useRef(token);
  const meRef = useRef(me);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  // ingest merges incoming wire messages into state: skip seqs we already have,
  // reconcile a matching pending echo of ours, otherwise append. Capped to the
  // last MAX_MESSAGES.
  const ingest = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    const myId = meRef.current?.id;
    setMessages((prev) => {
      const seen = new Set(
        prev.filter((m) => m.seq != null).map((m) => m.seq as number)
      );
      const next = prev.slice();
      for (const msg of incoming) {
        if (seen.has(msg.seq)) continue; // already have this seq
        const mine = myId != null && msg.user.id === myId;
        if (mine) {
          // Reconcile the oldest pending echo with the same text.
          const idx = next.findIndex(
            (m) => m.pending && m.seq == null && m.text === msg.text
          );
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              seq: msg.seq,
              ts: msg.ts,
              user: msg.user,
              pending: false,
              failed: false,
            };
            seen.add(msg.seq);
            continue;
          }
        }
        next.push({
          clientId: randomId(),
          seq: msg.seq,
          user: msg.user,
          text: msg.text,
          ts: msg.ts,
          mine,
          pending: false,
          failed: false,
        });
        seen.add(msg.seq);
      }
      next.sort((a, b) => {
        if (a.seq != null && b.seq != null) return a.seq - b.seq;
        return a.ts - b.ts; // keep pending (no seq) ordered by local time
      });
      return next.length > MAX_MESSAGES
        ? next.slice(next.length - MAX_MESSAGES)
        : next;
    });
  }, []);

  const applyFrame = useCallback(
    (raw: string) => {
      let frame: ChatFrame;
      try {
        frame = JSON.parse(raw) as ChatFrame;
      } catch {
        return;
      }
      switch (frame.type) {
        case "hello":
          setMode(frame.mode ?? {});
          setViewers(frame.count ?? 0);
          ingest(frame.recent ?? []);
          break;
        case "batch":
          ingest(frame.messages ?? []);
          break;
        case "presence":
          setViewers(frame.count ?? 0);
          break;
      }
    },
    [ingest]
  );

  useEffect(() => {
    if (!channelId) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      ws = new WebSocket(chatWsUrl(channelId, tokenRef.current));

      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
      };
      ws.onmessage = (ev) => applyFrame(ev.data as string);
      ws.onerror = () => ws?.close();
      ws.onclose = () => {
        if (disposed) return;
        setStatus("closed");
        const delay =
          Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY) + Math.random() * 500;
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // don't schedule a reconnect on intentional close
        ws.close();
      }
      // Reset for the next room so stale messages don't flash on switch.
      setMessages([]);
      setViewers(0);
    };
  }, [channelId, applyFrame]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const sender = meRef.current;
      if (!trimmed || !sender || !channelId) return;

      const clientId = randomId();
      // Optimistic local echo (§4.0): render immediately, reconcile on ack/echo.
      setMessages((prev) => [
        ...prev,
        {
          clientId,
          seq: null,
          user: sender,
          text: trimmed,
          ts: Date.now(),
          mine: true,
          pending: true,
          failed: false,
        },
      ]);

      try {
        const res = await api.chat.send(channelId, trimmed);
        // Stamp the assigned seq so the fan-out echo dedups against it. If the
        // echo already reconciled this message, it now has a seq and this maps
        // over nothing.
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === clientId && m.seq == null
              ? { ...m, seq: res.seq, ts: res.ts, pending: false }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === clientId
              ? { ...m, pending: false, failed: true }
              : m
          )
        );
      }
    },
    [channelId]
  );

  return {
    messages,
    status,
    viewers,
    mode,
    canSend: me != null,
    send,
  };
}
