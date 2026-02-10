import { NextResponse } from "next/server";

let cache: { base: string; rates: Record<string, number>; updatedAt: number; fetchedAt: number } | null = null;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") || "USD").toUpperCase();
  const now = Date.now();

  if (cache && cache.base === base && now - cache.fetchedAt < 6 * 60 * 60 * 1000) {
    return NextResponse.json({ base: cache.base, rates: cache.rates, updatedAt: cache.updatedAt });
  }

  const url = `https://open.er-api.com/v6/latest/${base}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "RATE_FETCH_FAILED" }, { status: 502 });
  }
  const data = await res.json();
  if (data?.result !== "success" || !data?.rates) {
    return NextResponse.json({ error: "RATE_BAD_RESPONSE" }, { status: 502 });
  }

  cache = {
    base,
    rates: data.rates,
    updatedAt: data.time_last_update_unix ? data.time_last_update_unix * 1000 : now,
    fetchedAt: now
  };

  return NextResponse.json({ base: cache.base, rates: cache.rates, updatedAt: cache.updatedAt });
}
