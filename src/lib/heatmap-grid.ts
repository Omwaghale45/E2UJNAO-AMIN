import {
  squareGrid,
  centroid as turfCentroid,
  distance as turfDistance,
  booleanPointInPolygon,
} from "@turf/turf";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  flashFloodEvents,
  landslideEvents,
  type HazardEvent,
  type Severity,
} from "@/data/hazards";
import { rudraprayagBoundary } from "@/data/boundaries/rudraprayag";

const CELL_SIZE_KM = 0.8; // 800m x 800m grid cells

// Events farther than this from a cell contribute ~nothing to its risk.
const INFLUENCE_RADIUS_KM = 6;

// Keeps inverse-distance weighting finite for a cell that sits right on
// top of an event's coordinates.
const DISTANCE_EPSILON_KM = 0.05;

const RISK_RED_THRESHOLD = 70;
const RISK_ORANGE_THRESHOLD = 40;

// Stand-in for a real ML risk score per event, since no prediction
// endpoint exists yet — derived from the event's existing severity
// classification. Events without a severity (older historical records)
// fall back to a mid-low weight.
const SEVERITY_WEIGHT: Record<Severity, number> = {
  EXTREME: 100,
  CRITICAL: 75,
  HIGH: 55,
};
const HISTORICAL_EVENT_WEIGHT = 45;

export type RiskLevel = "green" | "orange" | "red";

export interface RiskGridProperties {
  riskValue: number;
  riskLevel: RiskLevel;
}

export type RiskGridCollection = FeatureCollection<Polygon, RiskGridProperties>;

function classify(riskValue: number): RiskLevel {
  if (riskValue >= RISK_RED_THRESHOLD) return "red";
  if (riskValue >= RISK_ORANGE_THRESHOLD) return "orange";
  return "green";
}

function eventWeight(severity: Severity | undefined): number {
  return severity ? SEVERITY_WEIGHT[severity] : HISTORICAL_EVENT_WEIGHT;
}

function boundaryBbox(boundary: Feature<Polygon>): [number, number, number, number] {
  const ring = boundary.geometry.coordinates[0];
  const lons = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

// Inverse-distance-weighted risk from nearby flash-flood + landslide
// events, combined into a single 0-100 score.
function computeCellRisk(lon: number, lat: number, events: HazardEvent[]): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const event of events) {
    const d = turfDistance([lon, lat], [event.longitude, event.latitude], {
      units: "kilometers",
    });
    if (d > INFLUENCE_RADIUS_KM) continue;

    const weight = 1 / Math.pow(d + DISTANCE_EPSILON_KM, 2);
    weightedSum += weight * eventWeight(event.severity);
    weightTotal += weight;
  }

  if (weightTotal === 0) return 0;
  return Math.min(100, Math.round(weightedSum / weightTotal));
}

// SYNTHETIC DATA — placeholder for a backend risk-prediction API.
// Swap this function's body for a fetch() to the real endpoint once
// one is provided; keep the return shape (RiskGridCollection)
// identical so the map layer needs no changes.
export function getRudraprayagRiskGrid(): RiskGridCollection {
  const bbox = boundaryBbox(rudraprayagBoundary);
  const grid = squareGrid(bbox, CELL_SIZE_KM, { units: "kilometers" });

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const padding = 0.3; // degrees, generous enough to catch nearby events just outside the box
  const nearbyEvents = [...flashFloodEvents, ...landslideEvents].filter(
    (event) =>
      event.longitude >= minLon - padding &&
      event.longitude <= maxLon + padding &&
      event.latitude >= minLat - padding &&
      event.latitude <= maxLat + padding
  );

  // Clip to the district's actual outline (not the bounding box) so
  // the grid follows Rudraprayag's real shape instead of a rectangle.
  const features: Feature<Polygon, RiskGridProperties>[] = [];
  for (const cell of grid.features) {
    const [lon, lat] = turfCentroid(cell).geometry.coordinates;
    if (!booleanPointInPolygon([lon, lat], rudraprayagBoundary)) continue;

    const riskValue = computeCellRisk(lon, lat, nearbyEvents);
    features.push({
      ...cell,
      properties: { riskValue, riskLevel: classify(riskValue) },
    });
  }

  return { type: "FeatureCollection", features };
}
