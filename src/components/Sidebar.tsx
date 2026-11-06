import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n";
import { useLiveStreams } from "../live/LiveStreamsContext";
import { formatCount } from "../util/format";
import Avatar from "./Avatar";
import { CollapseIcon, ExpandIcon } from "./Icons";

const COLLAPSED_KEY = "stream.sidebar.collapsed";

// Sidebar is Twitch's side rail (on the right in Persian): the channels live right now, busiest first,
// each with its avatar, title and viewer count. It collapses to avatars only,
// and CSS hides it entirely on small screens.
export default function Sidebar() {
  const { streams } = useLiveStreams();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, v ? "0" : "1");
      } catch {
        // storage unavailable: the choice just won't persist
      }
      return !v;
    });
  };

  return (
    <nav className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`} aria-label={t("nav.liveChannels")}>
      <div className="sidebar-head">
        {!collapsed && <h2>{t("nav.liveChannels")}</h2>}
        <button
          className="icon-btn"
          onClick={toggle}
          aria-label={t(collapsed ? "nav.expandSidebar" : "nav.collapseSidebar")}
          title={t(collapsed ? "nav.expand" : "nav.collapse")}
        >
          {collapsed ? <ExpandIcon className="icon-flip" /> : <CollapseIcon className="icon-flip" />}
        </button>
      </div>

      {streams?.length === 0 && !collapsed && (
        <p className="sidebar-empty">{t("nav.noneLive")}</p>
      )}

      <ul className="sidebar-list">
        {streams?.map((s) => (
          <li key={s.stream_id}>
            <NavLink
              to={`/watch/${s.channel_id}`}
              className="sidebar-item"
              title={collapsed ? `${s.display_name} · ${s.title}` : s.title}
            >
              <Avatar name={s.display_name} src={s.avatar_url} size={30} />
              {!collapsed && (
                <>
                  <span className="sidebar-text">
                    <span className="sidebar-name">{s.display_name}</span>
                    <span className="sidebar-title">{s.title}</span>
                  </span>
                  <span className="sidebar-viewers">
                    <span className="live-dot" />
                    {formatCount(s.viewers)}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
