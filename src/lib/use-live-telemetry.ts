"use client";

import { useEffect, useState } from "react";
import { subscribeWeatherTelemetry, type WeatherTelemetry } from "@/lib/mqtt-client";

export interface LiveTelemetryState {
  data: WeatherTelemetry | null;
  receivedAt: number | null;
  connected: boolean;
  loading: boolean;
}

// Subscribes directly to the broker's WebSocket feed (see
// src/lib/mqtt-client.ts) instead of polling a Next.js API route.
export function useLiveTelemetry(): LiveTelemetryState {
  const [state, setState] = useState<LiveTelemetryState>({
    data: null,
    receivedAt: null,
    connected: false,
    loading: true,
  });

  useEffect(() => {
    return subscribeWeatherTelemetry((cache) => {
      setState({
        data: cache.data,
        receivedAt: cache.receivedAt,
        connected: cache.connected,
        loading: false,
      });
    });
  }, []);

  return state;
}
