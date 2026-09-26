"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  deviceStations,
  flashFloodEvents,
  landslideEvents,
  type HazardEvent,
  type Severity,
} from "@/data/hazards";

const COLOR = {
  flood: "#4285F4",
  landslide: "#FBBC05",
  critical: "#EA4335",
  station: "#34A853",
  hub: "#60A5FA",
  sky: "#020617",
  lightning: "#1E3A8A",
};

const LAT_MIN = 28.7;
const LAT_MAX = 31.5;
const LNG_MIN = 77.5;
const LNG_MAX = 81.1;
const UNITS_PER_DEG = 12.5;
const LAT_MID = (LAT_MIN + LAT_MAX) / 2;
const LNG_MID = (LNG_MIN + LNG_MAX) / 2;
const LNG_SCALE = Math.cos((LAT_MID * Math.PI) / 180);
const TERRAIN_W = (LNG_MAX - LNG_MIN) * LNG_SCALE * UNITS_PER_DEG;
const TERRAIN_D = (LAT_MAX - LAT_MIN) * UNITS_PER_DEG;
const HALF_W = TERRAIN_W / 2;
const HALF_D = TERRAIN_D / 2;
const HEIGHT_SCALE = 0.85;
const HUB = { lat: 30.2849, lng: 78.9812 };
const ZONES = 12;
const INTRO = 4.2;
const DIVE = 1.9;
const RAIN_HEIGHT = 22;

const SEVERITY_RANK: Record<Severity, number> = { EXTREME: 3, CRITICAL: 2, HIGH: 1 };

interface River {
  name: string;
  width: number;
  parent?: number;
  path: [number, number][];
}

// Paths run source → mouth; a tributary's last point must be a vertex of its parent.
const RIVERS: River[] = [
  {
    name: "Ganga",
    width: 0.26,
    path: [[30.146, 78.598], [30.12, 78.45], [30.09, 78.31], [30.0, 78.2], [29.93, 78.15], [29.75, 78.1], [29.55, 78.05], [29.2, 78.1]],
  },
  {
    name: "Alaknanda",
    width: 0.22,
    parent: 0,
    path: [[30.77, 79.49], [30.65, 79.55], [30.555, 79.565], [30.46, 79.42], [30.4, 79.33], [30.33, 79.3], [30.265, 79.22], [30.29, 79.1], [30.285, 78.98], [30.23, 78.83], [30.2, 78.7], [30.146, 78.598]],
  },
  {
    name: "Bhagirathi",
    width: 0.2,
    parent: 0,
    path: [[30.93, 79.08], [30.99, 78.94], [31.03, 78.75], [30.9, 78.58], [30.73, 78.44], [30.55, 78.42], [30.38, 78.48], [30.25, 78.56], [30.146, 78.598]],
  },
  {
    name: "Mandakini",
    width: 0.15,
    parent: 1,
    path: [[30.735, 79.067], [30.65, 78.99], [30.55, 79.0], [30.42, 78.98], [30.285, 78.98]],
  },
  {
    name: "Dhauliganga",
    width: 0.15,
    parent: 1,
    path: [[30.72, 79.9], [30.62, 79.78], [30.49, 79.65], [30.555, 79.565]],
  },
  {
    name: "Pindar",
    width: 0.14,
    parent: 1,
    path: [[30.1, 79.95], [30.07, 79.72], [30.15, 79.45], [30.265, 79.22]],
  },
  {
    name: "Yamuna",
    width: 0.2,
    path: [[31.01, 78.46], [30.85, 78.3], [30.7, 78.1], [30.5, 77.86], [30.4, 77.65], [30.2, 77.45]],
  },
  {
    name: "Kali",
    width: 0.2,
    path: [[30.3, 80.9], [30.05, 80.72], [29.85, 80.54], [29.6, 80.36], [29.3, 80.2], [29.05, 80.1], [28.8, 80.05]],
  },
  {
    name: "Ramganga",
    width: 0.16,
    path: [[30.05, 79.3], [29.85, 79.2], [29.6, 79.02], [29.42, 78.88], [29.2, 78.75], [28.85, 78.6]],
  },
];

type HazardKind = "flood" | "landslide";

interface RegionEvent {
  name: string;
  year: string;
  kind: HazardKind;
  severity?: Severity;
  fatalities: number;
  x: number;
  z: number;
}

function project(lat: number, lng: number): [number, number] {
  return [(lng - LNG_MID) * LNG_SCALE * UNITS_PER_DEG, -(lat - LAT_MID) * UNITS_PER_DEG];
}

function inRegion(lat: number, lng: number) {
  return lat > LAT_MIN && lat < LAT_MAX && lng > LNG_MIN && lng < LNG_MAX;
}

function toRegionEvents(events: HazardEvent[], kind: HazardKind): RegionEvent[] {
  return events
    .filter((e) => inRegion(e.latitude, e.longitude))
    .map((e) => {
      const [x, z] = project(e.latitude, e.longitude);
      return {
        name: e.eventName.split(" / ")[0].replace(/ Event$/, ""),
        year: e.date?.slice(0, 4) ?? "",
        kind,
        severity: e.severity,
        fatalities: e.fatalities ?? 0,
        x,
        z,
      };
    });
}

const REGION_EVENTS = [
  ...toRegionEvents(flashFloodEvents, "flood"),
  ...toRegionEvents(landslideEvents, "landslide"),
];

