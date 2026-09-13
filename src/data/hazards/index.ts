import { flashFloodEvents } from "./flash-flood";
import { landslideEvents } from "./landslide";
import type { HazardEvent } from "./types";

// "device-location" isn't a hazard-event category — monitoring stations
// are infrastructure, not occurrences (see devices.ts) — so it's kept
// out of this event-shaped union rather than force-merged into "all".
export type HazardCategory = "flash-flood" | "landslide";

// What the header's filter menu can select. "device-location" isn't a
// HazardCategory (see above) since it swaps in the device layer instead
// of filtering hazard events.
export type MapFilter = HazardCategory | "device-location" | "all";

export const hazardEventsByCategory: Record<HazardCategory, HazardEvent[]> = {
  "flash-flood": flashFloodEvents,
  landslide: landslideEvents,
};

export function getHazardEvents(
  category: HazardCategory | "all"
): HazardEvent[] {
  if (category === "all") {
    return [...flashFloodEvents, ...landslideEvents];
  }
  return hazardEventsByCategory[category];
}

export * from "./types";
export { flashFloodEvents, flashFloodMeta } from "./flash-flood";
export { landslideEvents, landslideMeta } from "./landslide";
export { deviceStations, devicesMeta } from "./devices";
