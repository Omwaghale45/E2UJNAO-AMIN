"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { hexGrid, collect } from "@turf/turf";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import { Check, Hexagon, Layers, LocateFixed, Minus, Plus, X } from "lucide-react";
import {
  deviceStations,
  flashFloodEvents,
  landslideEvents,
  type HazardEvent,
  type MonitoringStation,
  type Severity,
} from "@/data/hazards";
import type { SelectedItem } from "@/types/selection";
import {
  DEFAULT_COLOR,
  DEVICE_COLOR,
  SEVERITY_COLOR,
} from "@/lib/hazard-display";
import { getRudraprayagRiskGrid } from "@/lib/heatmap-grid";
import { rudraprayagCenter } from "@/data/boundaries/rudraprayag";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const INDIA_ISO_CODE = "IN";
const UNFADED_ISO_CODES = ["IN", "NP", "BT"];

// Zoom level at which we switch from the aggregated hexbin view to
// individual, precisely-placed risk points.
const HEX_TO_POINT_ZOOM = 6;

// Zoom to fly to when a search result is selected, so the destination
// area renders as an individual point rather than a hexbin.
const SEARCH_RESULT_ZOOM = 10;

// District risk-grid heat map (currently supports Rudraprayag only).
const RISK_GRID_SOURCE = "district-risk-grid";
const RISK_GRID_LAYER = "district-risk-grid-fill";
const RUDRAPRAYAG_ZOOM = 11;

type MapStyleId = "standard" | "satellite";

const MAP_STYLES: Record<MapStyleId, { label: string; url: string }> = {
  standard: { label: "Map", url: "mapbox://styles/mapbox/standard" },
  satellite: {
    label: "Hybrid",
    url: "mapbox://styles/mapbox/standard-satellite",
  },
};

// Each category is independently toggleable — no "All" state; on load
// every category defaults on.
export interface CategoryVisibility {
  flashFlood: boolean;
  landslide: boolean;
  devices: boolean;
}

export const DEFAULT_VISIBILITY: CategoryVisibility = {
  flashFlood: true,
  landslide: true,
  devices: true,
};

const CATEGORY_TOGGLES: { key: keyof CategoryVisibility; label: string }[] = [
  { key: "flashFlood", label: "Flash Flood" },
  { key: "landslide", label: "Landslide" },
  { key: "devices", label: "Device Location" },
];

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

function visibleHazardEvents(visibility: CategoryVisibility): HazardEvent[] {
  const events: HazardEvent[] = [];
  if (visibility.flashFlood) events.push(...flashFloodEvents);
  if (visibility.landslide) events.push(...landslideEvents);
  return events;
}

const RISK_LEGEND_ITEMS: { label: string; color: string }[] = [
  { label: "Extreme", color: SEVERITY_COLOR.EXTREME },
  { label: "Danger", color: SEVERITY_COLOR.CRITICAL },
  { label: "Warning", color: SEVERITY_COLOR.HIGH },
  { label: "Historical", color: DEFAULT_COLOR },
];

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

// A category is "device-only" when it's the sole enabled layer — in
// that case devices show at every zoom (no hexbin exists for them to
// hand off to), matching how the old exclusive filter behaved.
function deviceMinzoomFor(visibility: CategoryVisibility): number {
  const deviceOnly =
    visibility.devices && !visibility.flashFlood && !visibility.landslide;
  return deviceOnly ? 0 : HEX_TO_POINT_ZOOM;
}

function addRiskLayers(map: mapboxgl.Map, visibility: CategoryVisibility) {
  const events = visibleHazardEvents(visibility);

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
  // Left "visible" unconditionally — an empty/disabled category just
  // means an empty source, which naturally renders nothing.
  map.addSource("risk-hexbin", {
    type: "geojson",
    data: buildRiskHexbinGeoJson(events),
  });

  map.addLayer({
    id: "risk-hexbin-fill",
    type: "fill",
    source: "risk-hexbin",
    maxzoom: HEX_TO_POINT_ZOOM,
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

  // Monitoring stations: a square marker (vs. circles) since they're
  // infrastructure, not hazards.
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
    minzoom: deviceMinzoomFor(visibility),
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
      visibility: visibility.devices ? "visible" : "none",
    },
  });
}

