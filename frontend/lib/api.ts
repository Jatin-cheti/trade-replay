import axios from "axios";
import { frontendEnv } from "./env";

const API_BASE_URL = frontendEnv.API_URL;
let activeRequestCount = 0;
const loadingListeners = new Set<(isLoading: boolean) => void>();

function notifyLoading(): void {
  const isLoading = activeRequestCount > 0;
  loadingListeners.forEach((listener) => listener(isLoading));
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    activeRequestCount += 1;
    notifyLoading();
    return config;
  },
  (error) => {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    notifyLoading();
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    notifyLoading();
    return response;
  },
  (error) => {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    notifyLoading();
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

if (typeof window !== "undefined") {
  const bootToken = window.localStorage.getItem("sim_token");
  if (bootToken) {
    setApiToken(bootToken);
  }
}
