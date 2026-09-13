"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { hexGrid, collect } from "@turf/turf";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import { Layers, LocateFixed, Minus, Plus } from "lucide-react";
import {
  deviceStations,
  getHazardEvents,
  type HazardEvent,
  type MapFilter,
  type MonitoringStation,
  type Severity,
} from "@/data/hazards";
import type { SelectedItem } from "@/types/selection";
import {
  DEFAULT_COLOR,
  DEVICE_COLOR,
  SEVERITY_COLOR,
} from "@/lib/hazard-display";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const INDIA_ISO_CODE = "IN";
const UNFADED_ISO_CODES = ["IN", "NP", "BT"];

// Zoom level at which we switch from the aggregated hexbin view to
// individual, precisely-placed risk points.
const HEX_TO_POINT_ZOOM = 6;

// Zoom to fly to when a search result is selected, so the destination
// area renders as an individual point rather than a hexbin.
const SEARCH_RESULT_ZOOM = 10;

type MapStyleId = "standard" | "satellite";

const MAP_STYLES: Record<MapStyleId, { label: string; url: string }> = {
  standard: { label: "Standard", url: "mapbox://styles/mapbox/standard" },
  satellite: {
    label: "Satellite",
    url: "mapbox://styles/mapbox/standard-satellite",
  },
};

const SEVERITY_WEIGHT: Record<Severity, number> = {
  EXTREME: 3,
  CRITICAL: 2,
  HIGH: 1,
};

// Historical dated events (from landslide.ts/flash-flood.ts) carry no
// severity rating, unlike the migrated risk-assessment entries — this
// is their weight.
const DEFAULT_WEIGHT = 1;

const DEVICE_ICON_SIZE = 28;
const DEVICE_ICON_ID = "device-square-icon";

function createSquareIcon(size: number, fillColor: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const border = 3;
  ctx.fillStyle = fillColor;
  ctx.fillRect(border, border, size - border * 2, size - border * 2);
  return ctx.getImageData(0, 0, size, size);
}

function eventWeight(event: HazardEvent): number {
  return event.severity ? SEVERITY_WEIGHT[event.severity] : DEFAULT_WEIGHT;
}

// Mapbox GL serializes non-primitive GeoJSON properties (arrays,
// objects) when reading them back from a click event on a
// circle/symbol layer — `trigger`/`hazard` would come back as JSON
// strings, not arrays. Rather than parse that, every feature carries
// a plain-number `__uid` (its index in the array used to build the
// source) so click handlers can look the real object back up from
// our own in-memory data instead of trusting the event's properties.
function buildDeviceStationsGeoJson(): FeatureCollection<
  Point,
  MonitoringStation & { __uid: number }
> {
  return {
    type: "FeatureCollection",
    features: deviceStations.map((station, index) => ({
      type: "Feature",
      properties: { ...station, __uid: index },
      geometry: {
        type: "Point",
        coordinates: [station.longitude, station.latitude],
      },
    })),
  };
}

// Only hazard events (landslide/flash-flood) filter this way — device
// stations are an unrelated dataset swapped in/out separately.
function hazardEventsForFilter(filter: MapFilter): HazardEvent[] {
  return filter === "device-location" ? [] : getHazardEvents(filter);
}

function buildRiskPointsGeoJson(
  events: HazardEvent[]
): FeatureCollection<Point, HazardEvent & { __uid: number }> {
  return {
    type: "FeatureCollection",
    features: events.map((event, index) => ({
      type: "Feature",
      properties: { ...event, __uid: index },
      geometry: {
        type: "Point",
        coordinates: [event.longitude, event.latitude],
      },
    })),
  };
}