// Called on visibility changes after the layers already exist (a
// style switch instead re-runs addRiskLayers from scratch on
// "style.load").
function applyVisibility(map: mapboxgl.Map, visibility: CategoryVisibility) {
  const events = visibleHazardEvents(visibility);

  (map.getSource("risk-points") as mapboxgl.GeoJSONSource).setData(
    buildRiskPointsGeoJson(events)
  );
  (map.getSource("risk-hexbin") as mapboxgl.GeoJSONSource).setData(
    buildRiskHexbinGeoJson(events)
  );

  map.setLayoutProperty(
    "device-stations-square",
    "visibility",
    visibility.devices ? "visible" : "none"
  );
  map.setLayerZoomRange(
    "device-stations-square",
    deviceMinzoomFor(visibility),
    24
  );
}

// District risk-grid heat map: only rendered while a matching district
// search is active (no zoom-based trigger, no click behavior).
function addOrUpdateRiskGrid(map: mapboxgl.Map) {
  const data = getRudraprayagRiskGrid();
  const existingSource = map.getSource(RISK_GRID_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;

  if (existingSource) {
    existingSource.setData(data);
    return;
  }

  map.addSource(RISK_GRID_SOURCE, { type: "geojson", data });

  // Inserted before the hexbin layer so hazard hexbins/points/device
  // squares always render above the grid, not under it.
  const beforeId = map.getLayer("risk-hexbin-fill") ? "risk-hexbin-fill" : undefined;

  map.addLayer(
    {
      id: RISK_GRID_LAYER,
      type: "fill",
      source: RISK_GRID_SOURCE,
      paint: {
        "fill-color": [
          "match",
          ["get", "riskLevel"],
          "red",
          "#ef4444",
          "orange",
          "#f97316",
          "green",
          "#22c55e",
          "#22c55e",
        ],
        "fill-opacity": 0.55,
        "fill-outline-color": "rgba(0,0,0,0.25)",
      },
    },
    beforeId
  );
}

function removeRiskGrid(map: mapboxgl.Map) {
  if (map.getLayer(RISK_GRID_LAYER)) map.removeLayer(RISK_GRID_LAYER);
  if (map.getSource(RISK_GRID_SOURCE)) map.removeSource(RISK_GRID_SOURCE);
}

// 3D terrain: real elevation data (Mapbox's public terrain-RGB tiles)
// draped under every layer — re-run on every style.load since setStyle
// wipes sources/terrain along with everything else.
const TERRAIN_SOURCE = "mapbox-dem";
const TERRAIN_EXAGGERATION = 1.4;

function addTerrain(map: mapboxgl.Map) {
  if (!map.getSource(TERRAIN_SOURCE)) {
    map.addSource(TERRAIN_SOURCE, {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION });

  if (!map.getLayer("sky")) {
    map.addLayer({
      id: "sky",
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun-intensity": 15,
      },
    });
  }
}

interface MapProps {
  flyToTarget?: HazardEvent | null;
  visibility: CategoryVisibility;
  onVisibilityChange?: (next: CategoryVisibility) => void;
  onSelectItem?: (item: SelectedItem) => void;
  onClearSelection?: () => void;
  // Only "rudraprayag" is supported for now; null/undefined hides the grid.
  heatmapDistrict?: string | null;
}

export default function Map({
  flyToTarget,
  visibility,
  onVisibilityChange,
  onSelectItem,
  onClearSelection,
  heatmapDistrict,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(true);
  const [activeStyle, setActiveStyle] = useState<MapStyleId>("standard");
  // Whether the map is currently showing individual points (true) or
  // the aggregated hexbin (false) — drives the legend's icon shape.
  const [isPointView, setIsPointView] = useState(2.4 >= HEX_TO_POINT_ZOOM);
  // Read inside style.load (which can fire again after a style switch)
  // instead of closing over the visibility prop, so a style change
  // mid-toggle still rebuilds with the current visibility.
  const visibilityRef = useRef<CategoryVisibility>(visibility);
  // Read inside style.load so the grid survives a basemap style switch
  // (setStyle wipes all sources/layers, including this one).
  const heatmapDistrictRef = useRef<string | null | undefined>(heatmapDistrict);
  // Click handlers are registered once on mount; read the latest
  // onSelectItem/onClearSelection through refs instead of closing over
  // stale props.
  const onSelectItemRef = useRef(onSelectItem);
  const onClearSelectionRef = useRef(onClearSelection);
  useEffect(() => {
    onSelectItemRef.current = onSelectItem;
    onClearSelectionRef.current = onClearSelection;
  }, [onSelectItem, onClearSelection]);

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
      addTerrain(map);
      addRiskLayers(map, visibilityRef.current);
      if (heatmapDistrictRef.current === "rudraprayag") {
        addOrUpdateRiskGrid(map);
      }
    });

    // Only updates state when crossing the hex/point threshold (not on
    // every zoom tick) so the legend doesn't re-render continuously
    // while the user is mid-gesture.
    map.on("zoom", () => {
      const nowPointView = map.getZoom() >= HEX_TO_POINT_ZOOM;
      setIsPointView((prev) => (prev === nowPointView ? prev : nowPointView));
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

      const event = visibleHazardEvents(visibilityRef.current)[uid];
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

    // Closes the detail sidebar when clicking anywhere on the map that
    // isn't a selectable point/square (the layer-specific handlers
    // above still fire for an actual hit and open the new selection).
    map.on("click", (e) => {
      const selectableLayers = [
        "risk-points-circle",
        "device-stations-square",
      ].filter((id) => map.getLayer(id));
      if (selectableLayers.length === 0) return;

      const hits = map.queryRenderedFeatures(e.point, {
        layers: selectableLayers,
      });
      if (hits.length === 0) {
        onClearSelectionRef.current?.();
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    visibilityRef.current = visibility;

    const map = mapRef.current;
    // Skip if the layers haven't been added yet (initial style.load
    // will pick up the current visibility via the ref above instead).
    if (!map || !map.getSource("risk-points")) return;

    applyVisibility(map, visibility);
  }, [visibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;

    map.flyTo({
      center: [flyToTarget.longitude, flyToTarget.latitude],
      zoom: SEARCH_RESULT_ZOOM,
    });
  }, [flyToTarget]);

  // District risk-grid heat map: shown only while a matching district
  // search is active — no zoom threshold, no click interaction.
  useEffect(() => {
    heatmapDistrictRef.current = heatmapDistrict;

    const map = mapRef.current;
    if (!map) return;

    if (heatmapDistrict === "rudraprayag") {
      map.flyTo({ center: rudraprayagCenter, zoom: RUDRAPRAYAG_ZOOM });
      if (map.isStyleLoaded()) {
        addOrUpdateRiskGrid(map);
      }
    } else if (map.isStyleLoaded()) {
      removeRiskGrid(map);
    }
  }, [heatmapDistrict]);

  function handleStyleChange(id: MapStyleId) {
    setActiveStyle(id);
    mapRef.current?.setStyle(MAP_STYLES[id].url);
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

  function toggleCategory(key: keyof CategoryVisibility) {
    onVisibilityChange?.({ ...visibility, [key]: !visibility[key] });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute right-4 top-4">
        {!viewOptionsOpen ? (
          <button
            type="button"
            aria-label="View options"
            onClick={() => setViewOptionsOpen(true)}
            className="flex h-[40px] w-[40px] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-md hover:bg-zinc-50"
          >
            <Layers size={18} />
          </button>
        ) : (
          <div className="flex max-h-[calc(50%-16px)] w-[210px] flex-col rounded-2xl border border-zinc-200 bg-white shadow-lg">
            <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-zinc-100 p-2">
              <div className="flex items-center gap-1">
                <Layers size={13} className="text-zinc-700" />
                <span className="text-xs font-semibold text-zinc-800">
                  View options
                </span>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setViewOptionsOpen(false)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
              >
                <X size={13} />
              </button>
            </div>

            <div className="overflow-x-hidden overflow-y-auto p-2 [scrollbar-width:thin]">
              <div className="mb-2 flex rounded-full border border-zinc-200 bg-zinc-50 p-0.5">
                {(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleStyleChange(id)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[10px] font-medium ${
                      activeStyle === id
                        ? "bg-blue-100 text-blue-700"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {activeStyle === id && <Check size={10} />}
                    {MAP_STYLES[id].label}
                  </button>
                ))}
              </div>

              <div className="border-t border-zinc-100 pt-2">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Show
                </span>
                <div className="flex flex-col gap-1">
                  {CATEGORY_TOGGLES.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={visibility[key]}
                      onClick={() => toggleCategory(key)}
                      className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] ${
                        visibility[key]
                          ? "bg-blue-50 text-blue-700"
                          : "text-zinc-500 hover:bg-zinc-50"
                      }`}
                    >
                      {label}
                      {visibility[key] && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2 border-t border-zinc-100 pt-2">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Risk level
                </span>
                <div className="flex flex-col gap-1">
                  {RISK_LEGEND_ITEMS.map(({ label, color }) =>
                    isPointView ? (
                      <div key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        {label}
                      </div>
                    ) : (
                      <div key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                        <Hexagon
                          size={11}
                          className="shrink-0"
                          style={{ color }}
                          fill={color}
                          fillOpacity={0.2}
                        />
                        {label}
                      </div>
                    )
                  )}
                </div>
              </div>
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
