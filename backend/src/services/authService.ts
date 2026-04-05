import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { PortfolioModel } from "../models/Portfolio";
import { UserModel } from "../models/User";
import { env } from "../config/env";
import { signJwt } from "../utils/jwt";

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

export async function googleLogin(input: { idToken?: string; email?: string; name?: string; googleId?: string }) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID_NOT_CONFIGURED");
  }

  if (!input.idToken) {
    throw new Error("MISSING_GOOGLE_ID_TOKEN");
  }

  let { email, name, googleId } = input;

  const ticket = await googleClient.verifyIdToken({
    idToken: input.idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  googleId = payload?.sub;
  email = payload?.email;
  name = payload?.name;

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
