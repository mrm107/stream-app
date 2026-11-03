import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useChat } from "../chat/useChat";
import { nameColor } from "../util/format";
import type { ChatSender } from "../api/types";

interface Props {
  channelId: string | number | undefined;
  // onViewers reports the room's live viewer count (chat presence) upward,
  // for the channel bar.
  onViewers?: (n: number) => void;
  // ownerId is the channel owner's user id: they may close the chat, and post
  // while it is closed.
  ownerId?: number;
}

// ChatBox is the live-chat panel: it reads over the WebSocket (anonymous
// allowed) and writes over REST (login required). All the socket/dedup/echo
// logic lives in useChat; this component is just presentation + the input.
// The slow-mode intervals the owner can pick, in seconds (the server allows 0–120).
const SLOW_OPTIONS = [0, 3, 5, 10, 30, 60, 120];

export default function ChatBox({ channelId, onViewers, ownerId }: Props) {
  const { session } = useAuth();

  // Our identity as a chat sender (null = anonymous → read-only). Memoized so a
  // re-render doesn't churn the hook's identity ref.
  const me = useMemo<ChatSender | null>(
    () =>
      session
        ? {
            id: session.user.id,
            name: session.user.display_name || session.user.username,
          }
        : null,
    [session]
  );

  const { messages, status, viewers, mode, canSend, send } = useChat({
    channelId,
    token: session?.token,
    me,
  });
  const isOwner = session != null && ownerId != null && session.user.id === ownerId;
  // The owner is exempt from every mode, as on the server.
  const closed = mode.closed === true;
  const slowSeconds = isOwner ? 0 : mode.slow_seconds ?? 0;
  const mayWrite = canSend && (!closed || isOwner);

  // Slow mode countdown after our own send; the server enforces it anyway.
  const [waitUntil, setWaitUntil] = useState(0);
  const [, tick] = useState(0);
  const waitLeft = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));
  useEffect(() => {
    if (waitLeft <= 0) return;
    const t = setTimeout(() => tick((n) => n + 1), 250);
    return () => clearTimeout(t);
  }, [waitLeft, waitUntil]);

  const [changing, setChanging] = useState(false);
  const [modeError, setModeError] = useState("");
  const changeMode = async (change: { closed?: boolean; slow_seconds?: number }) => {
    if (!channelId) return;
    setChanging(true);
    setModeError("");
    try {
      // The room's mode frame updates the mode for everyone, us included.
      await api.chat.setMode(channelId, change);
    } catch (err) {
      setModeError(err instanceof ApiRequestError ? err.message : "network error");
    } finally {
      setChanging(false);
    }
  };

  useEffect(() => {
    onViewers?.(viewers);
  }, [viewers, onViewers]);

  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message, but only if the viewer is already near
  // the bottom — don't yank them down while they scroll back.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || waitLeft > 0) return;
    setDraft("");
    if (slowSeconds > 0) setWaitUntil(Date.now() + slowSeconds * 1000);
    void send(text);
  };

  return (
    <aside className="chat">
      <div className="chat-head">
        <span className={`chat-dot chat-dot--${status}`} title={`Chat ${status}`} />
        <span>Stream Chat</span>
      </div>
      {isOwner && (
        <div className="chat-controls">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => void changeMode({ closed: !closed })}
            disabled={changing || status !== "open"}
          >
            {closed ? "Open chat" : "Close chat"}
          </button>
          <label className="chat-slow">
            <span>Slow mode</span>
            <select
              id="chat-slow-mode"
              value={mode.slow_seconds ?? 0}
              onChange={(e) => void changeMode({ slow_seconds: Number(e.target.value) })}
              disabled={changing || status !== "open"}
            >
              {SLOW_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === 0 ? "Off" : `${s}s`}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {closed && (
        <p className="chat-notice">
          {isOwner ? "Chat is closed. Only you can send messages." : "The streamer has closed the chat."}
        </p>
      )}
      {!closed && (mode.slow_seconds ?? 0) > 0 && (
        <p className="chat-notice">
          {isOwner
            ? `Slow mode is on (${mode.slow_seconds}s). You are exempt.`
            : `Slow mode: one message every ${mode.slow_seconds} seconds.`}
        </p>
      )}
      {modeError && <p className="chat-notice chat-notice--error">{modeError}</p>}

      <div className="chat-messages" ref={listRef}>
        <p className="chat-welcome">Welcome to the chat room!</p>
        {messages.length === 0 && status !== "open" && (
          <p className="chat-welcome">Connecting to chat…</p>
        )}
        {messages.map((m) => (
          <div
            key={m.clientId}
            className={`chat-line${m.pending ? " chat-line--pending" : ""}${
              m.failed ? " chat-line--failed" : ""
            }`}
          >
            <span className="chat-user" style={{ color: m.user.color || nameColor(m.user.name) }}>
              {m.user.name}
            </span>
            <span className="chat-colon">: </span>
            <span className="chat-text">{m.text}</span>
            {m.failed && <span className="chat-fail"> (not sent)</span>}
          </div>
        ))}
      </div>

      {/* Writing requires a login (public reads, auth writes). */}
      <form className="chat-compose" onSubmit={onSubmit}>
        {mayWrite ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={waitLeft > 0 ? `Slow mode: wait ${waitLeft}s` : "Send a message"}
            maxLength={500}
            aria-label="Send a message"
          />
        ) : canSend ? (
          <div className="chat-locked">Chat is closed</div>
        ) : (
          <div className="chat-locked">
            <Link to="/login" className="link">Log in</Link> or{" "}
            <Link to="/register" className="link">sign up</Link> to chat
          </div>
        )}
        <div className="chat-actions">
          <span className="chat-count muted">{viewers > 0 ? `${viewers} in chat` : ""}</span>
          <button className="btn btn--primary btn--sm" disabled={!mayWrite || !draft.trim() || waitLeft > 0}>
            Chat
          </button>
        </div>
      </form>
    </aside>
  );
}
