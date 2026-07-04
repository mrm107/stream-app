import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setAuthCallbacks, setTokens } from "../api/client";
import type { User } from "../api/types";

interface Session {
  token: string; // short-lived access JWT
  refreshToken: string; // long-lived, rotated on every refresh
  user: User;
}

interface AuthState {
  session: Session | null;
  signIn: (s: Session) => void;
  signOut: () => void;
}

const STORAGE_KEY = "stream.session";
const AuthContext = createContext<AuthState | null>(null);

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function persist(s: Session | null) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = load();
    if (s) setTokens({ token: s.token, refresh: s.refreshToken }); // prime the client
    return s;
  });

  // Let the api client drive the session on token rotation / expiry. The client
  // refreshes tokens transparently on a 401; these callbacks keep React state
  // and localStorage in lockstep with whatever the client now holds.
  useEffect(() => {
    setAuthCallbacks({
      onTokensRotated: ({ token, refresh_token, user }) => {
        const next: Session = { token, refreshToken: refresh_token, user };
        persist(next);
        setSession(next);
      },
      onSessionExpired: () => {
        persist(null);
        setSession(null);
      },
    });
  }, []);

  // Keep the client's in-memory tokens matching the session for explicit
  // sign-in / sign-out (rotation is already handled by the callbacks above).
  useEffect(() => {
    setTokens(
      session ? { token: session.token, refresh: session.refreshToken } : null
    );
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      signIn: (s) => {
        persist(s);
        setSession(s);
      },
      signOut: () => {
        // Best-effort server-side revocation; the local session clears either way.
        if (session?.refreshToken) {
          void api.auth.logout(session.refreshToken).catch(() => {});
        }
        persist(null);
        setSession(null);
      },
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
