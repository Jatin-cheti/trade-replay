import axios from "axios";
import { frontendEnv } from "./env";

const API_BASE_URL = frontendEnv.API_URL;
let activeRequestCount = 0;
const loadingListeners = new Set<(isLoading: boolean) => void>();

function shouldTrackAsBlocking(method?: string): boolean {
  const normalized = (method || "get").toLowerCase();
  return normalized !== "get" && normalized !== "head" && normalized !== "options";
}

function notifyLoading(): void {
  const isLoading = activeRequestCount > 0;
  loadingListeners.forEach((listener) => listener(isLoading));
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

const bootstrapToken = typeof window !== "undefined" ? window.localStorage.getItem("sim_token") : null;
if (bootstrapToken) {
  api.defaults.headers.common.Authorization = `Bearer ${bootstrapToken}`;
}

api.interceptors.request.use(
  (config) => {
    if (shouldTrackAsBlocking(config.method)) {
      activeRequestCount += 1;
      notifyLoading();
      (config as typeof config & { __tracksGlobalLoading?: boolean }).__tracksGlobalLoading = true;
    }
    return config;
  },
  (error) => {
    const tracked = (error?.config as { __tracksGlobalLoading?: boolean } | undefined)?.__tracksGlobalLoading;
    if (tracked) {
      activeRequestCount = Math.max(0, activeRequestCount - 1);
      notifyLoading();
    }
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    const tracked = (response.config as { __tracksGlobalLoading?: boolean }).__tracksGlobalLoading;
    if (tracked) {
      activeRequestCount = Math.max(0, activeRequestCount - 1);
      notifyLoading();
    }
    return response;
  },
  (error) => {
    const tracked = (error?.config as { __tracksGlobalLoading?: boolean } | undefined)?.__tracksGlobalLoading;
    if (tracked) {
      activeRequestCount = Math.max(0, activeRequestCount - 1);
      notifyLoading();
    }
    return Promise.reject(error);
  },
);

export function subscribeApiLoading(listener: (isLoading: boolean) => void): () => void {
  loadingListeners.add(listener);
  listener(activeRequestCount > 0);

  return () => {
    loadingListeners.delete(listener);
  };
}

export function setApiToken(token: string | null): void {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error !== "object" || error === null) {
    return fallbackMessage;
  }

  if ("response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    const message = response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if ("message" in error && typeof (error as { message?: string }).message === "string") {
    const message = (error as { message?: string }).message;
    if (message && message.trim()) {
      return message;
    }
  }

  return fallbackMessage;
}

export function getApiErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const response = (error as { response?: { data?: { code?: string; errorCode?: string } } }).response;
  return response?.data?.code ?? response?.data?.errorCode;
}
