/// <reference types="vite/client" />


interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_HLS_BASE?: string;
  readonly VITE_RTMP_URL?: string;
  readonly VITE_HLS_ABR_URL?: string;
  // Dev only: initData to sign in with when running outside Eitaa.
  readonly VITE_DEV_EITAA_INIT_DATA?: string;
  // The Eitaa mini-app's link (e.g. https://eitaa.com/<bot>/<app>); stream
  // share links open it at the stream. Unset = share plain web links.
  readonly VITE_EITAA_APP_LINK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The parts of public/scripts/miniapp.js (Eitaa's SDK) the app uses. */
interface EitaaWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; first_name?: string; last_name?: string };
    start_param?: string;
  };
  platform: string;
  isVersionAtLeast: (version: string) => boolean;
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setBottomBarColor: (color: string) => void;
  // 1.3+: the mini-app covers the whole screen, without Eitaa's header.
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  isFullscreen?: boolean;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
}

interface Window {
  Eitaa?: { WebApp?: EitaaWebApp };
}
