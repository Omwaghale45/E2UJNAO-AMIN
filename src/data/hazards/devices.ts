import type { MonitoringStation, MonitoringStationDatasetMeta } from "./types";

// NOTE: the source message describing these stations was cut off by a
// platform length limit partway through UK-HM-020. Only 20 stations
// (UK-HM-001..020) were received — if the original list had more,
// send the rest and they can be appended here.
export const devicesMeta: MonitoringStationDatasetMeta = {
  datasetName:
    "Uttarakhand_Government_HydroMeteorological_and_Landslide_Monitoring_Stations",
  version: "1.0",
  country: "India",
  state: "Uttarakhand",
  purpose: "ML-ready station schema for flash-flood and landslide prediction",
  importantNote:
    "The listed coordinates came from the user's station table. Government agencies operate AWS/ARG, hydrological telemetry and landslide forecasting systems, but a government sensor should not be claimed at an individual station unless independently verified.",
  governmentSystems: {
    IMD: [
      "Automatic Weather Stations (AWS)",
      "Automatic Rain Gauge (ARG)",
      "manual rain gauges",
      "weather observations and warnings",
    ],
    USDMA: [
      "hydro-meteorological instruments/sensors",
      "automated weather stations",
      "Doppler radars",
      "real-time disaster early warning",
    ],
    CWC: [
      "river gauge stations",
      "water-level monitoring",
      "discharge observations",
      "telemetry",
      "flood forecasting",
    ],
    GSI: [
      "National Landslide Forecasting Centre",
      "rainfall-threshold landslide forecasting",
      "landslide inventory",
      "landslide monitoring/early-warning R&D",
    ],
    NCMRWF_IMD_GSI: [
      "forecast products and rainfall/weather inputs for landslide forecasting",
    ],
  },
};

const STATION_HAZARD = ["flash_flood", "flood", "landslide"];
const STATION_TRIGGER = [
  "heavy_rainfall",
  "cloudburst",
  "rapid_runoff",
  "slope_saturation",
];
const STATION_TYPE = "hydro-meteorological monitoring station";
const STATION_SOURCE =
  "User-supplied station list; government monitoring architecture cross-checked against IMD/USDMA/CWC/GSI";

function station(
  id: string,
  eventName: string,
  district: string,
  location: string,
  latitude: number,
  longitude: number
): MonitoringStation {
  return {
    id,
    eventName,
    date: null,
    country: "India",
    state: "Uttarakhand",
    district,
    location,
    latitude,
    longitude,
    hazard: STATION_HAZARD,
    trigger: STATION_TRIGGER,
    type: STATION_TYPE,
    fatalities: null,
    source: STATION_SOURCE,
  };
}

export const deviceStations: MonitoringStation[] = [
  station(
    "UK-HM-001",
    "Ranikhet Hydro-Meteorological Monitoring Station",
    "Almora",
    "Ranikhet",
    29.64,
    79.42
  ),
  station(
    "UK-HM-002",
    "Someshwar Hydro-Meteorological Monitoring Station",
    "Almora",
    "Someshwar",
    29.78,
    79.61
  ),
  station(
    "UK-HM-003",
    "Bageshwar Hydro-Meteorological Monitoring Station",
    "Bageshwar",
    "Bageshwar",
    29.8308,
    79.77
  ),
  station(
    "UK-HM-004",
    "Garur Hydro-Meteorological Monitoring Station",
    "Bageshwar",
    "Garur",
    29.9,
    79.62
  ),
  station(
    "UK-HM-005",
    "Karnprayag Hydro-Meteorological Monitoring Station",
    "Chamoli",
    "Karnprayag",
    30.25,
    79.21
  ),
  station(
    "UK-HM-006",
    "Tharali Hydro-Meteorological Monitoring Station",
    "Chamoli",
    "Tharali",
    30.06,
    79.51
  ),
  station(
    "UK-HM-007",
    "Lohaghat Hydro-Meteorological Monitoring Station",
    "Champawat",
    "Lohaghat",
    29.4,
    80.09
  ),
  station(
    "UK-HM-008",
    "Pati Hydro-Meteorological Monitoring Station",
    "Champawat",
    "Pati",
    29.4,
    79.93
  ),
  station(
    "UK-HM-009",
    "Kalsi Hydro-Meteorological Monitoring Station",
    "Dehradun",
    "Kalsi",
    30.53,
    77.84
  ),
  station(
    "UK-HM-010",
    "Rishikesh Hydro-Meteorological Monitoring Station",
    "Dehradun",
    "Rishikesh",
    30.11,
    78.28
  ),
  station(
    "UK-HM-011",
    "Haridwar Hydro-Meteorological Monitoring Station",
    "Haridwar",
    "Haridwar",
    29.92,
    78.12
  ),
  station(
    "UK-HM-012",
    "Kasya Hydro-Meteorological Monitoring Station",
    "Nainital",
    "Kasya",
    29.48,
    79.47
  ),
  station(
    "UK-HM-013",
    "Ramnagar Hydro-Meteorological Monitoring Station",
    "Nainital",
    "Ramnagar",
    29.39,
    79.11
  ),
  station(
    "UK-HM-014",
    "Kotdwar Hydro-Meteorological Monitoring Station",
    "Pauri_Garhwal",
    "Kotdwar",
    29.74,
    78.52
  ),
  station(
    "UK-HM-015",
    "Srinagar_arg Hydro-Meteorological Monitoring Station",
    "Pauri_Garhwal",
    "Srinagar_arg",
    30.22,
    78.77
  ),
  station(
    "UK-HM-016",
    "Gangolihat Hydro-Meteorological Monitoring Station",
    "Pithoragarh",
    "Gangolihat",
    29.65,
    80.04
  ),
  station(
    "UK-HM-017",
    "Jakholi Hydro-Meteorological Monitoring Station",
    "Rudraprayag",
    "Jakholi",
    30.39,
    78.89
  ),
  station(
    "UK-HM-018",
    "Ukhimath Hydro-Meteorological Monitoring Station",
    "Rudraprayag",
    "Ukhimath",
    30.5119,
    79.0939
  ),
  station(
    "UK-HM-019",
    "Devprayag Hydro-Meteorological Monitoring Station",
    "Tehri_Garhwal",
    "Devprayag",
    30.14,
    78.6
  ),
  station(
    "UK-HM-020",
    "Kashipur Hydro-Meteorological Monitoring Station",
    "Udham_Singh_Nagar",
    "Kashipur",
    29.21,
    78.95
  ),
];
