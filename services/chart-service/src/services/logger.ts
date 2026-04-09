type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, payload: Record<string, unknown> = {}): void {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    service: "chart-service",
    message,
    ...payload,
  };

  if (level === "error") {
    console.error(JSON.stringify(line));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(line));
    return;
  }

  console.log(JSON.stringify(line));
}

export function logInfo(message: string, payload: Record<string, unknown> = {}): void {
  log("info", message, payload);
}

export function logWarn(message: string, payload: Record<string, unknown> = {}): void {
  log("warn", message, payload);
}

export function logError(message: string, payload: Record<string, unknown> = {}): void {
  log("error", message, payload);
}
