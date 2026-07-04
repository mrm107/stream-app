/// <reference types="vite/client" />


interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_HLS_BASE?: string;
  readonly VITE_RTMP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
