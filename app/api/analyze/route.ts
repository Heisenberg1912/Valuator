import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUsageKey, getUsageState, incrementFreeUse, checkHasPro } from "@/lib/auth";
import { generateVisionContent, toInlineData } from "@/lib/gemini";
import { buildBasePrompt } from "@/lib/gemini-tuning";
import { BaseResultSchema } from "@/lib/schema";
import { CATEGORY_ROWS } from "@/lib/category-data";

const Body = z.object({
  imageDataUrl: z.string().min(20),
  meta: z
    .object({
      location: z.string().optional(),
      projectType: z.string().optional(),
      scale: z.string().optional(),
      constructionType: z.string().optional(),
      note: z.string().optional(),
      language: z.string().optional()
    })
    .default({})
});

const STAGES = ["Planning", "Foundation", "Structure", "Services", "Finishing", "Completed"] as const;
const STAGE_RANGES: Record<(typeof STAGES)[number], { min: number; max: number }> = {
  Planning: { min: 0, max: 5 },
  Foundation: { min: 5, max: 20 },
  Structure: { min: 20, max: 55 },
  Services: { min: 55, max: 75 },
  Finishing: { min: 75, max: 95 },
  Completed: { min: 100, max: 100 }
};

function normalizeStage(value: unknown): (typeof STAGES)[number] {
  if (typeof value !== "string") return "Planning";
  const v = value.toLowerCase();
  if (v.includes("plan")) return "Planning";
  if (v.includes("found")) return "Foundation";
  if (v.includes("struct") || v.includes("frame")) return "Structure";
  if (v.includes("service") || v.includes("mep") || v.includes("electric") || v.includes("plumb")) return "Services";
  if (v.includes("finish") || v.includes("interior") || v.includes("paint")) return "Finishing";
  if (v.includes("complete")) return "Completed";
  return "Structure";
}

function clampProgress(stage: (typeof STAGES)[number], value: number) {
  const range = STAGE_RANGES[stage];
  return Math.min(range.max, Math.max(range.min, value));
}

function uniqStages(value: unknown) {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((item) => normalizeStage(item))
    .filter((item) => item !== "Completed");
  return Array.from(new Set(cleaned)).slice(0, 5);
}

