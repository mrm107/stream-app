import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useChat } from "../chat/useChat";
import { nameColor } from "../util/format";
import type { ChatSender } from "../api/types";

interface Props {
  channelId: string | number | undefined;
  // onViewers reports the room's live viewer count (chat presence) upward,
  // for the channel bar.
  onViewers?: (n: number) => void;
}

// ChatBox is the live-chat panel: it reads over the WebSocket (anonymous
// allowed) and writes over REST (login required). All the socket/dedup/echo
// logic lives in useChat; this component is just presentation + the input.
export default function ChatBox({ channelId, onViewers }: Props) {
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

  const { messages, status, viewers, canSend, send } = useChat({
    channelId,
    token: session?.token,
    me,
  });

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
    if (!text) return;
    setDraft("");
    void send(text);
  };

  return (
    <aside className="chat">
      <div className="chat-head">
        <span className={`chat-dot chat-dot--${status}`} title={`Chat ${status}`} />
        <span>Stream Chat</span>
      </div>

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
        {canSend ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Send a message"
            maxLength={500}
            aria-label="Send a message"
          />
        ) : (
          <div className="chat-locked">
            <Link to="/login" className="link">Log in</Link> or{" "}
            <Link to="/register" className="link">sign up</Link> to chat
          </div>
        )}
        <div className="chat-actions">
          <span className="chat-count muted">{viewers > 0 ? `${viewers} in chat` : ""}</span>
          <button className="btn btn--primary btn--sm" disabled={!canSend || !draft.trim()}>
            Chat
          </button>
        </div>
      </form>
    </aside>
  );
}
