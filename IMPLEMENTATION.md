# NDRF — Disaster Risk Mapping Platform

## Implementation Documentation

A Mapbox-based web application for visualizing flash flood and landslide risk
across Uttarakhand, India — built for the National Disaster Response Force
(NDRF) use case. This document describes what has been implemented, how it is
structured, and what remains outstanding.

> **Status:** Frontend prototype. All hazard/device data is hardcoded from
> user-supplied historical records; two datasets are known to be incomplete
> (see [Known Gaps](#known-gaps--todos)). The alert-trigger endpoint is not
> yet configured.

---

## 1. Tech Stack

| Layer          | Technology                                              |
|----------------|----------------------------------------------------------|
| Framework      | Next.js 16 (App Router), React 19, TypeScript 5          |
| Styling        | Tailwind CSS v4                                           |
| Mapping engine | Mapbox GL JS v3 (`mapbox://styles/mapbox/standard` + `standard-satellite`) |
| Geospatial ops | `@turf/turf` v7 (grid generation, distance, point-in-polygon, centroid) |
| Charts         | Recharts v3 (trend lines, forecast composites)            |
| Icons          | lucide-react                                              |

---

## 2. Architecture Overview

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Composes Header + DetailSidebar + Map + Footer,
│                            # owns top-level state (selection, visibility, fly-to target)
├── components/
│   ├── Header.tsx           # Wordmark, search (events + district heat maps), help/lang icons
│   ├── Map.tsx               # Mapbox instance, all layers, view options panel, map controls
│   ├── DetailSidebar.tsx     # Slide-in panel for a selected hazard/station
│   ├── FlashFloodPanel.tsx   # Flash-flood parameter list + 12h forecast chart
│   ├── LandslidePanel.tsx    # Landslide parameter list + 12h forecast chart
│   ├── TrendChart.tsx        # Shared 8-day historical trend chart
│   ├── AlertButton.tsx       # PIN-gated alert arm/disarm switch
│   └── Footer.tsx            # Disclaimer bar
├── data/
│   ├── hazards/
│   │   ├── types.ts          # HazardEvent, MonitoringStation, Severity, dataset meta types
│   │   ├── flash-flood.ts    # Historical flash-flood events (Uttarakhand)
│   │   ├── landslide.ts      # Historical landslide events (Uttarakhand)
│   │   ├── devices.ts        # Government monitoring station list
│   │   └── index.ts          # getHazardEvents(), category union, re-exports
│   └── boundaries/
│       └── rudraprayag.ts    # District boundary polygon + center (for the risk grid)
├── lib/
│   ├── hazard-display.ts     # Shared severity → color mapping
│   ├── seeded-random.ts      # Deterministic PRNG for stable synthetic values
│   ├── flash-flood-prediction.ts  # Synthetic parameter + 12h forecast generator
│   ├── landslide-prediction.ts    # Synthetic parameter + 12h forecast generator
│   ├── heatmap-grid.ts       # Rudraprayag 800m² risk-grid generator (IDW interpolation)
│   └── alert-payload.ts      # Alert JSON payload builder + POST call
└── types/
    └── selection.ts          # Discriminated union for "what's selected on the map"
```

---

## 3. Feature Breakdown

### 3.1 Base Map

- Mapbox GL JS `standard` style (toggleable to `standard-satellite` — the
  "Map / Hybrid" switch in the view options panel).
- India rendered with its full claimed territory (Jammu & Kashmir, Ladakh,
  Aksai Chin) via `map.setConfigProperty("basemap", "worldview", "IN")`.
- Every country **except** India, Nepal, and Bhutan is faded using a
  semi-opaque fill layer sourced from `mapbox.country-boundaries-v1`, filtered
  by `worldview`, so the disputed-border rendering stays consistent with the
  fade mask.
- **3D terrain**: real elevation via Mapbox's `mapbox-rgb` terrain-DEM tiles,
  `setTerrain({ exaggeration: 1.4 })`, plus an atmosphere `sky` layer. Re-applied
  on every `style.load` since `setStyle()` wipes terrain along with everything
  else.

### 3.2 Hazard & Device Data

Three hardcoded datasets, all under `src/data/hazards/`:

| Dataset       | File               | Real records | Migrated risk-zone records | Total | Status |
|---------------|---------------------|:---:|:---:|:---:|--------|
| Flash floods  | `flash-flood.ts`    | 33 (FF001–FF033) | 26 (`VA-*`) | 59 | ⚠️ incomplete — source cut off at FF034/50 |
| Landslides    | `landslide.ts`      | 60 (LS001–LS060) | 52 (`VA-*`) | 112 | Complete as supplied |
| Monitoring stations | `devices.ts` | 20 (UK-HM-001–020) | — | 20 | ⚠️ incomplete — source cut off after UK-HM-020 |

Each `HazardEvent` carries: id, date, event name, state/district/location,
lat/lon, `trigger[]`, type, fatalities, source citation, and an optional
`Severity` (`EXTREME` / `CRITICAL` / `HIGH` — undefined for older historical
records that predate a severity classification). `MonitoringStation` is a
sibling shape without severity, carrying `hazard[]` instead (what it monitors
for).

All data is explicitly labeled as real historical/government-sourced records
where applicable — no fabricated events or coordinates. Missing data was
flagged rather than invented.

### 3.3 Map Visualization (Zoom-Adaptive)

- **Zoomed out (`< zoom 6`)**: hexagonal binning (`turf.hexGrid` +
  `turf.collect`) aggregates nearby events into hexbins, colored by a weight
  gradient (amber → red) based on event density.
- **Zoomed in (`≥ zoom 6`)**: individual circle markers per hazard event,
  colored by `Severity` (`SEVERITY_COLOR` — falls back to a neutral
  historical color when severity is undefined), radius scales with zoom.
- **Monitoring stations**: rendered as square icons (not circles) to visually
  distinguish infrastructure from hazard occurrences. Devices render at every
  zoom level *only* when they're the sole enabled category (`deviceMinzoomFor`);
  otherwise they hand off to the hex/point threshold like everything else.
- A synthetic `__uid` (array index) is stamped onto every GeoJSON feature.
  Mapbox JSON-stringifies array-valued properties (`trigger`, `hazard`) when
  read back from click events, so click handlers resolve the real object via
  `visibleHazardEvents(visibility)[uid]` / `deviceStations[uid]` rather than
  trusting `feature.properties` directly. This also avoids a correctness bug
  where several migrated risk-zone records share an `id` across the flash-flood
  and landslide datasets.

### 3.4 Category Visibility (View Options Panel)

- Independent multi-select toggles — **Flash Flood**, **Landslide**, **Device
  Location** — all default **on**, no "All" state.
- Panel opens by default on page load; closable via an X button in its own
  top-right corner (button and panel occupy the same `top-4 right-4` map
  corner, mutually exclusive).
- Fixed `210px` width, height capped at `50%` of the map minus margin, with an
  independently scrollable body (header stays pinned) so it never overlaps the
  Locate/Zoom controls as content grows.
- Includes a Map/Hybrid basemap segmented control and a risk-level legend
  (circle swatches in point view, hexagon icons in hexbin view — swaps
  automatically at the zoom threshold).

### 3.5 Rudraprayag Risk Grid (Heat Map)

Purpose-built for a single district as a proof of concept, documented in
[`heatmap-grid.ts`](src/lib/heatmap-grid.ts):

1. **Boundary**: an irregular 14-point polygon approximating Rudraprayag
   district's real outline (`src/data/boundaries/rudraprayag.ts`) — not a
   bounding-box rectangle, so the grid clips to a realistic shape rather than
   filling a square.
2. **Grid**: `turf.squareGrid()` generates 800m × 800m cells across the
   boundary's bounding box.
3. **Clipping**: each cell's centroid is tested with
   `turf.booleanPointInPolygon` against the district polygon — cells outside
   the real outline are dropped, producing the jagged, realistic edge.
4. **Risk scoring**: inverse-distance-weighted (IDW) interpolation from every
   flash-flood + landslide event within a 6km influence radius of each cell's
   centroid. Each event's contribution is weighted by its severity
   (`EXTREME=100, CRITICAL=75, HIGH=55`, undated historical records default to
   `45`), combined as:

   ```
   risk = Σ(eventWeight × 1/distance²) / Σ(1/distance²)
   ```

5. **Classification**: `risk ≥ 70` → red, `40 ≤ risk < 70` → orange,
   `risk < 40` → green.
6. **Trigger**: shown only when the user searches "Rudraprayag" in the header
   search bar (a distinct suggestion entry, separate from event results) —
   no zoom threshold, no click interaction on the grid itself. The map flies
   to the district center at zoom 11. Selecting a hazard event afterward
   clears the grid, and vice versa.
7. **Render order**: inserted below the hexbin/point/device layers so hazard
   markers always draw on top of the grid.

> **This is explicitly a placeholder.** `getRudraprayagRiskGrid()` is
> documented in-code as synthetic/derived data standing in for a real ML
> risk-prediction backend. When a backend endpoint is available, this
> function's body is the only thing that needs to change — swap the local
> IDW computation for a `fetch()` call, keeping the same
> `FeatureCollection<Polygon, { riskValue, riskLevel }>` return shape so
> `Map.tsx` requires no changes.

**Expected backend contract**, once available:

```json
{
  "district": "rudraprayag",
  "boundary": { "type": "Polygon", "coordinates": [[ ... ]] },
  "riskPoints": [
    { "latitude": 30.3, "longitude": 78.7, "riskValue": 85, "source": "ML_MODEL" }
  ]
}
```

### 3.6 Detail Sidebar

Opens when a hazard point or device station is clicked; slides in as a real
flex-layout panel (not an overlay) so the map area genuinely resizes — a
`ResizeObserver` calls `map.resize()` whenever the sidebar's open/close
changes the map container's dimensions.

- Fixed `250px` width, `300ms` slide transition.
- Closes via its own top-right X, or by clicking anywhere on the map that
  isn't a selectable point.
- Routes to a category-specific panel based on `event.type`:
  - **Flash Flood** → `FlashFloodPanel` (17 user-specified parameters)
  - **Landslide** → `LandslidePanel` (16 user-specified parameters)
  - **Monitoring stations / anything else** → a plain `TrendChart`

#### Prediction Panels

Both panels share a structure:

1. An 8-day historical `TrendChart` (Recharts `AreaChart`, reference lines at
   Warning=60 / Danger=75 / Extreme=90).
2. Grouped synthetic parameter values (deterministically seeded per location
   via `createSeededRandom(hash(event.id))` — the same event always renders
   the same "sensor" values across reloads, without being real telemetry).
3. An **ETA banner**: a 12-hour composite risk forecast is generated, and ETA
   is the first hour at which the composite crosses the danger threshold
   (`RISK_DANGER = 75`), labeled into three tiers (Warning / High Alert /
   Extreme).
4. A bottom 12-hour composite forecast chart visualizing the same curve.

All values are clearly synthetic/model-ready placeholders — the panels exist
to demonstrate where a real ML model's output would be surfaced, not to claim
real sensor readings.

### 3.7 Alert System

`AlertButton` (footer of the sidebar, hazard events only — not shown for
monitoring stations):

- A toggle switch. Turning it on requires entering a 4-digit PIN (`1972`,
  `ALERT_PIN` in `alert-payload.ts`) before it arms.
- On arm, `sendAlert(event, true)` builds and POSTs a JSON payload; on
  disarm, `sendAlert(event, false)` is best-effort (UI reflects "off"
  immediately regardless of network result).
- Payload shape (`buildAlertPayload`):

  ```ts
  {
    active: boolean,
    region: string,        // event.district
    lat: number,
    lon: number,
    sevirity: string,      // intentional spelling — matches endpoint's field name
    type: "flood" | "landslide",
  }
  ```

- `ALERT_ENDPOINT` is currently an **empty string placeholder** — until it's
  configured, `sendAlert` logs the payload to console and throws, which the
  UI surfaces as "Endpoint not configured — alert marked active locally only."

---

## 4. Known Gaps / TODOs

| Item | Detail |
|------|--------|
| Flash-flood dataset incomplete | Source data was cut off after FF033; the dataset's own metadata claims 50 records. FF034 onward is missing, not fabricated. |
| Device dataset incomplete | Source data was cut off after UK-HM-020; unknown if more stations exist beyond it. |
| Alert endpoint unset | `ALERT_ENDPOINT` in `src/lib/alert-payload.ts` needs a real URL. |
| `sevirity` field mapping unconfirmed | The endpoint's one example payload used `"moderate"`, which doesn't match any of this app's severity labels — currently mapped as a best guess (`CRITICAL → "moderate"`), not yet confirmed against real API docs. |
| Risk grid is single-district | Only Rudraprayag is implemented. Extending to other districts requires a boundary polygon + adding the district to `DISTRICT_HEATMAPS` in `Header.tsx`. |
| Risk grid data is synthetic | IDW-from-historical-events stands in for a real ML risk-prediction backend (see §3.5). |
| District boundary is approximate | Hand-traced polygon, not a survey-accurate shapefile. |

---

## 5. Data Integrity Principles Followed

- No hazard event, coordinate, or fatality count was invented — all sourced
  from user-supplied historical/government records, with citations preserved
  in each dataset's `source` field and dataset-level `meta` object.
- Where source data was truncated, the gap is explicitly commented in the
  file rather than filled with guessed records.
- Synthetic data (sensor parameter values, ETA forecasts, the Rudraprayag
  risk grid) is clearly scoped to prediction/demo surfaces and documented
  in-code as a placeholder for a future ML backend — never mixed into the
  historical event records themselves.

---

## 6. Running Locally

```bash
npm install
npm run dev
```

Requires a Mapbox access token in `.env.local`:

```
NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here
```

Open [http://localhost:3000](http://localhost:3000).
