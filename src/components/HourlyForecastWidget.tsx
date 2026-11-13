import { Droplets, Eye, Wind } from 'lucide-react';
import type { HourlyForecastPoint, TemperatureUnit } from '../types/weather';
import {
  celsiusToFahrenheit,
  decodeWmoCondition,
  formatCompassDirection,
  formatTemperature,
  kmhToMph,
} from '../utils/atmosphere';
import { WeatherConditionIcon } from './WeatherConditionIcon';

interface HourlyForecastWidgetProps {
  hourly: HourlyForecastPoint[];
  selectedIndex: number;
  onSelectHour: (index: number) => void;
  unit: TemperatureUnit;
  onInspectInSky: (index: number) => void;
}

export function HourlyForecastWidget({
  hourly,
  selectedIndex,
  onSelectHour,
  unit,
  onInspectInSky,
}: HourlyForecastWidgetProps) {
  const slice = hourly.slice(0, 24);
  if (slice.length === 0) return null;

  const active = slice[selectedIndex] ?? slice[0];
  const temps = slice.map((h) =>
    unit === 'F' ? celsiusToFahrenheit(h.temperatureC) : h.temperatureC
  );
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const spanT = Math.max(1, maxT - minT);

  // Build SVG sparkline polyline coordinates across 24 points
  const svgW = 960;
  const svgH = 72;
  const padX = 20;
  const padY = 14;
  const points = slice.map((h, i) => {
    const val = unit === 'F' ? celsiusToFahrenheit(h.temperatureC) : h.temperatureC;
    const x = padX + (i / Math.max(1, slice.length - 1)) * (svgW - padX * 2);
    const y = svgH - padY - ((val - minT) / spanT) * (svgH - padY * 2);
    return { x, y, precip: h.precipitationProbPct };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${svgH} L ${points[0].x.toFixed(1)} ${svgH} Z`;

  const selectedPoint = points[selectedIndex] ?? points[0];
  const decoded = decodeWmoCondition(active.weatherCode, active.isDay);
  const windDisplay =
    unit === 'F'
      ? `${Math.round(kmhToMph(active.windSpeedKmh))} mph`
      : `${Math.round(active.windSpeedKmh)} km/h`;

  return (
    <section
      id="hourly"
      aria-labelledby="hourly-heading"
      className="scroll-mt-20 rounded-xl border border-white/10 bg-[#0C1320]/90 p-5"
    >
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="hourly-heading" className="font-display text-lg font-semibold text-white">
            Quick Hourly Forecast
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            24-hour progression · Select any hour to inspect conditions or project it into the Sky Sensor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-white font-semibold">{active.hourLabel}</span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="text-sky-300">{formatTemperature(active.temperatureC, unit)}</span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span>{decoded.label}</span>
          </div>
          <button
            type="button"
            onClick={() => onInspectInSky(selectedIndex)}
            className="inline-flex h-8 items-center rounded-md border border-sky-400/40 bg-sky-500/15 px-3 text-xs font-medium text-sky-200 hover:bg-sky-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Project Hour in Sky
          </button>
        </div>
      </div>

      {/* Temperature Trend & Precip Probability Sparkline */}
      <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>24H THERMAL CURVE ({unit === 'F' ? '°F' : '°C'})</span>
          <span>
            RANGE {minT.toFixed(0)}° — {maxT.toFixed(0)}°
          </span>
        </div>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="h-16 w-full overflow-visible"
          role="img"
          aria-label="24 hour temperature trend sparkline"
        >
          <defs>
            <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.28)" />
              <stop offset="100%" stopColor="rgba(56, 189, 248, 0.01)" />
            </linearGradient>
          </defs>
          {points.map((p, idx) => {
            const barH = (p.precip / 100) * 26;
            return (
              <rect
                key={`pbar-${idx}`}
                x={p.x - 4}
                y={svgH - barH}
                width={8}
                height={barH}
                rx={1}
                fill="rgba(56, 189, 248, 0.25)"
              />
            );
          })}
          <path d={areaPath} fill="url(#tempAreaGrad)" />
          <path d={linePath} fill="none" stroke="#38BDF8" strokeWidth="2.2" />
          <circle
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r={4.5}
            fill="#F8FAFC"
            stroke="#38BDF8"
            strokeWidth={2.5}
          />
        </svg>
      </div>

      {/* Horizontal Hourly Cards */}
      <div
        className="stratum-scroll mt-3.5 flex gap-2.5 overflow-x-auto pb-2"
        role="listbox"
        aria-label="Hourly forecast hours"
      >
        {slice.map((h, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={h.time}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectHour(idx)}
              className={`flex min-w-[84px] flex-col items-center justify-between gap-2 rounded-lg border px-2.5 py-3 text-center transition-colors shrink-0 cursor-pointer ${
                isSelected
                  ? 'border-sky-400 bg-sky-500/15 text-white'
                  : 'border-white/10 bg-slate-900/55 text-slate-300 hover:border-white/25 hover:bg-slate-900/80'
              }`}
            >
              <span className="font-mono text-xs font-medium text-slate-300">
                {h.hourLabel}
              </span>
              <WeatherConditionIcon code={h.weatherCode} isDay={h.isDay} className="h-5 w-5" />
              <span className="font-mono text-base font-semibold text-white">
                {formatTemperature(h.temperatureC, unit)}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-300">
                <Droplets className="h-3 w-3" aria-hidden="true" />
                {Math.round(h.precipitationProbPct)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Hour Micro-Telemetry Strip */}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-xs sm:grid-cols-4">
        <div className="flex items-center gap-2 text-slate-300">
          <Wind className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
          <span className="text-slate-400">Wind:</span>
          <span className="font-mono text-white">
            {formatCompassDirection(active.windDirectionDeg)} {windDisplay}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <Droplets className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
          <span className="text-slate-400">Precip:</span>
          <span className="font-mono text-white">
            {active.precipitationProbPct}% ({active.precipitationMm.toFixed(1)} mm)
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <Eye className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
          <span className="text-slate-400">Visibility:</span>
          <span className="font-mono text-white">{(active.visibilityM / 1000).toFixed(1)} km</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <span className="text-slate-400">Pressure:</span>
          <span className="font-mono text-white">{Math.round(active.pressureMslHpa)} hPa</span>
        </div>
      </div>
    </section>
  );
}
