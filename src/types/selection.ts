import type { HazardEvent, MonitoringStation } from "@/data/hazards";

export type SelectedItem =
  | { kind: "hazard"; data: HazardEvent }
  | { kind: "station"; data: MonitoringStation };
