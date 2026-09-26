"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

const LOGO_LETTERS: { char: string; color: string }[] = [
  { char: "N", color: "#4285F4" },
  { char: "D", color: "#EA4335" },
  { char: "R", color: "#FBBC05" },
  { char: "F", color: "#34A853" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isSubmitting) return;
    const start = setTimeout(() => setProgress(100), 20);
    const finish = setTimeout(() => {
      try {
        sessionStorage.setItem("ndrf_session", "1");
      } catch {}
      router.push("/");
    }, 2000);
    return () => {
      clearTimeout(start);
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
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-white">
        <span className="text-2xl font-semibold tracking-tight">
          {LOGO_LETTERS.map(({ char, color }, i) => (
            <span key={i} style={{ color }}>
              {char}
            </span>
          ))}
        </span>
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-4 border-zinc-100" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
          <p className="text-sm text-zinc-500">Signing you in…</p>
        </div>
        <div className="h-1 w-56 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-[2000ms] ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-1 text-center">
          <span className="text-2xl font-semibold tracking-tight">
            {LOGO_LETTERS.map(({ char, color }, i) => (
              <span key={i} style={{ color }}>
                {char}
              </span>
            ))}
          </span>
          <span className="text-sm text-zinc-500">Disaster Hub</span>
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
                placeholder="you@ndrf.gov.in"
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
            Keep me signed in
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            className="mt-2 h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
