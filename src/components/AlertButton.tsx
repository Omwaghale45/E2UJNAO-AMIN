"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import type { HazardEvent } from "@/data/hazards";
import { ALERT_PIN, sendAlert } from "@/lib/alert-payload";

type Status = "idle" | "sending" | "sent" | "error";

interface AlertButtonProps {
  event: HazardEvent;
}

export default function AlertButton({ event }: AlertButtonProps) {
  const [armed, setArmed] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [wrongPin, setWrongPin] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  async function activate() {
    setStatus("sending");
    try {
      await sendAlert(event, true);
      setStatus("sent");
      setArmed(true);
    } catch {
      setStatus("error");
      setArmed(true);
    }
  }

  async function deactivate() {
    setArmed(false);
    setStatus("idle");
    try {
      await sendAlert(event, false);
    } catch {
      // Deactivating is best-effort — the switch already reflects "off"
      // regardless of whether the endpoint could be reached.
    }
  }

  function handleToggleClick() {
    if (armed) {
      deactivate();
      return;
    }
    setPinPromptOpen((open) => !open);
    setWrongPin(false);
    setPin("");
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin !== ALERT_PIN) {
      setWrongPin(true);
      setPin("");
      return;
    }
    setPinPromptOpen(false);
    setPin("");
    setWrongPin(false);
    activate();
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-zinc-600">Trigger Alert</span>
        <button
          type="button"
          role="switch"
          aria-checked={armed}
          aria-label="Toggle alert"
          onClick={handleToggleClick}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            armed ? "bg-red-600" : "bg-zinc-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              armed ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {pinPromptOpen && !armed && (
        <form onSubmit={handlePinSubmit} className="mt-1.5">
          <p className="mb-1 flex items-center gap-1 text-[9px] text-zinc-500">
            <Lock size={10} />
            {wrongPin ? "Incorrect PIN — try again" : "Enter PIN to confirm"}
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setWrongPin(false);
            }}
            placeholder="PIN"
            className={`w-full rounded border px-2 py-1 text-xs outline-none ${
              wrongPin
                ? "border-red-400 focus:border-red-500"
                : "border-zinc-300 focus:border-red-400"
            }`}
          />
        </form>
      )}

      {status === "sending" && (
        <p className="mt-1.5 text-[9px] font-medium text-zinc-500">Sending…</p>
      )}
      {status === "sent" && (
        <p className="mt-1.5 text-[9px] font-medium text-emerald-600">Alert active</p>
      )}
      {status === "error" && (
        <p className="mt-1.5 text-[9px] font-medium text-amber-600">
          Endpoint not configured — alert marked active locally only
        </p>
      )}

      <a
        href="/flood-overflow.html"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 block rounded border border-zinc-300 bg-white px-2 py-1 text-center text-[9px] font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        View flood overflow report
      </a>
    </div>
  );
}
