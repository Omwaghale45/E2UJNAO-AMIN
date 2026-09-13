"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  RISK_DANGER,
  RISK_EXTREME,
  RISK_WARNING,
  buildFlashFloodPrediction,
  type FlashFloodParameterGroup,
} from "@/lib/flash-flood-prediction";
import TrendChart from "@/components/TrendChart";

const GROUP_ORDER: FlashFloodParameterGroup[] = [
  "Rainfall",
  "Hydrology",
  "Catchment & Terrain",
  "Atmosphere",
];

interface FlashFloodPanelProps {
  seed: string;
  baselineRisk: number;
}

export default function FlashFloodPanel({ seed, baselineRisk }: FlashFloodPanelProps) {
  const { parameters, forecast, etaHours } = buildFlashFloodPrediction(seed, baselineRisk);

  return (
    <div className="mb-3 border-b border-zinc-100 pb-3">
      <TrendChart seed={seed} baseline={baselineRisk} />

      <p className="mb-1.5 text-[9px] italic text-zinc-400">
        Synthetic parameters — illustrative prediction, not a real-time
        forecast
      </p>

      {GROUP_ORDER.map((group) => {
        const items = parameters.filter((param) => param.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="mb-2">
            <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
              {group}
            </h4>
            <dl className="space-y-1 text-[10px]">
              {items.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-2">
                  <dt className="text-zinc-500">{item.label}</dt>
                  <dd className="text-right font-medium text-zinc-800">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}

      <div
        className={`my-2 rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold ${
          etaHours == null
            ? "bg-emerald-50 text-emerald-700"
            : etaHours <= 3
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-700"
        }`}
      >
        {etaHours == null
          ? "No imminent flash flood risk (next 12h)"
          : `Estimated time to flash flood: ~${etaHours}h`}
      </div>

      <div className="h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecast} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="floodRiskFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="hour"
              tickFormatter={(hour: number) => `+${hour}h`}
              tick={{ fontSize: 9, fill: "#71717a" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              width={26}
            />
            <ReferenceLine y={RISK_WARNING} stroke="#f59e0b" strokeWidth={1.5} />
            <ReferenceLine y={RISK_DANGER} stroke="#ef4444" strokeWidth={1.5} />
            <ReferenceLine y={RISK_EXTREME} stroke="#7f1d1d" strokeWidth={1.5} />
            <Area
              type="monotone"
              dataKey="risk"
              stroke="#0ea5e9"
              strokeWidth={2}
              fill="url(#floodRiskFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-[9px] text-zinc-400">
        Composite flash-flood risk index, next 12 hours
      </p>
    </div>
  );
}
