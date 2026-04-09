"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthModal } from "@/components/AuthModal";
import valuationTuning from "@/config/valuation-tuning.json";
import { CITY_SUGGESTIONS } from "@/lib/cities";
import { computeValuation } from "@/lib/valuation-engine";

type StageLabel = "Planning" | "Foundation" | "Structure" | "Services" | "Finishing" | "Completed";

type BaseResult = {
  project_status: "under_construction" | "completed";
  stage_of_construction: StageLabel;
  progress_percent: number;
  timeline: { hours_remaining: number; manpower_hours: number; machinery_hours: number };
  category_matrix: {
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
  };
  scope: { stages_completed: string[]; stages_left: string[]; dependencies: string[] };
  geo_market_factors: {
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
  };
  ai_valuation?: {
    estimated_property_value_usd: number;
    estimated_land_value_usd: number;
    estimated_built_area_sqm: number;
    estimated_land_area_sqm: number;
    estimated_price_per_sqm_usd: number;
    valuation_reasoning: string;
    location_identified: string;
  } | null;
  famous_building?: {
    is_famous: boolean;
    name?: string;
    city?: string;
    country?: string;
    year_built?: string;
    architect?: string;
    significance?: string;
  } | null;
  notes: string[];
};

type AdvancedResult = {
  progress_vs_ideal: "Ahead" | "On Track" | "Delayed";
  timeline_drift: string;
  cost_risk_signals: string[];
  recommendations: string[];
};

type Lang = "EN" | "HI" | "ES" | "FR" | "DE" | "TA" | "TE" | "KN" | "ML" | "MR" | "GU" | "PA" | "ZH" | "JA";

type Currency =
  | "USD"
  | "INR"
  | "AED"
  | "EUR"
  | "GBP"
  | "SGD"
  | "AUD"
  | "CAD"
  | "NZD"
  | "CHF"
  | "SEK"
  | "NOK"
  | "DKK"
  | "ZAR"
  | "JPY"
  | "CNY"
  | "HKD"
  | "SAR"
  | "QAR"
  | "KRW"
  | "THB"
  | "MYR"
  | "IDR"
  | "PHP"
  | "BRL"
  | "MXN"
  | "PLN"
  | "CZK"
  | "TRY";

const STAGE_RANGES = [
  { label: "Planning", min: 0, max: 5 },
  { label: "Foundation", min: 5, max: 20 },
  { label: "Structure", min: 20, max: 55 },
  { label: "Services", min: 55, max: 75 },
  { label: "Finishing", min: 75, max: 95 },
  { label: "Completed", min: 100, max: 100 }
] as const;

