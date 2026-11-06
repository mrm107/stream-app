import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useBackHandler } from "../eitaa";
import { useI18n } from "../i18n";
import Avatar from "./Avatar";
import { KeyIcon, LogoutIcon, PersonIcon, SearchIcon, VideoIcon } from "./Icons";

// Header is the Twitch-style top nav on every page: logo + Browse at the
// start, search in the middle, and either the language switch + Log In /
// Sign Up or the user menu at the end (sides follow the page direction).
export default function Header() {
  const { session, pending, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  // Follow the URL: leaving the results (the logo, Browse) clears the box.
  useEffect(() => setQuery(urlQuery), [urlQuery]);

  // Search filters the live channels on the browse page.
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  };

  return (
    <header className="topnav">
      <div className="topnav-left">
        <Link to="/" className="brand" aria-label={t("nav.home")}>
          <Logo />
        </Link>
        <NavLink to="/" end className="topnav-link">
          {t("nav.browse")}
        </NavLink>
      </div>

      <form className="search" onSubmit={onSearch} role="search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("nav.search")}
          aria-label={t("nav.searchLabel")}
        />
        <button type="submit" className="search-btn" aria-label={t("nav.search")}>
          <SearchIcon />
        </button>
      </form>

      <div className="topnav-right">
        {pending ? null : session ? (
          <UserMenu
            name={session.user.display_name || session.user.username}
            avatar={session.user.avatar_url}
            onSignOut={signOut}
          />
        ) : (
          <>
            <LangButton />
            <Link to="/login" className="btn btn--secondary">
              {t("nav.login")}
            </Link>
            <Link to="/register" className="btn btn--primary">
              {t("nav.signup")}
            </Link>
            <span className="topnav-guest" aria-hidden>
              <PersonIcon />
            </span>
          </>
        )}
      </div>
    </header>
  );
}

// UserMenu is the avatar button and its dropdown.
function UserMenu({
  name,
  avatar,
  onSignOut,
}: {
  name: string;
  avatar?: string | null;
  onSignOut: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Eitaa's back button closes the open menu before leaving the page.
  useBackHandler(open ? () => setOpen(false) : undefined);

  // Close on any click outside, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="usermenu" ref={ref}>
      <button
        className="usermenu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("nav.userMenu")}
      >
        <Avatar name={name} src={avatar} size={30} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <Avatar name={name} src={avatar} size={40} />
            <strong>{name}</strong>
          </div>
          <div className="menu-sep" />
          <Link to="/studio" className="menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <VideoIcon /> {t("nav.studio")}
          </Link>
          <Link to="/studio#obs" className="menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <KeyIcon /> {t("nav.streamKey")}
          </Link>
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => setLang(lang === "fa" ? "en" : "fa")}
          >
            <GlobeIcon /> {t("nav.language")}
            <span className="menu-item-end" lang={lang === "fa" ? "en" : "fa"}>
              {t("common.switchLang")}
            </span>
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogoutIcon className="icon-flip" /> {t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

// LangButton switches to the other language; guests get it in the nav bar
// (signed-in users find it in the user menu). It's labelled in the language
// it switches to, so it can be found by someone who can't read this one.
function LangButton() {
  const { t, lang, setLang } = useI18n();
  const other = lang === "fa" ? "en" : "fa";
  return (
    <button
      type="button"
      className="btn btn--sm lang-btn"
      lang={other}
      onClick={() => setLang(other)}
    >
      {t("common.switchLang")}
    </button>
  );
}

// GlobeIcon marks the language item in the user menu.
function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M2.5 10h15M10 2.5c2.2 2.3 3 4.8 3 7.5s-.8 5.2-3 7.5c-2.2-2.3-3-4.8-3-7.5s.8-5.2 3-7.5Z" />
    </svg>
  );
}

// Logo is the brand mark: a play button on a rounded tile, with the live dot
// in its corner, next to the wordmark.
function Logo() {
  return (
    <span className="logo">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect x="1" y="3" width="24" height="24" rx="7" fill="#9147ff" />
        <path d="M10.5 9.8v10.4a1 1 0 0 0 1.5.86l8.6-5.2a1 1 0 0 0 0-1.72L12 8.94a1 1 0 0 0-1.5.86Z" fill="#fff" />
        <circle cx="23" cy="5" r="4" fill="#eb0400" stroke="#18181b" strokeWidth="2" />
      </svg>
      <span className="logo-word">stream</span>
    </span>
  );
}
