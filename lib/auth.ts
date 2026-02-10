import jwt from "jsonwebtoken";
import crypto from "crypto";
import { cookies } from "next/headers";
import { dbConnect } from "./mongo";
import { Usage, User } from "./models";
import { isValidAccessCode } from "./access-codes";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set!");
  return secret;
}

/* ── JWT token generation (matches prod_vitruviai) ── */
export function generateToken(user: any): string {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN as any }
  );
}

/* ── Extract user from Authorization: Bearer header ── */
export async function getAuthUser(req: Request): Promise<any | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    await dbConnect();
    const user = await User.findById(decoded.userId);
    if (!user || !(user as any).isActive) return null;
    return user;
  } catch {
    return null;
  }
}

/* ── Device-based usage key (fallback for unauthenticated users) ── */
export async function ensureUsageKey(req: Request): Promise<{ key: string; email: string | null }> {
  const user = await getAuthUser(req);
  if (user) return { key: (user as any).email, email: (user as any).email };

  const jar = cookies();
  let device = jar.get("va_device")?.value;
  if (!device) {
    device = crypto.randomBytes(16).toString("hex");
    jar.set("va_device", device, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return { key: `device:${device}`, email: null };
}

type UsageRow = { key: string; freeUsed: number; paid: boolean };

export async function getUsageState(key: string) {
  await dbConnect();
  const row = await Usage.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, freeUsed: 0, paid: false } },
    { upsert: true, new: true }
  ).lean<UsageRow>();
  return row ?? { key, freeUsed: 0, paid: false };
}

export async function incrementFreeUse(key: string) {
  await dbConnect();
  const row = await Usage.findOneAndUpdate({ key }, { $inc: { freeUsed: 1 } }, { new: true }).lean<UsageRow>();
  return row ?? { key, freeUsed: 0, paid: false };
}

/* ── Pro tier check (access code OR subscription — same as prod_vitruviai) ── */
export async function checkHasPro(req: Request, accessCode?: string | null): Promise<boolean> {
  if (isValidAccessCode(accessCode)) return true;

  const user = await getAuthUser(req);
  if (!user) return false;

  const sub = (user as any).subscription;
  if (!sub) return false;

  const isPro = sub.plan === "pro";
  const isActive = sub.status === "active";
  const notExpired = !sub.endDate || new Date(sub.endDate) > new Date();

  return isPro && isActive && notExpired;
}
