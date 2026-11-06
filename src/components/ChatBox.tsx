import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { loginPath } from "../auth/next";
import { useChat } from "../chat/useChat";
import type { UiMessage } from "../chat/useChat";
import { useBackHandler } from "../eitaa";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n";
import { nameColor } from "../util/format";
import { ArrowDownIcon, SendIcon, ToolsIcon } from "./player/icons";
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

// The slow-mode intervals the owner can pick, in seconds (the server allows 0–120).
const SLOW_OPTIONS = [0, 3, 5, 10, 30, 60, 120];
const MAX_LEN = 500;
// Within this many pixels of the bottom counts as "reading the newest".
const STICK_PX = 80;

const FAIL_KEYS: Record<string, MessageKey> = {
  rate_limited: "chat.fail_rate_limited",
  slow_mode: "chat.fail_slow_mode",
  chat_closed: "chat.fail_chat_closed",
  too_long: "chat.fail_too_long",
};

// ChatBox is the live-chat panel: it reads over the WebSocket (anonymous
// allowed) and writes over REST (login required). The socket, dedup and echo
// logic lives in useChat; this is presentation and the composer. Built for a
// phone first: one-row composer with a send button, the list keeps to the
// newest line unless the viewer scrolled up (then a "new messages" pill), and
// the owner's tools fold into one panel.
export default function ChatBox({ channelId, onViewers, ownerId }: Props) {
  const { t } = useI18n();
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

  const { messages, status, viewers, mode, canSend, send, retry } = useChat({
    channelId,
    token: session?.token,
    me,
  });
  const isOwner = session != null && ownerId != null && session.user.id === ownerId;
  // The owner is exempt from every mode, as on the server.
  const closed = mode.closed === true;
  const slowSeconds = isOwner ? 0 : mode.slow_seconds ?? 0;
  const mayWrite = canSend && (!closed || isOwner);

  useEffect(() => {
    onViewers?.(viewers);
  }, [viewers, onViewers]);

  // Slow mode countdown after our own send; the server enforces it anyway.
  const [waitUntil, setWaitUntil] = useState(0);
  const [, tick] = useState(0);
  const waitLeft = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));
  useEffect(() => {
    if (waitLeft <= 0) return;
    const timer = setTimeout(() => tick((n) => n + 1), 250);
    return () => clearTimeout(timer);
  }, [waitLeft, waitUntil]);

  // --- the list: stick to the bottom unless the viewer scrolled up ---
  const listRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const seenCount = useRef(0);

  const toBottom = (smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setStuck(true);
    setUnseen(0);
  };
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    setStuck(atBottom);
    if (atBottom) setUnseen(0);
  };
  // Before paint, so a new line never flashes above the fold first.
  useLayoutEffect(() => {
    const added = Math.max(0, messages.length - seenCount.current);
    seenCount.current = messages.length;
    if (stuck) {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } else if (added) {
      setUnseen((n) => n + added);
    }
  }, [messages, stuck]);
  // The panel resizing (keyboard, rotation, fullscreen) keeps the newest line in view.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stuck) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [stuck]);

  // --- composer ---
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || waitLeft > 0 || !mayWrite) return;
    setDraft("");
    if (slowSeconds > 0) setWaitUntil(Date.now() + slowSeconds * 1000);
    void send(text);
    toBottom();
    // Keep the keyboard up for the next line.
    inputRef.current?.focus();
  };

  // --- owner tools ---
  const [tools, setTools] = useState(false);
  const [changing, setChanging] = useState(false);
  const [modeError, setModeError] = useState("");
  useBackHandler(tools ? () => setTools(false) : undefined);
  const run = async (action: () => Promise<unknown>) => {
    if (!channelId) return;
    setChanging(true);
    setModeError("");
    try {
      // The room's mode/clear frame updates everyone, us included.
      await action();
    } catch (err) {
      setModeError(err instanceof ApiRequestError ? err.message : t("common.networkError"));
    } finally {
      setChanging(false);
    }
  };
  const changeMode = (change: { closed?: boolean; slow_seconds?: number }) =>
    run(() => api.chat.setMode(channelId!, change));
  const clearChat = () => {
    if (!window.confirm(t("chat.clearConfirm"))) return;
    void run(() => api.chat.clear(channelId!));
  };

  const near = draft.length > MAX_LEN - 50;

  return (
    <aside className="chat" aria-label={t("chat.title")}>
      <div className="chat-head">
        <span
          className={`chat-dot chat-dot--${status}`}
          title={t(`chat.status_${status}` as MessageKey)}
          aria-label={t(`chat.status_${status}` as MessageKey)}
        />
        <span className="chat-title">{t("chat.title")}</span>
        {viewers > 0 && <span className="chat-count">{t("chat.inChat", { n: viewers })}</span>}
        {isOwner && (
          <button
            type="button"
            className={`chat-tools-btn${tools ? " active" : ""}`}
            aria-label={t("chat.tools")}
            aria-expanded={tools}
            title={t("chat.tools")}
            onClick={() => setTools((v) => !v)}
          >
            <ToolsIcon size={18} />
          </button>
        )}
      </div>

      {isOwner && tools && (
        <div className="chat-controls">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => void changeMode({ closed: !closed })}
            disabled={changing || status !== "open"}
          >
            {closed ? t("chat.openChat") : t("chat.closeChat")}
          </button>
          <label className="chat-slow">
            <span>{t("chat.slowMode")}</span>
            <select
              value={mode.slow_seconds ?? 0}
              onChange={(e) => void changeMode({ slow_seconds: Number(e.target.value) })}
              disabled={changing || status !== "open"}
            >
              {SLOW_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? t("chat.off") : t("chat.seconds", { n: s })}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={clearChat}
            disabled={changing || status !== "open"}
          >
            {t("chat.clearChat")}
          </button>
        </div>
      )}
      {closed && (
        <p className="chat-notice">{isOwner ? t("chat.noticeClosedOwner") : t("chat.noticeClosed")}</p>
      )}
      {!closed && (mode.slow_seconds ?? 0) > 0 && (
        <p className="chat-notice">
          {isOwner
            ? t("chat.noticeSlowOwner", { n: mode.slow_seconds ?? 0 })
            : t("chat.noticeSlow", { n: mode.slow_seconds ?? 0 })}
        </p>
      )}
      {modeError && <p className="chat-notice chat-notice--error">{modeError}</p>}

      <div className="chat-body">
        <div className="chat-messages" ref={listRef} onScroll={onScroll} role="log" aria-live="polite">
          <p className="chat-welcome">{t("chat.welcome")}</p>
          {messages.length === 0 && (
            <p className="chat-welcome">{status === "open" ? t("chat.empty") : t("chat.connecting")}</p>
          )}
          {messages.map((m) => (
            <ChatLine key={m.clientId} m={m} onRetry={retry} />
          ))}
        </div>
        {!stuck && unseen > 0 && (
          <button type="button" className="chat-jump" onClick={() => toBottom(true)}>
            <ArrowDownIcon size={16} />
            {t("chat.newMessages")}
          </button>
        )}
      </div>

      {/* Writing requires a login (public reads, auth writes). */}
      <form className="chat-compose" onSubmit={onSubmit}>
        {mayWrite ? (
          <>
            <div className="chat-input">
              <input
                ref={inputRef}
                dir="auto"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={waitLeft > 0 ? t("chat.slowWait", { n: waitLeft }) : t("chat.placeholder")}
                maxLength={MAX_LEN}
                enterKeyHint="send"
                autoComplete="off"
                aria-label={t("chat.placeholder")}
              />
              {near && <span className="chat-len">{MAX_LEN - draft.length}</span>}
            </div>
            <button
              type="submit"
              className="chat-send"
              aria-label={t("chat.send")}
              title={t("chat.send")}
              disabled={!draft.trim() || waitLeft > 0}
              // Tapping send must not take focus (the keyboard would drop).
              onPointerDown={(e) => e.preventDefault()}
            >
              {waitLeft > 0 ? <span className="chat-wait">{t("chat.seconds", { n: waitLeft })}</span> : <SendIcon size={20} />}
            </button>
          </>
        ) : canSend ? (
          <div className="chat-locked">{t("chat.closedForYou")}</div>
        ) : (
          <LoginLink className="chat-locked chat-locked--login">
            {t("chat.loginToChat")}
          </LoginLink>
        )}
      </form>
    </aside>
  );
}