function buildRiskHexbinGeoJson(
  events: HazardEvent[]
): FeatureCollection<Polygon, { count: number; totalWeight: number }> {
  if (events.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const longitudes = events.map((event) => event.longitude);
  const latitudes = events.map((event) => event.latitude);
  const bbox: [number, number, number, number] = [
    Math.min(...longitudes) - 1,
    Math.min(...latitudes) - 1,
    Math.max(...longitudes) + 1,
    Math.max(...latitudes) + 1,
  ];

  const weightedPoints: FeatureCollection<Point, { weight: number }> = {
    type: "FeatureCollection",
    features: events.map((event) => ({
      type: "Feature",
      properties: { weight: eventWeight(event) },
      geometry: {
        type: "Point",
        coordinates: [event.longitude, event.latitude],
      },
    })),
  };

  const grid = hexGrid(bbox, 40, { units: "kilometers" });
  const collected = collect(grid, weightedPoints, "weight", "weights");

  const features = collected.features
    .filter(
      (feature) =>
        (feature.properties?.weights as number[] | undefined)?.length,
    )
    .map((feature) => {
      const weights = feature.properties!.weights as number[];
      return {
        ...feature,
        properties: {
          count: weights.length,
          totalWeight: weights.reduce((sum, weight) => sum + weight, 0),
        },
      } as Feature<Polygon, { count: number; totalWeight: number }>;
    });

  return { type: "FeatureCollection", features };
}

function addRiskLayers(map: mapboxgl.Map, filter: MapFilter) {
  const events = hazardEventsForFilter(filter);
  const hazardsVisible = filter !== "device-location";
  const devicesVisible = filter === "all" || filter === "device-location";
  const deviceMinzoom = filter === "device-location" ? 0 : HEX_TO_POINT_ZOOM;

  map.addSource("country-boundaries", {
    type: "vector",
    url: "mapbox://mapbox.country-boundaries-v1",
  });

  // Fade every country except India, Nepal, and Bhutan by overlaying
  // a semi-opaque fill on everything else and leaving their opacity
  // at 0. The worldview filter picks the India-claimed polygon
  // (including J&K/Ladakh) so the fade mask lines up with the
  // basemap borders.
  map.addLayer({
    id: "country-fade",
    type: "fill",
    source: "country-boundaries",
    "source-layer": "country_boundaries",
    filter: [
      "any",
      ["==", ["get", "worldview"], "all"],
      ["in", INDIA_ISO_CODE, ["get", "worldview"]],
    ],
    paint: {
      "fill-color": "#e5e5e5",
      "fill-opacity": [
        "match",
        ["get", "iso_3166_1"],
        UNFADED_ISO_CODES,
        0,
        0.75,
      ],
    },
  });

  // Zoomed out: aggregated hexbin showing where risk concentrates.
  map.addSource("risk-hexbin", {
    type: "geojson",
    data: buildRiskHexbinGeoJson(events),
  });

  map.addLayer({
    id: "risk-hexbin-fill",
    type: "fill",
    source: "risk-hexbin",
    maxzoom: HEX_TO_POINT_ZOOM,
    layout: {
      visibility: hazardsVisible ? "visible" : "none",
    },
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "totalWeight"],
        1,
        "#fde68a",
        4,
        "#f59e0b",
        8,
        "#ea580c",
        14,
        "#b91c1c",
      ],
      "fill-opacity": 0.75,
      "fill-outline-color": "rgba(255,255,255,0.5)",
    },
  });

  // Zoomed in: precise points, sized by zoom, colored by severity.
  map.addSource("risk-points", {
    type: "geojson",
    data: buildRiskPointsGeoJson(events),
  });

  map.addLayer({
    id: "risk-points-circle",
    type: "circle",
    source: "risk-points",
    minzoom: HEX_TO_POINT_ZOOM,
    layout: {
      visibility: hazardsVisible ? "visible" : "none",
    },
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        HEX_TO_POINT_ZOOM,
        4,
        9,
        9,
        16,
        14,
      ],
      "circle-color": [
        "match",
        ["get", "severity"],
        "EXTREME",
        SEVERITY_COLOR.EXTREME,
        "CRITICAL",
        SEVERITY_COLOR.CRITICAL,
        "HIGH",
        SEVERITY_COLOR.HIGH,
        DEFAULT_COLOR,
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  // Monitoring stations: same zoom range as risk points, but a square
  // marker (vs. circles) since they're infrastructure, not hazards.
  if (!map.hasImage(DEVICE_ICON_ID)) {
    map.addImage(
      DEVICE_ICON_ID,
      createSquareIcon(DEVICE_ICON_SIZE, DEVICE_COLOR),
    );
  }

  map.addSource("device-stations", {
    type: "geojson",
    data: buildDeviceStationsGeoJson(),
  });

  map.addLayer({
    id: "device-stations-square",
    type: "symbol",
    source: "device-stations",
    minzoom: deviceMinzoom,
    layout: {
      "icon-image": DEVICE_ICON_ID,
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        HEX_TO_POINT_ZOOM,
        0.3,
        9,
        0.6,
        16,
        1,
      ],
      "icon-allow-overlap": true,
      visibility: devicesVisible ? "visible" : "none",
    },
  });
}

// Called on filter changes after the layers already exist (a style
// switch instead re-runs addRiskLayers from scratch on "style.load").
function applyFilter(map: mapboxgl.Map, filter: MapFilter) {
  const events = hazardEventsForFilter(filter);
  const hazardsVisible = filter !== "device-location";
  const devicesVisible = filter === "all" || filter === "device-location";

  (map.getSource("risk-points") as mapboxgl.GeoJSONSource).setData(
    buildRiskPointsGeoJson(events)
  );
  (map.getSource("risk-hexbin") as mapboxgl.GeoJSONSource).setData(
    buildRiskHexbinGeoJson(events)
  );

  map.setLayoutProperty(
    "risk-points-circle",
    "visibility",
    hazardsVisible ? "visible" : "none"
  );
  map.setLayoutProperty(
    "risk-hexbin-fill",
    "visibility",
    hazardsVisible ? "visible" : "none"
  );
  map.setLayoutProperty(
    "device-stations-square",
    "visibility",
    devicesVisible ? "visible" : "none"
  );
  map.setLayerZoomRange(
    "device-stations-square",
    filter === "device-location" ? 0 : HEX_TO_POINT_ZOOM,
    24
  );
}

