import type { Feature, Polygon } from "geojson";

// Approximate Rudraprayag district boundary (Uttarakhand, India), traced
// as an irregular outline (not a bounding-box rectangle) so the risk
// grid clips to a realistic district shape. Not survey-accurate —
// replace with an official shapefile/GeoJSON if precise limits are
// needed later.
export const rudraprayagBoundary: Feature<Polygon, { name: string; state: string }> = {
  type: "Feature",
  properties: {
    name: "Rudraprayag",
    state: "Uttarakhand",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [78.70, 30.20],
        [78.85, 30.15],
        [79.05, 30.18],
        [79.20, 30.25],
        [79.30, 30.35],
        [79.28, 30.48],
        [79.15, 30.55],
        [79.20, 30.65],
        [79.05, 30.72],
        [78.90, 30.68],
        [78.75, 30.60],
        [78.65, 30.50],
        [78.68, 30.38],
        [78.60, 30.28],
        [78.70, 30.20],
      ],
    ],
  },
};

export const rudraprayagCenter: [number, number] = [78.98, 30.45];
