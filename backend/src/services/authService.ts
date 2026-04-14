import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { PortfolioModel } from "../models/Portfolio";
import { UserModel } from "../models/User";
import { env } from "../config/env";
import { CONFIG } from "../config/index";
import { AppError } from "../utils/appError";
import { signJwt } from "../utils/jwt";
import { logger } from "../utils/logger";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID || undefined);

export async function registerUser(input: { email: string; password: string; name?: string }) {
  const existing = await UserModel.findOne({ email: input.email }).lean();
  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await UserModel.create({
    email: input.email,
    passwordHash,
    name: input.name ?? input.email.split("@")[0],
  });

  await PortfolioModel.findOneAndUpdate(
    { userId: user._id },
    { $setOnInsert: { userId: user._id, balance: 100000, holdings: [], currency: "USD" } },
    { upsert: true },
  );

  return {
    token: signJwt({ userId: String(user._id), email: user.email }),
    user: { id: String(user._id), email: user.email, name: user.name },
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await UserModel.findOne({ email: input.email });
  if (!user?.passwordHash) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return {
    token: signJwt({ userId: String(user._id), email: user.email }),
    user: { id: String(user._id), email: user.email, name: user.name },
  };
}

// ── helpers ─────────────────────────────────────────────────────────────
function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function googleLogin(input: { idToken?: string; email?: string; name?: string; googleId?: string }) {
  if (!input.idToken) {
    throw new Error("MISSING_GOOGLE_ID_TOKEN");
  }

  const isLocalDev = CONFIG.appEnv === "local" || CONFIG.appEnv === "docker";

  // Decode token BEFORE verification to surface diagnostic info in logs
  const rawPayload = decodeJwtPayloadUnsafe(input.idToken);
  const tokenAud = rawPayload.aud;
  const tokenIss = rawPayload.iss;
  const tokenExp = rawPayload.exp;
  const tokenSub = typeof rawPayload.sub === "string" ? rawPayload.sub.slice(0, 8) + "..." : "(none)";
  const configuredClientId = env.GOOGLE_CLIENT_ID ?? "";
  const tokenPrefix = input.idToken.slice(0, 20);

  console.log("[AUTH] GOOGLE LOGIN ATTEMPT", {
    tokenPrefix,
    tokenAud,
    tokenIss,
    tokenExpReadable: tokenExp ? new Date(Number(tokenExp) * 1000).toISOString() : "(none)",
    tokenSub,
    configuredClientIdSuffix: configuredClientId ? ("..." + configuredClientId.slice(-12)) : "(NOT SET)",
    hasClientId: Boolean(configuredClientId),
    audMatchesClientId: tokenAud === configuredClientId,
    isLocalDev,
    appEnv: CONFIG.appEnv,
  });

  if (!configuredClientId && !isLocalDev) {
    logger.error("google_client_id_not_configured", { appEnv: CONFIG.appEnv });
    throw new Error("GOOGLE_CLIENT_ID_NOT_CONFIGURED");
  }

  let { email, name, googleId } = input;

  try {
    if (!configuredClientId) {
      throw new Error("GOOGLE_CLIENT_ID_EMPTY");
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: configuredClientId,
    });
    const payload = ticket.getPayload();
    googleId = payload?.sub;
    email = payload?.email;
    name = payload?.name;
    console.log("[AUTH] GOOGLE TOKEN VERIFIED OK", { email, hasGoogleId: Boolean(googleId) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[AUTH] GOOGLE TOKEN VERIFICATION FAILED", {
      reason,
      tokenAud,
      configuredClientIdSuffix: configuredClientId ? ("..." + configuredClientId.slice(-12)) : "(NOT SET)",
      audMatchesClientId: tokenAud === configuredClientId,
      tokenExpReadable: tokenExp ? new Date(Number(tokenExp) * 1000).toISOString() : "(none)",
      nowReadable: new Date().toISOString(),
      appEnv: CONFIG.appEnv,
    });
    if (!isLocalDev) {
      logger.error("google_token_verification_failed", {
        appEnv: CONFIG.appEnv,
        reason,
        hasClientId: Boolean(configuredClientId),
        audMatchesClientId: tokenAud === configuredClientId,
      });
      // Wrap as 401 so the client sees "Google token invalid" not a generic 500
      throw new AppError(401, "GOOGLE_TOKEN_INVALID", reason);
    }

    logger.warn("google_token_verification_failed_using_fallback", {
      appEnv: CONFIG.appEnv,
      reason: error instanceof Error ? error.message : String(error),
    });

    const parts = input.idToken.split(".");
    if (parts.length < 2) {
      throw new Error("INVALID_GOOGLE_TOKEN_FORMAT");
    }

    try {
      const payloadRaw = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(payloadRaw) as { sub?: string; email?: string; name?: string };
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
    } catch {
      throw new Error("INVALID_GOOGLE_TOKEN_PAYLOAD");
    }
  }

  if (!email) {
    throw new Error("MISSING_GOOGLE_EMAIL");
  }

  let user = await UserModel.findOne({ email });
  if (!user) {
    user = await UserModel.create({ email, name: name ?? email.split("@")[0], googleId });
  }

  await PortfolioModel.findOneAndUpdate(
    { userId: user._id },
    { $setOnInsert: { userId: user._id, balance: 100000, holdings: [], currency: "USD" } },
    { upsert: true },
  );

  return {
    token: signJwt({ userId: String(user._id), email: user.email }),
    user: { id: String(user._id), email: user.email, name: user.name },
  };
}