function sanitizeBase(
  input: any,
  meta?: {
    location?: string;
    projectType?: string;
    scale?: string;
    constructionType?: string;
    note?: string;
  }
) {
  if (!input || typeof input !== "object") return input;
  const metaProjectType = meta?.projectType;
  const status = input.project_status === "completed" ? "completed" : "under_construction";
  let stage = normalizeStage(input.stage_of_construction);
  let progress = Number.isFinite(input.progress_percent) ? Number(input.progress_percent) : 0;

  if (status === "completed") {
    stage = "Completed";
    progress = 100;
  } else if (stage === "Completed" && progress < 100) {
    stage = "Finishing";
  }

  progress = clampProgress(stage, progress);

  const timeline = input.timeline ?? {};
  let hoursRemaining = status === "completed" ? 0 : Math.max(0, Number(timeline.hours_remaining) || 0);
  let manpowerHours = Math.max(0, Number(timeline.manpower_hours) || 0);
  let machineryHours = Math.max(0, Number(timeline.machinery_hours) || 0);

  if (status !== "completed") {
    const stageDefaults: Record<(typeof STAGES)[number], number> = {
      Planning: 300,
      Foundation: 900,
      Structure: 1500,
      Services: 800,
      Finishing: 600,
      Completed: 0
    };
    if (hoursRemaining === 0 && manpowerHours === 0 && machineryHours === 0) {
      const fallback = stageDefaults[stage] || 600;
      hoursRemaining = fallback;
      manpowerHours = Math.round(fallback * 0.65);
      machineryHours = Math.round(fallback * 0.35);
    } else if (hoursRemaining > 0 && manpowerHours === 0 && machineryHours === 0) {
      manpowerHours = Math.round(hoursRemaining * 0.65);
      machineryHours = Math.round(hoursRemaining * 0.35);
    }
  }

  const cleanField = (value: unknown, fallback: string) => {
    if (typeof value === "string" && value.trim().length) return value.trim();
    return fallback;
  };
  const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  const matrix = input.category_matrix ?? {};
  const findRow = () => {
    const typology = typeof matrix.Typology === "string" ? matrix.Typology.toLowerCase() : "";
    const category = typeof matrix.Category === "string" ? matrix.Category.toLowerCase() : "";
    let match = CATEGORY_ROWS.find((row: (typeof CATEGORY_ROWS)[number]) => row.Typology.toLowerCase() === typology);
    if (!match && category) {
      match = CATEGORY_ROWS.find((row: (typeof CATEGORY_ROWS)[number]) => row.Category.toLowerCase() === category);
    }
    if (!match && metaProjectType) {
      const fallbackCategory = metaProjectType.toLowerCase();
      match = CATEGORY_ROWS.find((row: (typeof CATEGORY_ROWS)[number]) =>
        row.Category.toLowerCase().includes(fallbackCategory)
      );
    }
    return match ?? CATEGORY_ROWS[0];
  };
  const datasetRow = findRow();
  const geo = input.geo_market_factors ?? {};
  const projectTypeLower = String(metaProjectType ?? matrix.Category ?? "residential").toLowerCase();
  const locationLower = String(meta?.location ?? "").toLowerCase();
  const defaultDensity = locationLower.includes("metro") || locationLower.includes("city")
    ? "High"
    : locationLower.includes("rural") || locationLower.includes("village")
      ? "Low"
      : "Medium";
  const defaultMasterPlanZone =
    projectTypeLower.includes("industrial")
      ? "Industrial / Logistics Zone"
      : projectTypeLower.includes("commercial")
        ? "Commercial Business Zone"
        : projectTypeLower.includes("infrastructure")
          ? "Infrastructure Corridor"
          : projectTypeLower.includes("mixed")
            ? "Mixed-use Growth Zone"
            : "Residential / Mixed Residential Zone";
  const defaultPolicyPosture =
    projectTypeLower.includes("industrial")
      ? "Pro-industry"
      : projectTypeLower.includes("commercial")
        ? "Pro-commerce"
        : projectTypeLower.includes("infrastructure")
          ? "Pro-infrastructure"
          : projectTypeLower.includes("institution")
            ? "Pro-institutions"
            : "Pro-residential";
  const defaultPolicyFocus =
    projectTypeLower.includes("industrial")
      ? "Manufacturing and logistics expansion"
      : projectTypeLower.includes("commercial")
        ? "Retail, office, and employment density"
        : projectTypeLower.includes("infrastructure")
          ? "Transport and utility upgrades"
          : projectTypeLower.includes("mixed")
            ? "Balanced mixed-use growth"
            : "Housing-led urban expansion";
  const defaultCityGrowth = clampNumber(geo.city_growth_5y_percent, 18, -20, 120);
  const defaultPropertyGrowth = clampNumber(geo.property_growth_percent, defaultCityGrowth * 0.8, -20, 120);
  const defaultLandGrowth = clampNumber(geo.land_growth_percent, defaultPropertyGrowth + 3, -20, 140);
  const defaultAgeYears = clampNumber(
    geo.property_age_years,
    status === "completed" ? 6 : Math.max(1, Math.round((100 - progress) / 18)),
    0,
    200
  );
  const defaultResale = clampNumber(
    geo.resale_value_percent,
    100 + defaultPropertyGrowth * 0.45 - defaultAgeYears * 0.6,
    0,
    220
  );
  const defaultRoi = clampNumber(
    geo.investment_roi_percent,
    defaultPropertyGrowth * 0.6 + defaultLandGrowth * 0.35 - defaultAgeYears * 0.12,
    -50,
    120
  );
  const defaultComparableActivity =
    projectTypeLower.includes("industrial")
      ? "Moderate industrial transaction activity"
      : projectTypeLower.includes("commercial")
        ? "High commercial inventory churn"
        : "Moderate residential comparable activity";
  const defaultComparableCount = clampNumber(
    geo.comparable_properties_count,
    defaultDensity === "High" ? 42 : defaultDensity === "Low" ? 11 : 24,
    0,
    5000
  );

  return {
    project_status: status,
    stage_of_construction: stage,
    progress_percent: progress,
    timeline: {
      hours_remaining: hoursRemaining,
      manpower_hours: manpowerHours,
      machinery_hours: machineryHours
    },
    category_matrix: {
      Category: cleanField(matrix.Category, datasetRow.Category),
      Typology: cleanField(matrix.Typology, datasetRow.Typology),
      Style: cleanField(matrix.Style, datasetRow.Style),
      ClimateAdaptability: cleanField(matrix.ClimateAdaptability, datasetRow.ClimateAdaptability),
      Terrain: cleanField(matrix.Terrain, datasetRow.Terrain),
      SoilType: cleanField(matrix.SoilType, datasetRow.SoilType),
      MaterialUsed: cleanField(matrix.MaterialUsed, datasetRow.MaterialUsed),
      InteriorLayout: cleanField(matrix.InteriorLayout, datasetRow.InteriorLayout),
      RoofType: cleanField(matrix.RoofType, datasetRow.RoofType),
      Exterior: cleanField(matrix.Exterior, datasetRow.Exterior),
      AdditionalFeatures: cleanField(matrix.AdditionalFeatures, datasetRow.AdditionalFeatures),
      Sustainability: cleanField(matrix.Sustainability, datasetRow.Sustainability)
    },
    scope: {
      stages_completed: uniqStages(input.scope?.stages_completed),
      stages_left: uniqStages(input.scope?.stages_left),
      dependencies: uniqStages(input.scope?.dependencies)
    },
    geo_market_factors: {
      terrain: cleanField(geo.terrain, cleanField(matrix.Terrain, datasetRow.Terrain)),
      soil_condition: cleanField(geo.soil_condition, cleanField(matrix.SoilType, datasetRow.SoilType)),
      climate_zone: cleanField(geo.climate_zone, cleanField(matrix.ClimateAdaptability, datasetRow.ClimateAdaptability)),
      population_density: cleanField(geo.population_density, defaultDensity),
      master_plan_zone: cleanField(geo.master_plan_zone, defaultMasterPlanZone),
      policy_posture: cleanField(geo.policy_posture, defaultPolicyPosture),
      policy_focus: cleanField(geo.policy_focus, defaultPolicyFocus),
      comparable_activity: cleanField(geo.comparable_activity, defaultComparableActivity),
      comparable_properties_count: defaultComparableCount,
      city_growth_5y_percent: defaultCityGrowth,
      property_growth_percent: defaultPropertyGrowth,
      land_growth_percent: defaultLandGrowth,
      property_age_years: defaultAgeYears,
      resale_value_percent: defaultResale,
      investment_roi_percent: defaultRoi
    },
    ai_valuation: input.ai_valuation && typeof input.ai_valuation === "object"
      ? {
          estimated_property_value_usd: Math.max(0, Number(input.ai_valuation.estimated_property_value_usd) || 0),
          estimated_land_value_usd: Math.max(0, Number(input.ai_valuation.estimated_land_value_usd) || 0),
          estimated_built_area_sqm: Math.max(0, Number(input.ai_valuation.estimated_built_area_sqm) || 0),
          estimated_land_area_sqm: Math.max(0, Number(input.ai_valuation.estimated_land_area_sqm) || 0),
          estimated_price_per_sqm_usd: Math.max(0, Number(input.ai_valuation.estimated_price_per_sqm_usd) || 0),
          valuation_reasoning: typeof input.ai_valuation.valuation_reasoning === "string" ? input.ai_valuation.valuation_reasoning : "AI estimate",
          location_identified: typeof input.ai_valuation.location_identified === "string" ? input.ai_valuation.location_identified : "Unknown"
        }
      : undefined,
    famous_building: input.famous_building && typeof input.famous_building === "object" && input.famous_building.is_famous === true
      ? {
          is_famous: true,
          name: typeof input.famous_building.name === "string" ? input.famous_building.name : undefined,
          city: typeof input.famous_building.city === "string" ? input.famous_building.city : undefined,
          country: typeof input.famous_building.country === "string" ? input.famous_building.country : undefined,
          year_built: typeof input.famous_building.year_built === "string" ? input.famous_building.year_built : undefined,
          architect: typeof input.famous_building.architect === "string" ? input.famous_building.architect : undefined,
          significance: typeof input.famous_building.significance === "string" ? input.famous_building.significance : undefined
        }
      : undefined,
    notes: Array.isArray(input.notes) ? input.notes.slice(0, 4) : []
  };
}

