import { Droplets, Sunrise, Sunset, Wind } from 'lucide-react';
import type { DailyForecastPoint, TemperatureUnit } from '../types/weather';
import { decodeWmoCondition, formatTemperature, kmhToMph } from '../utils/atmosphere';
import { WeatherConditionIcon } from './WeatherConditionIcon';

interface SevenDayOutlookProps {
  daily: DailyForecastPoint[];
  unit: TemperatureUnit;
}

export function SevenDayOutlook({ daily, unit }: SevenDayOutlookProps) {
  if (daily.length === 0) return null;

  const minAll = Math.min(...daily.map((d) => d.tempMinC));
  const maxAll = Math.max(...daily.map((d) => d.tempMaxC));
  const totalSpan = Math.max(1, maxAll - minAll);
  const today = daily[0];

  return (
    <section
      aria-labelledby="outlook-heading"
      className="grid grid-cols-1 gap-5 lg:grid-cols-12"
    >
      {/* 7-Day Synoptic Forecast */}
      <div className="lg:col-span-8 rounded-xl border border-white/10 bg-[#0C1320]/90 p-5">
        <div className="border-b border-white/10 pb-3.5">
          <h2 id="outlook-heading" className="font-display text-lg font-semibold text-white">
            7-Day Synoptic Outlook
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Daily temperature range bars, precipitation likelihood, and peak surface gusts.
          </p>
        </div>

        <ul className="mt-2 divide-y divide-white/10">
          {daily.map((day) => {
            const cond = decodeWmoCondition(day.weatherCode, true);
            const leftPct = ((day.tempMinC - minAll) / totalSpan) * 100;
            const widthPct = Math.max(
              8,
              ((day.tempMaxC - day.tempMinC) / totalSpan) * 100
            );
            const windStr =
              unit === 'F'
                ? `${Math.round(kmhToMph(day.windSpeedMaxKmh))} mph`
                : `${day.windSpeedMaxKmh} km/h`;

            return (
              <li
                key={day.date}
                className="grid grid-cols-12 items-center gap-2 py-3 text-sm"
              >
                <div className="col-span-3 sm:col-span-2 font-medium text-white">
                  {day.dayLabel}
                </div>
                <div className="col-span-3 sm:col-span-3 flex items-center gap-2 min-w-0">
                  <WeatherConditionIcon
                    code={day.weatherCode}
                    isDay={true}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="truncate text-xs text-slate-300">{cond.shortLabel}</span>
                </div>
                <div className="hidden sm:flex sm:col-span-2 items-center gap-1 font-mono text-xs text-sky-300">
                  <Droplets className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{day.precipProbMaxPct}%</span>
                </div>
                <div className="col-span-6 sm:col-span-3 flex items-center gap-2 font-mono text-xs">
                  <span className="w-8 text-right text-slate-400">
                    {formatTemperature(day.tempMinC, unit)}
                  </span>
                  <div className="relative h-1.5 flex-1 rounded-full bg-slate-800">
                    <div
                      className="absolute top-0 h-1.5 rounded-full bg-gradient-to-r from-sky-400 to-amber-300"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-8 text-white font-semibold">
                    {formatTemperature(day.tempMaxC, unit)}
                  </span>
                </div>
                <div className="hidden sm:flex sm:col-span-2 items-center justify-end gap-1 font-mono text-xs text-slate-400">
                  <Wind className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{windStr}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Solar Window & Daily Extremes Panel */}
      <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#0C1320]/90 p-5 flex flex-col justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-white">
            Solar &amp; Daily Extremes
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Astronomical twilight markers and peak daily radiative exposure.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Sunrise className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                <span>Sunrise</span>
              </div>
              <div className="mt-1.5 font-mono text-xl font-semibold text-white">
                {today.sunrise}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Sunset className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <span>Sunset</span>
              </div>
              <div className="mt-1.5 font-mono text-xl font-semibold text-white">
                {today.sunset}
              </div>
            </div>
          </div>

          <dl className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Daily Peak UV Index</dt>
              <dd className="font-mono font-semibold text-white">{today.uvIndexMax}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Peak Precip Probability</dt>
              <dd className="font-mono font-semibold text-sky-300">
                {today.precipProbMaxPct}%
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Max Surface Wind</dt>
              <dd className="font-mono font-semibold text-white">
                {unit === 'F'
                  ? `${Math.round(kmhToMph(today.windSpeedMaxKmh))} mph`
                  : `${today.windSpeedMaxKmh} km/h`}
              </dd>
            </div>
          </dl>
        </div>

        <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">
          Synoptic forecasts combine surface station observations with upper-air numerical models.
        </p>
      </div>
    </section>
  );
}
