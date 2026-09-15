import { NextResponse } from "next/server";
import { ensureWeatherMqttSubscription } from "@/lib/mqtt-client";

// Needs a real TCP socket to the MQTT broker — must run on the Node.js
// runtime, not the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cache = ensureWeatherMqttSubscription();
  return NextResponse.json({
    data: cache.data,
    receivedAt: cache.receivedAt,
    connected: cache.connected,
  });
}
