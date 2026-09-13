"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Map from "@/components/Map";
import DetailSidebar from "@/components/DetailSidebar";
import type { HazardEvent, MapFilter } from "@/data/hazards";
import type { SelectedItem } from "@/types/selection";

export default function Home() {
  const [flyToTarget, setFlyToTarget] = useState<HazardEvent | null>(null);
  const [activeFilter, setActiveFilter] = useState<MapFilter>("all");
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  function handleSelectFromSearch(event: HazardEvent) {
    setFlyToTarget(event);
    setSelected({ kind: "hazard", data: event });
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Header onSelectArea={handleSelectFromSearch} />
      <div className="flex flex-1 overflow-hidden">
        <DetailSidebar selected={selected} onClose={() => setSelected(null)} />
        <div className="relative flex-1">
          <Map
            flyToTarget={flyToTarget}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onSelectItem={setSelected}
            onClearSelection={() => setSelected(null)}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
