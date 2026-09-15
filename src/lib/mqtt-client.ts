// Server-only: maintains a single persistent MQTT connection and caches
// the latest reading, so route handlers don't reconnect on every
// request. Never import this from a "use client" file — import
// mqtt-config.ts instead for the client-safe constants.
import mqtt, { type MqttClient } from "mqtt";
import { MQTT_BROKER_URL, WEATHER_SENSOR_TOPIC } from "@/lib/mqtt-config";

export interface WeatherTelemetry {
  inclination_x: number;
  inclination_y: number;
  temperature: number;
  pressure: number;
  soil_moisture: number;
  soil_temperature: number;
  windSpeed_ms: number;
  humidity: number;
}

interface TelemetryCache {
  data: WeatherTelemetry | null;
  receivedAt: number | null;
  connected: boolean;
}

// Stored on the Node global object so the connection and cache survive
// Next.js dev-server module reloads instead of reconnecting every time
// this file is re-evaluated.
declare global {
  // eslint-disable-next-line no-var
  var __weatherMqttClient: MqttClient | undefined;
  // eslint-disable-next-line no-var
  var __weatherTelemetryCache: TelemetryCache | undefined;
}

function getCache(): TelemetryCache {
  if (!global.__weatherTelemetryCache) {
    global.__weatherTelemetryCache = {
      data: null,
      receivedAt: null,
      connected: false,
    };
  }
  return global.__weatherTelemetryCache;
}

export function ensureWeatherMqttSubscription(): TelemetryCache {
  const cache = getCache();

  if (!global.__weatherMqttClient) {
    const client = mqtt.connect(MQTT_BROKER_URL, {
      reconnectPeriod: 3000,
      connectTimeout: 8000,
    });

    client.on("connect", () => {
      cache.connected = true;
      client.subscribe(WEATHER_SENSOR_TOPIC, (err) => {
        if (err) console.error("[mqtt] subscribe failed:", err);
      });
    });

    client.on("reconnect", () => {
      cache.connected = false;
    });
    client.on("close", () => {
      cache.connected = false;
    });
    client.on("error", (err) => {
      cache.connected = false;
      console.error("[mqtt] client error:", err);
    });

    client.on("message", (topic, payload) => {
      if (topic !== WEATHER_SENSOR_TOPIC) return;
      try {
        cache.data = JSON.parse(payload.toString()) as WeatherTelemetry;
        cache.receivedAt = Date.now();
      } catch (err) {
        console.error("[mqtt] failed to parse payload:", err);
      }
    });

    global.__weatherMqttClient = client;
  }

  return cache;
}
