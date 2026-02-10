import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUsageKey, getUsageState, checkHasPro } from "@/lib/auth";
import { generateVisionContent, toInlineData } from "@/lib/gemini";
import { buildAdvancedPrompt } from "@/lib/gemini-tuning";
import { AdvancedResultSchema, BaseResultSchema } from "@/lib/schema";

const Body = z.object({
  imageDataUrl: z.string().min(20),
  base: BaseResultSchema,
  language: z.string().optional()
});

const STAGE_RANGES: Record<string, { min: number; max: number }> = {
  Planning: { min: 0, max: 5 },
  Foundation: { min: 5, max: 20 },
  Structure: { min: 20, max: 55 },
  Services: { min: 55, max: 75 },
  Finishing: { min: 75, max: 95 },
  Completed: { min: 100, max: 100 }
};

function baseIsValid(base: z.infer<typeof BaseResultSchema>) {
  const range = STAGE_RANGES[base.stage_of_construction];
  if (!range) return false;
  if (base.project_status === "completed") return base.progress_percent === 100 && base.timeline.hours_remaining === 0;
  return base.progress_percent >= range.min && base.progress_percent <= range.max;
}

function sanitizeAdvanced(input: any, base: z.infer<typeof BaseResultSchema>) {
  const fallbackSignals = ["Cost", "Pace", "Labor"];
  const geo = base.geo_market_factors;
  const fallbackRecommendations = [
    `Geo-market fit is moderate for ${geo.master_plan_zone}; align approvals and phasing with current policy posture.`,
    `Risk is driven by ${geo.climate_zone.toLowerCase()} and ${geo.terrain.toLowerCase()} conditions, so build contingency into budget and schedule.`
  ];
  const progressOptions = ["Ahead", "On Track", "Delayed"] as const;
  const progress =
    typeof input?.progress_vs_ideal === "string" && progressOptions.includes(input.progress_vs_ideal as any)
      ? input.progress_vs_ideal
      : "On Track";

  const rawDrift = typeof input?.timeline_drift === "string" ? input.timeline_drift : "";
  const driftMatch = rawDrift.match(/[-+]?\d+(?:\.\d+)?%/);
  const drift = driftMatch ? driftMatch[0] : "On Track (±3%)";

  const signals = Array.isArray(input?.cost_risk_signals)
    ? Array.from(
        new Set(
          input.cost_risk_signals
            .map((item: any) => String(item).trim().split(/\s+/).slice(0, 2).join(" "))
            .filter((item: string) => item.length > 0)
        )
      ).slice(0, 5)
    : fallbackSignals;

  const recs = Array.isArray(input?.recommendations)
    ? Array.from(
        new Set(
          input.recommendations
            .map((item: any) => String(item).trim())
            .filter((item: string) => item.length >= 8)
        )
      ).slice(0, 4)
    : fallbackRecommendations;

  return {
    progress_vs_ideal: progress,
    timeline_drift: drift,
    cost_risk_signals: signals.length ? signals : fallbackSignals,
    recommendations: recs.length ? recs : fallbackRecommendations
  };
}

export async function POST(req: Request) {
  // Check for access code in header
  const accessCode = req.headers.get("x-vitruvi-access-code");

  // Check if user has Pro (via subscription or access code)
  const hasPro = await checkHasPro(req, accessCode);

  // If not Pro, enforce free tier limits
  if (!hasPro) {
    const { key } = await ensureUsageKey(req);
    const state = await getUsageState(key);
    if (!state.paid && state.freeUsed >= 3) {
      return NextResponse.json({ error: "PAYWALL", message: "Free limit reached. Please sign in and upgrade." }, { status: 402 });
    }
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  if (!baseIsValid(body.base)) {
    return NextResponse.json({ error: "BASE_INVALID", message: "Base analysis incomplete or out of range." }, { status: 400 });
  }

  const inline = toInlineData(body.imageDataUrl);

  let result;
  try {
    result = await generateVisionContent([
      { text: buildAdvancedPrompt(body.language) + "\n\nBASE_RESULT_JSON:\n" + JSON.stringify(body.base) },
      { inlineData: inline }
    ]);
  } catch (err: any) {
    const fallback = sanitizeAdvanced({}, body.base);
    const advancedParsed = AdvancedResultSchema.safeParse(fallback);
    if (!advancedParsed.success) {
      return NextResponse.json({ error: "MODEL_ERROR", message: err?.message ?? "Model request failed." }, { status: 502 });
    }
    return NextResponse.json({
      advanced: advancedParsed.data,
      warning: "MODEL_FALLBACK_USED",
      message: err?.message ?? "Model request failed."
    });
  }

  const text = result.response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "BAD_MODEL_OUTPUT", raw: text }, { status: 500 });
    json = JSON.parse(m[0]);
  }

  const sanitized = sanitizeAdvanced(json, body.base);
  const advancedParsed = AdvancedResultSchema.safeParse(sanitized);
  if (!advancedParsed.success) {
    return NextResponse.json({ error: "SCHEMA_MISMATCH", raw: json, issues: advancedParsed.error.issues }, { status: 500 });
  }

  return NextResponse.json({ advanced: advancedParsed.data });
}
