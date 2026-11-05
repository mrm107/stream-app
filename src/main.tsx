import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { connectBackButton, setHostColor, startEitaa } from "./eitaa";
import { AuthProvider } from "./auth/AuthContext";
import { LiveStreamsProvider } from "./live/LiveStreamsContext";
import "./styles.css";

// Inside the Eitaa mini-app: take the full height, stop swipes from closing it,
// match its chrome to our background, and drive its back button.
startEitaa();
setHostColor("#0e0e10");
connectBackButton();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <LiveStreamsProvider>
        <App />
      </LiveStreamsProvider>
    </AuthProvider>
  </BrowserRouter>
);
