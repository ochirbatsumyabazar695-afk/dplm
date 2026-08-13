/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API-гийн бүтэн хаяг. Хоосон бол `/api` (dev дээр vite proxy). */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
