import { Droplets, Eye, Gauge, RefreshCw, Sun, Wind } from 'lucide-react';
import type {
  CurrentObservation,
  TemperatureUnit,
  WeatherLocation,
} from '../types/weather';
import { PRESET_LOCATIONS } from '../data/presets';
import {
  decodeWmoCondition,
  formatCompassDirection,
  formatTemperature,
  kmhToMph,
  metersToMiles,
} from '../utils/atmosphere';
import { WeatherConditionIcon } from './WeatherConditionIcon';

interface CurrentHeroSectionProps {
  location: WeatherLocation;
  current: CurrentObservation;
  unit: TemperatureUnit;
  onChangeUnit: (unit: TemperatureUnit) => void;
  onSelectPreset: (loc: WeatherLocation) => void;
  onRefresh: () => void;
  loading: boolean;
  sourceMode: 'live' | 'cached';
}

export function CurrentHeroSection({
  location,
  current,
  unit,
  onChangeUnit,
  onSelectPreset,
  onRefresh,
  loading,
  sourceMode,
}: CurrentHeroSectionProps) {
  const condition = decodeWmoCondition(current.weatherCode, current.isDay);
  const windValue =
    unit === 'F'
      ? `${Math.round(kmhToMph(current.windSpeedKmh))} mph`
      : `${Math.round(current.windSpeedKmh)} km/h`;
  const gustValue =
    unit === 'F'
      ? `${Math.round(kmhToMph(current.windGustsKmh))} mph`
      : `${Math.round(current.windGustsKmh)} km/h`;
  const visValue =
    unit === 'F'
      ? `${metersToMiles(current.visibilityM).toFixed(1)} mi`
      : `${(current.visibilityM / 1000).toFixed(1)} km`;

  return (
    <section
      id="overview"
      aria-labelledby="location-heading"
      className="scroll-mt-20 rounded-xl border border-white/10 bg-[#0B121F]/88 p-5 sm:p-6"
    >
      {/* Top Toolbar: Quick Station Switchers + Unit Toggle + Refresh */}
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Quick station presets"
        >
          {PRESET_LOCATIONS.map((preset) => {
            const active = preset.id === location.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 font-semibold'
                    : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-auto">
          <div
            className="inline-flex items-center rounded-lg border border-white/10 bg-slate-950/70 p-0.5"
            role="group"
            aria-label="Temperature unit"
          >
            <button
              type="button"
              aria-pressed={unit === 'C'}
              onClick={() => onChangeUnit('C')}
              className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                unit === 'C'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              °C
            </button>
            <button
              type="button"
              aria-pressed={unit === 'F'}
              onClick={() => onChangeUnit('F')}
              className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                unit === 'F'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              °F
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh weather observation"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {loading ? 'Updating…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Main Focal Weather Readout */}
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="font-mono text-sky-300">{location.icaoCode}</span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span>
              {location.region ? `${location.region}, ${location.country}` : location.country}
            </span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-400">
              {location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°
            </span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-400">
              {sourceMode === 'live' ? 'Live Meteorological Feed' : 'Calibrated Station Fallback'}
            </span>
          </div>

          <h1
            id="location-heading"
            className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl text-balance"
          >
            {location.name}
          </h1>

          <div className="mt-2 flex items-center gap-3 text-base text-slate-200">
            <WeatherConditionIcon
              code={current.weatherCode}
              isDay={current.isDay}
              className="h-6 w-6 shrink-0"
            />
            <span className="font-medium text-white">{condition.label}</span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">
              Feels like{' '}
              <span className="font-mono text-white">
                {formatTemperature(current.apparentTemperatureC, unit)}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-baseline gap-4">
          <div
            data-testid="hero-temperature"
            className="font-mono text-6xl font-semibold tracking-tighter text-white sm:text-7xl"
          >
            {formatTemperature(current.temperatureC, unit)}
          </div>
          <div className="text-xs font-mono text-slate-300 space-y-1">
            <div>CLOUD {Math.round(current.cloudCoverPct)}%</div>
            <div>DEW PT {formatTemperature(current.dewPointC, unit)}</div>
          </div>
        </div>
      </div>

      {/* 4-Column Surface Telemetry Strip */}
      <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 lg:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3.5">
          <dt className="flex items-center gap-1.5 text-xs text-slate-400">
            <Wind className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>Wind &amp; Gusts</span>
          </dt>
          <dd className="mt-1.5 font-mono text-lg font-semibold text-white">
            {formatCompassDirection(current.windDirectionDeg)} {windValue}
          </dd>
          <dd className="mt-0.5 font-mono text-xs text-slate-400">Gusts to {gustValue}</dd>
        </div>

        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3.5">
          <dt className="flex items-center gap-1.5 text-xs text-slate-400">
            <Droplets className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>Humidity &amp; Precip</span>
          </dt>
          <dd className="mt-1.5 font-mono text-lg font-semibold text-white">
            {Math.round(current.humidityPct)}%
          </dd>
          <dd className="mt-0.5 font-mono text-xs text-slate-400">
            Rate {current.precipitationMm.toFixed(1)} mm/h
          </dd>
        </div>

        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3.5">
          <dt className="flex items-center gap-1.5 text-xs text-slate-400">
            <Gauge className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>Sea-Level Pressure</span>
          </dt>
          <dd className="mt-1.5 font-mono text-lg font-semibold text-white">
            {Math.round(current.pressureMslHpa)} hPa
          </dd>
          <dd className="mt-0.5 font-mono text-xs text-slate-400">
            Surface {Math.round(current.surfacePressureHpa)} hPa
          </dd>
        </div>

        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3.5">
          <dt className="flex items-center gap-1.5 text-xs text-slate-400">
            <Eye className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>Visibility &amp; UV</span>
          </dt>
          <dd className="mt-1.5 font-mono text-lg font-semibold text-white">{visValue}</dd>
          <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs text-slate-400">
            <Sun className="h-3 w-3 text-amber-300" aria-hidden="true" />
            <span>UV {current.uvIndex.toFixed(1)} · {Math.round(current.directRadiationWm2)} W/m²</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
