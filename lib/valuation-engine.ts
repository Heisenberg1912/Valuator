import tuning from "@/config/valuation-tuning.json";

interface GeoMarketFactors {
  terrain: string;
  soil_condition: string;
  climate_zone: string;
  population_density: string;
  master_plan_zone: string;
  policy_posture: string;
  policy_focus: string;
  comparable_activity: string;
  comparable_properties_count: number;
  city_growth_5y_percent: number;
  property_growth_percent: number;
  land_growth_percent: number;
  property_age_years: number;
  resale_value_percent: number;
  investment_roi_percent: number;
}

interface CategoryRow {
  Category: string;
  Typology: string;
  Style: string;
  ClimateAdaptability: string;
  Terrain: string;
  SoilType: string;
  MaterialUsed: string;
  InteriorLayout: string;
  RoofType: string;
  Exterior: string;
  AdditionalFeatures: string;
  Sustainability: string;
}

interface AiValuation {
  estimated_property_value_usd: number;
  estimated_land_value_usd: number;
  estimated_built_area_sqm: number;
  estimated_land_area_sqm: number;
  estimated_price_per_sqm_usd: number;
  valuation_reasoning: string;
  location_identified: string;
}

interface ValuationInput {
  projectType: string;
  scale: string;
  status: string;
  stageLabel: string;
  progressValue: number;
  location: string;
  note: string;
  geoStatus: "exif" | "gps" | "manual" | "denied" | "none";
  categoryRow: CategoryRow | null;
  geoFactors?: GeoMarketFactors;
  aiValuation?: AiValuation;
}

