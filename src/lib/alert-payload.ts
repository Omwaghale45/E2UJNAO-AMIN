import type { HazardEvent, Severity } from "@/data/hazards";

// TODO: set this once the receiving endpoint is provided.
export const ALERT_ENDPOINT = "";

export const ALERT_PIN = "1972";

export interface AlertPayload {
  active: boolean;
  region: string;
  lat: number;
  lon: number;
  // Spelled "sevirity" (not "severity") to match the endpoint's exact
  // field name as given — do not "fix" this without confirming first.
  sevirity: string;
  type: "flood" | "landslide";
}

// The endpoint's example used "moderate", which doesn't match any of
// our severity labels (Extreme/High Alert/Warning) — mapped as a
// best guess (High Alert tier -> "moderate") until confirmed.
const SEVERITY_TO_PAYLOAD: Record<Severity, string> = {
  EXTREME: "extreme",
  CRITICAL: "moderate",
  HIGH: "warning",
};

function isFlashFloodEvent(event: HazardEvent): boolean {
  return event.type.toLowerCase().includes("flood");
}

export function buildAlertPayload(
  event: HazardEvent,
  active: boolean
): AlertPayload {
  return {
    active,
    region: event.district,
    lat: event.latitude,
    lon: event.longitude,
    sevirity: event.severity ? SEVERITY_TO_PAYLOAD[event.severity] : "unknown",
    type: isFlashFloodEvent(event) ? "flood" : "landslide",
  };
}

export async function sendAlert(
  event: HazardEvent,
  active: boolean
): Promise<void> {
  const payload = buildAlertPayload(event, active);

  if (!ALERT_ENDPOINT) {
    console.log("[alert] no endpoint configured yet, payload:", payload);
    throw new Error("Alert endpoint not configured yet");
  }

  const response = await fetch(ALERT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Alert endpoint responded with ${response.status}`);
  }
}
