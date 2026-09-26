"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Radio,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { deviceStations, flashFloodEvents, landslideEvents } from "@/data/hazards";
import styles from "./login.module.css";

const LoginScene = dynamic(() => import("./LoginScene"), { ssr: false });

const LOGO_LETTERS = [
  { char: "N", color: "#4285F4" },
  { char: "D", color: "#EA4335" },
  { char: "R", color: "#FBBC05" },
  { char: "F", color: "#34A853" },
];

const ROLES = [
  { id: "control-room", label: "Control Room", placeholder: "name@ndrf.gov.in" },
  { id: "field-team", label: "Field Team", placeholder: "Service ID or email" },
  { id: "admin", label: "Admin", placeholder: "admin@ndrf.gov.in" },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

const HAZARD_EVENTS = [
  ...flashFloodEvents.map((event) => ({ event, kind: "flood" as const })),
  ...landslideEvents.map((event) => ({ event, kind: "landslide" as const })),
];

const STATS = [
  { value: HAZARD_EVENTS.length, label: "Hazard events mapped" },
  { value: deviceStations.length, label: "Monitoring stations" },
  { value: new Set(HAZARD_EVENTS.map(({ event }) => event.state)).size, label: "States covered" },
];

const ARCHIVE = HAZARD_EVENTS.filter(({ event }) => event.date)
  .sort((a, b) => (b.event.date ?? "").localeCompare(a.event.date ?? ""))
  .slice(0, 16);

const LEGEND = [
  { label: "Flash flood", color: "#4285F4" },
  { label: "Landslide", color: "#FBBC05" },
  { label: "Critical risk", color: "#EA4335" },
  { label: "Monitoring station", color: "#34A853" },
];

const STAGES = [
  "Verifying credentials",
  "Establishing secure channel",
  `Syncing ${deviceStations.length} monitoring stations`,
  "Loading district risk grids",
];

const STAGE_MS = 425;
const REDIRECT_MS = 2000;

const HUD_CORNERS = [
  "left-5 top-5 border-l border-t",
  "right-5 top-5 border-r border-t",
  "bottom-14 left-5 border-b border-l",
  "bottom-14 right-5 border-b border-r",
];

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const INPUT_CLASS = `${styles.input} h-12 w-full rounded-xl border border-white/10 bg-white/4 pl-11 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-sky-400/50 focus:bg-white/7 focus:ring-4 focus:ring-sky-400/10 disabled:opacity-60`;

function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      {LOGO_LETTERS.map(({ char, color }) => (
        <span key={char} style={{ color }}>
          {char}
        </span>
      ))}
    </span>
  );
}

function IstClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] backdrop-blur-md">
      <span className="tabular-nums text-white/90">{now ? TIME_FORMAT.format(now) : "--:--:--"}</span>
      <span className="text-white/40">IST{now ? ` · ${DATE_FORMAT.format(now)}` : ""}</span>
    </div>
  );
}

function CountUp({ value, delay }: { value: number; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(Math.max((now - start) / 1600, 0), 1);
      el.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);

  return <span ref={ref}>0</span>;
}

