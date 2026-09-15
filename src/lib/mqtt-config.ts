// Client-safe constants for the live IoT sensor integration. Kept
// separate from mqtt-client.ts (which imports the "mqtt" package and
// must never be pulled into a browser bundle).
export const MQTT_BROKER_URL =
  process.env.MQTT_BROKER_URL ?? "mqtt://192.168.72.1:1883";
export const WEATHER_SENSOR_TOPIC = "device/weather_sensor_node_001/telematry";

// Physical placement: the sensor node has no lat/lon of its own, so its
// live readings are attached to this existing hardcoded station
// (Ukhimath, Rudraprayag district) rather than plotted as a new pin.
export const LIVE_SENSOR_STATION_ID = "UK-HM-018";

export const TELEMETRY_ENDPOINT = "/api/telemetry/weather-sensor";