function buildFallbackBase(meta?: {
  location?: string;
  projectType?: string;
  scale?: string;
  constructionType?: string;
  note?: string;
}) {
  const fallbackInput = {
    project_status: "under_construction",
    stage_of_construction: "Structure",
    progress_percent: 42,
    timeline: {
      hours_remaining: 860,
      manpower_hours: 560,
      machinery_hours: 300
    },
    category_matrix: {
      Category: meta?.projectType ?? "Residential",
      Typology: "",
      Style: "Context inferred",
      ClimateAdaptability: "Moderate",
      Terrain: "Mixed urban terrain",
      SoilType: "Medium bearing",
      MaterialUsed: meta?.constructionType ?? "RCC",
      InteriorLayout: "Standardized",
      RoofType: "Flat",
      Exterior: "Context inferred",
      AdditionalFeatures: meta?.note ?? "",
      Sustainability: "Baseline efficiency"
    },
    scope: {
      stages_completed: ["Planning", "Foundation"],
      stages_left: ["Services", "Finishing"],
      dependencies: ["Approvals", "Supply chain"]
    },
    geo_market_factors: {
      terrain: "Mixed urban terrain",
      soil_condition: "Medium bearing capacity",
      climate_zone: "Tropical / Subtropical",
      population_density: "Medium",
      master_plan_zone: "",
      policy_posture: "",
      policy_focus: "",
      comparable_activity: "Moderate",
      comparable_properties_count: 22,
      city_growth_5y_percent: 11,
      property_growth_percent: 9,
      land_growth_percent: 10,
      property_age_years: 8,
      resale_value_percent: 102,
      investment_roi_percent: 8.5
    },
    notes: ["Fallback analysis used because Gemini request was unavailable."]
  };
  return sanitizeBase(fallbackInput, meta);
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
  const inline = toInlineData(body.imageDataUrl);

  let result;
  try {
    result = await generateVisionContent([{ text: buildBasePrompt(body.meta) }, { inlineData: inline }]);
  } catch (err: any) {
    const fallbackBase = buildFallbackBase(body.meta);
    const fallbackParsed = BaseResultSchema.safeParse(fallbackBase);
    if (!fallbackParsed.success) {
      return NextResponse.json({ error: "MODEL_ERROR", message: err?.message ?? "Model request failed." }, { status: 502 });
    }
    if (!hasPro) {
      const { key } = await ensureUsageKey(req);
      const state = await getUsageState(key);
      if (!state.paid) await incrementFreeUse(key);
      const nextState = await getUsageState(key);
      const freeRemaining = nextState.paid ? Infinity : Math.max(0, 3 - nextState.freeUsed);
      return NextResponse.json({
        base: fallbackParsed.data,
        usage: { freeUsed: nextState.freeUsed, freeRemaining, paid: nextState.paid, hasPro: false },
        warning: "MODEL_FALLBACK_USED",
        message: err?.message ?? "Model request failed."
      });
    }
    return NextResponse.json({
      base: fallbackParsed.data,
      usage: { freeUsed: 0, freeRemaining: Infinity, paid: true, hasPro: true },
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

  const sanitized = sanitizeBase(json, body.meta);
  const baseParsed = BaseResultSchema.safeParse(sanitized);
  if (!baseParsed.success) {
    return NextResponse.json({ error: "SCHEMA_MISMATCH", raw: json, issues: baseParsed.error.issues }, { status: 500 });
  }

  // Track usage only for non-Pro users
  if (!hasPro) {
    const { key } = await ensureUsageKey(req);
    const state = await getUsageState(key);
    if (!state.paid) await incrementFreeUse(key);
    const nextState = await getUsageState(key);
    const freeRemaining = nextState.paid ? Infinity : Math.max(0, 3 - nextState.freeUsed);
    return NextResponse.json({ base: baseParsed.data, usage: { freeUsed: nextState.freeUsed, freeRemaining, paid: nextState.paid, hasPro: false } });
  }

  // Pro user - unlimited usage
  return NextResponse.json({ base: baseParsed.data, usage: { freeUsed: 0, freeRemaining: Infinity, paid: true, hasPro: true } });
}
