/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PORTAL_URL?: string;
  readonly VITE_STUDIO_URL?: string;
  readonly VITE_TAGS_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