const LANGUAGE_LABELS: Record<Lang, Record<string, string>> = {
  EN: {
    title: "Valuator by Builtattic",
    subtitle: "Valuation Analysis",
    engine: "Powered by VitruviAI",
    capture: "Capture + Ingest",
    inputWindow: "Input Window",
    constructionProgress: "Construction Progress",
    executionEstimation: "Execution Estimation",
    resources: "Resources",
    stagesLeft: "Stages Left",
    singleUse: "Single Use",
    stored: "Stored",
    valuationInsights: "Valuation + Insights",
    signals: "Signals",
    progressVsIdeal: "Progress vs Ideal",
    timelineDrift: "Timeline Drift",
    insights: "Insights",
    riskReveal: "Risk Reveal",
    revealRisks: "Reveal Risks",
    assumptions: "Assumptions",
    photoEstimate: "Photo-based estimation only.",
    indicative: "Indicative outputs. Validate on-site.",
    projectType: "Project Type",
    scale: "Scale",
    constructionType: "Construction Type",
    location: "Location",
    notes: "Notes",
    useGps: "Use GPS",
    browse: "Browse",
    live: "Live",
    analyze: "Analyze",
    status: "Status",
    stage: "Stage",
    progress: "Progress",
    manpower: "Manpower",
    machinery: "Machinery",
    used: "Used",
    remaining: "Remaining",
    confidence: "Confidence",
    budgetLeft: "Budget Left",
    budgetUsed: "Budget Used",
    landVal: "Land Val",
    projectVal: "Project Val",
    propertyVal: "Property Valuation",
    awaitingBase: "Awaiting base analysis",
    runRiskReveal: "Run risk reveal to unlock",
    pending: "Pending",
    notAnalyzed: "Not analyzed",
    climateInferred: "Climate inferred from location",
    climateAssumed: "Climate assumed generically",
    weatherSensitive: "Weather-sensitive phase detected",
    structuralOngoing: "Structural execution ongoing",
    pacingApplied: "Mid-rise pacing benchmark applied",
    currency: "Currency",
    language: "Language",
    light: "Light",
    dark: "Dark",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS Off",
    noGps: "No GPS",
    manual: "Manual"
  },
  HI: {
    title: "Builtattic",
    subtitle: "निर्माण विश्लेषण",
    engine: "VitruviAI द्वारा संचालित",
    capture: "कैप्चर + इनजेस्ट",
    inputWindow: "इनपुट विंडो",
    constructionProgress: "निर्माण प्रगति",
    executionEstimation: "निष्पादन अनुमान",
    resources: "संसाधन",
    stagesLeft: "बाकी चरण",
    singleUse: "सिंगल यूज़",
    stored: "स्टोर किया गया",
    valuationInsights: "वैल्यूएशन + इनसाइट्स",
    signals: "संकेत",
    progressVsIdeal: "आदर्श बनाम प्रगति",
    timelineDrift: "समय विचलन",
    insights: "इनसाइट्स",
    riskReveal: "जोखिम दिखाएँ",
    revealRisks: "जोखिम दिखाएँ",
    assumptions: "मान्यताएँ",
    photoEstimate: "केवल फोटो-आधारित अनुमान।",
    indicative: "संकेतात्मक परिणाम। साइट पर सत्यापित करें।",
    projectType: "प्रोजेक्ट प्रकार",
    scale: "स्केल",
    constructionType: "निर्माण प्रकार",
    location: "स्थान",
    notes: "नोट्स",
    useGps: "GPS उपयोग करें",
    browse: "अपलोड",
    live: "लाइव",
    analyze: "विश्लेषण",
    status: "स्थिति",
    stage: "चरण",
    progress: "प्रगति",
    manpower: "मैनपावर",
    machinery: "मशीनरी",
    confidence: "विश्वास स्तर",
    budgetLeft: "बचा बजट",
    budgetUsed: "खर्च बजट",
    landVal: "भूमि मूल्य",
    projectVal: "प्रोजेक्ट मूल्य",
    propertyVal: "संपत्ति मूल्यांकन",
    awaitingBase: "बेस विश्लेषण लंबित",
    runRiskReveal: "जोखिम दिखाने के लिए चलाएँ",
    pending: "लंबित",
    notAnalyzed: "विश्लेषण नहीं हुआ",
    climateInferred: "लोकेशन से जलवायु अनुमानित",
    climateAssumed: "सामान्य जलवायु मान लिया",
    weatherSensitive: "मौसम-संवेदनशील चरण",
    structuralOngoing: "स्ट्रक्चर कार्य जारी",
    pacingApplied: "मिड-राइज़ गति मानक लागू",
    currency: "मुद्रा",
    language: "भाषा",
    light: "लाइट",
    dark: "डार्क",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS बंद",
    noGps: "GPS नहीं",
    manual: "मैनुअल"
  },
  ES: {
    subtitle: "Análisis de construcción",
    engine: "Impulsado por VitruviAI",
    capture: "Captura + Ingesta",
    inputWindow: "Ventana de entrada",
    constructionProgress: "Progreso de obra",
    executionEstimation: "Estimación de ejecución",
    resources: "Recursos",
    stagesLeft: "Fases restantes",
    singleUse: "Uso único",
    stored: "Almacenado",
    valuationInsights: "Valoración + Insights",
    signals: "Señales",
    progressVsIdeal: "Progreso vs ideal",
    timelineDrift: "Desvío de plazo",
    insights: "Insights",
    riskReveal: "Revelar riesgos",
    revealRisks: "Ver riesgos",
    assumptions: "Supuestos",
    photoEstimate: "Estimación solo con foto.",
    indicative: "Resultados indicativos. Validar en sitio.",
    projectType: "Tipo de proyecto",
    scale: "Escala",
    constructionType: "Tipo constructivo",
    location: "Ubicación",
    notes: "Notas",
    useGps: "Usar GPS",
    browse: "Cargar",
    live: "Vivo",
    analyze: "Analizar",
    status: "Estado",
    stage: "Etapa",
    progress: "Progreso",
    manpower: "Mano de obra",
    machinery: "Maquinaria",
    confidence: "Confianza",
    budgetLeft: "Presupuesto restante",
    budgetUsed: "Presupuesto usado",
    landVal: "Valor del terreno",
    projectVal: "Valor del proyecto",
    propertyVal: "Valoración de propiedad",
    awaitingBase: "Esperando análisis base",
    runRiskReveal: "Ejecuta riesgos para ver",
    pending: "Pendiente",
    notAnalyzed: "No analizado",
    climateInferred: "Clima inferido por ubicación",
    climateAssumed: "Clima asumido",
    weatherSensitive: "Fase sensible al clima",
    structuralOngoing: "Estructura en curso",
    pacingApplied: "Referencia de ritmo mid-rise",
    currency: "Moneda",
    language: "Idioma",
    light: "Claro",
    dark: "Oscuro",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS apagado",
    noGps: "Sin GPS",
    manual: "Manual"
  },
  FR: {
    subtitle: "Analyse de construction",
    engine: "Propulsé par VitruviAI",
    capture: "Capture + Ingestion",
    inputWindow: "Fenêtre d'entrée",
    constructionProgress: "Avancement chantier",
    executionEstimation: "Estimation d'exécution",
    resources: "Ressources",
    stagesLeft: "Étapes restantes",
    singleUse: "Usage unique",
    stored: "Enregistré",
    valuationInsights: "Valorisation + Insights",
    signals: "Signaux",
    progressVsIdeal: "Progrès vs idéal",
    timelineDrift: "Dérive planning",
    insights: "Insights",
    riskReveal: "Révéler les risques",
    revealRisks: "Voir les risques",
    assumptions: "Hypothèses",
    photoEstimate: "Estimation basée sur photo.",
    indicative: "Résultats indicatifs. Vérifier sur site.",
    projectType: "Type de projet",
    scale: "Échelle",
    constructionType: "Type constructif",
    location: "Localisation",
    notes: "Notes",
    useGps: "Utiliser GPS",
    browse: "Importer",
    live: "Live",
    analyze: "Analyser",
    status: "Statut",
    stage: "Étape",
    progress: "Progrès",
    manpower: "Main-d'œuvre",
    machinery: "Machinerie",
    confidence: "Confiance",
    budgetLeft: "Budget restant",
    budgetUsed: "Budget utilisé",
    landVal: "Valeur du terrain",
    projectVal: "Valeur du projet",
    propertyVal: "Valorisation",
    awaitingBase: "En attente d'analyse",
    runRiskReveal: "Lancer les risques pour voir",
    pending: "En attente",
    notAnalyzed: "Non analysé",
    climateInferred: "Climat déduit de la localisation",
    climateAssumed: "Climat supposé",
    weatherSensitive: "Phase sensible au climat",
    structuralOngoing: "Structure en cours",
    pacingApplied: "Référence mid-rise appliquée",
    currency: "Devise",
    language: "Langue",
    light: "Clair",
    dark: "Sombre",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS coupé",
    noGps: "Pas de GPS",
    manual: "Manuel"
  },
  DE: {
    subtitle: "Bauanalyse",
    engine: "Powered by VitruviAI",
    capture: "Erfassung + Eingabe",
    inputWindow: "Eingabefenster",
    constructionProgress: "Baufortschritt",
    executionEstimation: "Ausführungsabschätzung",
    resources: "Ressourcen",
    stagesLeft: "Offene Phasen",
    singleUse: "Einmalnutzung",
    stored: "Gespeichert",
    valuationInsights: "Bewertung + Insights",
    signals: "Signale",
    progressVsIdeal: "Fortschritt vs Ideal",
    timelineDrift: "Terminabweichung",
    insights: "Insights",
    riskReveal: "Risiken anzeigen",
    revealRisks: "Risiken zeigen",
    assumptions: "Annahmen",
    photoEstimate: "Schätzung nur anhand Foto.",
    indicative: "Indikative Ergebnisse. Vor Ort prüfen.",
    projectType: "Projekttyp",
    scale: "Skalierung",
    constructionType: "Bauart",
    location: "Standort",
    notes: "Notizen",
    useGps: "GPS nutzen",
    browse: "Upload",
    live: "Live",
    analyze: "Analysieren",
    status: "Status",
    stage: "Phase",
    progress: "Fortschritt",
    manpower: "Arbeitskraft",
    machinery: "Maschinen",
    confidence: "Sicherheit",
    budgetLeft: "Restbudget",
    budgetUsed: "Budget genutzt",
    landVal: "Grundwert",
    projectVal: "Projektwert",
    propertyVal: "Objektbewertung",
    awaitingBase: "Basisanalyse ausstehend",
    runRiskReveal: "Risiken ausführen, um zu sehen",
    pending: "Ausstehend",
    notAnalyzed: "Nicht analysiert",
    climateInferred: "Klima aus Standort abgeleitet",
    climateAssumed: "Klima angenommen",
    weatherSensitive: "Wetterkritische Phase",
    structuralOngoing: "Strukturphase aktiv",
    pacingApplied: "Mid-rise Referenz genutzt",
    currency: "Währung",
    language: "Sprache",
    light: "Hell",
    dark: "Dunkel",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS aus",
    noGps: "Kein GPS",
    manual: "Manuell"
  },
  TA: {
    subtitle: "கட்டிடம் பகுப்பாய்வு",
    engine: "VitruviAI இயந்திரம்",
    capture: "பிடிப்பு + உள்ளீடு",
    inputWindow: "உள்ளீட்டு சாளரம்",
    constructionProgress: "கட்டுமான முன்னேற்றம்",
    executionEstimation: "நிறைவேற்ற மதிப்பீடு",
    resources: "வளங்கள்",
    stagesLeft: "மீதமுள்ள கட்டங்கள்",
    singleUse: "ஒருமுறை பயன்பாடு",
    stored: "சேமிக்கப்பட்டது",
    valuationInsights: "மதிப்பீடு + குறிப்புகள்",
    signals: "சிக்னல்கள்",
    progressVsIdeal: "இயல்புடன் ஒப்பீடு",
    timelineDrift: "கால அசைவுகள்",
    insights: "குறிப்புகள்",
    riskReveal: "ஆபத்து காண்க",
    revealRisks: "ஆபத்து காண்க",
    assumptions: "கருதுகோள்கள்",
    photoEstimate: "படத்தை மட்டும் வைத்து மதிப்பீடு.",
    indicative: "கணிசமான முடிவுகள். தளத்தில் சரிபார்க்கவும்.",
    projectType: "திட்ட வகை",
    scale: "அளவு",
    constructionType: "கட்டுமான வகை",
    location: "இடம்",
    notes: "குறிப்புகள்",
    useGps: "GPS பயன்படுத்து",
    browse: "அப்லோடு",
    live: "நேரடி",
    analyze: "பகுப்பு",
    status: "நிலை",
    stage: "கட்டம்",
    progress: "முன்னேற்றம்",
    manpower: "மனோபவர்",
    machinery: "இயந்திரங்கள்",
    confidence: "நம்பிக்கை",
    budgetLeft: "மீதமுள்ள பட்ஜெட்",
    budgetUsed: "பயன்பட்ட பட்ஜெட்",
    landVal: "நில மதிப்பு",
    projectVal: "திட்ட மதிப்பு",
    propertyVal: "சொத்து மதிப்பீடு",
    awaitingBase: "அடிப்படை பகுப்பாய்வு காத்திருப்பு",
    runRiskReveal: "ஆபத்து காண இயக்கவும்",
    pending: "நிலுவையில்",
    notAnalyzed: "பகுப்பாய்வு இல்லை",
    climateInferred: "இடத்தின் அடிப்படையில் காலநிலை",
    climateAssumed: "பொது காலநிலை கருதப்பட்டது",
    weatherSensitive: "வானிலை சென்சிடிவ் கட்டம்",
    structuralOngoing: "ஸ்ட்ரக்சர் வேலை நடைபெறுகிறது",
    pacingApplied: "மிட்-ரைஸ் அளவீடு பயன்படுத்தப்பட்டது",
    currency: "நாணயம்",
    language: "மொழி",
    light: "லைட்",
    dark: "டார்க்",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ஆஃப்",
    noGps: "GPS இல்லை",
    manual: "கையேடு"
  },
  TE: {
    subtitle: "నిర్మాణ విశ్లేషణ",
    engine: "VitruviAI ఇంజిన్",
    capture: "క్యాప్చర్ + ఇన్పుట్",
    inputWindow: "ఇన్పుట్ విండో",
    constructionProgress: "నిర్మాణ పురోగతి",
    executionEstimation: "నిర్వహణ అంచనా",
    resources: "వనరులు",
    stagesLeft: "మిగిలిన దశలు",
    singleUse: "ఒకసారి ఉపయోగం",
    stored: "సేవ్ అయ్యింది",
    valuationInsights: "విలువ + సూచనలు",
    signals: "సిగ్నల్స్",
    progressVsIdeal: "ఆదర్శంతో పోలిక",
    timelineDrift: "టైమ్ డ్రిఫ్ట్",
    insights: "సూచనలు",
    riskReveal: "రిస్క్ చూపు",
    revealRisks: "రిస్క్ చూపు",
    assumptions: "అంచనాలు",
    photoEstimate: "ఫోటో ఆధారిత అంచనా మాత్రమే.",
    indicative: "సూచనాత్మక ఫలితాలు. సైట్‌లో తనిఖీ చేయండి.",
    projectType: "ప్రాజెక్ట్ టైప్",
    scale: "స్కేల్",
    constructionType: "నిర్మాణ టైప్",
    location: "స్థానం",
    notes: "నోట్స్",
    useGps: "GPS ఉపయోగించు",
    browse: "అప్‌లోడ్",
    live: "లైవ్",
    analyze: "విశ్లేషణ",
    status: "స్థితి",
    stage: "దశ",
    progress: "పురోగతి",
    manpower: "మ్యాన్‌పవర్",
    machinery: "యంత్రాలు",
    confidence: "నమ్మకం",
    budgetLeft: "మిగిలిన బడ్జెట్",
    budgetUsed: "ఖర్చైన బడ్జెట్",
    landVal: "భూమి విలువ",
    projectVal: "ప్రాజెక్ట్ విలువ",
    propertyVal: "ఆస్తి విలువ",
    awaitingBase: "బేస్ విశ్లేషణ కోసం వేచి ఉంది",
    runRiskReveal: "రిస్క్ చూపడానికి రన్ చేయండి",
    pending: "పెండింగ్",
    notAnalyzed: "విశ్లేషణ లేదు",
    climateInferred: "లొకేషన్ ఆధారంగా క్లైమేట్",
    climateAssumed: "సాధారణ క్లైమేట్ అంచనా",
    weatherSensitive: "వాతావరణానికి సున్నితమైన దశ",
    structuralOngoing: "స్ట్రక్చర్ వర్క్ కొనసాగుతోంది",
    pacingApplied: "మిడ్-రైజ్ బెంచ్‌మార్క్ వర్తించింది",
    currency: "కరెన్సీ",
    language: "భాష",
    light: "లైట్",
    dark: "డార్క్",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ఆఫ్",
    noGps: "GPS లేదు",
    manual: "మాన్యువల్"
  },
  KN: {
    subtitle: "ನಿರ್ಮಾಣ ವಿಶ್ಲೇಷಣೆ",
    engine: "VitruviAI ಎಂಜಿನ್",
    capture: "ಕ್ಯಾಪ್ಚರ್ + ಇನ್‌ಪುಟ್",
    inputWindow: "ಇನ್‌ಪುಟ್ ವಿಂಡೋ",
    constructionProgress: "ನಿರ್ಮಾಣ ಪ್ರಗತಿ",
    executionEstimation: "ಕಾರ್ಯನಿರ್ವಹಣೆ ಅಂದಾಜು",
    resources: "ಸಂಪನ್ಮೂಲಗಳು",
    stagesLeft: "ಉಳಿದ ಹಂತಗಳು",
    singleUse: "ಒಮ್ಮೆ ಬಳಕೆ",
    stored: "ಸೇವ್ ಆಗಿದೆ",
    valuationInsights: "ಮೌಲ್ಯಮಾಪನ + ಇನ್ಸೈಟ್ಸ್",
    signals: "ಸಿಗ್ನಲ್ಸ್",
    progressVsIdeal: "ಆದರ್ಶದೊಂದಿಗೆ ಹೋಲಿಕೆ",
    timelineDrift: "ಟೈಮ್ಲೈನ್ ಡ್ರಿಫ್ಟ್",
    insights: "ಇನ್ಸೈಟ್ಸ್",
    riskReveal: "ರಿಸ್ಕ್ ತೋರಿಸಿ",
    revealRisks: "ರಿಸ್ಕ್ ತೋರಿಸಿ",
    assumptions: "ಅಂದಾಜುಗಳು",
    photoEstimate: "ಫೋಟೋ ಆಧಾರಿತ ಅಂದಾಜು ಮಾತ್ರ.",
    indicative: "ಸೂಚಕ ಫಲಿತಾಂಶಗಳು. ಸೈಟ್‌ನಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.",
    projectType: "ಪ್ರಾಜೆಕ್ಟ್ ಟೈಪ್",
    scale: "ಸ್ಕೇಲ್",
    constructionType: "ಕಾನ್ಸ್ಟ್ರಕ್ಷನ್ ಟೈಪ್",
    location: "ಸ್ಥಳ",
    notes: "ನೋಟ್ಸ್",
    useGps: "GPS ಬಳಸಿ",
    browse: "ಅಪ್ಲೋಡ್",
    live: "ಲೈವ್",
    analyze: "ವಿಶ್ಲೇಷಣೆ",
    status: "ಸ್ಥಿತಿ",
    stage: "ಹಂತ",
    progress: "ಪ್ರಗತಿ",
    manpower: "ಮ್ಯಾನ್ಪವರ್",
    machinery: "ಯಂತ್ರಗಳು",
    confidence: "ನಂಬಿಕೆ",
    budgetLeft: "ಉಳಿದ ಬಜೆಟ್",
    budgetUsed: "ಬಳಸಿದ ಬಜೆಟ್",
    landVal: "ಭೂಮಿ ಮೌಲ್ಯ",
    projectVal: "ಪ್ರಾಜೆಕ್ಟ್ ಮೌಲ್ಯ",
    propertyVal: "ಆಸ್ತಿ ಮೌಲ್ಯ",
    awaitingBase: "ಬೇಸ್ ವಿಶ್ಲೇಷಣೆಗೆ ಕಾಯುತ್ತಿದೆ",
    runRiskReveal: "ರಿಸ್ಕ್ ನೋಡಲು ರನ್ ಮಾಡಿ",
    pending: "ಪೆಂಡಿಂಗ್",
    notAnalyzed: "ವಿಶ್ಲೇಷಣೆ ಇಲ್ಲ",
    climateInferred: "ಸ್ಥಳದಿಂದ ಹವಾಮಾನ ಅಂದಾಜು",
    climateAssumed: "ಸಾಮಾನ್ಯ ಹವಾಮಾನ ಅಂದಾಜು",
    weatherSensitive: "ಹವಾಮಾನ ಸಂವೇದನಾಶೀಲ ಹಂತ",
    structuralOngoing: "ಸ್ಟ್ರಕ್ಚರ್ ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ",
    pacingApplied: "ಮಿಡ್-ರೈಸ್ ಬೆಂಚ್ಮಾರ್ಕ್ ಅನ್ವయಿಸಲಾಗಿದೆ",
    currency: "ಕರೆನ್ಸಿ",
    language: "ಭಾಷೆ",
    light: "ಲೈಟ್",
    dark: "ಡಾರ್ಕ್",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ಆಫ್",
    noGps: "GPS ಇಲ್ಲ",
    manual: "ಮಾನುವಲ್"
  },
  ML: {
    subtitle: "നിർമാണ വിശകലനം",
    engine: "VitruviAI എൻജിൻ",
    capture: "ക്യാപ്ചർ + ഇൻപുട്ട്",
    inputWindow: "ഇൻപുട്ട് വിൻഡോ",
    constructionProgress: "നിർമാണ പുരോഗതി",
    executionEstimation: "നിർവഹണ അനുമാനം",
    resources: "വിഭവങ്ങൾ",
    stagesLeft: "ബാക്കി ഘട്ടങ്ങൾ",
    singleUse: "ഒറ്റ ഉപയോഗം",
    stored: "സേവ് ചെയ്തു",
    valuationInsights: "വിലയിരുത്തൽ + ഇൻസൈറ്റ്സ്",
    signals: "സിഗ്നലുകൾ",
    progressVsIdeal: "ഇഡിയൽ താരതമ്യം",
    timelineDrift: "ടൈംലൈൻ ഡ്രിഫ്റ്റ്",
    insights: "ഇൻസൈറ്റ്സ്",
    riskReveal: "റിസ്ക് കാണിക്കുക",
    revealRisks: "റിസ്ക് കാണിക്കുക",
    assumptions: "അനുമാനങ്ങൾ",
    photoEstimate: "ഫോട്ടോ അടിസ്ഥാനമാക്കിയുള്ള വിലയിരുത്തൽ മാത്രം.",
    indicative: "സൂചനാത്മക ഫലങ്ങൾ. സൈറ്റിൽ പരിശോധിക്കുക.",
    projectType: "പ്രോജക്റ്റ് തരം",
    scale: "സ്കെയിൽ",
    constructionType: "നിർമാണ തരം",
    location: "സ്ഥലം",
    notes: "നോട്ട്സ്",
    useGps: "GPS ഉപയോഗിക്കുക",
    browse: "അപ്‌ലോഡ്",
    live: "ലൈവ്",
    analyze: "വിശകലനം",
    status: "സ്റ്റാറ്റസ്",
    stage: "ഘട്ടം",
    progress: "പുരോഗതി",
    manpower: "മാൻപവർ",
    machinery: "മെഷിനറി",
    confidence: "വിശ്വാസം",
    budgetLeft: "ബാക്കി ബജറ്റ്",
    budgetUsed: "ഉപയോഗിച്ച ബജറ്റ്",
    landVal: "ഭూമി മൂല്യം",
    projectVal: "പ്രോജക്റ്റ് മൂല്യം",
    propertyVal: "സ്വത്ത് മൂല്യം",
    awaitingBase: "ബേസ് വിശകലനം കാത്തിരിക്കുന്നു",
    runRiskReveal: "റിസ്ക് കാണാൻ റൺ ചെയ്യുക",
    pending: "പെൻഡിങ്",
    notAnalyzed: "വിശകലനം ഇല്ല",
    climateInferred: "ലൊക്കേഷൻ അടിസ്ഥാനത്തിൽ കാലാവസ്ഥ",
    climateAssumed: "സാധാരണ കാലാവസ്ഥ അനുമാനം",
    weatherSensitive: "കാലാവസ്ഥയ്ക്ക് സെൻസിറ്റീവ് ഘട്ടം",
    structuralOngoing: "സ്ട്രക്ചർ ജോലി നടക്കുന്നു",
    pacingApplied: "മിഡ്-റൈസ് ബെഞ്ച്മാർക്ക് പ്രയോഗിച്ചു",
    currency: "കറన్સી",
    language: "ഭാഷ",
    light: "ലൈറ്റ്",
    dark: "ಡാർക്ക്",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ഓഫ്",
    noGps: "GPS ഇല്ല",
    manual: "മാനുവൽ"
  },
  MR: {
    subtitle: "बांधकाम विश्लेषण",
    engine: "VitruviAI इंजिन",
    capture: "कॅप्चर + इनपुट",
    inputWindow: "इनपुट विंडो",
    constructionProgress: "बांधकाम प्रगती",
    executionEstimation: "अंमलबजावणी अंदाज",
    resources: "संसाधने",
    stagesLeft: "उर्वरित टप्पे",
    singleUse: "एकदाच वापर",
    stored: "जतन केले",
    valuationInsights: "मूल्यांकन + इनसाइट्स",
    signals: "सिग्नल्स",
    progressVsIdeal: "आदर्शाशी तुलना",
    timelineDrift: "टाइमलाइन ड्रिफ्ट",
    insights: "इनसाइट्स",
    riskReveal: "धोका दाखवा",
    revealRisks: "धोका दाखवा",
    assumptions: "गृहितके",
    photoEstimate: "फोटो-आधारित अंदाज.",
    indicative: "सूचक परिणाम. साइटवर तपासा.",
    projectType: "प्रकल्प प्रकार",
    scale: "स्केल",
    constructionType: "बांधकाम प्रकार",
    location: "स्थान",
    notes: "नोट्स",
    useGps: "GPS वापरा",
    browse: "अपलोड",
    live: "लाइव्ह",
    analyze: "विश्लेषण",
    status: "स्थिती",
    stage: "टप्पा",
    progress: "प्रगती",
    manpower: "मनपावर",
    machinery: "यंत्रे",
    confidence: "विश्वास",
    budgetLeft: "उरलेले बजेट",
    budgetUsed: "वापरलेला बजेट",
    landVal: "जमीन मूल्य",
    projectVal: "प्रकल्प मूल्य",
    propertyVal: "मालमत्ता मूल्य",
    awaitingBase: "बेस विश्लेषण प्रतीक्षेत",
    runRiskReveal: "धोका पाहण्यासाठी चालवा",
    pending: "प्रलंबित",
    notAnalyzed: "विश्लेषण नाही",
    climateInferred: "स्थानावरून हवामान अंदाज",
    climateAssumed: "सामान्य हवामान गृहित",
    weatherSensitive: "हवामान संवेदनशील टप्पा",
    structuralOngoing: "स्ट्रक्चर काम सुरू आहे",
    pacingApplied: "मिड-राईज मानक लागू",
    currency: "चलन",
    language: "भाषा",
    light: "लाइट",
    dark: "डार्क",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS बंद",
    noGps: "GPS नाही",
    manual: "मॅन्युअल"
  },
  GU: {
    subtitle: "બાંધકામ વિશ્લેષણ",
    engine: "VitruviAI એન્જિન",
    capture: "કૅપ્ચર + ઇનપુટ",
    inputWindow: "ઇનપુટ વિન્ડો",
    constructionProgress: "બાંધકામ પ્રગતિ",
    executionEstimation: "અનુમાનિત અમલ",
    resources: "સ્રોતો",
    stagesLeft: "બાકી તબક્કા",
    singleUse: "એક વખત ઉપયોગ",
    stored: "સેવ કરેલું",
    valuationInsights: "મૂલ્યાંકન + ઇનસાઇટ્સ",
    signals: "સિગ્નલ્સ",
    progressVsIdeal: "આદર્શની તુલના",
    timelineDrift: "ટાઇમલાઇન ડ્રિફ્ટ",
    insights: "ઇનસાઇટ્સ",
    riskReveal: "જોખમ બતાવો",
    revealRisks: "જોખમ બતાવો",
    assumptions: "ધારણાઓ",
    photoEstimate: "ફોટો આધારિત અંદાજ.",
    indicative: "સૂચક પરિણામો. સાઇટ પર ચકાસો.",
    projectType: "પ્રોજેક્ટ પ્રકાર",
    scale: "સ્કેલ",
    constructionType: "બાંધકામ પ્રકાર",
    location: "સ્થાન",
    notes: "નોંધો",
    useGps: "GPS ઉપયોગ કરો",
    browse: "અપલોડ",
    live: "લાઇવ",
    analyze: "વિશ્લેષણ",
    status: "સ્થિતિ",
    stage: "તબક્કો",
    progress: "પ્રગતિ",
    manpower: "મેનપાવર",
    machinery: "યંત્રો",
    confidence: "વિશ્વાસ",
    budgetLeft: "બાકી બજેટ",
    budgetUsed: "ઉપયોગ કરેલો બજેટ",
    landVal: "જમીન મૂલ્ય",
    projectVal: "પ્રોજેક્ટ મૂલ્ય",
    propertyVal: "મિલકત મૂલ્ય",
    awaitingBase: "બેઝ વિશ્લેષણ માટે રાહ",
    runRiskReveal: "જોખમ જોવા માટે ચલાવો",
    pending: "બાકી",
    notAnalyzed: "વિશ્લેષણ નથી",
    climateInferred: "સ્થાન આધારિત હવામાન",
    climateAssumed: "સામાન્ય હવામાન ધાર્યું",
    weatherSensitive: "હવામાન સંવેદનશીલ તબક્કો",
    structuralOngoing: "સ્ટ્રક્ચર કામ ચાલુ છે",
    pacingApplied: "મિડ-રાઈઝ બેન્ચમાર્ક લાગુ",
    currency: "ચલણ",
    language: "ભાષા",
    light: "લાઇટ",
    dark: "ડાર્ક",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS બંધ",
    noGps: "GPS નથી",
    manual: "મેન્યુઅલ"
  },
  PA: {
    subtitle: "ਨਿਰਮਾਣ ਵਿਸ਼ਲੇਸ਼ਣ",
    engine: "VitruviAI ਇੰਜਨ",
    capture: "ਕੈਪਚਰ + ਇਨਪੁਟ",
    inputWindow: "ਇਨਪੁਟ ਵਿੰਡੋ",
    constructionProgress: "ਨਿਰਮਾਣ ਪ੍ਰਗਤੀ",
    executionEstimation: "ਕਾਰਜ ਅੰਦਾਜ਼ਾ",
    resources: "ਸਰੋਤ",
    stagesLeft: "ਬਾਕੀ ਪੜਾਅ",
    singleUse: "ਇੱਕ ਵਾਰ ਵਰਤੋਂ",
    stored: "ਸੇਵ ਕੀਤਾ",
    valuationInsights: "ਮੁੱਲਾਂਕਨ + ਇਨਸਾਈਟസ്",
    signals: "ਸਿਗਨਲ",
    progressVsIdeal: "ਆਦਰਸ਼ ਨਾਲ ਤੁਲਨਾ",
    timelineDrift: "ਟਾਈਮਲਾਈਨ ਡ੍ਰਿਫਟ",
    insights: "ਇਨਸਾਈਟਸ",
    riskReveal: "ਖਤਰਾ ਵੇਖੋ",
    revealRisks: "ਖਤਰਾ ਵੇਖੋ",
    assumptions: "ਅਨੁਮਾਨ",
    photoEstimate: "ਸਿਰਫ਼ ਫੋਟੋ ਆਧਾਰਿਤ ਅੰਦਾਜ਼ਾ।",
    indicative: "ਸੰਕੇਤਕ ਨਤੀਜੇ। ਸਾਈਟ ਤੇ ਚੈੱਕ ਕਰੋ।",
    projectType: "ਪਰੋਜੈਕਟ ਕਿਸਮ",
    scale: "ਸਕੇਲ",
    constructionType: "ਨਿਰਮਾਣ ਕਿਸਮ",
    location: "ਥਾਂ",
    notes: "ਨੋਟਸ",
    useGps: "GPS ਵਰਤੋਂ",
    browse: "ਅਪਲੋਡ",
    live: "ਲਾਈਵ",
    analyze: "ਵਿਸ਼ਲੇਸ਼ਣ",
    status: "ਹਾਲਤ",
    stage: "ਪੜਾਅ",
    progress: "ਪ੍ਰਗਤੀ",
    manpower: "ਮੈਨਪਾਵਰ",
    machinery: "ਮਸ਼ੀਨਰੀ",
    confidence: "ਭਰੋਸਾ",
    budgetLeft: "ਬਾਕੀ ਬਜਟ",
    budgetUsed: "ਵਰਤਿਆ ਬਜਟ",
    landVal: "ਜਮੀਨ ਮੁੱਲ",
    projectVal: "ਪਰੋਜੈਕਟ ਮੁੱਲ",
    propertyVal: "ਸੰਪਤੀ ਮੁੱਲ",
    awaitingBase: "ਬੇਸ ਵਿਸ਼ਲੇਸ਼ਣ ਦੀ ਉਡੀਕ",
    runRiskReveal: "ਖਤਰਾ ਦੇਖਣ ਲਈ ਚਲਾਓ",
    pending: "ਬਾਕੀ",
    notAnalyzed: "ਵਿਸ਼ਲੇਸ਼ਣ ਨਹੀਂ",
    climateInferred: "ਥਾਂ ਤੋਂ ਹਵਾਮਾਨ ਅੰਦਾਜ਼ਾ",
    climateAssumed: "ਆਮ ਹਵਾਮਾਨ ਮੰਨਿਆ",
    weatherSensitive: "ਮੌਸਮ ਸੰਵੇਦਨਸ਼ੀਲ ਪੜਾਅ",
    structuralOngoing: "ਸਟਰਕਚਰ ਕੰਮ ਚੱਲ ਰਿਹਾ",
    pacingApplied: "ਮਿਡ-ਰਾਈਜ਼ ਬੈਂਚਮਾਰਕ ਲਾਗੂ",
    currency: "ਮੁਦరా",
    language: "ਭਾਸ਼ਾ",
    light: "ਲਾਈਟ",
    dark: "ਡਾਰਕ",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ਬੰਦ",
    noGps: "GPS ਨਹੀਂ",
    manual: "ਮੈਨੁਅਲ"
  },
  ZH: {
    subtitle: "施工分析",
    engine: "由 VitruviAI 驱动",
    capture: "采集 + 输入",
    inputWindow: "输入窗口",
    constructionProgress: "施工进度",
    executionEstimation: "执行估算",
    resources: "资源",
    stagesLeft: "剩余阶段",
    singleUse: "单次使用",
    stored: "已保存",
    valuationInsights: "估值 + 见解",
    signals: "信号",
    progressVsIdeal: "进度对比",
    timelineDrift: "工期偏差",
    insights: "见解",
    riskReveal: "风险揭示",
    revealRisks: "查看风险",
    assumptions: "假设",
    photoEstimate: "仅基于照片估算。",
    indicative: "仅供参考，请现场核实。",
    projectType: "项目类型",
    scale: "规模",
    constructionType: "结构类型",
    location: "位置",
    notes: "备注",
    useGps: "使用 GPS",
    browse: "上传",
    live: "现场",
    analyze: "分析",
    status: "状态",
    stage: "阶段",
    progress: "进度",
    manpower: "人力",
    machinery: "机械",
    confidence: "置信度",
    budgetLeft: "剩余预算",
    budgetUsed: "已用预算",
    landVal: "土地估值",
    projectVal: "项目估值",
    propertyVal: "资产估值",
    awaitingBase: "等待基础分析",
    runRiskReveal: "运行风险以查看",
    pending: "待处理",
    notAnalyzed: "未分析",
    climateInferred: "基于位置推断气候",
    climateAssumed: "采用通用气候假设",
    weatherSensitive: "天气敏感阶段",
    structuralOngoing: "结构施工进行中",
    pacingApplied: "采用中高层基准",
    currency: "货币",
    language: "语言",
    light: "浅色",
    dark: "深色",
    highContrast: "高对比",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS 关闭",
    noGps: "无 GPS",
    manual: "手动"
  },
  JA: {
    subtitle: "建設分析",
    engine: "VitruviAI エンジン",
    capture: "撮影 + 入力",
    inputWindow: "入力ウィンドウ",
    constructionProgress: "施工進捗",
    executionEstimation: "実行見積り",
    resources: "リソース",
    stagesLeft: "残り工程",
    singleUse: "単回使用",
    stored: "保存済み",
    valuationInsights: "評価 + インサイト",
    signals: "シグナル",
    progressVsIdeal: "理想との差",
    timelineDrift: "工程のズレ",
    insights: "インサイト",
    riskReveal: "リスク表示",
    revealRisks: "リスクを見る",
    assumptions: "前提",
    photoEstimate: "写真ベースの推定のみ。",
    indicative: "参考値です。現地確認を推奨。",
    projectType: "プロジェクト種別",
    scale: "規模",
    constructionType: "構造種別",
    location: "場所",
    notes: "メモ",
    useGps: "GPS を使用",
    browse: "アップロード",
    live: "ライブ",
    analyze: "解析",
    status: "状態",
    stage: "工程",
    progress: "進捗",
    manpower: "人員",
    machinery: "機械",
    confidence: "信頼度",
    budgetLeft: "残予算",
    budgetUsed: "使用済み予算",
    landVal: "土地評価",
    projectVal: "プロジェクト評価",
    propertyVal: "物件評価",
    awaitingBase: "ベース分析待ち",
    runRiskReveal: "リスク表示を実行",
    pending: "保留",
    notAnalyzed: "未解析",
    climateInferred: "位置情報から気候推定",
    climateAssumed: "一般的な気候仮定",
    weatherSensitive: "天候影響のある工程",
    structuralOngoing: "構造工程進行中",
    pacingApplied: "中高層ベンチマーク適用",
    currency: "通貨",
    language: "言語",
    light: "ライト",
    dark: "ダーク",
    highContrast: "高コントラスト",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS オフ",
    noGps: "GPS なし",
    manual: "手動"
  }
};

