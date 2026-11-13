import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { AlertSeverity, WeatherAlert } from '../types/weather';

interface AlertsBannerProps {
  locationName: string;
  alerts: WeatherAlert[];
}

function getSeverityAccent(severity: AlertSeverity) {
  switch (severity) {
    case 'Extreme':
      return {
        border: 'border-rose-500/50 bg-rose-950/35',
        label: 'text-rose-300',
        icon: 'text-rose-400',
      };
    case 'Severe':
      return {
        border: 'border-amber-500/50 bg-amber-950/30',
        label: 'text-amber-300',
        icon: 'text-amber-400',
      };
    case 'Moderate':
      return {
        border: 'border-amber-400/35 bg-slate-900/75',
        label: 'text-amber-200',
        icon: 'text-amber-300',
      };
    case 'Advisory':
      return {
        border: 'border-sky-400/35 bg-slate-900/75',
        label: 'text-sky-200',
        icon: 'text-sky-300',
      };
  }
}

export function AlertsBanner({ locationName, alerts }: AlertsBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) {
    return (
      <section
        id="alerts"
        aria-label="Location weather alerts"
        className="scroll-mt-20 rounded-xl border border-white/10 bg-[#0C1320]/90 px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-slate-200">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="font-medium text-white">Nominal Conditions</span>
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">
              No active severe weather warnings or sensor threshold advisories for {locationName}.
            </span>
          </div>
          <span className="font-mono text-xs text-slate-400">NWS &amp; Sensor Feed Monitored</span>
        </div>
      </section>
    );
  }

  const lead = alerts[0];
  const style = getSeverityAccent(lead.severity);

  return (
    <section
      id="alerts"
      aria-label="Location weather alerts"
      className={`scroll-mt-20 rounded-xl border px-4 py-3.5 transition-colors ${style.border}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${style.icon}`} aria-hidden="true" />
            <span className={`font-semibold uppercase tracking-wide ${style.label}`}>
              {lead.severity} Alert
            </span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">{lead.source}</span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300 truncate">{lead.area}</span>
          </div>
          <h2 className="mt-1 font-display text-base font-semibold text-white">
            {lead.title}
          </h2>
          {!expanded && (
            <p className="mt-0.5 text-sm text-slate-300 line-clamp-1">{lead.summary}</p>
          )}
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/60 px-3.5 text-xs font-medium text-white hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {expanded ? 'Hide Details' : `View ${alerts.length} ${alerts.length === 1 ? 'Advisory' : 'Advisories'}`}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3.5 space-y-3 border-t border-white/10 pt-3.5">
          {alerts.map((alert) => {
            const itemStyle = getSeverityAccent(alert.severity);
            return (
              <article
                key={alert.id}
                className="rounded-lg border border-white/10 bg-slate-950/55 p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${itemStyle.label}`}>
                      {alert.severity}
                    </span>
                    <span className="text-slate-500" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-300">{alert.source}</span>
                    <span className="text-slate-500" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-300">{alert.area}</span>
                  </div>
                  <span className="font-mono text-slate-400">
                    Valid until{' '}
                    {new Date(alert.expires).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <h3 className="mt-1 font-display text-sm font-semibold text-white">
                  {alert.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{alert.summary}</p>
                <p className="mt-2 text-xs text-sky-200/90">
                  <span className="font-semibold text-sky-300">Guidance: </span>
                  {alert.instruction}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
