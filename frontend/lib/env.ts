const mode = (import.meta.env.MODE ?? "local").toLowerCase();

function getPrefixForMode(currentMode: string): "LOCAL" | "DEV" | "QA" | "PROD" {
  if (currentMode === "production" || currentMode === "prod") return "PROD";
  if (currentMode === "qa" || currentMode === "test") return "QA";
  if (currentMode === "development" || currentMode === "dev") return "DEV";
  return "LOCAL";
}

const envPrefix = getPrefixForMode(mode);

function readProfileVar(key: string, fallback: string): string {
  const vars = import.meta.env as Record<string, string | undefined>;
  return vars[`${envPrefix}_VITE_${key}`]
    ?? vars[`VITE_${envPrefix}_${key}`]
    ?? vars[`VITE_LOCAL_${key}`]
    ?? vars[`LOCAL_VITE_${key}`]
    ?? vars[`VITE_${key}`]
    ?? fallback;
}

export const frontendEnv = {
  API_URL: readProfileVar("API_URL", "http://localhost:4000/api"),
  GOOGLE_CLIENT_ID: readProfileVar("GOOGLE_CLIENT_ID", "519388948862-jgnq690fvh4ipig0ujcagbv671b8uvqh.apps.googleusercontent.com"),
};