const CURRENCY_LABELS: Record<Currency, { code: Currency; name: string; locale: string }> = {
  USD: { code: "USD", name: "US Dollar", locale: "en-US" },
  INR: { code: "INR", name: "Indian Rupee", locale: "hi-IN" },
  AED: { code: "AED", name: "UAE Dirham", locale: "en-AE" },
  EUR: { code: "EUR", name: "Euro", locale: "fr-FR" },
  GBP: { code: "GBP", name: "British Pound", locale: "en-GB" },
  SGD: { code: "SGD", name: "Singapore Dollar", locale: "en-SG" },
  AUD: { code: "AUD", name: "Australian Dollar", locale: "en-AU" },
  CAD: { code: "CAD", name: "Canadian Dollar", locale: "en-CA" },
  NZD: { code: "NZD", name: "New Zealand Dollar", locale: "en-NZ" },
  CHF: { code: "CHF", name: "Swiss Franc", locale: "de-CH" },
  SEK: { code: "SEK", name: "Swedish Krona", locale: "sv-SE" },
  NOK: { code: "NOK", name: "Norwegian Krone", locale: "nb-NO" },
  DKK: { code: "DKK", name: "Danish Krone", locale: "da-DK" },
  ZAR: { code: "ZAR", name: "South African Rand", locale: "en-ZA" },
  JPY: { code: "JPY", name: "Japanese Yen", locale: "ja-JP" },
  CNY: { code: "CNY", name: "Chinese Yuan", locale: "zh-CN" },
  HKD: { code: "HKD", name: "Hong Kong Dollar", locale: "en-HK" },
  SAR: { code: "SAR", name: "Saudi Riyal", locale: "ar-SA" },
  QAR: { code: "QAR", name: "Qatari Riyal", locale: "ar-QA" },
  KRW: { code: "KRW", name: "South Korean Won", locale: "ko-KR" },
  THB: { code: "THB", name: "Thai Baht", locale: "th-TH" },
  MYR: { code: "MYR", name: "Malaysian Ringgit", locale: "ms-MY" },
  IDR: { code: "IDR", name: "Indonesian Rupiah", locale: "id-ID" },
  PHP: { code: "PHP", name: "Philippine Peso", locale: "en-PH" },
  BRL: { code: "BRL", name: "Brazilian Real", locale: "pt-BR" },
  MXN: { code: "MXN", name: "Mexican Peso", locale: "es-MX" },
  PLN: { code: "PLN", name: "Polish Zloty", locale: "pl-PL" },
  CZK: { code: "CZK", name: "Czech Koruna", locale: "cs-CZ" },
  TRY: { code: "TRY", name: "Turkish Lira", locale: "tr-TR" }
};

