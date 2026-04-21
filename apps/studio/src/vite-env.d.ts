interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ASSETS_BASE_URL?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_PUBLIC_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
