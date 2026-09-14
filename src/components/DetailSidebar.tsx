"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Antenna, MapPin, TriangleAlert, X } from "lucide-react";
import type { SelectedItem } from "@/types/selection";
import type { HazardEvent, MonitoringStation } from "@/data/hazards";
import {
  DEFAULT_COLOR,
  DEVICE_COLOR,
  SEVERITY_COLOR,
  formatTriggerLabel,
} from "@/lib/hazard-display";
import TrendChart from "@/components/TrendChart";
import FlashFloodPanel from "@/components/FlashFloodPanel";
import LandslidePanel from "@/components/LandslidePanel";
import AlertButton from "@/components/AlertButton";

interface DetailSidebarProps {
  selected: SelectedItem | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-800">{value}</dd>
    </div>
  );
}

function SidebarShell({
  icon,
  accentColor,
  title,
  district,
  state,
  badge,
  chart,
  hazardLabel,
  hazards,
  rows,
  footer,
  onClose,
}: {
  icon: "station" | "hazard";
  accentColor: string;
  title: string;
  district: string;
  state: string;
  badge: ReactNode;
  chart: ReactNode;
  hazardLabel: string;
  hazards: string[];
  rows: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full w-[250px] flex-col overflow-y-auto">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 p-3">
        <div className="flex items-start gap-1.5">
          {icon === "station" ? (
            <Antenna size={16} style={{ color: accentColor }} className="mt-0.5 shrink-0" />
          ) : (
            <MapPin size={16} style={{ color: accentColor }} className="mt-0.5 shrink-0" />
          )}
          <div>
            <h2 className="text-sm font-semibold leading-tight text-zinc-900">{title}</h2>
            <p className="text-[10px] text-zinc-500">
              {district}, {state}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 p-3">
        <div className="mb-3">{badge}</div>

        {chart}

        <div className="mb-3">
          <h3 className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <TriangleAlert size={11} />
            {hazardLabel}
          </h3>
          <div className="flex flex-wrap gap-1">
            {hazards.map((hazard) => (
              <span
                key={hazard}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700"
              >
                {formatTriggerLabel(hazard)}
              </span>
            ))}
          </div>
        </div>

        <dl className="space-y-2 border-t border-zinc-100 pt-3 text-[11px]">{rows}</dl>
      </div>

      <div className="border-t border-zinc-100 p-3 text-[9px] leading-snug text-zinc-400">
        Information shown is for situational awareness only. Verify with
        official NDRF or state disaster management authorities before
        acting.
        {footer}
      </div>
    </div>
  );
}

function computeHazardBaseline(event: HazardEvent): number {
  if (event.severity === "EXTREME") return 88;
  if (event.severity === "CRITICAL") return 74;
  if (event.severity === "HIGH") return 58;
  if (event.fatalities) return Math.min(85, 30 + Math.log2(event.fatalities + 1) * 8);
  return 35;
}

// Flash-flood events (both historical and migrated risk-zone entries)
// always carry "flood" in their type string; landslide events never do.
function isFlashFloodEvent(event: HazardEvent): boolean {
  return event.type.toLowerCase().includes("flood");
}

function isLandslideEvent(event: HazardEvent): boolean {
  return event.type.toLowerCase().includes("landslide") || event.type.toLowerCase().includes("slide");
}

function HazardDetail({
  event,
  onClose,
}: {
  event: HazardEvent;
  onClose: () => void;
}) {
  const badge = event.severity ? (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: SEVERITY_COLOR[event.severity] }}
    >
      {event.severity} risk
    </span>
  ) : (
    <span className="rounded-full bg-stone-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      Historical event
    </span>
  );

  const baseline = computeHazardBaseline(event);
  const chart = isFlashFloodEvent(event) ? (
    <FlashFloodPanel seed={event.id} baselineRisk={baseline} />
  ) : isLandslideEvent(event) ? (
    <LandslidePanel seed={event.id} baselineRisk={baseline} />
  ) : (
    <TrendChart seed={event.id} baseline={baseline} />
  );

  return (
    <SidebarShell
      icon="hazard"
      accentColor={event.severity ? SEVERITY_COLOR[event.severity] : DEFAULT_COLOR}
      title={event.eventName}
      district={event.district}
      state={event.state}
      badge={badge}
      chart={chart}
      hazardLabel="Risk factors"
      hazards={event.trigger}
      footer={<AlertButton event={event} />}
      onClose={onClose}
      rows={
        <>
          {event.date && <Row label="Date" value={event.date} />}
          {event.fatalities != null && (
            <Row label="Fatalities" value={String(event.fatalities)} />
          )}
          <Row label="Type" value={event.type} />
          <Row label="Source" value={event.source} />
          <Row
            label="Coordinates"
            value={`${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`}
          />
          <Row label="ID" value={event.id} />
        </>
      }
    />
  );
}

function StationDetail({
  station,
  onClose,
}: {
  station: MonitoringStation;
  onClose: () => void;
}) {
  return (
    <SidebarShell
      icon="station"
      accentColor={DEVICE_COLOR}
      title={station.eventName}
      district={station.district}
      state={station.state}
      badge={
        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Monitoring Station
        </span>
      }
      chart={<TrendChart seed={station.id} baseline={45} />}
      hazardLabel="Monitored hazards"
      hazards={station.hazard}
      onClose={onClose}
      rows={
        <>
          <Row label="Type" value={station.type} />
          <Row label="Source" value={station.source} />
          <Row
            label="Coordinates"
            value={`${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`}
          />
          <Row label="ID" value={station.id} />
        </>
      }
    />
  );
}

const TRANSITION_MS = 300;

export default function DetailSidebar({ selected, onClose }: DetailSidebarProps) {
  // Keep rendering the last-selected content while the panel slides
  // shut, instead of clearing it instantly — the width transition
  // below is what actually animates; this just keeps content in
  // place for the duration of that animation rather than popping out.
  const [displayed, setDisplayed] = useState<SelectedItem | null>(selected);
  const [prevSelected, setPrevSelected] = useState<SelectedItem | null>(selected);

  // A new (non-null) selection should show immediately — adjusting
  // state during render (React's documented pattern for this) instead
  // of an effect, since it must happen before this paint, not after.
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (selected) {
      setDisplayed(selected);
    }
  }

  // Closing (selected -> null) instead waits for the slide-shut
  // animation before clearing content, so the panel doesn't go blank
  // mid-transition.
  useEffect(() => {
    if (selected) return;
    const timeout = setTimeout(() => setDisplayed(null), TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [selected]);

  const isOpen = selected !== null;

  return (
    <div
      className={`h-full shrink-0 overflow-hidden border-zinc-200 bg-white shadow-xl transition-all ease-in-out ${
        isOpen ? "w-[250px] border-r" : "w-0 border-r-0"
      }`}
      style={{ transitionDuration: `${TRANSITION_MS}ms` }}
    >
      {displayed &&
        (displayed.kind === "station" ? (
          <StationDetail station={displayed.data} onClose={onClose} />
        ) : (
          <HazardDetail event={displayed.data} onClose={onClose} />
        ))}
    </div>
  );
}
