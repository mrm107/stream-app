/// <reference types="vite/client" />

// Custom build-time env vars (see src/config.ts). Declaring them here makes
// import.meta.env.VITE_* type-safe instead of an error under strict mode.
interface ImportMetaEnv {
  readonly VITE_HLS_BASE?: string;
  readonly VITE_RTMP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
