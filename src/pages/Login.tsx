import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.auth.login({ identifier, password });
      signIn({ token: res.token, refreshToken: res.refresh_token, user: res.user });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="auth-title">Log in to Stream</h1>
        <div className="tabs" role="tablist">
          <Link to="/login" className="tab tab--active" role="tab" aria-selected>Log In</Link>
          <Link to="/register" className="tab" role="tab">Sign Up</Link>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Username or email</span>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Logging in…" : "Log In"}
          </button>
        </form>
        <p className="auth-alt">
          Don’t have an account? <Link to="/register" className="link">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
