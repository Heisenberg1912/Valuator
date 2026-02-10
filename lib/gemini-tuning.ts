import fs from "node:fs";
import path from "node:path";

type BaseMeta = {
  location?: string;
  projectType?: string;
  scale?: string;
  constructionType?: string;
  note?: string;
  language?: string;
};

type PromptTuning = {
  basePersona: string;
  advancedPersona: string;
  baseFocus: string[];
  advancedFocus: string[];
};

const PROMPT_TUNING_PATH = path.resolve(process.cwd(), "config", "prompt-tuning.json");

const DEFAULT_TUNING: PromptTuning = {
  basePersona:
    "You are a HIGH END, DATA-CORRECT, PERFECTION-ORIENTED real estate valuation and construction analysis firm with global operations.",
  advancedPersona:
    "You are a HIGH END, DATA-CORRECT, PERFECTION-ORIENTED real estate valuation and construction risk firm with global operations.",
  baseFocus: [
    "Use geography-first reasoning with terrain, soil, climate, and city context.",
    "Estimate growth, comparables, and policy posture conservatively.",
    "Keep outputs decision-ready for valuation and risk review."
  ],
  advancedFocus: [
    "Risk analysis must reference geography, market growth, zoning, and policy posture.",
    "Keep recommendations specific and execution-ready."
  ]
};

function readPromptTuning(): PromptTuning {
  try {
    const raw = fs.readFileSync(PROMPT_TUNING_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<PromptTuning>;
    return {
      basePersona: typeof parsed.basePersona === "string" && parsed.basePersona.trim() ? parsed.basePersona : DEFAULT_TUNING.basePersona,
      advancedPersona:
        typeof parsed.advancedPersona === "string" && parsed.advancedPersona.trim()
          ? parsed.advancedPersona
          : DEFAULT_TUNING.advancedPersona,
      baseFocus:
        Array.isArray(parsed.baseFocus) && parsed.baseFocus.every((item) => typeof item === "string")
          ? parsed.baseFocus
          : DEFAULT_TUNING.baseFocus,
      advancedFocus:
        Array.isArray(parsed.advancedFocus) && parsed.advancedFocus.every((item) => typeof item === "string")
          ? parsed.advancedFocus
          : DEFAULT_TUNING.advancedFocus
    };
  } catch {
    return DEFAULT_TUNING;
  }
}

export const GEMINI_TUNING = {
  baseSchema: `{
  "project_status": "under_construction" | "completed",
  "stage_of_construction": "Planning" | "Foundation" | "Structure" | "Services" | "Finishing" | "Completed",
  "progress_percent": number (0-100),
  "timeline": {
    "hours_remaining": number,
    "manpower_hours": number,
    "machinery_hours": number
  },
  "category_matrix": {
    "Category": string,
    "Typology": string,
    "Style": string,
    "ClimateAdaptability": string,
    "Terrain": string,
    "SoilType": string,
    "MaterialUsed": string,
    "InteriorLayout": string,
    "RoofType": string,
    "Exterior": string,
    "AdditionalFeatures": string,
    "Sustainability": string
  },
  "scope": {
    "stages_completed": string[],
    "stages_left": string[],
    "dependencies": string[]
  },
  "geo_market_factors": {
    "terrain": string,
    "soil_condition": string,
    "climate_zone": string,
    "population_density": string,
    "master_plan_zone": string,
    "policy_posture": string,
    "policy_focus": string,
    "comparable_activity": string,
    "comparable_properties_count": number,
    "city_growth_5y_percent": number,
    "property_growth_percent": number,
    "land_growth_percent": number,
    "property_age_years": number,
    "resale_value_percent": number,
    "investment_roi_percent": number
  },
  "notes": string[]
}`,
  baseRules: [
    "Stage must be one of: Planning, Foundation, Structure, Services, Finishing, Completed.",
    "Progress must align with stage range: Planning 0-5, Foundation 5-20, Structure 20-55, Services 55-75, Finishing 75-95, Completed 100.",
    "If completed: stage_of_construction must be 'Completed', progress_percent = 100, hours_remaining = 0.",
    "If under_construction: hours_remaining, manpower_hours, machinery_hours must be > 0. Never output all zeros.",
    "category_matrix fields must be populated with realistic, consumer-friendly terms derived from the image context.",
    "geo_market_factors must include practical, local-context estimates derived from location clues and project type.",
    "policy_posture and policy_focus must describe local governance bias in plain English (for example: pro-industry, pro-commerce, pro-institutions, pro-residential, mixed).",
    "comparable_properties_count must be a realistic count of similar active/sold references in the area.",
    "city_growth_5y_percent, property_growth_percent, land_growth_percent, resale_value_percent, investment_roi_percent must be realistic percentages.",
    "property_age_years should be inferred conservatively from visible condition and typology.",
    "Arrays must contain only the allowed stage values, max 5 items each, no duplicates.",
    "Use conservative, plausible estimates. Put assumptions in notes."
  ],
  advancedSchema: `{
  "progress_vs_ideal": "Ahead" | "On Track" | "Delayed",
  "timeline_drift": string,
  "cost_risk_signals": string[],
  "recommendations": string[]
}`,
  advancedRules: [
    "Keep it practical, contractor-grade, and consumer-readable.",
    "Call out risks and gaps in plain language. Avoid jargon.",
    "Prefer real-world site impacts (terrain access, climate delays, zoning approvals, labor availability, supply delays).",
    "timeline_drift must be '+12%' or '-8%' OR 'On Track (±3%)'.",
    "cost_risk_signals: max 5, 1-2 words each, no duplicates, human phrasing.",
    "recommendations: sentence-based insights, 1 sentence each, max 4, no bullets, no duplicates.",
    "Each recommendation must reference stage, pace, dependency, or geo-market context in concrete terms."
  ]
};

export function buildBasePrompt(meta: BaseMeta) {
  const tuning = readPromptTuning();
  return `
${tuning.basePersona}
You analyze a site photo (or project photo) and produce strict, engineering-grade outputs.
First decide if the project is "under_construction" or "completed".
Then output ONLY valid JSON matching this exact schema:

${GEMINI_TUNING.baseSchema}

Priority focus:
- ${tuning.baseFocus.join("\n- ")}

Rules:
- ${GEMINI_TUNING.baseRules.join("\n- ")}
- Use the provided metadata if useful:
  location: ${meta.location ?? "unknown"}
  projectType: ${meta.projectType ?? "unknown"}
  scale: ${meta.scale ?? "unknown"}
  constructionType: ${meta.constructionType ?? "unknown"}
  note: ${meta.note ?? "none"}
  language: ${meta.language ?? "English"}
Return JSON only. No markdown. No commentary.
`.trim();
}

export function buildAdvancedPrompt(language?: string) {
  const tuning = readPromptTuning();
  return `
${tuning.advancedPersona}
You are an expert construction deviation analyst producing AEC-grade outputs.
You will be given:
1) a site photo (or project photo)
2) a previous base analysis result (JSON)

You must output ONLY valid JSON matching this exact schema:
${GEMINI_TUNING.advancedSchema}

Priority focus:
- ${tuning.advancedFocus.join("\n- ")}

Rules:
- ${GEMINI_TUNING.advancedRules.join("\n- ")}
- Output language: ${language ?? "English"}.
Return JSON only. No markdown. No commentary.
`.trim();
}
