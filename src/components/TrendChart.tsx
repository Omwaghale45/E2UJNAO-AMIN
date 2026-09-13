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
import { createSeededRandom } from "@/lib/seeded-random";

const WARNING = 60;
const DANGER = 75;
const EXTREME = 90;

function lastNDayLabels(n: number): string[] {
  const labels: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
  }
  return labels;
}

function buildSeries(seed: string, baseline: number) {
  const random = createSeededRandom(seed);
  let value = baseline;
  return lastNDayLabels(8).map((day) => {
    value += (random() - 0.5) * 5;
    value = Math.min(98, Math.max(5, value));
    return { day, value: Math.round(value * 10) / 10 };
  });
}

interface TrendChartProps {
  seed: string;
  baseline: number;
}

export default function TrendChart({ seed, baseline }: TrendChartProps) {
  const data = buildSeries(seed, baseline);

  return (
    <div className="mb-3 border-b border-zinc-100 pb-3">
      <p className="mb-1 text-[9px] italic text-zinc-400">
        Indicative trend — synthetic, not live sensor data
      </p>

      <div className="h-[130px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="day"
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
            <ReferenceLine y={WARNING} stroke="#f59e0b" strokeWidth={1.5} />
            <ReferenceLine y={DANGER} stroke="#ef4444" strokeWidth={1.5} />
            <ReferenceLine y={EXTREME} stroke="#7f1d1d" strokeWidth={1.5} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#trendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 grid grid-cols-3 gap-1 text-center text-[9px]">
        <div>
          <div className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-zinc-500">Warning</span>
          </div>
          <div className="font-semibold text-zinc-700">{WARNING}</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-zinc-500">Danger</span>
          </div>
          <div className="font-semibold text-zinc-700">{DANGER}</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-900" />
            <span className="text-zinc-500">Extreme</span>
          </div>
          <div className="font-semibold text-zinc-700">{EXTREME}</div>
        </div>
      </div>
    </div>
  );
}
