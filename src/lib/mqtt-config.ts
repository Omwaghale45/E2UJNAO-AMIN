// Client-safe constants for the live IoT sensor integration. Kept
// separate from mqtt-client.ts (which imports the "mqtt" package and
// must never be pulled into a browser bundle).
export const MQTT_BROKER_URL = "localhost";
export const WEATHER_SENSOR_TOPIC = "device/weather_sensor_node_001/telematry";
export const LIVE_SENSOR_STATION_ID = "UK-HM-018";
export const TELEMETRY_ENDPOINT = "/api/telemetry/weather-sensor";
