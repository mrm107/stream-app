import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { loginPath } from "./auth/next";
import { useAuth } from "./auth/AuthContext";
import { useRouteBack, useStartParamRoute } from "./eitaa";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Browse from "./pages/Browse";
import Watch from "./pages/Watch";
import Login from "./pages/Login";
import PhoneAuth from "./pages/PhoneAuth";
import Studio from "./pages/Studio";
import type { ReactNode } from "react";

// RequireAuth gates creator-only routes; viewers/browse/watch stay public.
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, pending } = useAuth();
  const { pathname, search, hash } = useLocation();
  if (pending) return null; // signing in from Eitaa; the page follows
  return session ? <>{children}</> : <Navigate to={loginPath(pathname + search + hash)} replace />;
}

// The shell is Twitch's: a fixed top nav, the live-channels rail on the left,
// and the page scrolling on its own to the right of it.
export default function App() {
  // Eitaa's back button: back through the pages, close on the first one.
  useRouteBack();
  // Opened from a stream link in Eitaa: go to that stream.
  useStartParamRoute();
  return (
    <div className="app">
      <Header />
      <div className="shell">
        <Sidebar />
        <div className="content">
          <Routes>
            {/* public */}
            <Route path="/" element={<Browse />} />
            <Route path="/watch/:channelId" element={<Watch />} />
            <Route path="/login" element={<PhoneAuth key="login" mode="login" />} />
            <Route path="/register" element={<PhoneAuth key="register" mode="register" />} />
            <Route path="/login/password" element={<Login />} />

            {/* creator only */}
            <Route
              path="/studio"
              element={
                <RequireAuth>
                  <Studio />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