const REGION_STATIONS = deviceStations
  .filter((s) => inRegion(s.latitude, s.longitude))
  .map((s) => project(s.latitude, s.longitude));

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function createNoise(seed: number) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const grad = (hash: number, x: number, y: number) => {
    switch (hash & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const u = fade(xf);
    const v = fade(yf);
    const g00 = grad(perm[perm[X] + Y], xf, yf);
    const g10 = grad(perm[perm[X + 1] + Y], xf - 1, yf);
    const g01 = grad(perm[perm[X] + Y + 1], xf, yf - 1);
    const g11 = grad(perm[perm[X + 1] + Y + 1], xf - 1, yf - 1);
    const x1 = g00 + u * (g10 - g00);
    const x2 = g01 + u * (g11 - g01);
    return x1 + v * (x2 - x1);
  };
}

function createTerrainSampler() {
  const base = createNoise(1337);
  const ridge = createNoise(7331);
  const warp = createNoise(4242);

  const segments: number[] = [];
  const riverPoints: [number, number][][] = [];
  const riverDownstream: number[][] = [];
  let maxDm = 0;

  // Downstream distance ("dm") is measured along the network to the final mouth,
  // so a surge can sweep every tributary and hand off seamlessly at confluences.
  for (const river of RIVERS) {
    const pts = river.path.map(([lat, lng]) => project(lat, lng));
    const dm = new Array<number>(pts.length).fill(0);
    const parent = river.parent;
    if (parent !== undefined) {
      const [mx, mz] = pts[pts.length - 1];
      let best = Infinity;
      riverPoints[parent].forEach(([px, pz], i) => {
        const d = Math.hypot(px - mx, pz - mz);
        if (d < best) {
          best = d;
          dm[pts.length - 1] = riverDownstream[parent][i];
        }
      });
    }
    for (let i = pts.length - 2; i >= 0; i--) {
      dm[i] = dm[i + 1] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    }
    maxDm = Math.max(maxDm, dm[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], dm[i], dm[i + 1], river.width);
    }
    riverPoints.push(pts);
    riverDownstream.push(dm);
  }

  const seg = Float32Array.from(segments);
  const segCount = seg.length / 7;

  const fbm = (x: number, z: number) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < 5; o++) {
      sum += base(x * freq, z * freq) * amp;
      freq *= 2.03;
      amp *= 0.5;
    }
    return sum;
  };

  const ridged = (x: number, z: number) => {
    let sum = 0;
    let amp = 0.6;
    let freq = 1;
    for (let o = 0; o < 3; o++) {
      const r = 1 - Math.abs(ridge(x * freq, z * freq));
      sum += r * r * amp;
      freq *= 2.1;
      amp *= 0.5;
    }
    return sum;
  };

  const result = { h: 0, bank: 0, dm: 0 };

  const sample = (x: number, z: number) => {
    const wx = x + warp(x * 0.32, z * 0.32) * 0.5;
    const wz = z + warp(x * 0.32 + 19.7, z * 0.32 - 8.3) * 0.5;

    let best = Infinity;
    let bestDm = 0;
    let bestWidth = 0.2;
    for (let s = 0; s < segCount; s++) {
      const o = s * 7;
      const ax = seg[o];
      const az = seg[o + 1];
      const dx = seg[o + 2] - ax;
      const dz = seg[o + 3] - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = clamp01(((wx - ax) * dx + (wz - az) * dz) / len2);
      const ex = wx - (ax + dx * t);
      const ez = wz - (az + dz * t);
      const d2 = ex * ex + ez * ez;
      if (d2 < best) {
        best = d2;
        bestDm = seg[o + 4] + (seg[o + 5] - seg[o + 4]) * t;
        bestWidth = seg[o + 6];
      }
    }
    const dist = Math.sqrt(best);

    const north = clamp01((HALF_D - z) / TERRAIN_D);
    const alt = Math.pow(north, 1.5);
    const f = fbm(x * 0.11, z * 0.11);
    const r = ridged(x * 0.075 + 3.1, z * 0.075 - 1.7);
    let h = 0.35 + alt * 4.2 + (f * 0.5 + 0.5) * (0.9 + alt * 2.0) + r * r * (0.8 + alt * 3.6);

    const bed = 0.08 + alt * 1.9;
    const valley = smoothstep(bestWidth * 0.5, 1.4 + bestWidth * 3 + alt * 1.4, dist);
    h = bed + (h - bed) * Math.pow(valley, 0.85);

    const edge = Math.min(HALF_W - Math.abs(x), HALF_D - Math.abs(z));
    h *= 0.4 + 0.6 * smoothstep(0, 4, edge);

    result.h = h * HEIGHT_SCALE;
    result.bank = dist - bestWidth;
    result.dm = bestDm;
    return result;
  };

  return { sample, maxDm };
}

function pickLabelled(events: RegionEvent[], hub: [number, number], count: number) {
  const chosen: RegionEvent[] = [];
  const ranked = events.filter((e) => e.year).sort((a, b) => b.fatalities - a.fatalities);
  for (const e of ranked) {
    if (chosen.length >= count) break;
    const nearHub = Math.hypot(e.x - hub[0], e.z - hub[1]) < 2;
    const duplicate = chosen.some((c) => Math.hypot(e.x - c.x, e.z - c.z) < 2.5);
    if (!nearHub && !duplicate) chosen.push(e);
  }
  return chosen;
}

type Box = [number, number, number, number];

const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

function makeLabel(title: string, meta: string, color: string) {
  const root = document.createElement("div");
  root.className = "pointer-events-none flex select-none flex-col items-center";
  root.style.opacity = "0";
  root.style.transition = "opacity 0.8s ease";

  const pill = document.createElement("div");
  pill.className =
    "flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-slate-950/70 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/90 shadow-lg shadow-black/40 backdrop-blur-md";

  const dot = document.createElement("span");
  dot.className = "h-1.5 w-1.5 rounded-full";
  dot.style.background = color;
  dot.style.boxShadow = `0 0 8px ${color}`;

  const name = document.createElement("span");
  name.textContent = title;

  const detail = document.createElement("span");
  detail.className = "text-white/45";
  detail.textContent = meta;

  pill.append(dot, name, detail);

  const stem = document.createElement("div");
  stem.className = "h-7 w-px bg-linear-to-b from-white/10 to-white/60";

  root.append(pill, stem);
  return root;
}

