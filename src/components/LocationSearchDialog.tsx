import { useEffect, useRef, useState } from 'react';
import { Compass, MapPin, Search, X } from 'lucide-react';
import type { WeatherLocation } from '../types/weather';
import { PRESET_LOCATIONS } from '../data/presets';
import { searchWeatherLocations } from '../services/weatherApi';

interface LocationSearchDialogProps {
  open: boolean;
  currentLocation: WeatherLocation;
  onClose: () => void;
  onSelectLocation: (loc: WeatherLocation) => void;
}

export function LocationSearchDialog({
  open,
  currentLocation,
  onClose,
  onSelectLocation,
}: LocationSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>(PRESET_LOCATIONS);
  const [searching, setSearching] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setGeoError(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(PRESET_LOCATIONS);
      setSearching(false);
      return;
    }

    setSearching(true);
    const debounce = setTimeout(async () => {
      const found = await searchWeatherLocations(trimmed);
      if (active) {
        setResults(found);
        setSearching(false);
      }
    }, 240);

    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [query, open]);

  if (!open) return null;

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      setGeoError('Browser geolocation is unavailable in this environment.');
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSelectLocation({
          id: `gps-${pos.coords.latitude.toFixed(2)}-${pos.coords.longitude.toFixed(2)}`,
          name: 'Current Position',
          region: `${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`,
          country: 'Local Sensor',
          countryCode: 'LC',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timezone: 'auto',
          icaoCode: 'KLOC',
        });
        onClose();
      },
      () => {
        setGeoError('Location permission denied or unavailable. Choose a city or search below.');
      },
      { timeout: 6000 }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 px-4 pt-16 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-white/15 bg-[#0D1422] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3.5">
          <div>
            <h2
              id="location-dialog-title"
              className="font-display text-lg font-semibold text-white"
            >
              Select Observation Station
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Search any city globally or switch between calibrated regional stations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location selector"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="station-search-input" className="sr-only">
              Search city or station name
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              id="station-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city (e.g. Zurich, Seattle, Singapore)..."
              className="h-11 w-full rounded-lg border border-white/15 bg-slate-900/90 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleUseCurrentGps}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-4 text-xs font-medium text-sky-300 hover:bg-slate-800 hover:text-sky-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            Use My Location
          </button>
        </div>

        {geoError && (
          <p className="mt-2.5 text-xs text-amber-300" role="status">
            {geoError}
          </p>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>{query.trim() ? 'Matching Locations' : 'Calibrated Stations'}</span>
            {searching && <span className="font-mono text-sky-300">Searching…</span>}
          </div>

          {results.length === 0 && !searching ? (
            <div className="rounded-lg border border-white/10 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-400">
              No stations found matching &ldquo;{query}&rdquo;. Try another city name.
            </div>
          ) : (
            <ul className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {results.map((loc) => {
                const isActive = loc.id === currentLocation.id;
                return (
                  <li key={loc.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectLocation(loc);
                        onClose();
                      }}
                      className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'border-sky-400/60 bg-sky-500/10 text-white'
                          : 'border-white/10 bg-slate-900/60 text-slate-200 hover:border-white/25 hover:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium text-white truncate">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
                          <span className="truncate">{loc.name}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 truncate">
                          <span className="truncate">
                            {loc.region ? `${loc.region}, ${loc.countryCode}` : loc.country}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{loc.icaoCode}</span>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-slate-400 shrink-0">
                        {loc.latitude.toFixed(1)}°, {loc.longitude.toFixed(1)}°
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
