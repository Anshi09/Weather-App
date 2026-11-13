import { MapPin } from 'lucide-react';

interface TopBarProps {
  onOpenLocationSearch: () => void;
}

export function TopBar({ onOpenLocationSearch }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080C14]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
        >
          Stratum
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
        >
          <a
            href="#overview"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
          >
            Overview
          </a>
          <a
            href="#alerts"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
          >
            Alerts
          </a>
          <a
            href="#hourly"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
          >
            Hourly
          </a>
          <a
            href="#sky-sensor"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
          >
            Sky Sensor
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenLocationSearch}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            Change Location
          </button>
        </div>
      </div>
    </header>
  );
}
