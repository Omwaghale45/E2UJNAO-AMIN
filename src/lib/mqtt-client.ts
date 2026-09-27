"use client";
// Browser-only: connects directly to the MQTT broker over WebSocket
// (mosquitto's ws listener on 8083) and fans out the latest reading to
// any subscribed React components. No Next.js API route in the loop.
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

export interface TelemetryCache {
  data: WeatherTelemetry | null;
  receivedAt: number | null;
  connected: boolean;
}

type Listener = (cache: TelemetryCache) => void;

const cache: TelemetryCache = {
  data: null,
  receivedAt: null,
  connected: false,
};

const listeners = new Set<Listener>();
let client: MqttClient | undefined;

function notify() {
  for (const listener of listeners) listener(cache);
}

function ensureClient(): MqttClient {
  if (client) return client;

  client = mqtt.connect({
    host: MQTT_BROKER_URL,
    port: 443,
    protocol: "wss",
    path: "/mqtt",
  });

  client.on("connect", () => {
    cache.connected = true;
    notify();
    client?.subscribe(WEATHER_SENSOR_TOPIC, (err) => {
      if (err) console.error("[mqtt] subscribe failed:", err);
    });
  });

  client.on("reconnect", () => {
    cache.connected = false;
    notify();
  });
  client.on("close", () => {
    cache.connected = false;
    notify();
  });
  client.on("error", (err) => {
    cache.connected = false;
    notify();
    console.error("[mqtt] client error:", err);
  });

  client.on("message", (topic, payload) => {
    if (topic !== WEATHER_SENSOR_TOPIC) return;
    try {
      cache.data = JSON.parse(payload.toString()) as WeatherTelemetry;
      cache.receivedAt = Date.now();
      notify();
    } catch (err) {
      console.error("[mqtt] failed to parse payload:", err);
    }
  });

  return client;
}

// Subscribes to live weather telemetry, opening the shared broker
// connection on first use. Fires immediately with the current cache,
// then again on every update. Returns an unsubscribe function.
export function subscribeWeatherTelemetry(listener: Listener): () => void {
  ensureClient();
  listeners.add(listener);
  listener(cache);
  return () => {
    listeners.delete(listener);
  };
}
