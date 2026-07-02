import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Header from "./components/Header";
import Browse from "./pages/Browse";
import Watch from "./pages/Watch";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Studio from "./pages/Studio";
import type { ReactNode } from "react";

// RequireAuth gates creator-only routes; viewers/browse/watch stay public.
function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return session ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="app">
      <Header />
      <Routes>
        {/* public */}
        <Route path="/" element={<Browse />} />
        <Route path="/watch/:channelId" element={<Watch />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
  );
}