function ChatLine({ m, onRetry }: { m: UiMessage; onRetry: (m: UiMessage) => void }) {
  const { t } = useI18n();
  const reason = m.failCode ? FAIL_KEYS[m.failCode] : undefined;
  return (
    <div
      className={`chat-line${m.pending ? " chat-line--pending" : ""}${m.failed ? " chat-line--failed" : ""}${
        m.mine ? " chat-line--mine" : ""
      }`}
    >
      <bdi className="chat-user" style={{ color: m.user.color || nameColor(m.user.name) }}>
        {m.user.name}
      </bdi>
      <span className="chat-colon">: </span>
      <bdi className="chat-text" dir="auto">
        {m.text}
      </bdi>
      {m.failed && (
        <span className="chat-fail">
          {" "}
          {reason ? t(reason) : t("chat.notSent")} ·{" "}
          <button type="button" className="chat-retry" onClick={() => onRetry(m)}>
            {t("chat.retry")}
          </button>
        </span>
      )}
    </div>
  );
}

// LoginLink goes to sign-in and, once signed in, back to this page.
function LoginLink({ className, children }: { className: string; children: React.ReactNode }) {
  const { pathname, search } = useLocation();
  return (
    <Link to={loginPath(pathname + search)} className={className}>
      {children}
    </Link>
  );
}
