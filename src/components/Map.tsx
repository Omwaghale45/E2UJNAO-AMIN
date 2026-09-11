"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { vulnerableAreas, type Severity } from "@/data/vulnerable-areas";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const INDIA_ISO_CODE = "IN";
const UNFADED_ISO_CODES = ["IN", "NP", "BT"];

const SOURCE_ID = "vulnerable-areas";
const CLUSTERS_LAYER_ID = "clusters";
const CLUSTER_COUNT_LAYER_ID = "cluster-count";
const POINTS_LAYER_ID = "unclustered-point";

const SEVERITY_COLOR: Record<Severity, string> = {
  EXTREME: "#9333ea",
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
};

const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  EXTREME: "bg-purple-600",
  CRITICAL: "bg-red-600",
  HIGH: "bg-orange-500",
};

interface AreaProperties {
  areaName: string;
  district: string;
  state: string;
  severity: Severity;
  riskType: string;
}

const vulnerableAreasGeoJSON: GeoJSON.FeatureCollection<
  GeoJSON.Point,
  AreaProperties
> = {
  type: "FeatureCollection",
  features: vulnerableAreas.map((area) => ({
    type: "Feature",
    properties: {
      areaName: area.areaName,
      district: area.district,
      state: area.state,
      severity: area.severity,
      riskType: area.riskType.join(", "),
    },
    geometry: {
      type: "Point",
      coordinates: [area.longitude, area.latitude],
    },
  })),
};

function createPopupHtml(props: AreaProperties): string {
  const chips = props.riskType
    .split(", ")
    .map(
      (risk) =>
        `<span class="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">${risk}</span>`,
    )
    .join("");

  return `
    <div class="min-w-[200px] font-sans">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-zinc-900">${props.areaName}</h3>
        <span class="rounded-full ${SEVERITY_BADGE_CLASS[props.severity]} px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">${props.severity}</span>
      </div>
      <p class="mt-0.5 text-xs text-zinc-500">${props.district}, ${props.state}</p>
      <div class="mt-2 flex flex-wrap gap-1">${chips}</div>
    </div>
  `;
}

export default function Map() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard-satellite",
      center: [78.9629, 22.5937],
      zoom: 2.4,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("style.load", () => {
      // Render disputed borders (Jammu & Kashmir, Ladakh, Aksai Chin)
      // per India's worldview so they show as part of India.
      map.setConfigProperty("basemap", "worldview", INDIA_ISO_CODE);
    });

    map.on("load", () => {
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

      // Cluster nearby risk points so circles never overlap: Mapbox
      // regroups points into clusters per zoom level, and clusters
      // split apart into individual points as you zoom in.
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: vulnerableAreasGeoJSON,
        cluster: true,
        clusterMaxZoom: 9,
        clusterRadius: 60,
      });

      map.addLayer({
        id: CLUSTERS_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#fbbf24",
            10,
            "#f97316",
            25,
            "#dc2626",
          ],
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 25, 26],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#fff",
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#fff",
        },
      });

      map.addLayer({
        id: POINTS_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "severity"],
            "EXTREME",
            SEVERITY_COLOR.EXTREME,
            "CRITICAL",
            SEVERITY_COLOR.CRITICAL,
            SEVERITY_COLOR.HIGH,
          ],
          "circle-radius": 8,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#fff",
        },
      });

      map.on("click", CLUSTERS_LAYER_ID, (e) => {
        const feature = map.queryRenderedFeatures(e.point, {
          layers: [CLUSTERS_LAYER_ID],
        })[0] as unknown as
          | {
              properties: { cluster_id?: number } | null;
              geometry: { type: string; coordinates: [number, number] };
            }
          | undefined;
        if (!feature || feature.geometry.type !== "Point") return;

        const clusterId = feature.properties?.cluster_id;
        if (clusterId === undefined) return;

        const coordinates = feature.geometry.coordinates;
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;

        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error || zoom == null) return;
          map.easeTo({ center: coordinates, zoom });
        });
      });

      map.on("click", POINTS_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;

        const coordinates = feature.geometry.coordinates.slice() as [
          number,
          number,
        ];
        const props = feature.properties as unknown as AreaProperties;

        new mapboxgl.Popup({ offset: 12, closeButton: false })
          .setLngLat(coordinates)
          .setHTML(createPopupHtml(props))
          .addTo(map);
      });

      [CLUSTERS_LAYER_ID, POINTS_LAYER_ID].forEach((layerId) => {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
