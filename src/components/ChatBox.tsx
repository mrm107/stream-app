import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useChat } from "../chat/useChat";
import type { ChatSender } from "../api/types";

interface Props {
  channelId: string | number | undefined;
}

// ChatBox is the live-chat panel: it reads over the WebSocket (anonymous
// allowed) and writes over REST (login required). All the socket/dedup/echo
// logic lives in useChat; this component is just presentation + the input.
export default function ChatBox({ channelId }: Props) {
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
    <aside className="chat-col">
      <div className="chat-header">
        <span>Stream chat</span>
        <span className="chat-status">
          <span className={`chat-dot chat-dot--${status}`} />
          {viewers > 0 && <span className="muted small">{viewers} watching</span>}
        </span>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 ? (
          <p className="muted small">
            {status === "open" ? "No messages yet. Say hi 👋" : "Connecting…"}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.clientId}
              className={`chat-msg${m.pending ? " chat-msg--pending" : ""}${
                m.failed ? " chat-msg--failed" : ""
              }`}
            >
              <span className="chat-msg-user" style={colorOf(m.user.color)}>
                {m.user.name}
              </span>
              <span className="chat-msg-text">{m.text}</span>
              {m.failed && <span className="chat-msg-fail"> · failed</span>}
            </div>
          ))
        )}
      </div>

      {/* Writing requires a login (public reads, auth writes). */}
      {canSend ? (
        <form className="chat-input" onSubmit={onSubmit}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Send a message"
            maxLength={500}
          />
          <button className="small" disabled={!draft.trim()}>
            Chat
          </button>
        </form>
      ) : (
        <div className="chat-locked">
          <Link to="/login">Log in</Link> to chat
        </div>
      )}
    </aside>
  );
}

// colorOf applies the sender's color if the server provided one.
function colorOf(color?: string): React.CSSProperties {
  return color ? { color } : {};
}
