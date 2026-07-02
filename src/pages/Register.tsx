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
      signIn({ token: res.token, user: res.user });
      navigate("/"); // no channel is created — land on browse
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card center">
      <h1>Create account</h1>
      <form onSubmit={onSubmit}>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32} /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="optional" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? "Creating…" : "Register"}</button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
