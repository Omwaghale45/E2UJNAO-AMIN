"use client";

import { useMemo, useState } from "react";
import { CircleHelp, Languages, Search } from "lucide-react";
import { getHazardEvents, type HazardEvent } from "@/data/hazards";

const LOGO_LETTERS: { char: string; color: string }[] = [
  { char: "N", color: "#4285F4" },
  { char: "D", color: "#EA4335" },
  { char: "R", color: "#FBBC05" },
  { char: "F", color: "#34A853" },
];

interface HeaderProps {
  onSelectArea: (event: HazardEvent) => void;
}

export default function Header({ onSelectArea }: HeaderProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return getHazardEvents("all")
      .filter(
        (event) =>
          event.eventName.toLowerCase().includes(q) ||
          event.district.toLowerCase().includes(q) ||
          event.state.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query]);

  function handleSelect(event: HazardEvent) {
    onSelectArea(event);
    setQuery(event.eventName);
    setIsFocused(false);
  }

  return (
    <header className="flex h-[50px] w-full shrink-0 items-center gap-3 border-b-2 border-zinc-200 bg-white px-4">
      <div className="flex shrink-0 items-baseline gap-3">
        <span className="text-lg font-semibold tracking-tight">
          {LOGO_LETTERS.map(({ char, color }, i) => (
            <span key={i} style={{ color }}>
              {char}
            </span>
          ))}
        </span>
        <span className="text-base text-zinc-600">Disaster Hub</span>
      </div>

      <div className="relative flex flex-1 justify-center px-2">
        <div className="relative w-full max-w-[842px]">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder="Search area, district or state"
            className="h-9 w-full rounded-full border border-zinc-200 bg-white pl-9 pr-4 text-sm text-zinc-800 shadow-sm outline-none focus:border-blue-400"
          />

          {isFocused && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-[42px] z-20 max-h-80 overflow-auto rounded-2xl border border-zinc-200 bg-white py-2 shadow-lg">
              {suggestions.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(event)}
                    className="flex w-full flex-col px-4 py-2 text-left hover:bg-zinc-50"
                  >
                    <span className="text-sm font-medium text-zinc-800">
                      {event.eventName}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {event.district}, {event.state}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Help"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100"
        >
          <CircleHelp size={17} />
        </button>
        <button
          type="button"
          aria-label="Language"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100"
        >
          <Languages size={17} />
        </button>
      </div>
    </header>
  );
}
