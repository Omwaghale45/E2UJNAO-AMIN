"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SubmitEvent as ReactSubmitEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
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

const INPUT_CLASS = `${styles.input} h-11 w-full rounded-md border border-slate-700 bg-[#060b16] px-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 hover:border-slate-600 focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] disabled:opacity-60`;

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

function BrandStrip() {
  return (
    <div aria-hidden className="flex h-0.75">
      {LOGO_LETTERS.map(({ char, color }) => (
        <span key={char} className="flex-1" style={{ background: color }} />
      ))}
    </div>
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
    <span>
      <span className="font-mono tabular-nums text-slate-300">
        {now ? TIME_FORMAT.format(now) : "--:--:--"}
      </span>
      <span className="text-slate-500"> IST{now ? ` · ${DATE_FORMAT.format(now)}` : ""}</span>
    </span>
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
      const p = Math.min(Math.max((now - start) / 1400, 0), 1);
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
  identifier,
  percentRef,
}: {
  stage: number;
  identifier: string;
  percentRef: RefObject<HTMLSpanElement | null>;
}) {
  const granted = stage >= STAGES.length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-30 flex items-center justify-center px-4"
    >
      <div
        className={`${styles.overlayIn} w-full max-w-85 overflow-hidden rounded-lg border border-slate-800 bg-[#0b1220] shadow-2xl shadow-black/50`}
      >
        <BrandStrip />
        <div className="p-6">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                granted ? "bg-emerald-500/15 text-emerald-400" : "bg-[#1a73e8]/15 text-[#8ab4f8]"
              }`}
            >
              {granted ? (
                <Check size={18} strokeWidth={2.5} />
              ) : (
                <LoaderCircle size={18} className="animate-spin" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100">
                {granted ? "Access granted" : "Signing you in"}
              </p>
              <p className="truncate text-xs text-slate-400">{identifier}</p>
            </div>
          </div>

          <ul className="mt-5 space-y-2.5">
            {STAGES.map((label, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2.5 text-sm ${
                    done ? "text-slate-300" : active ? "text-slate-100" : "text-slate-600"
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {done ? (
                      <Check size={14} strokeWidth={2.5} className="text-emerald-400" />
                    ) : active ? (
                      <LoaderCircle size={14} className="animate-spin text-[#8ab4f8]" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                    )}
                  </span>
                  {label}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-800">
            <div className={`${styles.progress} h-full bg-[#4285F4]`} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>
              Step {Math.min(stage + 1, STAGES.length)} of {STAGES.length}
            </span>
            <span ref={percentRef} className="tabular-nums">
              0%
            </span>
          </div>
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

  const activeRole = ROLES.find((r) => r.id === role) ?? ROLES[0];

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

  function handleSubmit(e: ReactSubmitEvent<HTMLFormElement>) {
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

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020617] font-sans text-slate-100">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_25%,rgba(37,99,235,0.22),transparent_55%)]"
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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(2,6,23,0.75)_100%)]"
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_75%_65%_at_12%_88%,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.72)_45%,transparent_80%)] transition-opacity duration-500 lg:block ${
          submitting ? "opacity-0" : ""
        }`}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-linear-to-l from-[#020617]/85 via-[#020617]/35 to-transparent lg:block"
      />
      <div aria-hidden className={`${styles.grain} pointer-events-none absolute inset-0`} />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 lg:px-12 lg:py-7">
        <div ref={brandRef} className={`${styles.fadeUp} flex items-center gap-3`}>
          <Logo className="text-2xl font-bold tracking-tight" />
          <span className="h-7 w-px bg-white/15" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-100">Disaster Hub</p>
            <p className="text-xs text-slate-400">National Disaster Response Force</p>
          </div>
        </div>
        <div
          ref={statusRef}
          className={`${styles.fadeUp} hidden items-center gap-4 text-xs text-slate-400 md:flex`}
          style={{ animationDelay: "0.1s" }}
        >
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Digital twin · Uttarakhand
          </span>
          <span className="h-3.5 w-px bg-white/15" />
          <IstClock />
        </div>
      </header>

      <section
        ref={heroRef}
        className="absolute bottom-24 left-12 z-10 hidden w-[min(540px,40vw)] lg:block"
      >
        <div
          className={`transition-all duration-500 ease-out ${
            submitting ? "translate-y-3 opacity-0" : ""
          }`}
        >
          <div className={styles.fadeUp} style={{ animationDelay: "0.15s" }}>
            <p className="text-sm font-medium text-[#8ab4f8]">
              Flash-flood &amp; landslide early warning
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-white [text-shadow:0_2px_24px_rgba(2,6,23,0.9)] xl:text-[56px]">
              See the flood
              <br />
              before it arrives.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-300 [text-shadow:0_1px_12px_rgba(2,6,23,0.9)]">
              Live sensor telemetry, district risk grids and one-tap alert dispatch, unified in a
              single command console.
            </p>
          </div>

          <div
            className={`${styles.fadeUp} mt-8 flex divide-x divide-white/10`}
            style={{ animationDelay: "0.3s" }}
          >
            {STATS.map((stat, i) => (
              <div key={stat.label} className={i === 0 ? "pr-6" : "px-6"}>
                <div className="text-2xl font-semibold tabular-nums text-white">
                  <CountUp value={stat.value} delay={600 + i * 150} />
                </div>
                <div className="mt-0.5 text-xs text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>

          <div
            className={`${styles.fadeUp} mt-6 flex flex-wrap items-center gap-x-5 gap-y-2`}
            style={{ animationDelay: "0.4s" }}
          >
            {LEGEND.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-xs" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div
        ref={archiveRef}
        className={`absolute inset-x-0 bottom-0 z-10 hidden border-t border-white/10 bg-[#020617]/85 transition-opacity duration-500 lg:flex ${
          submitting ? "opacity-0" : ""
        }`}
      >
        <div className="flex shrink-0 items-center border-r border-white/10 px-5 text-xs font-medium text-slate-300">
          Event archive
        </div>
        <div className={`${styles.tickerMask} relative flex-1 overflow-hidden py-2.5`}>
          <div className="flex w-max" style={{ animation: "ndrf-ticker 80s linear infinite" }}>
            {[...ARCHIVE, ...ARCHIVE].map(({ event, kind }, i) => (
              <span
                key={`${event.id}-${i}`}
                className="flex items-center gap-2 px-5 text-xs text-slate-500"
              >
                <span
                  className="h-1.5 w-1.5 rounded-[1px]"
                  style={{ background: kind === "flood" ? "#4285F4" : "#FBBC05" }}
                />
                <span className="text-slate-300">{event.eventName}</span>
                <span>
                  {event.district}, {event.state}
                </span>
                <span className="tabular-nums">{event.date?.slice(0, 4)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-20 overflow-y-auto lg:pointer-events-none">
        <div className="flex min-h-full items-center justify-center px-4 py-24 lg:justify-end lg:py-10 lg:pr-[7vw]">
          <div
            className={`w-full max-w-100 transition-all duration-300 ease-out ${
              submitting
                ? "pointer-events-none translate-y-1 scale-[0.98] opacity-0"
                : "pointer-events-auto"
            }`}
          >
            <div className={styles.fadeUp} style={{ animationDelay: "0.25s" }}>
              <div
                ref={cardRef}
                className="overflow-hidden rounded-lg border border-slate-800 bg-[#0b1220] shadow-2xl shadow-black/40"
              >
                <BrandStrip />
                <div className="p-6 sm:p-8">
                  <h2 className="text-xl font-semibold text-slate-100">Sign in</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Use your NDRF-issued credentials to continue.
                  </p>

                  <div
                    role="radiogroup"
                    aria-label="Sign in as"
                    className="mt-6 flex border-b border-slate-800"
                  >
                    {ROLES.map((r) => {
                      const active = role === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setRole(r.id)}
                          disabled={submitting}
                          className={`-mb-px flex-1 whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm transition-colors ${
                            active
                              ? "border-[#4285F4] font-medium text-slate-100"
                              : "border-transparent text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <div>
                      <label
                        htmlFor="login-identifier"
                        className="mb-1.5 block text-sm font-medium text-slate-300"
                      >
                        Email or service ID
                      </label>
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
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label
                          htmlFor="login-password"
                          className="text-sm font-medium text-slate-300"
                        >
                          Password
                        </label>
                        {capsLock && (
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <TriangleAlert size={12} />
                            Caps Lock is on
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={handlePasswordKey}
                          onKeyUp={handlePasswordKey}
                          onBlur={() => setCapsLock(false)}
                          disabled={submitting}
                          className={`${INPUT_CLASS} pr-16`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-pressed={showPassword}
                          className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    <label
                      htmlFor="login-remember"
                      className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-400"
                    >
                      <input
                        id="login-remember"
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-4 w-4 accent-[#1a73e8] scheme-dark"
                      />
                      Keep me signed in on this device
                    </label>

                    {error && (
                      <p role="alert" className="flex items-center gap-1.5 text-sm text-red-400">
                        <TriangleAlert size={14} />
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1a73e8] text-sm font-medium text-white transition-colors hover:bg-[#1765cc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ab4f8] active:bg-[#185abc] disabled:opacity-70"
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle size={16} className="animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        "Sign in"
                      )}
                    </button>
                  </form>

                  <p className="mt-6 border-t border-slate-800 pt-5 text-xs leading-relaxed text-slate-500">
                    Authorized personnel only. Trouble signing in? Contact your control room
                    administrator.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {submitting && (
        <AuthOverlay stage={stage} identifier={identifier.trim()} percentRef={percentRef} />
      )}

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-50 bg-white transition-opacity duration-300 ${
          stage >= STAGES.length ? "opacity-100" : "opacity-0"
        }`}
      />
    </main>
  );
}
