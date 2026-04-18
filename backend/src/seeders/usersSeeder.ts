import bcrypt from "bcrypt";
import { UserModel } from "../models/User";

export async function seedUsers(): Promise<{ userId: string }> {
  const email = process.env.DEMO_USER_EMAIL ?? "demo@test.com";
  const demoPass = process.env.DEMO_USER_PASSWORD ?? "demo1234";
  const passwordHash = await bcrypt.hash(demoPass, 10);

  const user = await UserModel.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        passwordHash,
        name: "Demo Trader",
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  return { userId: String(user._id) };
}