const apiUrl = (path: string) => path;

const LANGUAGE_OPTIONS: { value: Lang; label: string }[] = [
  { value: "EN", label: "English" },
  { value: "HI", label: "Hindi" },
  { value: "ES", label: "Spanish" },
  { value: "FR", label: "French" },
  { value: "DE", label: "German" },
  { value: "TA", label: "Tamil" },
  { value: "TE", label: "Telugu" },
  { value: "KN", label: "Kannada" },
  { value: "ML", label: "Malayalam" },
  { value: "MR", label: "Marathi" },
  { value: "GU", label: "Gujarati" },
  { value: "PA", label: "Punjabi" },
  { value: "ZH", label: "Chinese" },
  { value: "JA", label: "Japanese" }
];

type RatesPayload = { base: Currency; rates: Record<string, number>; updatedAt?: number };

function formatCurrencyRange(currency: Currency, min: number, max: number, rates: RatesPayload | null) {
  if (!rates || !rates.rates) return "—";
  const usdRate = rates.rates["USD"];
  const targetRate = rates.rates[currency];
  if (!targetRate) return "—";
  const baseAmount = rates.base === "USD" ? 1 : usdRate ? 1 / usdRate : null;
  if (!baseAmount) return "—";
  const convert = (amountUsd: number) => {
    const amountInBase = rates.base === "USD" ? amountUsd : amountUsd * baseAmount;
    return amountInBase * targetRate;
  };
  const convertedMin = convert(min);
  const convertedMax = convert(max);
  const maxAbs = Math.max(Math.abs(convertedMin), Math.abs(convertedMax));
  const useCompact = maxAbs >= 100_000_000;
  const fmt = new Intl.NumberFormat(CURRENCY_LABELS[currency].locale, {
    style: "currency",
    currency,
    notation: useCompact ? "compact" : "standard",
    maximumFractionDigits: useCompact ? 1 : 0
  });
  return `${fmt.format(convertedMin)} - ${fmt.format(convertedMax)}`;
}

