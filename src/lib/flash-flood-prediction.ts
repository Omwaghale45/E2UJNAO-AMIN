import { clamp, createSeededRandom, pick, randRange } from "./seeded-random";

export const RISK_WARNING = 60;
export const RISK_DANGER = 75;
export const RISK_EXTREME = 90;

export type FlashFloodParameterGroup =
  | "Rainfall"
  | "Hydrology"
  | "Catchment & Terrain"
  | "Atmosphere";

export interface FlashFloodParameter {
  group: FlashFloodParameterGroup;
  label: string;
  value: string;
}

export interface FlashFloodForecastPoint {
  hour: number;
  risk: number;
}

export interface FlashFloodPrediction {
  parameters: FlashFloodParameter[];
  forecast: FlashFloodForecastPoint[];
  etaHours: number | null;
}

const LAND_USE_OPTIONS = [
  "Forest",
  "Agricultural",
  "Barren / Rocky",
  "Urban / Built-up",
  "Grassland",
  "Snow / Glacier",
];

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Every value here is synthetic — generated from the 17 parameters the
// user specified for flash-flood prediction — not a real sensor feed.
// The forecast/ETA is a simple illustrative composite of the
// rainfall- and hydrology-related parameters, projected hourly.
export function buildFlashFloodPrediction(
  seed: string,
  baselineRisk: number
): FlashFloodPrediction {
  const random = createSeededRandom(seed);

  const rainfallIntensity = randRange(random, 5, 120);
  const accum1h = randRange(random, 5, 60);
  const accum3h = accum1h + randRange(random, 10, 90);
  const accum6h = accum3h + randRange(random, 10, 90);
  const accum24h = accum6h + randRange(random, 20, 150);
  const upstreamRainfall = randRange(random, 10, 200);
  const forecastRainfall = randRange(random, 0, 180);
  const waterLevel = randRange(random, 1, 9);
  const discharge = randRange(random, 20, 2000);
  const rateOfRise = randRange(random, 0.05, 1.5);
  const distanceUpstream = randRange(random, 2, 60);
  const flowVelocity = randRange(random, 0.3, 4.5);
  const catchmentArea = randRange(random, 50, 3000);
  const elevation = randRange(random, 500, 3800);
  const slope = randRange(random, 5, 45);
  const soilMoisture = randRange(random, 20, 95);
  const landUse = pick(random, LAND_USE_OPTIONS);
  const drainageDensity = randRange(random, 0.5, 3.5);
  const channelGeometry = randRange(random, 10, 400);
  const temperature = randRange(random, 5, 32);
  const groundwaterLevel = randRange(random, 1, 15);

  const parameters: FlashFloodParameter[] = [
    { group: "Rainfall", label: "Rainfall intensity", value: `${rainfallIntensity.toFixed(1)} mm/hr` },
    { group: "Rainfall", label: "Accumulated (1h)", value: `${accum1h.toFixed(0)} mm` },
    { group: "Rainfall", label: "Accumulated (3h)", value: `${accum3h.toFixed(0)} mm` },
    { group: "Rainfall", label: "Accumulated (6h)", value: `${accum6h.toFixed(0)} mm` },
    { group: "Rainfall", label: "Accumulated (24h)", value: `${accum24h.toFixed(0)} mm` },
    { group: "Rainfall", label: "Upstream rainfall", value: `${upstreamRainfall.toFixed(0)} mm` },
    { group: "Rainfall", label: "Forecast rainfall (6h)", value: `${forecastRainfall.toFixed(0)} mm` },
    { group: "Hydrology", label: "River/stream water level", value: `${waterLevel.toFixed(2)} m` },
    { group: "Hydrology", label: "River discharge / flow rate", value: `${discharge.toFixed(0)} m³/s` },
    { group: "Hydrology", label: "Rate of rise", value: `${rateOfRise.toFixed(2)} m/hr` },
    { group: "Hydrology", label: "Flow velocity", value: `${flowVelocity.toFixed(2)} m/s` },
    { group: "Hydrology", label: "Groundwater level (depth)", value: `${groundwaterLevel.toFixed(1)} m` },
    { group: "Catchment & Terrain", label: "Distance from upstream gauge", value: `${distanceUpstream.toFixed(1)} km` },
    { group: "Catchment & Terrain", label: "Catchment area upstream", value: `${catchmentArea.toFixed(0)} km²` },
    { group: "Catchment & Terrain", label: "Slope / elevation", value: `${slope.toFixed(0)}° / ${elevation.toFixed(0)} m` },
    { group: "Catchment & Terrain", label: "Soil moisture (antecedent wetness)", value: `${soilMoisture.toFixed(0)}%` },
    { group: "Catchment & Terrain", label: "Land use / land cover", value: landUse },
    { group: "Catchment & Terrain", label: "Drainage density", value: `${drainageDensity.toFixed(2)} km/km²` },
    { group: "Catchment & Terrain", label: "River cross-section / geometry", value: `${channelGeometry.toFixed(0)} m²` },
    { group: "Atmosphere", label: "Temperature", value: `${temperature.toFixed(1)} °C` },
  ];

  const rainSignal = clamp01(
    (accum24h / 300 + rainfallIntensity / 100 + forecastRainfall / 150) / 3
  );
  const hydroSignal = clamp01((rateOfRise / 1.2 + soilMoisture / 100) / 2);
  const driftPerHour = (rainSignal * 0.6 + hydroSignal * 0.4) * 6;

  let risk = baselineRisk;
  const forecast: FlashFloodForecastPoint[] = [{ hour: 0, risk: round1(risk) }];
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
