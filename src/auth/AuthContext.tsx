import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, setAuthCallbacks, setTokens } from "../api/client";
import type { AuthResponse, User } from "../api/types";
import { eitaaUserId, getInitData } from "../eitaa";

interface Session {
  token: string; // short-lived access JWT
  refreshToken: string; // long-lived, rotated on every refresh
  user: User;
  // Set when the session came from the Eitaa mini-app: the Eitaa user it
  // belongs to, so another Eitaa account on this phone gets its own session.
  eitaaId?: number;
}

interface AuthState {
  session: Session | null;
  // True while the app signs in by itself from the Eitaa mini-app. Nothing
  // should send the user to a login page meanwhile.
  pending: boolean;
  signIn: (s: Session) => void;
  signOut: () => void;
  // Replace the signed-in user (after a profile change), keeping the tokens.
  updateUser: (user: User) => void;
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

// Inside Eitaa the user signs in by being there: with no session, or with one
// left by another Eitaa account. A session the user made here by phone is kept.
function needsEitaaSignIn(s: Session | null): boolean {
  if (!getInitData()) return false;
  if (!s) return true;
  const current = eitaaUserId();
  return s.eitaaId !== undefined && current !== null && s.eitaaId !== current;
}

function fromResponse(r: AuthResponse, eitaaId?: number): Session {
  return { token: r.token, refreshToken: r.refresh_token, user: r.user, eitaaId };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = load();
    if (needsEitaaSignIn(s)) return null; // someone else's; replaced below
    if (s) setTokens({ token: s.token, refresh: s.refreshToken }); // prime the client
    return s;
  });
  const [pending, setPending] = useState(() => needsEitaaSignIn(load()));

  const apply = useCallback((next: Session | null) => {
    setTokens(next ? { token: next.token, refresh: next.refreshToken } : null);
    persist(next);
    setSession(next);
  }, []);

  // One Eitaa sign-in at a time, however many places ask for it.
  const signingIn = useRef<Promise<void> | null>(null);
  const signInWithEitaa = useCallback(() => {
    signingIn.current ??= (async () => {
      setPending(true);
      try {
        const res = await api.auth.eitaa(getInitData());
        apply(fromResponse(res, eitaaUserId() ?? undefined));
      } catch {
        // Refused or offline: the usual Log In stays available.
        apply(null);
      } finally {
        setPending(false);
        signingIn.current = null;
      }
    })();
    return signingIn.current;
  }, [apply]);

  useEffect(() => {
    if (needsEitaaSignIn(load())) void signInWithEitaa();
  }, [signInWithEitaa]);

  // Let the api client drive the session on token rotation / expiry. The client
  // refreshes tokens transparently on a 401; these callbacks keep React state
  // and localStorage in lockstep with whatever the client now holds.
  useEffect(() => {
    setAuthCallbacks({
      onTokensRotated: (r) => {
        // Rotation keeps the session's origin.
        const next = fromResponse(r, load()?.eitaaId);
        persist(next);
        setSession(next);
      },
      onSessionExpired: () => {
        persist(null);
        setSession(null);
        // Inside Eitaa a dead session is just signed in again.
        if (getInitData()) void signInWithEitaa();
      },
    });
  }, [signInWithEitaa]);

  // Replace the stored user without touching the tokens. A functional update,
  // so a rotation that landed meanwhile is kept.
  const updateUser = useCallback((user: User) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user };
      persist(next);
      return next;
    });
  }, []);

  // Keep the client's in-memory tokens matching the session for explicit
  // sign-in / sign-out (rotation is already handled by the callbacks above).
  useEffect(() => {
    setTokens(
      session ? { token: session.token, refresh: session.refreshToken } : null
    );
  }, [session]);

  // A saved session holds the user as of sign-in: once per signed-in user,
  // fetch the current one (picture, name and bio may have changed since, on
  // another device, or before these fields existed). Failures keep it as is.
  const userId = session?.user.id;
  useEffect(() => {
    if (userId === undefined) return;
    let stale = false;
    api.users
      .me()
      .then((user) => {
        if (!stale && user.id === userId) updateUser(user);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [userId, updateUser]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      pending,
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
      updateUser,
    }),
    [session, pending, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
