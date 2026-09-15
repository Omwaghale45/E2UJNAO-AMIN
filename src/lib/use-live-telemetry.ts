"use client";

import { useEffect, useState } from "react";
import type { WeatherTelemetry } from "@/lib/mqtt-client";

export interface LiveTelemetryState {
  data: WeatherTelemetry | null;
  receivedAt: number | null;
  connected: boolean;
  loading: boolean;
}

const POLL_INTERVAL_MS = 5000;

// Polls the server-side MQTT bridge (see src/app/api/telemetry) rather
// than connecting to the broker directly — browsers can't open a raw
// TCP/MQTT socket.
export function useLiveTelemetry(endpoint: string): LiveTelemetryState {
  const [state, setState] = useState<LiveTelemetryState>({
    data: null,
    receivedAt: null,
    connected: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        setState({
          data: json.data,
          receivedAt: json.receivedAt,
          connected: json.connected,
          loading: false,
        });
      } catch {
        if (cancelled) return;
        setState((prev) => ({ ...prev, connected: false, loading: false }));
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [endpoint]);

  return state;
}