function compactWords(value?: string, maxWords = 2) {
  if (!value) return "-";
  return value
    .replace(/[\n\r]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join(" ");
}

function cleanSentence(value: string, maxLength = 120) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

function normalizeStage(value?: string, status?: BaseResult["project_status"]): StageLabel {
  if (status === "completed") return "Completed";
  if (!value) return "Planning";
  const v = value.toLowerCase();
  if (v.includes("plan")) return "Planning";
  if (v.includes("found")) return "Foundation";
  if (v.includes("struct") || v.includes("frame")) return "Structure";
  if (v.includes("service") || v.includes("mep") || v.includes("electric") || v.includes("plumb")) return "Services";
  if (v.includes("finish") || v.includes("interior") || v.includes("paint")) return "Finishing";
  return "Structure";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 ${className}`}>
      {children}
    </div>
  );
}

function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={() => setOpen(false)}
      className="relative ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      aria-label="Info"
    >
      ?
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-4 text-[11px] font-medium leading-relaxed text-zinc-600 dark:text-zinc-300 shadow-2xl"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function StatCard({ label, value, tooltip, tag, className }: { label: string; value: React.ReactNode; tooltip?: string; tag?: React.ReactNode; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = typeof value === 'string' && value.length > 24;
  
  return (
    <motion.div 
      layout
      variants={itemVariants}
      onClick={() => isLong && setExpanded(!expanded)}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative flex flex-col rounded-[24px] border border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 p-5 backdrop-blur-md transition-all hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-2xl hover:shadow-zinc-500/10 dark:hover:shadow-white/5 ${isLong ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[24px]" />
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
        {label}
        {tooltip ? <Info text={tooltip} /> : null}
      </div>
      <div className={`mt-2 font-black tracking-tight text-zinc-900 dark:text-white leading-[1.2] transition-all duration-500 ${isLong && !expanded ? 'text-sm line-clamp-2' : isLong ? 'text-sm' : 'text-xl'}`}>
        {value}
      </div>
      {isLong && (
        <div className="mt-2 text-[8px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
          {expanded ? 'Collapse' : 'Tap to Expand'}
        </div>
      )}
      {tag ? <div className="mt-auto pt-3">{tag}</div> : null}
    </motion.div>
  );
}

function MatrixEntry({ label, value }: { label: string; value: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > 20;

  return (
    <div 
      onClick={() => isLong && setExpanded(!expanded)}
      className={`min-w-0 ${isLong ? 'cursor-pointer' : ''}`}
    >
      <div className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1.5">{label}</div>
      <div className={`text-[11px] font-bold text-zinc-900 dark:text-white leading-tight transition-all duration-300 ${isLong && !expanded ? 'line-clamp-1' : ''}`}>
        {value}
      </div>
      {isLong && !expanded && <div className="text-[7px] font-black uppercase text-zinc-300 mt-1">More</div>}
    </div>
  );
}

export default function Page() {
  const [usage, setUsage] = useState<{ freeUsed: number; freeRemaining: number | "∞"; paid: boolean } | null>(null);

  // Auth state (JWT-based, matching prod_vitruviai)
  const [authUser, setAuthUser] = useState<{ name: string; email: string; subscription?: { plan: string; status: string; endDate?: string } } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [accessCode, setAccessCodeState] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | "accessCode">("login");

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    location: "",
    projectType: "Residential",
    scale: "Low-rise",
    constructionType: "RCC",
    note: ""
  });
  const [geoStatus, setGeoStatus] = useState<"exif" | "gps" | "manual" | "denied" | "none">("none");

  const [loading, setLoading] = useState(false);
  const [advLoading, setAdvLoading] = useState(false);

  const [base, setBase] = useState<BaseResult | null>(null);
  const [advanced, setAdvanced] = useState<AdvancedResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "hc">("light");
  const [lang, setLang] = useState<Lang>("EN");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [rates, setRates] = useState<RatesPayload | null>(null);
  const [rateStatus, setRateStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [answerTranslations, setAnswerTranslations] = useState<Record<string, string>>({});

  const browseInputRef = useRef<HTMLInputElement>(null);
  const liveInputRef = useRef<HTMLInputElement>(null);

  // Initialize auth from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = localStorage.getItem("theme");
    const savedLang = localStorage.getItem("lang");
    const savedCurrency = localStorage.getItem("currency");
    if (savedTheme === "dark" || savedTheme === "hc" || savedTheme === "light") setTheme(savedTheme as any);
    if (savedLang) setLang(savedLang as any);
    if (savedCurrency) setCurrency(savedCurrency as any);
    
    const savedToken = localStorage.getItem("vitruvi_token");
    const savedCode = localStorage.getItem("vitruvi_access_code");
    if (savedToken) setAuthToken(savedToken);
    if (savedCode) setAccessCodeState(savedCode);
  }, []);

  // Fetch current user when token changes
  useEffect(() => {
    if (!authToken) {
      setAuthUser(null);
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/session", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (r.ok) {
          const data = await r.json();
          setAuthUser(data.data?.user ?? null);
        } else {
          localStorage.removeItem("vitruvi_token");
          setAuthToken(null);
          setAuthUser(null);
        }
      } catch {
        localStorage.removeItem("vitruvi_token");
        setAuthToken(null);
        setAuthUser(null);
      }
    })();
  }, [authToken]);

  const apiFetch = useCallback((path: string, options?: RequestInit) => {
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> ?? {}),
    };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (accessCode) headers["x-vitruvi-access-code"] = accessCode;
    return fetch(apiUrl(path), { ...options, headers });
  }, [authToken, accessCode]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    if (theme === "dark" || theme === "hc") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("lang", lang);
    window.localStorage.setItem("currency", currency);
  }, [lang, currency]);

  const selectedCategoryRow = useMemo(() => {
    return base?.category_matrix ?? null;
  }, [base]);

  const categoryEntries = selectedCategoryRow
    ? [
        { label: "Category", value: selectedCategoryRow.Category },
        { label: "Typology", value: selectedCategoryRow.Typology },
        { label: "Style", value: selectedCategoryRow.Style },
        { label: "Climate", value: selectedCategoryRow.ClimateAdaptability },
        { label: "Terrain", value: selectedCategoryRow.Terrain },
        { label: "Soil", value: selectedCategoryRow.SoilType },
        { label: "Material", value: selectedCategoryRow.MaterialUsed },
        { label: "Interior", value: selectedCategoryRow.InteriorLayout },
        { label: "Roof", value: selectedCategoryRow.RoofType },
        { label: "Exterior", value: selectedCategoryRow.Exterior },
        { label: "Features", value: selectedCategoryRow.AdditionalFeatures },
        { label: "Eco", value: selectedCategoryRow.Sustainability }
      ]
    : [];

  useEffect(() => {
    let active = true;
    const loadRates = async () => {
      setRateStatus("loading");
      try {
        const r = await apiFetch("/api/rates?base=USD", { cache: "no-store" });
        const j = (await r.json()) as RatesPayload;
        if (!r.ok || !j?.rates) throw new Error("rates");
        if (!active) return;
        setRates(j);
        setRateStatus("ok");
      } catch {
        if (!active) return;
        setRateStatus("error");
      }
    };
    loadRates();
    return () => {
      active = false;
    };
  }, [apiFetch]);

  const t = useCallback(
    (key: string) => {
      return LANGUAGE_LABELS[lang][key] ?? LANGUAGE_LABELS.EN[key] ?? key;
    },
    [lang]
  );

  const languageName = useMemo(() => {
    return LANGUAGE_OPTIONS.find((item) => item.value === lang)?.label ?? "English";
  }, [lang]);

  async function readJson<T>(r: Response): Promise<{ data: T | null; text: string }> {
    const text = await r.text();
    if (!text) return { data: null, text: "" };
    try {
      return { data: JSON.parse(text) as T, text };
    } catch {
      return { data: null, text };
    }
  }

  const refreshUsage = useCallback(async () => {
    const r = await apiFetch("/api/usage", { cache: "no-store" });
    const { data } = await readJson<{ freeUsed: number; freeRemaining: number | null; paid: boolean }>(r);
    if (!data) return;
    setUsage({
      freeUsed: data.freeUsed,
      freeRemaining: data.freeRemaining === null ? "∞" : data.freeRemaining,
      paid: data.paid
    });
  }, [apiFetch]);

  useEffect(() => {
    refreshUsage().catch(() => {});
  }, [refreshUsage]);

  const freeRemaining = usage ? (usage.freeRemaining === "∞" ? Infinity : usage.freeRemaining) : 0;
  const paywalled = usage ? !usage.paid && freeRemaining <= 0 : false;
  const canRun = useMemo(() => {
    if (!usage) return false;
    if (usage.paid) return true;
    return (usage.freeRemaining as number) > 0;
  }, [usage]);

  async function requestGps() {
    if (!navigator.geolocation) {
      setGeoStatus("none");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        setMeta((s) => ({ ...s, location: `${lat},${lon}` }));
        setGeoStatus("gps");
      },
      () => {
        setGeoStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  async function tryExif(file: File) {
    try {
      const exifr = await import("exifr");
      const gps = await exifr.gps(file);
      if (gps?.latitude && gps?.longitude) {
        const lat = gps.latitude.toFixed(5);
        const lon = gps.longitude.toFixed(5);
        setMeta((s) => ({ ...s, location: `${lat},${lon}` }));
        setGeoStatus("exif");
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  async function onPickFile(file: File) {
    setError(null);
    setBase(null);
    setAdvanced(null);

    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);

    const exifFound = await tryExif(file);
    if (!exifFound) await requestGps();
  }

  async function runBase() {
    if (!imageDataUrl) return;
    setLoading(true);
    setError(null);
    setAdvanced(null);

    try {
      const r = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl, meta: { ...meta, language: languageName } })
      });

      const { data: j, text } = await readJson<any>(r);
      if (!r.ok) {
        if (j?.error === "PAYWALL") throw new Error("Paywall");
        const detail = (j?.message ?? j?.error ?? text) || `Request failed (${r.status})`;
        throw new Error(detail);
      }

      if (!j) throw new Error("Failed");
      setBase(j.base);
      setUsage(j.usage);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function runAdvanced() {
    if (!imageDataUrl || !base) return;
    setAdvLoading(true);
    setError(null);

    try {
      const r = await apiFetch("/api/advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl, base, language: languageName })
      });

      const { data: j, text } = await readJson<any>(r);
      if (!r.ok) {
        if (j?.error === "PAYWALL") throw new Error("Paywall");
        const detail = (j?.message ?? j?.error ?? text) || `Request failed (${r.status})`;
        throw new Error(detail);
      }

      if (!j) throw new Error("Failed");
      setAdvanced(j.advanced);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setAdvLoading(false);
    }
  }

  async function handleLogin(email: string, password: string) {
    const r = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!data.success) throw new Error(data.error || "Login failed");
    localStorage.setItem("vitruvi_token", data.data.token);
    setAuthToken(data.data.token);
    setAuthUser(data.data.user);
    await refreshUsage();
  }

  async function handleRegister(email: string, password: string, name: string) {
    const r = await fetch("/api/session/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await r.json();
    if (!data.success) throw new Error(data.error || "Registration failed");
    localStorage.setItem("vitruvi_token", data.data.token);
    setAuthToken(data.data.token);
    setAuthUser(data.data.user);
    await refreshUsage();
  }

  function handleAccessCode(code: string) {
    localStorage.setItem("vitruvi_access_code", code);
    setAccessCodeState(code);
    refreshUsage();
  }

  function signOut() {
    localStorage.removeItem("vitruvi_token");
    localStorage.removeItem("vitruvi_access_code");
    setAuthToken(null);
    setAuthUser(null);
    setAccessCodeState(null);
    refreshUsage();
  }

  async function upgrade() {
    setError(null);
    const r = await apiFetch("/api/stripe/checkout", { method: "POST" });
    const { data: j, text } = await readJson<any>(r);
    if (!r.ok) {
      setError((j?.error ?? text) || "Failed");
      return;
    }
    if (j?.url) window.location.href = j.url;
  }

  function openAuthModal(mode: "login" | "register" | "accessCode" = "login") {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  }

  const status = base?.project_status === "completed" ? "Completed" : base?.project_status === "under_construction" ? "Under Construction" : "Unknown";
  let stageLabel = normalizeStage(base?.stage_of_construction, base?.project_status);

  const rawProgress = Math.min(100, Math.max(0, base?.progress_percent ?? 0));
  const stageRange = STAGE_RANGES.find((range) => range.label === stageLabel);
  const progressValue = stageRange ? Math.min(stageRange.max, Math.max(stageRange.min, rawProgress)) : rawProgress;
  const baseValid = !!base && (status === "Completed" ? progressValue === 100 : stageRange ? progressValue >= stageRange.min && progressValue <= stageRange.max : false);

  const clampFloat = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const geoFactors = base?.geo_market_factors;
  const policyText = (geoFactors?.policy_posture ?? "balanced").toLowerCase();
  const masterPlanZone = geoFactors?.master_plan_zone ?? "Not inferred";
  const valuation = computeValuation({
    projectType: meta.projectType,
    scale: meta.scale,
    status,
    stageLabel,
    progressValue,
    location: meta.location,
    note: meta.note,
    geoStatus,
    categoryRow: selectedCategoryRow,
    geoFactors,
    aiValuation: base?.ai_valuation ?? undefined
  });
  const comparableCount = valuation.metrics.comparableCount;
  const cityGrowthPct = valuation.metrics.cityGrowthPct;
  const propertyGrowthPct = valuation.metrics.propertyGrowthPct;
  const landGrowthPct = valuation.metrics.landGrowthPct;
  const propertyAgeYears = valuation.metrics.propertyAgeYears;
  const resaleValuePct = valuation.metrics.resaleValuePct;
  const roiPct = valuation.metrics.roiPct;
  const minVal = valuation.property.low;
  const maxVal = valuation.property.high;
  const minLand = valuation.land.low;
  const maxLand = valuation.land.high;
  const minProject = valuation.project.low;
  const maxProject = valuation.project.high;
  const valuationConfidence = valuation.confidence;
  const valuationWarnings = valuation.warnings;
  const roiDisplay = `${roiPct >= 0 ? "+" : ""}${roiPct.toFixed(1)}%`;
  const cityGrowthDisplay = `${cityGrowthPct >= 0 ? "+" : ""}${cityGrowthPct.toFixed(1)}%`;
  const propertyGrowthDisplay = `${propertyGrowthPct >= 0 ? "+" : ""}${propertyGrowthPct.toFixed(1)}%`;
  const landGrowthDisplay = `${landGrowthPct >= 0 ? "+" : ""}${landGrowthPct.toFixed(1)}%`;
  const resaleDisplay = `${resaleValuePct.toFixed(1)}%`;
  const roiMeterMin = -20;
  const roiMeterMax = 40;
  const roiMeterValue = baseValid ? clampFloat(((roiPct - roiMeterMin) / (roiMeterMax - roiMeterMin)) * 100, 0, 100) : 0;

  const errorShort = error ? compactWords(error, 2) : null;

  const advancedInsights = advanced?.recommendations?.map((item) => cleanSentence(item)) ?? [];
  const buyInsights: string[] = [];
  const sellInsights: string[] = [];
  const buySet = new Set<string>();
  const sellSet = new Set<string>();
  const addBuy = (value: string) => {
    const cleaned = cleanSentence(value);
    if (!buySet.has(cleaned)) {
      buySet.add(cleaned);
      buyInsights.push(cleaned);
    }
  };
  const addSell = (value: string) => {
    const cleaned = cleanSentence(value);
    if (!sellSet.has(cleaned)) {
      sellSet.add(cleaned);
      sellInsights.push(cleaned);
    }
  };

  if (!baseValid) {
    addBuy(t("awaitingBase"));
    addSell(t("awaitingBase"));
  } else if (paywalled) {
    addBuy(t("revealRisks"));
    addSell(t("revealRisks"));
  } else {
    if (roiPct >= 12) addBuy("Projected ROI is strong; buying is favorable if legal and structural checks pass.");
    else if (roiPct >= 7) addBuy("ROI is moderate; negotiate entry price and transaction costs before committing.");
    else addBuy("ROI is currently low; buy only with a discount or a clear value-add plan.");

    if (propertyGrowthPct > 15 || landGrowthPct > 18) {
      addBuy("Growth momentum is high, but avoid overbidding during peak pricing cycles.");
      addSell("Current growth momentum supports premium exits if listing quality is strong.");
    } else if (propertyGrowthPct < 4 && landGrowthPct < 4) {
      addBuy("Demand growth is soft; prioritize downside protection in your bid.");
      addSell("Price growth is soft; consider waiting unless liquidity is urgent.");
    }

    if (comparableCount < 10) {
      addBuy("Comparable depth is thin; use an independent appraisal before final offer.");
      addSell("Comparable depth is thin; list with a wider negotiation band.");
    }

    if (propertyAgeYears > 20) {
      addBuy("Older asset profile implies additional capex; budget for upgrades before purchase.");
      addSell("Pre-listing repairs can materially improve buyer confidence and closing value.");
    }

    if (resaleValuePct > 112) {
      addBuy("Resale strength is above baseline, supporting better medium-term exit flexibility.");
      addSell("Resale signal is strong; this is generally a seller-friendly positioning window.");
    } else if (resaleValuePct < 95) {
      addBuy("Resale signal is weaker than baseline; target a conservative acquisition price.");
      addSell("Resale pressure is visible; focus on pricing realism and faster closing strategy.");
    }

    if (masterPlanZone.toLowerCase().includes("industrial") && meta.projectType === "Residential") {
      addBuy("Industrial zoning adjacency may pressure residential livability and long-term resale demand.");
      addSell("If residential demand is mixed, highlight accessibility and amenity offsets in listing.");
    }

    if (policyText.includes("pro-commerce") || policyText.includes("pro-industry")) {
      addBuy("Policy posture is development-friendly, which can support approvals and demand depth.");
      addSell("Use policy momentum in marketing narrative to justify pricing confidence.");
    }
    if (valuationConfidence < 45) {
      addBuy("Confidence is low because geo/comp signals are weak; widen your safety margin before purchase.");
      addSell("Confidence is low; price with a wider negotiation band to improve liquidity.");
    }
    if (valuationWarnings.length > 0) {
      addBuy("One or more inputs were clamped to realistic limits; verify zoning, age, and comparables before offer.");
      addSell("Some model inputs were clipped as outliers; validate dossier quality before listing.");
    }

    if (!buyInsights.length) addBuy("Acquisition outlook is balanced; proceed with standard due diligence.");
    if (!sellInsights.length) addSell("Exit outlook is balanced; list at market-clearing price with negotiation room.");

    advancedInsights.slice(0, 1).forEach((item) => {
      addBuy(item);
      addSell(item);
    });
  }

  const buyInsightSignature = buyInsights.slice(0, 4).join("\u001f");
  const sellInsightSignature = sellInsights.slice(0, 4).join("\u001f");
  const notesSignature = (base?.notes ?? []).slice(0, 4).join("\u001f");
  const answerSourceTexts = useMemo(() => {
    const source = ["If Purchasing", "If Selling", ...buyInsights.slice(0, 4), ...sellInsights.slice(0, 4), ...(base?.notes ?? []).slice(0, 4)];
    const unique = new Set<string>();
    source.forEach((value) => {
      const cleaned = value.replace(/\s+/g, " ").trim();
      if (cleaned) unique.add(cleaned);
    });
    return Array.from(unique);
  }, [buyInsightSignature, sellInsightSignature, notesSignature]);

  useEffect(() => {
    let active = true;

    if (lang === "EN" || !answerSourceTexts.length) {
      setAnswerTranslations({});
      return () => {
        active = false;
      };
    }

    const translateAnswers = async () => {
      try {
        const r = await apiFetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ language: languageName, texts: answerSourceTexts })
        });
        const text = await r.text();
        let parsed: { items?: string[] } | null = null;
        try {
          parsed = text ? (JSON.parse(text) as { items?: string[] }) : null;
        } catch {
          parsed = null;
        }

        if (!active) return;
        const translatedItems = Array.isArray(parsed?.items) ? parsed.items : [];
        if (!r.ok || translatedItems.length !== answerSourceTexts.length) {
          setAnswerTranslations({});
          return;
        }

        const next: Record<string, string> = {};
        answerSourceTexts.forEach((source, idx) => {
          const translated = typeof translatedItems[idx] === "string" ? translatedItems[idx].trim() : "";
          if (translated) next[source] = translated;
        });
        setAnswerTranslations(next);
      } catch {
        if (!active) return;
        setAnswerTranslations({});
      }
    };

    translateAnswers();
    return () => {
      active = false;
    };
  }, [lang, languageName, answerSourceTexts, apiFetch]);

  const trAnswer = useCallback(
    (value: string) => {
      if (lang === "EN") return value;
      return answerTranslations[value] ?? value;
    },
    [lang, answerTranslations]
  );

  const pendingValue = <span className="text-zinc-300 dark:text-zinc-600 italic">Pending</span>;
  const premium = (value: React.ReactNode) => (paywalled ? <span className="text-zinc-400 dark:text-zinc-600 italic">Locked</span> : value);

  const fxRate = rates?.rates?.[currency];
  const fxInfo =
    rateStatus === "ok" && fxRate
      ? `FX: 1 ${rates?.base ?? "USD"} = ${fxRate.toFixed(3)} ${currency}`
      : rateStatus === "error"
        ? "FX unavailable"
        : "FX loading";
  const microcopy = (valuationTuning as any).microcopy as Record<string, string>;
  const iCopy = (key: string, fallback: string) => microcopy[key] ?? fallback;

  return (
    <div className="min-h-screen selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-zinc-400/10 blur-[120px] dark:bg-zinc-600/5" />
        <div className="absolute top-[20%] -right-[10%] h-[50%] w-[50%] rounded-full bg-emerald-400/10 blur-[120px] dark:bg-emerald-600/5" />
        <div className="absolute -bottom-[10%] left-[20%] h-[40%] w-[40%] rounded-full bg-blue-400/10 blur-[120px] dark:bg-blue-600/5" />
      </div>

      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex max-w-[1600px] items-center justify-between px-8 pt-10"
      >
        <div className="flex items-center gap-6">
          <div className="group cursor-default">
            <h1 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white transition-all">Valuator</h1>
            <div className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-500">Builtattic</div>
          </div>
          {errorShort && (
            <Badge variant="outline" className="border-red-500/30 text-red-500 bg-red-500/5 backdrop-blur-md px-3 py-1">
              {errorShort}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-4 lg:flex">
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-4 py-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{t("lang")}</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                className="bg-transparent text-xs font-black text-zinc-900 dark:text-zinc-100 outline-none"
              >
                {LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-white dark:bg-zinc-900">{o.label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-1 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/50 p-1 backdrop-blur-md">
              {(['light', 'dark'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTheme(m)}
                  className={`rounded-xl px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    theme === m ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  {t(m)}
                </button>
              ))}
            </div>
          </div>

          {authUser ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] font-black text-zinc-900 dark:text-white">{authUser.name || authUser.email.split("@")[0]}</div>
                <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400">{usage?.paid ? 'PRO' : 'FREE'}</div>
              </div>
              <Button variant="outline" onClick={signOut} className="h-10 w-10 rounded-2xl border-zinc-200/50 dark:border-zinc-800/50 p-0 hover:bg-red-50 dark:hover:bg-red-950/20">
                <span className="text-xs italic">Exit</span>
              </Button>
            </div>
          ) : (
            <Button onClick={() => openAuthModal("login")} className="h-11 rounded-2xl bg-zinc-900 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-white dark:bg-white dark:text-zinc-900">
              Access
            </Button>
          )}
        </div>
      </motion.header>

      <main className="mx-auto max-w-[1700px] px-8 py-12">
        <AnimatePresence mode="wait">
          {!baseValid ? (
            <motion.div 
              key="initial"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95 }}
              variants={containerVariants}
              className="flex flex-col items-center space-y-12"
            >
              <motion.div variants={itemVariants} className="text-center">
                <Badge variant="secondary" className="mb-6 rounded-full bg-zinc-900/5 dark:bg-white/5 px-6 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                  {iCopy("hero_badge", "Architectural Intelligence Platform")}
                </Badge>
                <h2 className="text-6xl font-black tracking-tighter text-zinc-900 dark:text-white sm:text-8xl">
                  Analyze. Value. <span className="text-zinc-400 dark:text-zinc-600">Iterate.</span>
                </h2>
              </motion.div>

              <motion.div 
                variants={itemVariants}
                className="group relative h-[450px] w-full max-w-[700px] overflow-hidden rounded-[56px] border-[16px] border-white dark:border-zinc-900 bg-white dark:bg-zinc-900 shadow-[0_50px_120px_-20px_rgba(0,0,0,0.18)] transition-all duration-700 hover:scale-[1.01]"
              >
                <button
                  onClick={() => browseInputRef.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-8 bg-zinc-50 dark:bg-zinc-950 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  {imageDataUrl ? (
                    <img src={imageDataUrl} className="h-full w-full object-cover grayscale-[0.1] contrast-[1.05]" alt="Preview" />
                  ) : (
                    <>
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-900/5 dark:bg-white/5 text-3xl">📸</div>
                      <div className="space-y-2 text-center">
                        <div className="text-lg font-black text-zinc-900 dark:text-white">{t("browse")} / {t("live")}</div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Click to ingest visual data</div>
                      </div>
                    </>
                  )}
                </button>
              </motion.div>

              <motion.div variants={itemVariants} className="w-full max-w-[600px] space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <input
                      value={meta.location}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMeta(s => ({ ...s, location: val }));
                        setGeoStatus(val ? "manual" : "none");
                      }}
                      placeholder={t("location") + "..."}
                      className="w-full h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 px-8 text-sm font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 ring-zinc-900/5 dark:ring-white/5 transition-all"
                    />
                    <button 
                      onClick={requestGps}
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-8 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                    >
                      {t("gps")}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['projectType', 'scale'].map((field) => (
                      <select
                        key={field}
                        value={(meta as any)[field]}
                        onChange={(e) => setMeta(s => ({ ...s, [field]: e.target.value }))}
                        className="h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none appearance-none text-center"
                      >
                        {field === 'projectType' && ['Residential', 'Commercial', 'Industrial', 'Mixed-use'].map(o => <option key={o} value={o}>{o}</option>)}
                        {field === 'scale' && ['Low-rise', 'Mid-rise', 'High-rise', 'Large-site'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={runBase}
                  disabled={!imageDataUrl || loading || !canRun}
                  className="h-20 w-full rounded-[32px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase tracking-[0.5em] text-sm shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-20"
                >
                  {loading ? "Synthesizing Architecture..." : t("analyze")}
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              key="analyzed"
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="grid grid-cols-1 gap-8 lg:grid-cols-12"
            >
              {/* Left Column: Intelligence & Market */}
              <div className="lg:col-span-3 space-y-8">
                <div className="space-y-6">
                  <Label className="pl-2">Strategic Intelligence</Label>
                  <motion.div variants={itemVariants} className="rounded-[32px] bg-white/40 dark:bg-zinc-900/40 p-6 backdrop-blur-xl border border-zinc-200/30 dark:border-zinc-800/30 shadow-sm">
                    <div className="mb-5 inline-flex rounded-xl bg-zinc-900 dark:bg-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white dark:text-zinc-900">Purchase Strategy</div>
                    <ul className="space-y-4">
                      {buyInsights.slice(0, 4).map((item, i) => (
                        <li key={i} className="flex gap-4 text-[12px] font-bold leading-relaxed text-zinc-600 dark:text-zinc-300">
                          <span className="text-zinc-400 font-black text-[10px] pt-0.5">0{i+1}</span>
                          <span>{trAnswer(item)}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                  <motion.div variants={itemVariants} className="rounded-[32px] border border-zinc-200/30 dark:border-zinc-800/30 p-6 bg-zinc-50/30 dark:bg-zinc-900/20">
                    <div className="mb-5 inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Exit Strategy</div>
                    <ul className="space-y-4">
                      {sellInsights.slice(0, 4).map((item, i) => (
                        <li key={i} className="flex gap-4 text-[12px] font-bold leading-relaxed text-zinc-600 dark:text-zinc-300">
                          <span className="text-zinc-400 font-black text-[10px] pt-0.5">0{i+1}</span>
                          <span>{trAnswer(item)}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </div>

                <div className="space-y-6 pt-4">
                  <Label className="pl-2">Market Velocity</Label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <StatCard label="City Growth" value={premium(cityGrowthDisplay)} />
                    <StatCard label="Land Growth" value={premium(landGrowthDisplay)} />
                    <StatCard label="Built Growth" value={premium(propertyGrowthDisplay)} />
                    <StatCard label="Age Index" value={premium(`${Math.round(propertyAgeYears)}y`)} />
                  </div>
                </div>
              </div>

              {/* Center Column: The Subject & Core Metrics */}
              <div className="lg:col-span-6 space-y-8">
                <motion.div 
                  variants={itemVariants}
                  className="group relative h-[500px] w-full overflow-hidden rounded-[64px] border-[16px] border-white dark:border-zinc-900 bg-white dark:bg-zinc-900 shadow-[0_60px_150px_-30px_rgba(0,0,0,0.25)]"
                >
                  <img src={imageDataUrl!} className="h-full w-full object-cover grayscale-[0.05] contrast-[1.02]" alt="Subject" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-12 text-white">
                    {base?.famous_building?.is_famous ? (
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400">Identified Landmark</div>
                        <h3 className="text-4xl font-black tracking-tighter">{base.famous_building.name}</h3>
                        <div className="flex items-center gap-4 text-xs font-bold text-zinc-300">
                          <span>{base.famous_building.city}, {base.famous_building.country}</span>
                          <span className="h-1 w-1 rounded-full bg-white/30" />
                          <span>{base.famous_building.architect}</span>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400">Analysis Subject</div>
                        <h3 className="text-4xl font-black tracking-tighter">{meta.location || "Inferred Coordinates"}</h3>
                      </div>
                    )}
                  </div>
                </motion.div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <StatCard label={t("propertyVal")} value={premium(formatCurrencyRange(currency, minVal, maxVal, rates))} className="sm:col-span-2 py-8" />
                  <StatCard label="Model ROI" value={premium(roiDisplay)} tag={
                    <div className="relative h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mt-4">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${roiMeterValue}%` }} transition={{ duration: 2.5 }} className="h-full bg-zinc-900 dark:bg-white" />
                    </div>
                  } className="py-8" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <StatCard label={t("landVal")} value={premium(formatCurrencyRange(currency, minLand, maxLand, rates))} />
                  <StatCard label={t("projectVal")} value={premium(formatCurrencyRange(currency, minProject, maxProject, rates))} />
                </div>
              </div>

              {/* Right Column: Structure & Advanced */}
              <div className="lg:col-span-3 space-y-8">
                <div className="space-y-6">
                  <Label className="pl-2">Structural Matrix</Label>
                  <motion.div variants={itemVariants} className="rounded-[40px] bg-white/20 dark:bg-zinc-900/20 p-8 backdrop-blur-3xl border border-zinc-200/30 dark:border-zinc-800/30">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                      {categoryEntries.slice(0, 10).map((e) => (
                        <MatrixEntry key={e.label} label={e.label} value={e.value} />
                      ))}
                    </div>
                  </motion.div>
                </div>

                <div className="space-y-6">
                  <Label className="pl-2">Market Context</Label>
                  <div className="space-y-4">
                    <StatCard label="Terrain / Soil" value={premium(`${geoFactors?.terrain ?? "-"} / ${geoFactors?.soil_condition ?? "-"}`)} />
                    <StatCard label="Policy & Zone" value={premium(`${geoFactors?.policy_posture ?? "-"} / ${masterPlanZone}`)} />
                    <StatCard label="Comparable Units" value={premium(`${Math.round(comparableCount)} Depth`)} />
                    <StatCard label="Exit Liquidity" value={premium(resaleDisplay)} />
                  </div>
                </div>

                <motion.div variants={itemVariants} className="pt-4">
                  <Button
                    onClick={runAdvanced}
                    disabled={advLoading || paywalled}
                    className="h-20 w-full rounded-[32px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase tracking-[0.4em] text-[11px] shadow-2xl active:scale-95 transition-all"
                  >
                    {advLoading ? "Deep Mining..." : "Reveal Risk Signals"}
                  </Button>
                </motion.div>
                
                {advanced && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] bg-emerald-500/5 border border-emerald-500/20 p-6">
                    <Label className="text-emerald-600 dark:text-emerald-400 mb-4">Risk Recommendations</Label>
                    <ul className="space-y-3">
                      {advanced.recommendations.slice(0, 2).map((r, i) => (
                        <li key={i} className="text-[11px] font-bold leading-relaxed text-emerald-800 dark:text-emerald-200 flex gap-3">
                          <span className="shrink-0">•</span>
                          <span>{trAnswer(r)}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>


      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authModalMode}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onAccessCode={handleAccessCode}
      />
      
      <input ref={browseInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />
      <input ref={liveInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />
    </div>
  );
}
