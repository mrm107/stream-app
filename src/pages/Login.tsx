import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/AuthContext";
import { useNext } from "../auth/next";

export default function Login() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const next = useNext();

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
      navigate(next.to, { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("common.networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="auth-title">{t("auth.loginTitle")}</h1>
        <div className="tabs" role="tablist">
          <Link to={next.link("/login")} className="tab tab--active" role="tab" aria-selected>{t("auth.login")}</Link>
          <Link to={next.link("/register")} className="tab" role="tab">{t("auth.signup")}</Link>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>{t("auth.identifier")}</span>
            <input dir="ltr" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>{t("auth.password")}</span>
            <input type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? t("auth.loggingIn") : t("auth.login")}
          </button>
        </form>
        <p className="auth-alt">
          {t("auth.noPassword")} <Link to={next.link("/login")} className="link">{t("auth.loginWithPhone")}</Link>
        </p>
      </div>
    </div>
  );
}
