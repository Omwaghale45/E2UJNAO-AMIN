"use client";

import type { ReactNode } from "react";
import { Antenna, MapPin, TriangleAlert, X } from "lucide-react";
import type { SelectedItem } from "@/types/selection";
import type { HazardEvent, MonitoringStation } from "@/data/hazards";
import {
  DEFAULT_COLOR,
  DEVICE_COLOR,
  SEVERITY_COLOR,
  formatTriggerLabel,
} from "@/lib/hazard-display";

interface DetailSidebarProps {
  selected: SelectedItem | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
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
  hazardLabel,
  hazards,
  rows,
  onClose,
}: {
  icon: "station" | "hazard";
  accentColor: string;
  title: string;
  district: string;
  state: string;
  badge: ReactNode;
  hazardLabel: string;
  hazards: string[];
  rows: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full w-full max-w-[380px] shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 p-4">
        <div className="flex items-start gap-2">
          {icon === "station" ? (
            <Antenna size={20} style={{ color: accentColor }} className="mt-0.5 shrink-0" />
          ) : (
            <MapPin size={20} style={{ color: accentColor }} className="mt-0.5 shrink-0" />
          )}
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <p className="text-xs text-zinc-500">
              {district}, {state}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 p-4">
        <div className="mb-4">{badge}</div>

        <div className="mb-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <TriangleAlert size={13} />
            {hazardLabel}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {hazards.map((hazard) => (
              <span
                key={hazard}
                className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
              >
                {formatTriggerLabel(hazard)}
              </span>
            ))}
          </div>
        </div>

        <dl className="space-y-3 border-t border-zinc-100 pt-4 text-sm">{rows}</dl>
      </div>

      <div className="border-t border-zinc-100 p-4 text-[11px] text-zinc-400">
        Information shown is for situational awareness only. Verify with
        official NDRF or state disaster management authorities before
        acting.
      </div>
    </div>
  );
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
      className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: SEVERITY_COLOR[event.severity] }}
    >
      {event.severity} risk
    </span>
  ) : (
    <span className="rounded-full bg-stone-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
      Historical event
    </span>
  );

  return (
    <SidebarShell
      icon="hazard"
      accentColor={event.severity ? SEVERITY_COLOR[event.severity] : DEFAULT_COLOR}
      title={event.eventName}
      district={event.district}
      state={event.state}
      badge={badge}
      hazardLabel="Risk factors"
      hazards={event.trigger}
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
        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          Monitoring Station
        </span>
      }
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

export default function DetailSidebar({ selected, onClose }: DetailSidebarProps) {
  if (!selected) return null;

  if (selected.kind === "station") {
    return <StationDetail station={selected.data} onClose={onClose} />;
  }
  return <HazardDetail event={selected.data} onClose={onClose} />;
}