function AuthOverlay({
  stage,
  percentRef,
}: {
  stage: number;
  percentRef: RefObject<HTMLSpanElement | null>;
}) {
  const granted = stage >= STAGES.length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-30 flex items-center justify-center px-4"
    >
      <div className={`${styles.overlayIn} flex w-full max-w-[340px] flex-col items-center`}>
        <div className="relative flex h-36 w-36 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-sky-400/25" />
          <div className="absolute inset-5 rounded-full border border-sky-400/15" />
          <div className="absolute inset-10 rounded-full border border-sky-400/10" />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, rgba(96,165,250,0.55), transparent 80deg)",
              animation: "ndrf-radar-sweep 1.4s linear infinite",
            }}
          />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-slate-950/80 shadow-[0_0_40px_rgba(96,165,250,0.35)] backdrop-blur-xl">
            {granted ? (
              <Check size={28} strokeWidth={2.5} className="text-emerald-400" />
            ) : (
              <Logo className="text-lg font-bold tracking-tight" />
            )}
          </div>
        </div>

        <div className="mt-8 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <ul className="space-y-3">
            {STAGES.map((label, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                    done ? "text-white/85" : active ? "text-white" : "text-white/30"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                      done
                        ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                        : active
                          ? "border-sky-400/60 text-sky-300"
                          : "border-white/10"
                    }`}
                  >
                    {done ? (
                      <Check size={12} strokeWidth={3} />
                    ) : active ? (
                      <LoaderCircle size={12} className="animate-spin" />
                    ) : null}
                  </span>
                  {label}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`${styles.progress} h-full rounded-full`}
                style={{ background: "linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853)" }}
              />
            </div>
            <span
              ref={percentRef}
              className="w-9 text-right font-mono text-[11px] tabular-nums text-white/60"
            >
              0%
            </span>
          </div>

          <p
            className={`mt-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300 transition-opacity duration-300 ${
              granted ? "opacity-100" : "opacity-0"
            }`}
          >
            Access granted
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<RoleId>("control-room");
  const [identifier, setIdentifier] = useState("name@ndrf.gov.in");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);

  const roleIndex = ROLES.findIndex((r) => r.id === role);
  const activeRole = ROLES[roleIndex];

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  useEffect(() => {
    if (!submitting) return;
    const stageTimers = STAGES.map((_, i) =>
      setTimeout(() => setStage(i + 1), (i + 1) * STAGE_MS),
    );
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min((performance.now() - start) / (STAGE_MS * STAGES.length), 1);
      if (percentRef.current) percentRef.current.textContent = `${Math.round(p * 100)}%`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const finish = setTimeout(() => {
      try {
        sessionStorage.setItem("ndrf_session", "1");
      } catch {}
      router.push("/");
    }, REDIRECT_MS);
    return () => {
      stageTimers.forEach(clearTimeout);
      clearTimeout(finish);
      cancelAnimationFrame(raf);
    };
  }, [submitting, router]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!identifier.trim() || !password) {
      setError("Enter your email or service ID and password.");
      return;
    }
    setError("");
    setStage(0);
    setSubmitting(true);
  }

  function handlePasswordKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  function handleCardMove(e: ReactPointerEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card || e.pointerType !== "mouse") return;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    card.style.setProperty("--rx", `${((0.5 - py) * 5).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${((px - 0.5) * 7).toFixed(2)}deg`);
    card.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
    card.style.setProperty("--glare", "1");
  }

  function handleCardLeave() {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--glare", "0");
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020617] font-sans text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_25%,rgba(37,99,235,0.28),transparent_55%),radial-gradient(ellipse_at_75%_85%,rgba(16,185,129,0.12),transparent_50%)]"
      />
      <div aria-hidden className={`${styles.contours} absolute inset-0`} />

      <LoginScene
        diving={submitting}
        onReady={() => setSceneReady(true)}
        avoid={[cardRef, brandRef, statusRef, heroRef, archiveRef]}
        className={`absolute inset-0 transition-opacity duration-1000 ${
          sceneReady ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(2,6,23,0.8)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] bg-linear-to-l from-slate-950/80 via-slate-950/30 to-transparent lg:block"
      />
      <div aria-hidden className={`${styles.grain} pointer-events-none absolute inset-0`} />

      {HUD_CORNERS.map((corner) => (
        <span
          key={corner}
          aria-hidden
          className={`pointer-events-none absolute z-10 hidden h-5 w-5 border-white/25 transition-opacity duration-500 lg:block ${corner} ${
            submitting ? "opacity-0" : ""
          }`}
        />
      ))}

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 lg:px-12 lg:py-7">
        <div ref={brandRef} className={`${styles.fadeUp} flex items-center gap-3`}>
          <Logo className="text-2xl font-bold tracking-tight" />
          <span className="h-7 w-px bg-white/15" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white/90">Disaster Hub</p>
            <p className="text-[11px] text-white/45">National Disaster Response Force</p>
          </div>
        </div>
        <div
          ref={statusRef}
          className={`${styles.fadeUp} hidden items-center gap-2.5 md:flex`}
          style={{ animationDelay: "0.15s" }}
        >
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Digital twin · Uttarakhand
          </div>
          <IstClock />
        </div>
      </header>

      <section
        ref={heroRef}
        className="absolute bottom-24 left-12 z-10 hidden w-[min(560px,40vw)] lg:block"
      >
        <div
          className={`transition-all duration-500 ease-out ${
            submitting ? "translate-y-4 opacity-0 blur-sm" : ""
          }`}
        >
          <div className={styles.fadeUp} style={{ animationDelay: "0.2s" }}>
            <p className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">
              <span className="h-px w-8 bg-sky-300/60" />
              Flash-flood &amp; landslide early warning
            </p>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
              See the flood
              <br />
              <span className={styles.gradientText}>before it arrives.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60">
              Live sensor telemetry, district risk grids and one-tap alert dispatch — unified in
              a single command console.
            </p>
          </div>

          <div
            className={`${styles.fadeUp} mt-7 grid grid-cols-3 gap-3`}
            style={{ animationDelay: "0.45s" }}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3 backdrop-blur-md"
              >
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  <CountUp value={stat.value} delay={700 + i * 150} />
                </div>
                <div className="mt-0.5 text-[11px] text-white/50">{stat.label}</div>
              </div>
            ))}
          </div>

          <div
            className={`${styles.fadeUp} mt-5 flex flex-wrap items-center gap-x-4 gap-y-2`}
            style={{ animationDelay: "0.6s" }}
          >
            {LEGEND.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-white/55">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color, boxShadow: `0 0 10px ${color}` }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div
        ref={archiveRef}
        className={`absolute inset-x-0 bottom-0 z-10 hidden border-t border-white/10 bg-slate-950/60 backdrop-blur-md transition-opacity duration-500 lg:flex ${
          submitting ? "opacity-0" : ""
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 border-r border-white/10 px-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
          <Radio size={12} className="text-red-400" />
          Event archive
        </div>
        <div className={`${styles.tickerMask} relative flex-1 overflow-hidden py-2.5`}>
          <div className="flex w-max" style={{ animation: "ndrf-ticker 80s linear infinite" }}>
            {[...ARCHIVE, ...ARCHIVE].map(({ event, kind }, i) => (
              <span
                key={`${event.id}-${i}`}
                className="flex items-center gap-2 px-5 text-[11px] text-white/50"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: kind === "flood" ? "#4285F4" : "#FBBC05" }}
                />
                <span className="text-white/80">{event.eventName}</span>
                <span>
                  {event.district}, {event.state}
                </span>
                <span className="font-mono text-white/35">{event.date?.slice(0, 4)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-20 overflow-y-auto lg:pointer-events-none">
        <div className="flex min-h-full items-center justify-center px-4 py-24 lg:justify-end lg:py-10 lg:pr-[7vw]">
          <div
            className={`w-full max-w-[410px] transition-all duration-500 ease-out ${
              submitting
                ? "pointer-events-none translate-y-2 scale-95 opacity-0 blur-sm"
                : "pointer-events-auto"
            }`}
          >
            <div className={styles.fadeUp} style={{ animationDelay: "0.3s" }}>
              <div
                ref={cardRef}
                onPointerMove={handleCardMove}
                onPointerLeave={handleCardLeave}
                className={`${styles.card} relative rounded-[28px]`}
              >
                <div className={styles.beam} />
                <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60 p-7 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:p-8">
                  <div className={styles.glare} />
                  <div className="relative">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                      <ShieldCheck size={12} />
                      Restricted access
                    </span>

                    <h2 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight">
                      Welcome back
                    </h2>
                    <p className="mt-1.5 text-sm text-white/55">
                      Sign in to the Disaster Hub command console.
                    </p>

                    <div
                      role="radiogroup"
                      aria-label="Sign in as"
                      className="relative mt-6 grid grid-cols-3 rounded-full border border-white/10 bg-white/4 p-1"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-white/10 ring-1 ring-white/15 transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(${roleIndex * 100}%)` }}
                      />
                      {ROLES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={role === r.id}
                          onClick={() => setRole(r.id)}
                          disabled={submitting}
                          className={`relative rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                            role === r.id ? "text-white" : "text-white/45 hover:text-white/75"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                      <div>
                        <label
                          htmlFor="login-identifier"
                          className="mb-1.5 block text-xs font-medium text-white/60"
                        >
                          Email or service ID
                        </label>
                        <div className="group relative">
                          <UserRound
                            size={16}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-sky-300"
                          />
                          <input
                            id="login-identifier"
                            type="text"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder={activeRole.placeholder}
                            disabled={submitting}
                            className={`${INPUT_CLASS} pr-4`}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label
                            htmlFor="login-password"
                            className="text-xs font-medium text-white/60"
                          >
                            Password
                          </label>
                          {capsLock && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-300">
                              <TriangleAlert size={12} />
                              Caps Lock is on
                            </span>
                          )}
                        </div>
                        <div className="group relative">
                          <KeyRound
                            size={16}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-sky-300"
                          />
                          <input
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handlePasswordKey}
                            onKeyUp={handlePasswordKey}
                            onBlur={() => setCapsLock(false)}
                            placeholder="••••••••••"
                            disabled={submitting}
                            className={`${INPUT_CLASS} pr-12`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <label
                        htmlFor="login-remember"
                        className="flex cursor-pointer select-none items-center gap-2.5 text-xs text-white/55"
                      >
                        <input
                          id="login-remember"
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="flex h-4 w-4 items-center justify-center rounded-[5px] border border-white/20 bg-white/5 transition-colors peer-checked:border-[#4285F4] peer-checked:bg-[#4285F4] peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400/40">
                          <Check
                            size={11}
                            strokeWidth={3}
                            className={remember ? "text-white" : "text-transparent"}
                          />
                        </span>
                        Keep me signed in on this device
                      </label>

                      {error && (
                        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-300">
                          <TriangleAlert size={13} />
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className={`${styles.shimmer} group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-linear-to-r from-[#4285F4] to-[#2563eb] text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:shadow-blue-500/50 active:scale-[0.985] disabled:opacity-80`}
                      >
                        {submitting ? (
                          <>
                            <LoaderCircle size={16} className="animate-spin" />
                            Authenticating…
                          </>
                        ) : (
                          <>
                            Sign in
                            <ArrowRight
                              size={16}
                              className="transition-transform group-hover:translate-x-0.5"
                            />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 flex items-center gap-3 text-[11px] text-white/35">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck size={12} />
                        Encrypted in transit · Authorized personnel only
                      </span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {submitting && <AuthOverlay stage={stage} percentRef={percentRef} />}

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-50 bg-white transition-opacity duration-300 ${
          stage >= STAGES.length ? "opacity-100" : "opacity-0"
        }`}
      />
    </main>
  );
}
