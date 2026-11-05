import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useBackHandler } from "../eitaa";

// Signing in and signing up are one flow: the phone number is sent a code, and
// verifying it creates the account the first time that number is seen. The two
// routes differ only in wording and in offering a display name.
export default function PhoneAuth({ mode }: { mode: "login" | "register" }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
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
      setError(err instanceof ApiRequestError ? err.message : "network error");
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
      navigate("/");
    });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void (codeSent ? verify() : sendCode());
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="auth-title">{signingUp ? "Join Stream today" : "Log in to Stream"}</h1>
        <div className="tabs" role="tablist">
          <Link to="/login" className={signingUp ? "tab" : "tab tab--active"} role="tab">Log In</Link>
          <Link to="/register" className={signingUp ? "tab tab--active" : "tab"} role="tab">Sign Up</Link>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Mobile number</span>
            <input
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={codeSent}
              required
              autoFocus
            />
          </label>
          {codeSent && (
            <>
              <label className="field">
                <span>Code</span>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoFocus
                />
                <small className="muted">We texted a 6-digit code to this number.</small>
              </label>
              {signingUp && (
                <label className="field">
                  <span>Display name <em className="muted">(optional)</em></span>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} />
                </label>
              )}
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Please wait…" : codeSent ? (signingUp ? "Sign Up" : "Log In") : "Send code"}
          </button>
          {codeSent && (
            <>
              <button type="button" className="btn btn--secondary btn--block" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
              <button type="button" className="btn btn--secondary btn--block" disabled={busy} onClick={() => { setCodeSent(false); setError(""); }}>
                Change number
              </button>
            </>
          )}
        </form>
        {!signingUp && (
          <p className="auth-alt">
            Have an older account? <Link to="/login/password" className="link">Log in with a password</Link>
          </p>
        )}
      </div>
    </div>
  );
}
