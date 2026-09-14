"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Map, { DEFAULT_VISIBILITY, type CategoryVisibility } from "@/components/Map";
import DetailSidebar from "@/components/DetailSidebar";
import type { HazardEvent } from "@/data/hazards";
import type { SelectedItem } from "@/types/selection";

export default function Home() {
  const [flyToTarget, setFlyToTarget] = useState<HazardEvent | null>(null);
  const [visibility, setVisibility] = useState<CategoryVisibility>(DEFAULT_VISIBILITY);
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
            visibility={visibility}
            onVisibilityChange={setVisibility}
            onSelectItem={setSelected}
            onClearSelection={() => setSelected(null)}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
