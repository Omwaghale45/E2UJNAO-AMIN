"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Map, { DEFAULT_VISIBILITY, type CategoryVisibility } from "@/components/Map";
import DetailSidebar from "@/components/DetailSidebar";
import type { HazardEvent } from "@/data/hazards";
import type { SelectedItem } from "@/types/selection";

export default function DashboardPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<HazardEvent | null>(null);
  const [visibility, setVisibility] = useState<CategoryVisibility>(DEFAULT_VISIBILITY);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [heatmapDistrict, setHeatmapDistrict] = useState<string | null>(null);

  useEffect(() => {
    let signedIn = false;
    try {
      signedIn = sessionStorage.getItem("ndrf_session") === "1";
    } catch {}
    if (!signedIn) {
      router.replace("/");
      return;
    }
    setAuthorized(true);
  }, [router]);

  function handleSelectFromSearch(event: HazardEvent) {
    setFlyToTarget(event);
    setSelected({ kind: "hazard", data: event });
    setHeatmapDistrict(null);
  }

  function handleSelectDistrictHeatmap(districtId: string) {
    setHeatmapDistrict(districtId);
    setSelected(null);
  }

  if (!authorized) {
    return <div className="h-screen w-screen bg-white" />;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Header
        onSelectArea={handleSelectFromSearch}
        onSelectDistrictHeatmap={handleSelectDistrictHeatmap}
      />
      <div className="flex flex-1 overflow-hidden">
        <DetailSidebar selected={selected} onClose={() => setSelected(null)} />
        <div className="relative flex-1">
          <Map
            flyToTarget={flyToTarget}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            onSelectItem={setSelected}
            onClearSelection={() => setSelected(null)}
            heatmapDistrict={heatmapDistrict}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
