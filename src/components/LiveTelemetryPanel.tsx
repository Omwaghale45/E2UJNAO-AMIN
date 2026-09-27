"use client";

import { Radio } from "lucide-react";
import { useLiveTelemetry } from "@/lib/use-live-telemetry";
import type { WeatherTelemetry } from "@/lib/mqtt-client";

const FIELDS: { key: keyof WeatherTelemetry; label: string; unit: string }[] = [
  { key: "temperature", label: "Air Temperature", unit: "°C" },
  { key: "humidity", label: "Humidity", unit: "%" },
  { key: "pressure", label: "Pressure", unit: "hPa" },
  { key: "windSpeed_ms", label: "Wind Speed", unit: "m/s" },
  { key: "soil_moisture", label: "Soil Moisture", unit: "%" },
  { key: "soil_temperature", label: "Soil Temperature", unit: "°C" },
  { key: "inclination_x", label: "Inclination X", unit: "°" },
  { key: "inclination_y", label: "Inclination Y", unit: "°" },
];

function formatAge(receivedAt: number | null): string {
  if (!receivedAt) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - receivedAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function LiveTelemetryPanel() {
  const { data, receivedAt, connected, loading } = useLiveTelemetry();

  return (
    <div className="mb-3 rounded-lg border border-zinc-200 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          <Radio size={12} className={connected ? "text-emerald-500" : "text-zinc-400"} />
          Live Sensor Feed
        </span>
        <span
          className={`flex items-center gap-1 text-[9px] font-medium ${
            connected ? "text-emerald-600" : "text-zinc-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? "animate-pulse bg-emerald-500" : "bg-zinc-300"
            }`}
          />
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>

      {loading && !data ? (
        <p className="text-[11px] text-zinc-400">Connecting…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            {FIELDS.map(({ key, label, unit }) => (
              <div key={key} className="flex flex-col">
                <span className="text-[9px] text-zinc-500">{label}</span>
                <span className="text-[12px] font-semibold text-zinc-800">
                  {data[key].toFixed(2)} {unit}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-zinc-400">Updated {formatAge(receivedAt)}</p>
        </>
      ) : (
        <p className="text-[11px] text-zinc-400">
          No data received yet from weather_sensor_node_001.
        </p>
      )}
    </div>
  );
}
