import { clamp, createSeededRandom, pick, randRange } from "./seeded-random";

export const RISK_WARNING = 60;
export const RISK_DANGER = 75;
export const RISK_EXTREME = 90;

export type LandslideParameterGroup =
  | "Rainfall"
  | "Ground Conditions"
  | "Terrain & Land"
  | "History & Triggers"
  | "Atmosphere";

export interface LandslideParameter {
  group: LandslideParameterGroup;
  label: string;
  value: string;
}

export interface LandslideForecastPoint {
  hour: number;
  risk: number;
}

export interface LandslidePrediction {
  parameters: LandslideParameter[];
  forecast: LandslideForecastPoint[];
  etaHours: number | null;
}

const LAND_COVER_OPTIONS = [
  "Dense forest",
  "Sparse vegetation",
  "Grassland",
  "Bare soil / rock",
  "Agricultural terraces",
  "Urban / built-up",
];
const DRAINAGE_OPTIONS = [
  "Well drained",
  "Moderately drained",
  "Poorly drained",
  "Waterlogged",
];
const ROAD_CUTTING_OPTIONS = [
  "None",
  "Minor cutting",
  "Moderate cutting",
  "Heavy cutting / excavation",
];
const HISTORY_OPTIONS = [
  "No prior record",
  "One prior event",
  "Multiple prior events",
  "Chronic landslide zone",
];

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Every value here is synthetic — generated from the 16 parameters the
// user specified for landslide prediction — not a real sensor feed.
// The forecast/ETA is a simple illustrative composite of the
// rainfall- and ground-condition-related parameters, projected hourly.
export function buildLandslidePrediction(
  seed: string,
  baselineRisk: number
): LandslidePrediction {
  const random = createSeededRandom(seed);

  const rainfallIntensity = randRange(random, 2, 100);
  const cumulative3h = randRange(random, 0, 50);
  const cumulative6h = cumulative3h + randRange(random, 0, 60);
  const cumulative12h = cumulative6h + randRange(random, 0, 70);
  const cumulative24h = cumulative12h + randRange(random, 0, 90);
  const cumulative3d = cumulative24h + randRange(random, 20, 200);
  const cumulative7d = cumulative3d + randRange(random, 40, 350);
  const soilSaturation = randRange(random, 20, 100);
  const poreWaterPressure = randRange(random, 5, 95);
  const groundDisplacement = randRange(random, 0, 150);
  const slopeAngle = randRange(random, 10, 60);
  const slopeTilt = randRange(random, 0, 25);
  const elevation = randRange(random, 300, 4200);
  const landCover = pick(random, LAND_COVER_OPTIONS);
  const drainage = pick(random, DRAINAGE_OPTIONS);
  const distanceFromRiver = randRange(random, 0.1, 10);
  const roadCutting = pick(random, ROAD_CUTTING_OPTIONS);
  const priorHistory = pick(random, HISTORY_OPTIONS);
  const seismicActivity = randRange(random, 0, 5.5);
  const temperature = randRange(random, 0, 30);
  const wind = randRange(random, 0, 40);

  const parameters: LandslideParameter[] = [
    { group: "Rainfall", label: "Rainfall intensity", value: `${rainfallIntensity.toFixed(1)} mm/hr` },
    { group: "Rainfall", label: "Cumulative (3h)", value: `${cumulative3h.toFixed(0)} mm` },
    { group: "Rainfall", label: "Cumulative (6h)", value: `${cumulative6h.toFixed(0)} mm` },
    { group: "Rainfall", label: "Cumulative (12h)", value: `${cumulative12h.toFixed(0)} mm` },
    { group: "Rainfall", label: "Cumulative (24h)", value: `${cumulative24h.toFixed(0)} mm` },
    { group: "Rainfall", label: "Cumulative (3d)", value: `${cumulative3d.toFixed(0)} mm` },
    { group: "Rainfall", label: "Cumulative (7d)", value: `${cumulative7d.toFixed(0)} mm` },
    { group: "Ground Conditions", label: "Soil moisture / saturation", value: `${soilSaturation.toFixed(0)}%` },
    { group: "Ground Conditions", label: "Pore-water pressure", value: `${poreWaterPressure.toFixed(0)} kPa` },
    { group: "Ground Conditions", label: "Ground displacement", value: `${groundDisplacement.toFixed(0)} mm` },
    { group: "Ground Conditions", label: "Slope deformation / tilt", value: `${slopeTilt.toFixed(1)} mm/day` },
    { group: "Terrain & Land", label: "Slope angle", value: `${slopeAngle.toFixed(0)}°` },
    { group: "Terrain & Land", label: "Elevation", value: `${elevation.toFixed(0)} m` },
    { group: "Terrain & Land", label: "Land-cover / vegetation", value: landCover },
    { group: "Terrain & Land", label: "Drainage / surface water", value: drainage },
    { group: "Terrain & Land", label: "Distance from rivers/streams", value: `${distanceFromRiver.toFixed(1)} km` },
    { group: "Terrain & Land", label: "Road cutting / excavation", value: roadCutting },
    { group: "History & Triggers", label: "Previous landslide history", value: priorHistory },
    { group: "History & Triggers", label: "Seismic activity", value: `M${seismicActivity.toFixed(1)} (30-day)` },
    { group: "Atmosphere", label: "Temperature", value: `${temperature.toFixed(1)} °C` },
    { group: "Atmosphere", label: "Wind", value: `${wind.toFixed(0)} km/hr` },
  ];

  const rainSignal = clamp01(
    (cumulative24h / 150 + cumulative3d / 300 + cumulative7d / 500) / 3
  );
  const groundSignal = clamp01(
    (soilSaturation / 100 + poreWaterPressure / 100 + slopeTilt / 25 + groundDisplacement / 150) / 4
  );
  const driftPerHour = (rainSignal * 0.5 + groundSignal * 0.5) * 6;

  let risk = baselineRisk;
  const forecast: LandslideForecastPoint[] = [{ hour: 0, risk: round1(risk) }];
  let etaHours: number | null = null;

  for (let hour = 1; hour <= 12; hour++) {
    const noise = (random() - 0.5) * 4;
    risk = clamp(risk + driftPerHour + noise, 0, 100);
    forecast.push({ hour, risk: round1(risk) });
    if (etaHours === null && risk >= RISK_DANGER) {
      etaHours = hour;
    }
  }

  return { parameters, forecast, etaHours };
}
