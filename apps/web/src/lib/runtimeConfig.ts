const viteApiUrl = import.meta.env.VITE_API_URL;
const viteE2eeBackend = import.meta.env.VITE_E2EE_BACKEND;

export const API_BASE_URL =
  viteApiUrl !== undefined
    ? viteApiUrl
    : import.meta.env.DEV
      ? "http://localhost:3001"
      : "";

export const E2EE_BACKEND = viteE2eeBackend === "matrix" ? "matrix" : "legacy";

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
