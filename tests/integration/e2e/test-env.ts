const rawApiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4000";

export const E2E_API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (path.startsWith("/")) {
    return `${E2E_API_BASE_URL}${path}`;
  }
  return `${E2E_API_BASE_URL}/${path}`;
}