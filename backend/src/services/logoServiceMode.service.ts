import { env } from "../config/env";
import { logger } from "../utils/logger";

export type LogoServiceMode = "local" | "remote" | "disabled";

function normalizeLogoMode(raw: string): LogoServiceMode {
  const mode = raw.toLowerCase();
  if (mode === "local" || mode === "remote" || mode === "disabled") {
    return mode;
  }
  return env.APP_ENV === "local" ? "remote" : "local";
}

export function getLogoServiceMode(): LogoServiceMode {
  if (!env.LOGO_SERVICE_ENABLED) {
    return "disabled";
  }
  return normalizeLogoMode(env.LOGO_SERVICE_MODE);
}

export function isLogoQueueModeEnabled(): boolean {
  return getLogoServiceMode() === "local";
}

export function getLogoServiceUrl(): string {
  return env.LOGO_SERVICE_URL.trim();
}

export async function getLogoServiceHealthStatus(): Promise<{
  mode: LogoServiceMode;
  enabled: boolean;
  reachable: boolean | null;
  degraded: boolean;
  reason: string | null;
  url: string | null;
}> {
  const mode = getLogoServiceMode();
  const url = getLogoServiceUrl();

  if (mode === "disabled") {
    return {
      mode,
      enabled: false,
      reachable: null,
      degraded: true,
      reason: "disabled_by_mode_or_flag",
      url: null,
    };
  }

  if (mode === "local") {
    return {
      mode,
      enabled: true,
      reachable: null,
      degraded: false,
      reason: null,
      url: null,
    };
  }

  if (!url) {
    return {
      mode,
      enabled: true,
      reachable: false,
      degraded: true,
      reason: "remote_url_missing",
      url: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const target = `${url.replace(/\/$/, "")}/health`;
    const response = await fetch(target, { method: "GET", signal: controller.signal });
    return {
      mode,
      enabled: true,
      reachable: response.ok,
      degraded: !response.ok,
      reason: response.ok ? null : `remote_http_${response.status}`,
      url,
    };
  } catch (error) {
    logger.warn("logo_service_remote_health_unreachable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      mode,
      enabled: true,
      reachable: false,
      degraded: true,
      reason: "remote_unreachable",
      url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function reportMissingLogoToRemote(payload: {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: string;
  country: string;
  fallbackType: string;
}): Promise<boolean> {
  if (getLogoServiceMode() !== "remote") {
    return false;
  }

  const url = getLogoServiceUrl();
  if (!url) {
    logger.warn("logo_service_remote_report_skipped", { reason: "missing_url" });
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const target = `${url.replace(/\/$/, "")}/api/symbols/missing-logo`;
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok && response.status !== 204) {
      logger.warn("logo_service_remote_report_failed", {
        status: response.status,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.warn("logo_service_remote_report_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
