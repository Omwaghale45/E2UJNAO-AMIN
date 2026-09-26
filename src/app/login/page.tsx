"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Antenna,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Radio,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

const LOGO_LETTERS: { char: string; color: string }[] = [
  { char: "N", color: "#4285F4" },
  { char: "D", color: "#EA4335" },
  { char: "R", color: "#FBBC05" },
  { char: "F", color: "#34A853" },
];

const ROLES = [
  { id: "control-room", label: "Control Room", domain: "you@ndrf.gov.in" },
  { id: "field-team", label: "Field Team", domain: "callsign@fieldops.ndrf.gov.in" },
  { id: "admin", label: "Administrator", domain: "admin@ndrf.gov.in" },
] as const;

const RISK_POINTS: { name: string; top: string; left: string; color: string }[] = [
  { name: "Rudraprayag", top: "22%", left: "28%", color: "#F59E0B" },
  { name: "Chamoli", top: "55%", left: "62%", color: "#EF4444" },
  { name: "Tehri Garhwal", top: "72%", left: "20%", color: "#10B981" },
  { name: "Pithoragarh", top: "38%", left: "78%", color: "#10B981" },
];

const TICKER_ITEMS = [
  "Flash flood watch issued — Rudraprayag catchment",
  "Sensor RP-14 back online after maintenance",
  "Landslide risk downgraded — Tehri Garhwal",
  "New monitoring station commissioned — Pithoragarh",
];

const LOADING_STAGES = [
  "Verifying credentials…",
  "Connecting to monitoring network…",
  "Syncing live sensor feed…",
  "Loading Disaster Hub…",
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<(typeof ROLES)[number]["id"]>("control-room");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const activeRole = ROLES.find((r) => r.id === role) ?? ROLES[0];

  useEffect(() => {
    if (!isSubmitting) return;
    const start = setTimeout(() => setProgress(100), 20);
    const stageTimer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, LOADING_STAGES.length - 1));
    }, 500);
    const finish = setTimeout(() => {
      try {
        sessionStorage.setItem("ndrf_session", "1");
      } catch {}
      router.push("/");
    }, 2000);
    return () => {
      clearTimeout(start);
      clearInterval(stageTimer);
      clearTimeout(finish);
    };
  }, [isSubmitting, router]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password to continue.");
      return;
    }
    setError("");
    setIsSubmitting(true);
  }

  if (isSubmitting) {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full border border-white/10" />

        <div className="relative z-10 flex flex-col items-center gap-8">
          <span className="text-3xl font-semibold tracking-tight">
            {LOGO_LETTERS.map(({ char, color }, i) => (
              <span key={i} style={{ color }}>
                {char}
              </span>
            ))}
          </span>

          <div className="relative flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-blue-400/20" />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(96,165,250,0.55), transparent 65%)",
                animation: "ndrf-radar-sweep 2.4s linear infinite",
                maskImage: "radial-gradient(circle, transparent 55%, black 56%)",
                WebkitMaskImage:
                  "radial-gradient(circle, transparent 55%, black 56%)",
              }}
            />
            <div className="absolute inset-3 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm" />
            <TriangleAlert size={28} className="relative z-10 text-blue-300" />
          </div>

          <p className="text-sm text-white/70">{LOADING_STAGES[stageIndex]}</p>

          <div className="h-1 w-64 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-blue-400 to-emerald-400 transition-[width] duration-2000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-white">
      {/* Hero / live-network panel */}
      <div className="relative hidden w-[54%] flex-col justify-between overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-white lg:flex">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
          viewBox="0 0 800 600"
          preserveAspectRatio="none"
        >
          <path
            d="M-20 100 C 150 40, 300 160, 460 90 S 780 60, 860 130"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
          <path
            d="M-20 220 C 180 160, 320 280, 480 210 S 760 180, 860 250"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
          <path
            d="M-20 340 C 160 280, 340 400, 500 330 S 780 300, 860 370"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
          <path
            d="M-20 460 C 170 400, 330 520, 490 450 S 770 420, 860 490"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
        </svg>

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(59,130,246,0.35), transparent 60%)",
              animation: "ndrf-radar-sweep 6s linear infinite",
            }}
          />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <span className="text-2xl font-semibold tracking-tight">
            {LOGO_LETTERS.map(({ char, color }, i) => (
              <span key={i} style={{ color }}>
                {char}
              </span>
            ))}
          </span>
          <div className="h-6 w-px bg-white/15" />
          <span className="text-sm font-medium text-white/60">
            National Disaster Response Force
          </span>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center gap-7 py-10">
          <div>
            <h1 className="max-w-md text-3xl font-semibold leading-tight">
              Real-time hazard intelligence for every district.
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/60">
              Flash-flood and landslide early warning, live sensor telemetry, and
              rapid alert dispatch — in one command console.
            </p>
          </div>

          <div className="relative h-44 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            {RISK_POINTS.map((point) => (
              <div
                key={point.name}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5"
                style={{ top: point.top, left: point.left }}
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ backgroundColor: point.color }}
                  />
                  <span
                    className="relative inline-flex h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: point.color }}
                  />
                </span>
                <span className="whitespace-nowrap text-[11px] text-white/70">
                  {point.name}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            <div className="flex items-center gap-2">
              <Radio size={16} className="shrink-0 text-blue-300" />
              <span className="text-xs text-white/60">1,240+ sensors online</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="shrink-0 text-blue-300" />
              <span className="text-xs text-white/60">28 states &amp; UTs</span>
            </div>
            <div className="flex items-center gap-2">
              <Antenna size={16} className="shrink-0 text-blue-300" />
              <span className="text-xs text-white/60">24/7 monitoring</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/20 py-2">
          <div
            className="flex w-max whitespace-nowrap text-xs text-white/60"
            style={{ animation: "ndrf-ticker 22s linear infinite" }}
          >
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="flex items-center gap-2 px-4">
                <TriangleAlert size={12} className="text-amber-400" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-[46%]">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-1 text-center lg:hidden">
            <span className="text-2xl font-semibold tracking-tight">
              {LOGO_LETTERS.map(({ char, color }, i) => (
                <span key={i} style={{ color }}>
                  {char}
                </span>
              ))}
            </span>
            <span className="text-sm text-zinc-500">Disaster Hub</span>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-zinc-900">Welcome back</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Sign in to access the national hazard monitoring console.
            </p>
          </div>

          <div className="mb-6 flex gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 p-1">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                  role === r.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={activeRole.domain}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-9 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300"
              />
              Keep me signed in on this device
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              className="mt-2 h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Sign in to Disaster Hub
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
            <ShieldCheck size={13} />
            Secure sign-in · Data encrypted in transit
          </div>
        </div>
      </div>
    </div>
  );
}
