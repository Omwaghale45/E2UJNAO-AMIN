export type Severity = "EXTREME" | "CRITICAL" | "HIGH";

export interface HazardEvent {
  id: string;
  date: string | null;
  eventName: string;
  state: string;
  district: string;
  location: string;
  latitude: number;
  longitude: number;
  trigger: string[];
  type: string;
  fatalities?: number | null;
  source: string;
  // Only present for risk-assessment entries (no date-of-occurrence);
  // historical dated events don't carry a severity rating.
  severity?: Severity;
}

export interface HazardDatasetMeta {
  datasetName: string;
  country: string;
  hazard: string;
  coordinateNote?: string;
  primarySources: string[];
}

// A monitoring station is infrastructure that watches for hazards, not a
// past hazard occurrence — hence the array-valued hazard/trigger coverage
// and no date-of-occurrence, unlike HazardEvent.
export interface MonitoringStation {
  id: string;
  eventName: string;
  date: string | null;
  country: string;
  state: string;
  district: string;
  location: string;
  latitude: number;
  longitude: number;
  hazard: string[];
  trigger: string[];
  type: string;
  fatalities: number | null;
  source: string;
}

export interface MonitoringStationDatasetMeta {
  datasetName: string;
  version: string;
  country: string;
  state: string;
  purpose: string;
  importantNote: string;
  governmentSystems: Record<string, string[]>;
}
