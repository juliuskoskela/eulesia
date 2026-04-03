const viteApiUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL =
  viteApiUrl !== undefined
    ? viteApiUrl
    : import.meta.env.DEV
      ? "http://localhost:3001"
      : "";

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
