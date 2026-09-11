"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const INDIA_ISO_CODE = "IN";
const UNFADED_ISO_CODES = ["IN", "NP", "BT"];

export default function Map() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
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
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
