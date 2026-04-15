import axios from "axios";
import { frontendEnv } from "./env";

const API_BASE_URL = frontendEnv.API_URL;
let activeRequestCount = 0;
const loadingListeners = new Set<(isLoading: boolean) => void>();

type LoadingAwareRequestConfig = {
  __tracksGlobalLoading?: boolean;
  suppressGlobalLoading?: boolean;
  method?: string;
};

function shouldTrackAsBlocking(method?: string): boolean {
  const normalized = (method || "get").toLowerCase();
  return normalized !== "get" && normalized !== "head" && normalized !== "options";
}

function shouldTrackRequest(config: LoadingAwareRequestConfig): boolean {
  if (config.suppressGlobalLoading) {
    return false;
  }

  return shouldTrackAsBlocking(config.method);
}

function notifyLoading(): void {
  const isLoading = activeRequestCount > 0;
  loadingListeners.forEach((listener) => listener(isLoading));
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// --- Geo-detection: resolve user country and attach as header ---
let detectedCountry: string | null = typeof window !== "undefined" ? window.localStorage.getItem("user_country") : null;
const GEO_LOOKUP_TIMEOUT_MS = 3000;

function setCountryHeader(country: string): void {
  detectedCountry = country.toUpperCase();
  api.defaults.headers.common["X-Country"] = detectedCountry;
  api.defaults.headers.common["X-User-Country"] = detectedCountry;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem("user_country", detectedCountry); } catch { /* quota */ }
  }
}

if (detectedCountry) {
  api.defaults.headers.common["X-Country"] = detectedCountry;
  api.defaults.headers.common["X-User-Country"] = detectedCountry;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function detectCountryFromGeolocation(): Promise<string | null> {
  if (!("geolocation" in navigator)) return null;

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: GEO_LOOKUP_TIMEOUT_MS,
        maximumAge: 5 * 60 * 1000,
      });
    });

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const reverseUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const response = await fetchWithTimeout(reverseUrl, GEO_LOOKUP_TIMEOUT_MS);
    if (!response.ok) return null;

    const payload = await response.json() as { countryCode?: string };
    const code = String(payload.countryCode || "").trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

async function detectCountryFromIp(): Promise<string | null> {
  try {
    const response = await fetchWithTimeout("https://ipapi.co/country/", GEO_LOOKUP_TIMEOUT_MS);
    if (!response.ok) return null;
    const code = (await response.text()).trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

// Async geo-detect (non-blocking): geolocation first, IP fallback second.
if (typeof window !== "undefined" && !detectedCountry) {
  void (async () => {
    const fromGeolocation = await detectCountryFromGeolocation();
    if (fromGeolocation) {
      setCountryHeader(fromGeolocation);
      return;
    }

    const fromIp = await detectCountryFromIp();
    if (fromIp) {
      setCountryHeader(fromIp);
      return;
    }

    // Deterministic fallback so ranking/filtering always has a country context.
    setCountryHeader("IN");
  })();
}

export { setCountryHeader };

const bootstrapToken = typeof window !== "undefined" ? window.localStorage.getItem("sim_token") : null;
if (bootstrapToken) {
  api.defaults.headers.common.Authorization = `Bearer ${bootstrapToken}`;
}

api.interceptors.request.use(
  (config) => {
    if (shouldTrackRequest(config as LoadingAwareRequestConfig)) {
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
