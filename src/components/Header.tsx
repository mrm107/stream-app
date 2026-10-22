import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Avatar from "./Avatar";
import { KeyIcon, LogoutIcon, PersonIcon, SearchIcon, VideoIcon } from "./Icons";

// Header is the Twitch-style top nav on every page: logo + Browse on the left,
// search in the middle, and either Log In / Sign Up or the user menu on the
// right.
export default function Header() {
  const { session, signOut } = useAuth();
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
        <Link to="/" className="brand" aria-label="Home">
          <Logo />
        </Link>
        <NavLink to="/" end className="topnav-link">
          Browse
        </NavLink>
      </div>

      <form className="search" onSubmit={onSearch} role="search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search live channels"
        />
        <button type="submit" className="search-btn" aria-label="Search">
          <SearchIcon />
        </button>
      </form>

      <div className="topnav-right">
        {session ? (
          <UserMenu
            name={session.user.display_name || session.user.username}
            onSignOut={signOut}
          />
        ) : (
          <>
            <Link to="/login" className="btn btn--secondary">
              Log In
            </Link>
            <Link to="/register" className="btn btn--primary">
              Sign Up
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
function UserMenu({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      >
        <Avatar name={name} size={30} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <Avatar name={name} size={40} />
            <strong>{name}</strong>
          </div>
          <div className="menu-sep" />
          <Link to="/studio" className="menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <VideoIcon /> Creator Dashboard
          </Link>
          <Link to="/studio#obs" className="menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <KeyIcon /> Stream Key
          </Link>
          <div className="menu-sep" />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogoutIcon /> Log Out
          </button>
        </div>
      )}
    </div>
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