const TERRAIN_VERT = /* glsl */ `
  attribute float aBank;
  attribute float aDm;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vBank;
  varying float vDm;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vBank = aBank;
    vDm = aDm;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const TERRAIN_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uHub;
  uniform float uScan;
  uniform float uScanStrength;
  uniform float uFlash;
  uniform float uSurge;
  uniform float uReveal;
  uniform vec4 uZones[ZONES];
  uniform vec2 uHalf;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vBank;
  varying float vDm;
  varying float vDepth;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float isoLine(float value, float spacing, float thickness) {
    float v = value / spacing;
    float w = max(fwidth(v), 1e-4);
    float d = abs(fract(v - 0.5) - 0.5) / w;
    return 1.0 - clamp(d / thickness, 0.0, 1.0);
  }

  void main() {
    vec3 n = normalize(vNormalW);
    float h = vWorld.y;
    float slope = 1.0 - clamp(n.y, 0.0, 1.0);
    float diffuse = max(dot(n, normalize(vec3(-0.45, 0.8, -0.35))), 0.0);

    float hn = clamp(h / 8.5, 0.0, 1.0);
    vec3 base = mix(vec3(0.010, 0.024, 0.060), vec3(0.028, 0.066, 0.140), smoothstep(0.0, 0.45, hn));
    base = mix(base, vec3(0.085, 0.140, 0.240), smoothstep(0.45, 0.95, hn));
    float snow = smoothstep(5.6, 7.2, h) * (1.0 - smoothstep(0.35, 0.75, slope));
    base = mix(base, vec3(0.42, 0.52, 0.68), snow * 0.75);

    float cloud = smoothstep(0.42, 0.85, vnoise(vWorld.xz * 0.085 + vec2(uTime * 0.018, uTime * 0.011)));
    float light = (0.26 + 0.74 * diffuse) * (1.0 - cloud * 0.35) + uFlash * 0.8;
    vec3 col = base * light;

    float fadeFar = exp(-vDepth * 0.02);
    vec3 contourCol = mix(vec3(0.10, 0.33, 0.95), vec3(0.55, 0.88, 1.0), smoothstep(1.5, 7.5, h));
    float minor = isoLine(h, 0.35, 1.0);
    float major = isoLine(h, 1.75, 1.4);
    col += contourCol * (minor * 0.14 + major * 0.5) * (0.35 + 0.65 * fadeFar);

    vec2 gv = vWorld.xz / 2.5;
    vec2 gd = abs(fract(gv - 0.5) - 0.5) / max(fwidth(gv), vec2(1e-4));
    float grid = 1.0 - clamp(min(gd.x, gd.y), 0.0, 1.0);
    col += vec3(0.16, 0.32, 0.65) * grid * 0.05 * fadeFar;

    for (int i = 0; i < ZONES; i++) {
      vec4 zone = uZones[i];
      if (zone.z <= 0.0) continue;
      float d = distance(vWorld.xz, zone.xy);
      float k = 1.0 - smoothstep(0.0, zone.z, d);
      vec3 zc = zone.w < 0.5 ? vec3(0.26, 0.52, 0.96) : (zone.w < 1.5 ? vec3(0.98, 0.72, 0.02) : vec3(0.92, 0.26, 0.21));
      float pulse = 0.65 + 0.35 * sin(uTime * 2.4 + float(i) * 1.7);
      float rings = pow(0.5 + 0.5 * sin((d - uTime * 0.5) * 12.0), 10.0);
      col += zc * k * (k * 0.28 * pulse + rings * 0.35);
    }

    float passed = vDm - uSurge;
    float surge = passed > 0.0 ? exp(-passed / 5.5) : exp(-(passed * passed) / 0.9);
    float edge = vBank - surge * 0.5;
    float water = 1.0 - smoothstep(-0.03, 0.05, edge);
    float flow = 0.5 + 0.5 * sin(vDm * 3.2 + uTime * 4.5 + vBank * 7.0);
    vec3 waterCol = mix(vec3(0.04, 0.30, 0.95), vec3(0.18, 0.80, 1.0), flow * 0.55);
    waterCol = mix(waterCol, vec3(0.85, 0.96, 1.0), smoothstep(0.45, 1.0, surge) * 0.6);
    col = mix(col, waterCol * (0.6 + surge * 1.7), water * 0.92);
    col += vec3(0.08, 0.45, 1.0) * exp(-max(edge, 0.0) * 5.0) * (0.10 + surge * 0.45);

    float dHub = distance(vWorld.xz, uHub.xz);
    float ring = exp(-pow((dHub - uScan) / 0.4, 2.0)) * uScanStrength;
    col += vec3(0.22, 0.55, 1.0) * ring * 0.55;
    col += contourCol * (minor + major) * ring * 0.9;

    float inside = 1.0 - smoothstep(uReveal - 1.5, uReveal, dHub);
    float front = exp(-pow((dHub - uReveal) / 0.35, 2.0)) * step(uReveal, 60.0);
    col = mix(uFogColor, col, inside) + vec3(0.3, 0.7, 1.0) * front * 0.9;

    float ex = 1.0 - smoothstep(uHalf.x - 4.5, uHalf.x - 0.2, abs(vWorld.x));
    float ez = 1.0 - smoothstep(uHalf.y - 4.5, uHalf.y - 0.2, abs(vWorld.z));
    col = mix(uFogColor, col, ex * ez);
    float fog = 1.0 - exp(-pow(vDepth * uFogDensity, 2.0));
    col = mix(col, uFogColor, fog);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const RAIN_VERT = /* glsl */ `
  attribute float aTop;
  attribute float aSeed;
  uniform float uPhase;
  uniform float uLength;
  uniform float uHeight;
  uniform vec2 uWind;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - uPhase * (0.75 + aSeed * 0.5), uHeight);
    float len = uLength * (0.7 + aSeed * 0.6);
    p.y += aTop * len;
    p.xz += uWind * aTop * len;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    float fade = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(uHeight - 3.0, uHeight, p.y));
    vAlpha = fade * (0.12 + aSeed * 0.2) * (1.0 - aTop * 0.8);
  }
