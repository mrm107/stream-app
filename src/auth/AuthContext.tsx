import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setToken } from "../api/client";
import type { User } from "../api/types";

interface Session {
  token: string;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = load();
    if (s) setToken(s.token); // prime the api client on first load
    return s;
  });

  // Keep the api client's in-memory token in lockstep with the session.
  useEffect(() => {
    setToken(session?.token ?? null);
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      signIn: (s) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        setSession(s);
      },
      signOut: () => {
        localStorage.removeItem(STORAGE_KEY);
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
