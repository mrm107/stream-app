import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useNext } from "../auth/next";
import { useBackHandler } from "../eitaa";
import { useI18n } from "../i18n";

// Persian and Arabic keyboards type their own digits; the API wants Latin ones.
const latinDigits = (s: string) =>
  s.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) & 0xf));

// Length of the code the server texts.
const CODE_LENGTH = 6;

// Signing in and signing up are one flow: the phone number is sent a code, and
// verifying it creates the account the first time that number is seen. The two
// routes differ only in wording and in offering a display name.
export default function PhoneAuth({ mode }: { mode: "login" | "register" }) {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const next = useNext();
  const signingUp = mode === "register";

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // On the code step, Eitaa's back button returns to the number first (and
  // waits while a request is in flight).
  useBackHandler(codeSent ? () => !busy && setCodeSent(false) : undefined);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("common.networkError"));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      const res = await api.auth.requestOtp(phone);
      setCode("");
      setCodeSent(true);
      setResendIn(res.retry_after);
    });

  const verify = () =>
    run(async () => {
      const res = await api.auth.verifyOtp({
        phone,
        code,
        display_name: displayName || undefined,
      });
      signIn({ token: res.token, refreshToken: res.refresh_token, user: res.user });
      navigate(next.to, { replace: true });
    });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void (codeSent ? verify() : sendCode());
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="auth-title">{t(signingUp ? "auth.joinTitle" : "auth.loginTitle")}</h1>
        <div className="tabs" role="tablist">
          <Link to={next.link("/login")} className={signingUp ? "tab" : "tab tab--active"} role="tab">{t("auth.login")}</Link>
          <Link to={next.link("/register")} className={signingUp ? "tab tab--active" : "tab"} role="tab">{t("auth.signup")}</Link>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>{t("auth.phone")}</span>
            <input
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09123456789"
              value={phone}
              onChange={(e) => setPhone(latinDigits(e.target.value))}
              disabled={codeSent}
              required
              autoFocus
            />
          </label>
          {codeSent && (
            <>
              <label className="field">
                <span>{t("auth.code")}</span>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(latinDigits(e.target.value))}
                  required
                  autoFocus
                />
                <small className="muted">{t("auth.codeSent", { n: CODE_LENGTH })}</small>
              </label>
              {signingUp && (
                <label className="field">
                  <span>{t("auth.displayName")} <em className="muted">{t("auth.optional")}</em></span>
                  <input dir="auto" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} />
                </label>
              )}
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? t("auth.wait") : codeSent ? t(signingUp ? "auth.signup" : "auth.login") : t("auth.sendCode")}
          </button>
          {codeSent && (
            <>
              <button type="button" className="btn btn--secondary btn--block" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
                {resendIn > 0 ? t("auth.resendIn", { n: resendIn }) : t("auth.resend")}
              </button>
              <button type="button" className="btn btn--secondary btn--block" disabled={busy} onClick={() => { setCodeSent(false); setError(""); }}>
                {t("auth.changeNumber")}
              </button>
            </>
          )}
        </form>
        {!signingUp && (
          <p className="auth-alt">
            {t("auth.olderAccount")} <Link to={next.link("/login/password")} className="link">{t("auth.loginWithPassword")}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
