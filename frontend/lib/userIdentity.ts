type TokenClaims = {
  email?: string;
  userId?: string;
  sub?: string;
};

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return decodeURIComponent(Array.from(window.atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
  }

  const nodeBuffer = (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (outputEncoding: string) => string } } }).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(padded, "base64").toString("utf8");
  }

  return "";
}

export function decodeJwtClaims(token: string | null | undefined): TokenClaims {
  if (!token) return {};

  const parts = token.split(".");
  if (parts.length < 2) return {};

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as TokenClaims;
  } catch {
    return {};
  }
}

function maskIdentifier(value: string): string {
  if (value.length <= 10) {
    return `${value.slice(0, 3)}...${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function resolveUserIdentityLabel(input: {
  username?: string | null;
  token?: string | null;
}): string {
  const username = input.username?.trim();
  if (username) return username;

  const claims = decodeJwtClaims(input.token);
  const email = claims.email?.trim();
  if (email) {
    const localPart = email.split("@")[0]?.trim();
    if (localPart) return localPart;
  }

  const userId = claims.userId?.trim() || claims.sub?.trim();
  if (userId) return maskIdentifier(userId);

  return "Connected";
}