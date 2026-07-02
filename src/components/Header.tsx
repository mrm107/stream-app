import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Header is shown on every page. It exposes the browse link plus either
// login/register (anonymous) or the creator link + logout (authenticated).
export default function Header() {
  const { session, signOut } = useAuth();

  return (
    <header className="topbar">
      <Link to="/" className="brand">◉ stream</Link>
      <nav className="row">
        {session ? (
          <>
            <Link to="/studio" className="navlink">Creator studio</Link>
            <span className="muted">{session.user.display_name || session.user.username}</span>
            <button className="ghost small" onClick={signOut}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="navlink">Log in</Link>
            <Link to="/register"><button className="small">Sign up</button></Link>
          </>
        )}
      </nav>
    </header>
  );
}
