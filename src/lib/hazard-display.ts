import type { Severity } from "@/data/hazards";

export const SEVERITY_COLOR: Record<Severity, string> = {
  EXTREME: "#9333ea",
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
};

export const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  EXTREME: "bg-purple-600",
  CRITICAL: "bg-red-600",
  HIGH: "bg-orange-500",
};

// Historical dated events (from landslide.ts/flash-flood.ts) carry no
// severity rating, unlike the migrated risk-assessment entries.
export const DEFAULT_COLOR = "#78716c";

// Monitoring stations are infrastructure, not hazard occurrences.
export const DEVICE_COLOR = "#8ef605";

export function formatTriggerLabel(token: string): string {
  return token.includes("_")
    ? token.charAt(0).toUpperCase() + token.slice(1).replace(/_/g, " ")
    : token;
}