`;

const RAIN_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  }
`;

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vTwinkle;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 40.0);
  }
`;

const STAR_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    float a = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vec3(0.75, 0.85, 1.0), a * vTwinkle * uOpacity);
  }
`;

const REVEAL_CHUNK = /* glsl */ `
  uniform float uReveal;
  uniform vec3 uHub;
  float revealAt(vec3 worldPos) {
    return 1.0 - smoothstep(uReveal - 2.0, uReveal, distance(worldPos.xz, uHub.xz));
  }
`;

const BEAM_VERT = /* glsl */ `
  attribute float aPhase;
  varying float vY;
  varying float vPhase;
  varying float vVisible;
  ${REVEAL_CHUNK}
  void main() {
    vVisible = revealAt((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
    vY = uv.y;
    vPhase = aPhase;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const BEAM_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying float vY;
  varying float vPhase;
  varying float vVisible;
  void main() {
    float fade = pow(1.0 - vY, 1.5);
    float pulse = 0.6 + 0.4 * sin(uTime * 3.0 + vPhase * 6.2831);
    gl_FragColor = vec4(uColor * 2.4, fade * pulse * vVisible);
  }
`;

const RING_VERT = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  uniform float uSpeed;
  varying float vAlpha;
  ${REVEAL_CHUNK}
  void main() {
    float t = fract(uTime * uSpeed + aPhase);
    float visible = revealAt((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
    vAlpha = (1.0 - t) * (1.0 - t) * visible;
    vec3 p = position * mix(0.12, 1.0, t);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor * 2.0, vAlpha);
  }
`;

const NODE_VERT = /* glsl */ `
  varying float vVisible;
  ${REVEAL_CHUNK}
  void main() {
    vVisible = revealAt((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const NODE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vVisible;
  void main() {
    gl_FragColor = vec4(uColor * 3.0, vVisible);
  }
`;

const POINT_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  ${REVEAL_CHUNK}
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float pulse = 0.8 + 0.2 * sin(uTime * 2.6 + aPhase * 6.2831);
    gl_PointSize = aSize * pulse * uPixelRatio * (30.0 / max(-mv.z, 1.0));
    vColor = aColor;
    vAlpha = revealAt(position);
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float core = 1.0 - smoothstep(0.0, 0.16, r);
    float halo = (1.0 - smoothstep(0.08, 0.5, r)) * 0.35;
    float ring = (1.0 - smoothstep(0.0, 0.035, abs(r - 0.4))) * 0.5;
    gl_FragColor = vec4(vColor * (1.0 + core * 1.8), (core + halo + ring) * vAlpha);
  }
`;

const ARC_VERT = /* glsl */ `
  attribute float aT;
  attribute float aSeed;
  varying float vT;
  varying float vSeed;
  void main() {
    vT = aT;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_FRAG = /* glsl */ `
  uniform float uPhase;
  uniform float uOpacity;
  uniform float uBoost;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vT;
  varying float vSeed;
  void main() {
    float head = fract(uPhase + vSeed);
    float d = vT - head;
    float packet = smoothstep(-0.12, 0.0, d) * (1.0 - smoothstep(0.0, 0.012, d));
    vec3 col = mix(uColorA, uColorB, vT) * (1.0 + packet * 2.0) * uBoost;
    gl_FragColor = vec4(col, (0.07 + packet * 0.9) * uOpacity);
  }
`;

interface LoginSceneProps {
  diving: boolean;
  onReady?: () => void;
  avoid?: RefObject<HTMLElement | null>[];
  className?: string;
}

export default function LoginScene({ diving, onReady, avoid, className }: LoginSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const divingRef = useRef(diving);
  const onReadyRef = useRef(onReady);
  const avoidRef = useRef(avoid);

  useEffect(() => {
    divingRef.current = diving;
    onReadyRef.current = onReady;
    avoidRef.current = avoid;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compact = window.innerWidth < 768;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }

    const measure = () => ({
      w: container.clientWidth || window.innerWidth,
      h: container.clientHeight || window.innerHeight,
    });
    let { w, h } = measure();
    let pixelRatio = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.6);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    Object.assign(labelRenderer.domElement.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      transition: "opacity 0.35s ease",
    });
    container.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    const sky = new THREE.Color(COLOR.sky);
    const skyBase = sky.clone();
    const skyFlash = new THREE.Color(COLOR.lightning);
    scene.background = sky;

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 240);

    const sampler = createTerrainSampler();
    const [hubX, hubZ] = project(HUB.lat, HUB.lng);
    const hubGround = sampler.sample(hubX, hubZ).h;
    const hubTop = new THREE.Vector3(hubX, hubGround + 3.2, hubZ);

    const shared = {
      uTime: { value: 0 },
      uReveal: { value: reduceMotion ? 200 : 0 },
      uHub: { value: new THREE.Vector3(hubX, hubGround, hubZ) },
      uPixelRatio: { value: pixelRatio },
    };

    // Terrain
    const segX = compact ? 150 : 230;
    const segZ = Math.round((segX * TERRAIN_D) / TERRAIN_W);
    const terrainGeo = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, segX, segZ);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainPos = terrainGeo.getAttribute("position") as THREE.BufferAttribute;
    const bank = new Float32Array(terrainPos.count);
    const downstream = new Float32Array(terrainPos.count);
    for (let i = 0; i < terrainPos.count; i++) {
      const s = sampler.sample(terrainPos.getX(i), terrainPos.getZ(i));
      terrainPos.setY(i, s.h);
      bank[i] = s.bank;
      downstream[i] = s.dm;
    }
    terrainGeo.setAttribute("aBank", new THREE.BufferAttribute(bank, 1));
    terrainGeo.setAttribute("aDm", new THREE.BufferAttribute(downstream, 1));
    terrainGeo.computeVertexNormals();

    const zones = Array.from({ length: ZONES }, () => new THREE.Vector4());
    REGION_EVENTS.filter((e) => e.severity)
      .sort((a, b) => SEVERITY_RANK[b.severity ?? "HIGH"] - SEVERITY_RANK[a.severity ?? "HIGH"])
      .slice(0, ZONES)
      .forEach((e, i) => {
        const critical = e.severity !== "HIGH";
        zones[i].set(e.x, e.z, critical ? 1.5 : 1.05, critical ? 2 : e.kind === "flood" ? 0 : 1);
      });

    const terrainUniforms = {
      uTime: shared.uTime,
      uReveal: shared.uReveal,
      uHub: shared.uHub,
      uFogColor: { value: sky },
      uFogDensity: { value: 0.019 },
      uScan: { value: -10 },
      uScanStrength: { value: 0 },
      uFlash: { value: 0 },
      uSurge: { value: -100 },
      uZones: { value: zones },
      uHalf: { value: new THREE.Vector2(HALF_W, HALF_D) },
    };
    scene.add(
      new THREE.Mesh(
        terrainGeo,
        new THREE.ShaderMaterial({
          uniforms: terrainUniforms,
          vertexShader: TERRAIN_VERT,
          fragmentShader: TERRAIN_FRAG,
          defines: { ZONES },
        }),
      ),
    );

    // Rain
    const rainCount = reduceMotion ? 0 : compact ? 1400 : 3600;
    const rainUniforms = {
      uPhase: { value: 0 },
      uLength: { value: 0.45 },
      uHeight: { value: RAIN_HEIGHT },
      uWind: { value: new THREE.Vector2(0.12, 0.05) },
      uColor: { value: new THREE.Color("#9cc3ff") },
      uOpacity: { value: 0 },
    };
    if (rainCount > 0) {
      const rainPos = new Float32Array(rainCount * 6);
      const rainTop = new Float32Array(rainCount * 2);
      const rainSeed = new Float32Array(rainCount * 2);
      for (let i = 0; i < rainCount; i++) {
        const x = (Math.random() - 0.5) * 48;
        const y = Math.random() * RAIN_HEIGHT;
        const z = (Math.random() - 0.5) * 44;
        const seed = Math.random();
        rainPos.set([x, y, z, x, y, z], i * 6);
        rainTop[i * 2 + 1] = 1;
        rainSeed[i * 2] = seed;
        rainSeed[i * 2 + 1] = seed;
      }
      const rainGeo = new THREE.BufferGeometry();
      rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
      rainGeo.setAttribute("aTop", new THREE.BufferAttribute(rainTop, 1));
      rainGeo.setAttribute("aSeed", new THREE.BufferAttribute(rainSeed, 1));
      const rain = new THREE.LineSegments(
        rainGeo,
        new THREE.ShaderMaterial({
          uniforms: rainUniforms,
          vertexShader: RAIN_VERT,
          fragmentShader: RAIN_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      rain.frustumCulled = false;
      scene.add(rain);
    }

    // Stars
    const starCount = 1500;
    const starPos = new Float32Array(starCount * 3);
    const starSize = new Float32Array(starCount);
    const starSeed = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 0.92);
      const r = 110;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) + 4;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      starSize[i] = 0.6 + Math.pow(Math.random(), 3) * 2.4;
      starSeed[i] = Math.random();
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(starSize, 1));
    starGeo.setAttribute("aSeed", new THREE.BufferAttribute(starSeed, 1));
    const starUniforms = {
      uTime: shared.uTime,
      uPixelRatio: shared.uPixelRatio,
      uOpacity: { value: reduceMotion ? 1 : 0 },
    };
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.ShaderMaterial({
          uniforms: starUniforms,
          vertexShader: STAR_VERT,
          fragmentShader: STAR_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

    // Shared builders for glowing instanced markers
    const additive = {
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    } as const;

    const addBeams = (items: { x: number; y: number; z: number; height: number }[], color: string, radius: number) => {
      const geo = new THREE.CylinderGeometry(radius, radius, 1, 8, 1, true);
      geo.translate(0, 0.5, 0);
      const phase = new Float32Array(items.length).map(() => Math.random());
      geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
      const mesh = new THREE.InstancedMesh(
        geo,
        new THREE.ShaderMaterial({
          uniforms: { uTime: shared.uTime, uReveal: shared.uReveal, uHub: shared.uHub, uColor: { value: new THREE.Color(color) } },
          vertexShader: BEAM_VERT,
          fragmentShader: BEAM_FRAG,
          ...additive,
        }),
        items.length,
      );
      const m = new THREE.Matrix4();
      items.forEach((it, i) => {
        m.makeScale(1, it.height, 1).setPosition(it.x, it.y, it.z);
        mesh.setMatrixAt(i, m);
      });
      mesh.frustumCulled = false;
      scene.add(mesh);
    };

    const addRings = (items: { x: number; y: number; z: number; scale: number }[], color: string, speed: number) => {
      const geo = new THREE.RingGeometry(0.85, 1, 48);
      geo.rotateX(-Math.PI / 2);
      const phase = new Float32Array(items.length).map(() => Math.random());
      geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
      const mesh = new THREE.InstancedMesh(
        geo,
        new THREE.ShaderMaterial({
          uniforms: {
            uTime: shared.uTime,
            uReveal: shared.uReveal,
            uHub: shared.uHub,
            uSpeed: { value: speed },
            uColor: { value: new THREE.Color(color) },
          },
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
          side: THREE.DoubleSide,
          ...additive,
        }),
        items.length,
      );
      const m = new THREE.Matrix4();
      items.forEach((it, i) => {
        m.makeScale(it.scale, it.scale, it.scale).setPosition(it.x, it.y, it.z);
        mesh.setMatrixAt(i, m);
      });
      mesh.frustumCulled = false;
      scene.add(mesh);
    };

    // Monitoring stations
    const stations = REGION_STATIONS.map(([x, z], i) => {
      const ground = sampler.sample(x, z).h;
      const height = 1.3 + (i % 4) * 0.28;
      return { x, z, ground, height, top: ground + height };
    });

    addBeams(stations.map((s) => ({ x: s.x, y: s.ground, z: s.z, height: s.height })), COLOR.station, 0.028);
    addRings(stations.map((s) => ({ x: s.x, y: s.ground + 0.08, z: s.z, scale: 0.6 })), COLOR.station, 0.45);

    const nodeMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.075, 0),
      new THREE.ShaderMaterial({
        uniforms: { uReveal: shared.uReveal, uHub: shared.uHub, uColor: { value: new THREE.Color(COLOR.station) } },
        vertexShader: NODE_VERT,
        fragmentShader: NODE_FRAG,
        ...additive,
      }),
      stations.length,
    );
    const nodeMatrix = new THREE.Matrix4();
    stations.forEach((s, i) => {
      nodeMatrix.makeTranslation(s.x, s.top, s.z);
      nodeMesh.setMatrixAt(i, nodeMatrix);
    });
    nodeMesh.frustumCulled = false;
    scene.add(nodeMesh);

    // Hazard events
    const eventPos = new Float32Array(REGION_EVENTS.length * 3);
    const eventColor = new Float32Array(REGION_EVENTS.length * 3);
    const eventSize = new Float32Array(REGION_EVENTS.length);
    const eventPhase = new Float32Array(REGION_EVENTS.length);
    const tint = new THREE.Color();
    REGION_EVENTS.forEach((e, i) => {
      const critical = e.severity === "CRITICAL" || e.severity === "EXTREME";
      eventPos.set([e.x, sampler.sample(e.x, e.z).h + 0.14, e.z], i * 3);
      tint.set(critical ? COLOR.critical : e.kind === "flood" ? COLOR.flood : COLOR.landslide);
      eventColor.set([tint.r, tint.g, tint.b], i * 3);
      eventSize[i] = critical ? 15 : e.fatalities > 50 ? 13 : 10;
      eventPhase[i] = Math.random();
    });
    const eventGeo = new THREE.BufferGeometry();
    eventGeo.setAttribute("position", new THREE.BufferAttribute(eventPos, 3));
    eventGeo.setAttribute("aColor", new THREE.BufferAttribute(eventColor, 3));
    eventGeo.setAttribute("aSize", new THREE.BufferAttribute(eventSize, 1));
    eventGeo.setAttribute("aPhase", new THREE.BufferAttribute(eventPhase, 1));
    scene.add(
      new THREE.Points(
        eventGeo,
        new THREE.ShaderMaterial({
          uniforms: { uTime: shared.uTime, uPixelRatio: shared.uPixelRatio, uReveal: shared.uReveal, uHub: shared.uHub },
          vertexShader: POINT_VERT,
          fragmentShader: POINT_FRAG,
          ...additive,
        }),
      ),
    );

    const criticalEvents = REGION_EVENTS.filter((e) => e.severity === "CRITICAL" || e.severity === "EXTREME");
    if (criticalEvents.length > 0) {
      addRings(
        criticalEvents.map((e) => ({ x: e.x, y: sampler.sample(e.x, e.z).h + 0.1, z: e.z, scale: 1.1 })),
        COLOR.critical,
        0.35,
      );
    }

    // Disaster Hub beacon at the Rudraprayag confluence
    addBeams([{ x: hubX, y: hubGround, z: hubZ, height: 3.2 }], COLOR.hub, 0.04);
    addRings([{ x: hubX, y: hubGround + 0.1, z: hubZ, scale: 2.2 }], COLOR.hub, 0.3);

    const hubColor = new THREE.Color(COLOR.hub).multiplyScalar(2.4);
    const hubMaterial = new THREE.MeshBasicMaterial({ color: hubColor, ...additive });
    const segmentedRing = (radius: number, tube: number, count: number, arc: number) => {
      const group = new THREE.Group();
      const geo = new THREE.TorusGeometry(radius, tube, 6, 96, arc);
      for (let i = 0; i < count; i++) {
        const segment = new THREE.Mesh(geo, hubMaterial);
        segment.rotation.z = (i / count) * Math.PI * 2;
        group.add(segment);
      }
      group.position.copy(hubTop);
      scene.add(group);
      return group;
    };
    const ringOuter = segmentedRing(1.3, 0.012, 2, 2.3);
    ringOuter.rotation.x = Math.PI / 2 + 0.6;
    const ringMid = segmentedRing(0.95, 0.018, 3, 1.5);
    ringMid.rotation.x = Math.PI / 2;
    const ringInner = segmentedRing(0.62, 0.014, 4, 0.9);
    ringInner.rotation.x = Math.PI / 2 - 0.45;

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.26, 1),
      new THREE.MeshBasicMaterial({ color: hubColor, wireframe: true, ...additive }),
    );
    core.position.copy(hubTop);
    scene.add(core);
    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#dbeafe").multiplyScalar(3), ...additive }),
    );
    coreGlow.position.copy(hubTop);
    scene.add(coreGlow);

    // Telemetry arcs: station → hub
    const arcSegments = 48;
    const arcPositions: number[] = [];
    const arcT: number[] = [];
    const arcSeed: number[] = [];
    const arcStart = new THREE.Vector3();
    const arcMid = new THREE.Vector3();
    stations.forEach((s) => {
      arcStart.set(s.x, s.top, s.z);
      arcMid.copy(arcStart).lerp(hubTop, 0.5);
      arcMid.y += 1.6 + arcStart.distanceTo(hubTop) * 0.22;
      const points = new THREE.QuadraticBezierCurve3(arcStart.clone(), arcMid.clone(), hubTop.clone()).getPoints(arcSegments);
      const seed = Math.random();
      for (let k = 0; k < arcSegments; k++) {
        const a = points[k];
        const b = points[k + 1];
        arcPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        arcT.push(k / arcSegments, (k + 1) / arcSegments);
        arcSeed.push(seed, seed);
      }
    });
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute("position", new THREE.Float32BufferAttribute(arcPositions, 3));
    arcGeo.setAttribute("aT", new THREE.Float32BufferAttribute(arcT, 1));
    arcGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(arcSeed, 1));
    const arcUniforms = {
      uPhase: { value: 0 },
      uOpacity: { value: reduceMotion ? 1 : 0 },
      uBoost: { value: 1 },
      uColorA: { value: new THREE.Color(COLOR.station) },
      uColorB: { value: new THREE.Color(COLOR.hub) },
    };
    scene.add(
      new THREE.LineSegments(
        arcGeo,
        new THREE.ShaderMaterial({
          uniforms: arcUniforms,
          vertexShader: ARC_VERT,
          fragmentShader: ARC_FRAG,
          ...additive,
        }),
      ),
    );

    // Floating labels
    const labels: { el: HTMLDivElement; pos: THREE.Vector3; dist: number; width: number; shown: boolean }[] = [];
    const addLabel = (x: number, y: number, z: number, title: string, meta: string, color: string) => {
      const el = makeLabel(title, meta, color);
      const obj = new CSS2DObject(el);
      obj.center.set(0.5, 1);
      obj.position.set(x, y, z);
      scene.add(obj);
      labels.push({ el, pos: obj.position, dist: Math.hypot(x - hubX, z - hubZ), width: 0, shown: false });
    };
    addLabel(hubX, hubTop.y + 1.5, hubZ, "Disaster Hub", "Rudraprayag", COLOR.hub);
    pickLabelled(REGION_EVENTS, [hubX, hubZ], 6).forEach((e) => {
      const critical = e.severity === "CRITICAL" || e.severity === "EXTREME";
      addLabel(
        e.x,
        sampler.sample(e.x, e.z).h + 0.25,
        e.z,
        e.name,
        e.year,
        critical ? COLOR.critical : e.kind === "flood" ? COLOR.flood : COLOR.landslide,
      );
    });

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.8, 0.55, 0.2);
    composer.addPass(bloom);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Camera choreography
    const target = new THREE.Vector3(-1.0, 1.5, -2.0);
    const introStart = new THREE.Vector3(target.x, target.y + 46, target.z + 4);
    const orbitRadius = 26;
    const orbitHeight = 14.5;
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    const look = target.clone();
    const orbitPos = new THREE.Vector3();
    const diveFromPos = new THREE.Vector3();
    const diveFromLook = new THREE.Vector3();
    const diveToPos = new THREE.Vector3();
    const diveToLook = new THREE.Vector3();
    const projected = new THREE.Vector3();

    const orbitPose = (t: number, out: THREE.Vector3) => {
      const swing = reduceMotion ? 0 : Math.sin(t * 0.045) * 0.55;
      const theta = 0.28 + swing + pointer.sx * 0.12;
      const lift = orbitHeight + (reduceMotion ? 0 : Math.sin(t * 0.21) * 0.6) - pointer.sy * 1.8;
      return out.set(
        target.x + Math.sin(theta) * orbitRadius,
        target.y + lift,
        target.z + Math.cos(theta) * orbitRadius,
      );
    };

    const onPointer = (e: PointerEvent) => {
      if (reduceMotion) return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const resize = () => {
      ({ w, h } = measure());
      renderer.setSize(w, h);
      composer.setSize(w, h);
      labelRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let obstacles: Box[] = [];
    const refreshObstacles = () => {
      const origin = container.getBoundingClientRect();
      obstacles = [];
      for (const ref of avoidRef.current ?? []) {
        const r = ref.current?.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) {
          obstacles.push([
            r.left - origin.left - 12,
            r.top - origin.top - 12,
            r.right - origin.left + 12,
            r.bottom - origin.top + 12,
          ]);
        }
      }
    };

    let raf = 0;
    let frame = 0;
    let readyFired = false;
    let diveStart = -1;
    let scanStart = -1;
    let rainPhase = 0;
    let arcPhase = 0;
    let flashStart = -10;
    let nextFlash = INTRO + 5 + Math.random() * 6;
    let perfFrames = 0;
    let perfTime = 0;
    let perfChecked = false;
    const startTime = performance.now();
    let last = startTime;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - startTime) / 1000;
      shared.uTime.value = t;

      pointer.sx += (pointer.x - pointer.sx) * Math.min(dt * 2.5, 1);
      pointer.sy += (pointer.y - pointer.sy) * Math.min(dt * 2.5, 1);

      if (!reduceMotion && diveStart < 0) {
        const r = clamp01(t / 3.2);
        shared.uReveal.value = r < 1 ? easeOutCubic(r) * 58 : 200;
      }

      if (divingRef.current && diveStart < 0) {
        diveStart = t;
        diveFromPos.copy(camera.position);
        diveFromLook.copy(look);
        const dir = new THREE.Vector3(diveFromPos.x - hubTop.x, 0, diveFromPos.z - hubTop.z).normalize();
        diveToPos.copy(hubTop).addScaledVector(dir, 0.55);
        diveToPos.y += 0.3;
        diveToLook.copy(hubTop).addScaledVector(dir, -4);
        diveToLook.y -= 1.6;
        shared.uReveal.value = 200;
        scanStart = t;
      }

      let diveK = 0;
      if (diveStart >= 0) {
        diveK = clamp01((t - diveStart) / DIVE);
        const e = smootherstep(diveK);
        camera.position.lerpVectors(diveFromPos, diveToPos, e);
        look.lerpVectors(diveFromLook, diveToLook, e);
      } else if (!reduceMotion && t < INTRO) {
        camera.position.lerpVectors(introStart, orbitPose(t, orbitPos), easeInOutCubic(t / INTRO));
      } else {
        orbitPose(t, camera.position);
      }
      camera.lookAt(look);
      camera.fov = 42 + 24 * diveK * diveK * diveK;
      const offset = (w >= 1024 ? 0.13 : 0) * (1 - smootherstep(diveK));
      camera.setViewOffset(w, h, w * offset, 0, w, h);

      if (scanStart < 0 && t > INTRO - 0.5) scanStart = t;
      if (scanStart >= 0) {
        const st = t - scanStart;
        terrainUniforms.uScan.value = st * (diveStart >= 0 ? 16 : 8);
        terrainUniforms.uScanStrength.value = clamp01(1 - st / 4.5);
        if (st > 8 && diveStart < 0) scanStart = t;
      }

      const cycle = sampler.maxDm + 24;
      terrainUniforms.uSurge.value = sampler.maxDm + 6 - ((t * 3.4) % cycle);

      let flash = 0;
      if (!reduceMotion) {
        if (t > nextFlash) {
          flashStart = t;
          nextFlash = t + 9 + Math.random() * 9;
        }
        const ft = t - flashStart;
        if (ft >= 0 && ft < 1.2) {
          flash = ft < 0.05 ? ft / 0.05 : Math.exp(-(ft - 0.05) * 9);
          if (ft > 0.16) flash += 0.55 * Math.exp(-(ft - 0.16) * 12);
          flash *= 0.32;
        }
      }
      terrainUniforms.uFlash.value = flash;
      sky.copy(skyBase).lerp(skyFlash, flash * 0.9);

      rainPhase += dt * (11 + diveK * 40);
      rainUniforms.uPhase.value = rainPhase;
      rainUniforms.uLength.value = 0.45 + diveK * diveK * 5.5;
      rainUniforms.uOpacity.value = reduceMotion ? 0 : clamp01(t / 2.5);
      starUniforms.uOpacity.value = reduceMotion ? 1 : clamp01(t / 2.5);

      arcPhase += dt * (0.3 + diveK * 1.6);
      arcUniforms.uPhase.value = arcPhase;
      arcUniforms.uOpacity.value = reduceMotion ? 1 : clamp01((t - INTRO * 0.8) / 1.5);
      arcUniforms.uBoost.value = 1 + diveK * 2.5;

      const spin = 1 + diveK * 6;
      ringOuter.rotation.z += dt * 0.35 * spin;
      ringMid.rotation.z -= dt * 0.6 * spin;
      ringInner.rotation.z += dt * 1.1 * spin;
      core.rotation.x += dt * 0.4 * spin;
      core.rotation.y += dt * 0.6 * spin;

      bloom.strength = 0.8 + diveK * diveK * 1.3;

      if (frame++ % 20 === 0) refreshObstacles();
      camera.updateMatrixWorld();
      const placed: Box[] = [];
      for (const label of labels) {
        let show = false;
        if (diveStart < 0 && shared.uReveal.value > label.dist + 1) {
          projected.copy(label.pos).project(camera);
          if (!label.width) label.width = label.el.offsetWidth;
          if (projected.z < 1 && label.width > 0) {
            const sx = (projected.x * 0.5 + 0.5) * w;
            const sy = (0.5 - projected.y * 0.5) * h;
            const box: Box = [sx - label.width / 2 - 8, sy - 54, sx + label.width / 2 + 8, sy + 4];
            show =
              box[0] > 0 &&
              box[1] > 0 &&
              box[2] < w &&
              box[3] < h &&
              !obstacles.some((o) => overlaps(box, o)) &&
              !placed.some((p) => overlaps(box, p));
            if (show) placed.push(box);
          }
        }
        if (show !== label.shown) {
          label.shown = show;
          label.el.style.opacity = show ? "1" : "0";
        }
      }

      if (!perfChecked && t > INTRO + 0.5) {
        perfFrames++;
        perfTime += dt;
        if (perfFrames >= 90) {
          perfChecked = true;
          const avg = perfTime / perfFrames;
          if (avg > 1 / 32 && pixelRatio > 1) {
            pixelRatio = 1;
            renderer.setPixelRatio(1);
            composer.setPixelRatio(1);
            shared.uPixelRatio.value = 1;
          }
          if (avg > 1 / 22) bloom.enabled = false;
        }
      }

      composer.render(dt);
      labelRenderer.render(scene, camera);

      if (!readyFired) {
        readyFired = true;
        onReadyRef.current?.();
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      resizeObserver.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      bloom.dispose();
      outputPass.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