interface MapProps {
  flyToTarget?: HazardEvent | null;
  activeFilter: MapFilter;
  onSelectItem?: (item: SelectedItem) => void;
}

export default function Map({ flyToTarget, activeFilter, onSelectItem }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [activeStyle, setActiveStyle] = useState<MapStyleId>("standard");
  // Read inside style.load (which can fire again after a style switch)
  // instead of closing over the activeFilter prop, so a style change
  // mid-filter-selection still rebuilds with the current filter.
  const activeFilterRef = useRef<MapFilter>(activeFilter);
  // Click handlers are registered once on mount; read the latest
  // onSelectItem through a ref instead of closing over a stale prop.
  const onSelectItemRef = useRef(onSelectItem);
  useEffect(() => {
    onSelectItemRef.current = onSelectItem;
  }, [onSelectItem]);

  // Keep the Mapbox canvas in sync when its container is resized (e.g.
  // the detail sidebar opening/closing shrinks or grows the map area).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES.standard.url,
      center: [78.9629, 22.5937],
      zoom: 2.4,
    });
    mapRef.current = map;

    map.on("style.load", () => {
      // Render disputed borders (Jammu & Kashmir, Ladakh, Aksai Chin)
      // per India's worldview so they show as part of India.
      map.setConfigProperty("basemap", "worldview", INDIA_ISO_CODE);
      addRiskLayers(map, activeFilterRef.current);
    });

    // Registered once: these keep working across style switches since
    // the "risk-points-circle" layer is re-added under the same id
    // every time addRiskLayers runs on a fresh style. onSelectItemRef
    // is read (not closed over) so a fresh onSelectItem prop is used
    // even though this effect only runs on mount.
    map.on("click", "risk-points-circle", (e) => {
      const feature = e.features?.[0];
      const uid = feature?.properties?.__uid;
      if (typeof uid !== "number") return;

      const event = hazardEventsForFilter(activeFilterRef.current)[uid];
      if (!event) return;
      onSelectItemRef.current?.({ kind: "hazard", data: event });
    });

    map.on("mouseenter", "risk-points-circle", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "risk-points-circle", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("click", "device-stations-square", (e) => {
      const feature = e.features?.[0];
      const uid = feature?.properties?.__uid;
      if (typeof uid !== "number") return;

      const station = deviceStations[uid];
      if (!station) return;
      onSelectItemRef.current?.({ kind: "station", data: station });
    });

    map.on("mouseenter", "device-stations-square", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "device-stations-square", () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeFilterRef.current = activeFilter;

    const map = mapRef.current;
    // Skip if the layers haven't been added yet (initial style.load
    // will pick up the current filter via the ref above instead).
    if (!map || !map.getSource("risk-points")) return;

    applyFilter(map, activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;

    map.flyTo({
      center: [flyToTarget.longitude, flyToTarget.latitude],
      zoom: SEARCH_RESULT_ZOOM,
    });
  }, [flyToTarget]);

  function handleStyleChange(id: MapStyleId) {
    setActiveStyle(id);
    mapRef.current?.setStyle(MAP_STYLES[id].url);
    setLayersOpen(false);
  }

  function handleLocate() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((position) => {
      map.flyTo({
        center: [position.coords.longitude, position.coords.latitude],
        zoom: SEARCH_RESULT_ZOOM,
      });
    });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute right-4 top-4">
        <button
          type="button"
          aria-label="Layers"
          onClick={() => setLayersOpen((open) => !open)}
          className="flex h-[40px] w-[40px] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-md hover:bg-zinc-50"
        >
          <Layers size={18} />
        </button>

        {layersOpen && (
          <div className="absolute right-0 top-[48px] w-56 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700">
                Map style
              </span>
              <button
                type="button"
                onClick={() => setLayersOpen(false)}
                className="flex h-[29px] w-[55px] items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleStyleChange(id)}
                  className={`rounded-lg px-3 py-2 text-left text-sm ${
                    activeStyle === id
                      ? "bg-blue-50 text-blue-700"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {MAP_STYLES[id].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 right-4 flex flex-col items-end gap-3">
        <button
          type="button"
          aria-label="My location"
          onClick={handleLocate}
          className="flex h-[40px] w-[40px] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-md hover:bg-zinc-50"
        >
          <LocateFixed size={18} />
        </button>

        <div className="flex w-[40px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => mapRef.current?.zoomIn()}
            className="flex h-[40px] w-[40px] items-center justify-center text-zinc-700 hover:bg-zinc-50"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => mapRef.current?.zoomOut()}
            className="flex h-[40px] w-[40px] items-center justify-center border-t border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          >
            <Minus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
