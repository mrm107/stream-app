import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.auth.register({
        username,
        email,
        password,
        display_name: displayName || undefined,
      });
      signIn({ token: res.token, refreshToken: res.refresh_token, user: res.user });
      navigate("/"); // no channel is created — land on browse
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="auth-title">Join Stream today</h1>
        <div className="tabs" role="tablist">
          <Link to="/login" className="tab" role="tab">Log In</Link>
          <Link to="/register" className="tab tab--active" role="tab" aria-selected>Sign Up</Link>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32} autoFocus />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Display name <em className="muted">(optional)</em></span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <small className="muted">At least 8 characters.</small>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Signing up…" : "Sign Up"}
          </button>
        </form>
        <p className="auth-alt">
          Already have an account? <Link to="/login" className="link">Log in</Link>
        </p>
      </div>
    </div>
  );
}
