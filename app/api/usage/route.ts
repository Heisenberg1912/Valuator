import { NextResponse } from "next/server";
import { ensureUsageKey, getUsageState, getAuthUser, checkHasPro } from "@/lib/auth";

export async function GET(req: Request) {
  const accessCode = req.headers.get("x-vitruvi-access-code");

  const user = await getAuthUser(req);
  const hasPro = await checkHasPro(req, accessCode);

  const { key } = await ensureUsageKey(req);
  const state = await getUsageState(key);
  const freeRemaining = (state.paid || hasPro) ? Infinity : Math.max(0, 3 - state.freeUsed);

  return NextResponse.json({
    freeUsed: hasPro ? 0 : state.freeUsed,
    freeRemaining,
    paid: state.paid || hasPro,
    hasPro,
    user: user ? {
      name: (user as any).name,
      email: (user as any).email,
      subscription: (user as any).subscription
    } : null
  });
}
