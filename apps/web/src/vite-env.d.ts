/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API, e.g. http://localhost:3000. Optional in development, mandatory in production. */
  readonly VITE_API_URL?: string;
}