interface ValuationResult {
  property: { low: number; high: number };
  land: { low: number; high: number };
  project: { low: number; high: number };
  confidence: number;
  warnings: string[];
  metrics: {
    comparableCount: number;
    cityGrowthPct: number;
    propertyGrowthPct: number;
    landGrowthPct: number;
    propertyAgeYears: number;
    resaleValuePct: number;
    roiPct: number;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function resolveTypologyClass(typology: string): string {
  const lower = typology.toLowerCase().trim();
  const anchors = tuning.typologyAnchorsUsdPerSqm as Record<string, { class: string; base: number; max: number; aliases: string[] }>;
  for (const entry of Object.values(anchors)) {
    if (entry.aliases.some((a: string) => lower.includes(a))) return entry.class;
  }
  return "Residential";
}

function resolveTypologyRates(typology: string): { base: number; max: number } {
  const lower = typology.toLowerCase().trim();
  const anchors = tuning.typologyAnchorsUsdPerSqm as Record<string, { class: string; base: number; max: number; aliases: string[] }>;
  for (const entry of Object.values(anchors)) {
    if (entry.aliases.some((a: string) => lower.includes(a))) return { base: entry.base, max: entry.max };
  }
  const cls = resolveTypologyClass(typology);
  const fallback = (tuning.typologyClassFallbackUsdPerSqm as Record<string, { base: number; max: number }>)[cls];
  return fallback ?? { base: 800, max: 6000 };
}

function densityBand(density: string): "low" | "medium" | "high" {
  const d = density.toLowerCase();
  if (d.includes("high") || d.includes("dense") || d.includes("urban")) return "high";
  if (d.includes("low") || d.includes("rural") || d.includes("sparse")) return "low";
  return "medium";
}

function locationTier(location: string): "ultraPrime" | "prime" | "budget" | "standard" {
  const l = location.toLowerCase();
  if (tuning.locationSignals.ultraPrime.some((s: string) => l.includes(s))) return "ultraPrime";
  if (tuning.locationSignals.prime.some((s: string) => l.includes(s))) return "prime";
  if (tuning.locationSignals.budget.some((s: string) => l.includes(s))) return "budget";
  return "standard";
}

function locationMultiplier(tier: "ultraPrime" | "prime" | "budget" | "standard"): number {
  switch (tier) {
    case "ultraPrime": return 3.5;
    case "prime": return 1.6;
    case "budget": return 0.55;
    default: return 1.0;
  }
}

function spreadForConfidence(conf: number): number {
  for (const band of tuning.spreadByConfidence) {
    if (conf >= band.min) return band.spread;
  }
  return 0.42;
}

export function computeValuation(input: ValuationInput): ValuationResult {
  const {
    projectType,
    scale,
    status,
    stageLabel,
    progressValue,
    location,
    geoStatus,
    categoryRow,
    geoFactors,
    aiValuation
  } = input;

  const warnings: string[] = [];
  const typology = categoryRow?.Typology ?? projectType ?? "Residential";
  const marketClass = resolveTypologyClass(typology);
  const typoRates = resolveTypologyRates(typology);
  const scaleKey = scale || "Low-rise";

  // Metrics from geo factors
  const comparableCount = geoFactors?.comparable_properties_count ?? 0;
  const cityGrowthPct = geoFactors?.city_growth_5y_percent ?? 0;
  const propertyGrowthPct = geoFactors?.property_growth_percent ?? 0;
  const landGrowthPct = geoFactors?.land_growth_percent ?? 0;
  const propertyAgeYears = geoFactors?.property_age_years ?? 0;
  const resaleValuePct = geoFactors?.resale_value_percent ?? 0;
  const roiPct = geoFactors?.investment_roi_percent ?? 0;

  const isCompleted = status === "Completed" || stageLabel === "Completed";
  const completionFactors = tuning.completionByStage as Record<string, number>;
  const completionFactor = completionFactors[stageLabel] ?? (progressValue / 100);

  // --- AI-anchored valuation (primary source when available) ---
  const hasAiValuation = aiValuation &&
    aiValuation.estimated_property_value_usd > 0 &&
    aiValuation.estimated_land_value_usd > 0;

  // --- Table-based valuation (fallback / cross-check) ---
  const areaDefaults = tuning.builtAreaSqmDefaults as Record<string, Record<string, number>>;
  const classDefaults = areaDefaults[marketClass] ?? areaDefaults["Residential"];
  const tableBuiltArea = classDefaults[scaleKey] ?? classDefaults["Low-rise"] ?? 110;
  const builtArea = (hasAiValuation && aiValuation.estimated_built_area_sqm > 0)
    ? aiValuation.estimated_built_area_sqm
    : tableBuiltArea;

  const band = geoFactors ? densityBand(geoFactors.population_density) : "medium";
  const unitRates = (tuning.unitRatesUsdPerSqm as Record<string, Record<string, number>>)[marketClass];
  let unitRate = unitRates ? (unitRates[band] ?? unitRates["medium"] ?? 1100) : 1100;

  // Location adjustments — check user input, AI location_identified, AND geo context
  const locationSources = [location ?? ""];
  if (hasAiValuation) locationSources.push(aiValuation.location_identified);
  if (geoFactors) {
    locationSources.push(geoFactors.terrain, geoFactors.master_plan_zone,
      geoFactors.policy_posture, geoFactors.comparable_activity);
  }
  const combinedLocation = locationSources.join(" ");
  const locTier = locationTier(combinedLocation);
  const locMult = locationMultiplier(locTier);
  unitRate *= locMult;

  const typoMid = (typoRates.base + typoRates.max) / 2;
  unitRate = unitRate * 0.6 + typoMid * 0.4;

  // Table-based gross values
  const tableGrossProperty = builtArea * unitRate;
  const landAreaMult = (tuning.landAreaMultiplierByScale as Record<string, number>)[scaleKey] ?? 1.5;
  const landRateMult = (tuning.landRateMultiplierByType as Record<string, number>)[marketClass] ?? 0.5;
  const landArea = (hasAiValuation && aiValuation.estimated_land_area_sqm > 0)
    ? aiValuation.estimated_land_area_sqm
    : builtArea * landAreaMult;
  const tableGrossLand = landArea * unitRate * landRateMult;

  // Blend AI and table values: AI gets 70% weight when available, table 30%
  let grossPropertyValue: number;
  let grossLandValue: number;
  if (hasAiValuation) {
    grossPropertyValue = aiValuation.estimated_property_value_usd * 0.7 + tableGrossProperty * 0.3;
    grossLandValue = aiValuation.estimated_land_value_usd * 0.7 + tableGrossLand * 0.3;
  } else {
    grossPropertyValue = tableGrossProperty;
    grossLandValue = tableGrossLand;
  }

  // Confidence calculation
  const conf = tuning.confidence;
  let confidence = conf.base;

  // AI valuation boosts confidence
  if (hasAiValuation) {
    confidence += 12;
  }

  if (!location && !hasAiValuation) {
    confidence -= conf.missingLocationPenalty;
    warnings.push("No location provided — wider valuation band.");
  } else if (!location && hasAiValuation) {
    confidence -= Math.round(conf.missingLocationPenalty * 0.3);
  }
  if (geoStatus === "none" || geoStatus === "denied") {
    confidence -= hasAiValuation ? Math.round(conf.missingGpsPenalty * 0.4) : conf.missingGpsPenalty;
  }
  if (comparableCount === 0) {
    confidence -= hasAiValuation ? Math.round(conf.noComparablesPenalty * 0.4) : conf.noComparablesPenalty;
    if (!hasAiValuation) warnings.push("No comparable properties found — estimates are speculative.");
  } else if (comparableCount < tuning.limits.minComparablesForAnchor) {
    confidence -= conf.fewComparablesPenalty;
    warnings.push("Few comparables — valuation band is wider.");
  } else if (comparableCount >= tuning.limits.strongComparables) {
    confidence += conf.strongComparablesBonus;
  }

  if (geoFactors) {
    const terrain = geoFactors.terrain.toLowerCase();
    const soil = geoFactors.soil_condition.toLowerCase();
    const hazardTerms = ["seismic", "flood", "landslide", "erosion", "unstable", "marshy", "soft"];
    const isHighHazard = hazardTerms.some((h) => terrain.includes(h) || soil.includes(h));
    const lowHazardTerms = ["flat", "stable", "firm", "alluvial", "loamy"];
    const isLowHazard = lowHazardTerms.some((h) => terrain.includes(h) || soil.includes(h));

    if (isHighHazard) {
      confidence -= conf.highHazardPenalty;
      warnings.push("High terrain/soil hazard detected — added risk spread.");
    }
    if (isLowHazard) {
      confidence += conf.lowHazardBonus;
    }

    const policy = geoFactors.policy_posture.toLowerCase();
    if (policy.includes("uncertain") || policy.includes("restrictive")) {
      confidence -= conf.policyUncertainPenalty;
    }

    const zone = geoFactors.master_plan_zone.toLowerCase();
    const classLower = marketClass.toLowerCase();
    const zoneMatch = zone.includes(classLower) || zone.includes("mixed") || zone.includes("general");
    if (!zoneMatch && zone !== "not inferred") {
      confidence -= conf.zoneMismatchPenalty;
      warnings.push("Zoning may not align with project type — check master-plan.");
    } else if (zoneMatch) {
      confidence += conf.clearZoneFitBonus;
    }

    if (cityGrowthPct > 5 && propertyGrowthPct > 3) {
      confidence += conf.stableGrowthBonus;
    }
  }

  confidence = clamp(confidence, tuning.limits.minConfidence, tuning.limits.maxConfidence);

  // Spread and haircuts
  let spread = spreadForConfidence(confidence);
  const haircuts = tuning.haircuts;

  if (comparableCount === 0 && !hasAiValuation) {
    spread += haircuts.fallbackNoCompsExtraSpread;
  }
  if (warnings.some((w) => w.toLowerCase().includes("hazard"))) {
    spread += haircuts.hazardExtraSpread;
  }

  const lowSide = haircuts.lowSideExtra;
  const highSide = haircuts.highSideExtra;

  // Property valuation range
  const propertyBase = isCompleted ? grossPropertyValue : grossPropertyValue * completionFactor;
  const propertyLow = Math.max(tuning.limits.minValue, propertyBase * (1 - spread - lowSide));
  const propertyHigh = Math.min(tuning.limits.maxValue, propertyBase * (1 + spread + highSide));

  // Land valuation range
  const landLow = Math.max(tuning.limits.minValue, grossLandValue * (1 - spread - lowSide));
  const landHigh = Math.min(tuning.limits.maxValue, grossLandValue * (1 + spread + highSide));

  // Project valuation (as-is: land + completed portion of property)
  const projectBase = grossLandValue + propertyBase;
  const projectLow = Math.max(tuning.limits.minValue, projectBase * (1 - spread - lowSide));
  const projectHigh = Math.min(tuning.limits.maxValue, projectBase * (1 + spread + highSide));

  return {
    property: { low: Math.round(propertyLow), high: Math.round(propertyHigh) },
    land: { low: Math.round(landLow), high: Math.round(landHigh) },
    project: { low: Math.round(projectLow), high: Math.round(projectHigh) },
    confidence,
    warnings: warnings.slice(0, tuning.limits.maxWarningsForSpread),
    metrics: {
      comparableCount,
      cityGrowthPct,
      propertyGrowthPct,
      landGrowthPct,
      propertyAgeYears,
      resaleValuePct,
      roiPct
    }
  };
}
