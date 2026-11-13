import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Layers, Radio, RotateCcw, Wind } from 'lucide-react';
import type {
  CurrentObservation,
  SkySimulationMode,
  TemperatureUnit,
  WeatherLocation,
} from '../types/weather';
import {
  applySkySimulationMode,
  buildAtmosphericLayers,
  calculateLiftingCondensationLevelM,
  decodeWmoCondition,
  formatCompassDirection,
  formatTemperature,
  generateMetarReport,
  kmhToMph,
  metersToFeet,
  sampleAtmosphereAtAltitude,
} from '../utils/atmosphere';

interface InteractiveSkyVisualizerProps {
  location: WeatherLocation;
  observation: CurrentObservation;
  unit: TemperatureUnit;
  projectedHourLabel: string | null;
  onResetProjectedHour: () => void;
}

const SIMULATION_OPTIONS: Array<{ id: SkySimulationMode; label: string }> = [
  { id: 'live', label: 'Live Sensor' },
  { id: 'marine-fog', label: 'Marine Fog' },
  { id: 'squall-line', label: 'Squall Line' },
  { id: 'clear-high', label: 'Clear High' },
];

function flightCategoryTone(cat: 'VFR' | 'MVFR' | 'IFR' | 'LIFR'): string {
  switch (cat) {
    case 'VFR':
      return 'text-emerald-300';
    case 'MVFR':
      return 'text-sky-300';
    case 'IFR':
      return 'text-amber-300';
    case 'LIFR':
      return 'text-rose-300';
  }
}

export function InteractiveSkyVisualizer({
  location,
  observation,
  unit,
  projectedHourLabel,
  onResetProjectedHour,
}: InteractiveSkyVisualizerProps) {
  const [simMode, setSimMode] = useState<SkySimulationMode>('live');
  const [probeAltitudeM, setProbeAltitudeM] = useState<number>(1500);
  const [probeAzimuthPct, setProbeAzimuthPct] = useState<number>(52);
  const [showClouds, setShowClouds] = useState(true);
  const [showWind, setShowWind] = useState(true);
  const [showRadiation, setShowRadiation] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [copiedMetar, setCopiedMetar] = useState(false);

  const effectiveObs = useMemo(
    () => applySkySimulationMode(observation, simMode),
    [observation, simMode]
  );

  const metar = useMemo(
    () => generateMetarReport(location.icaoCode, effectiveObs),
    [location.icaoCode, effectiveObs]
  );

  const layers = useMemo(() => buildAtmosphericLayers(effectiveObs), [effectiveObs]);
  const probeSample = useMemo(
    () => sampleAtmosphereAtAltitude(effectiveObs, probeAltitudeM),
    [effectiveObs, probeAltitudeM]
  );
  const lclM = useMemo(
    () =>
      calculateLiftingCondensationLevelM(
        effectiveObs.temperatureC,
        effectiveObs.dewPointC
      ),
    [effectiveObs.temperatureC, effectiveObs.dewPointC]
  );
  const condition = useMemo(
    () => decodeWmoCondition(effectiveObs.weatherCode, effectiveObs.isDay),
    [effectiveObs.weatherCode, effectiveObs.isDay]
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawStateRef = useRef({
    obs: effectiveObs,
    lclM,
    category: condition.category,
    probeAltitudeM,
    probeAzimuthPct,
    showClouds,
    showWind,
    showRadiation,
    showGrid,
    layers,
  });
  drawStateRef.current = {
    obs: effectiveObs,
    lclM,
    category: condition.category,
    probeAltitudeM,
    probeAzimuthPct,
    showClouds,
    showWind,
    showRadiation,
    showGrid,
    layers,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cssW = canvas.clientWidth || 720;
    let cssH = canvas.clientHeight || 420;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      cssW = canvas.clientWidth || 720;
      cssH = canvas.clientHeight || 420;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const windTracers = Array.from({ length: 42 }, (_, i) => ({
      x: Math.random(),
      altM: 150 + (i / 42) * 11400,
      len: 26 + Math.random() * 44,
    }));

    const precipDrops = Array.from({ length: 75 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.45 + Math.random() * 0.45,
      size: 1.5 + Math.random() * 2,
    }));

    const makeCloudSprite = (rgb: string) => {
      const sp = document.createElement('canvas');
      sp.width = 192;
      sp.height = 96;
      const sctx = sp.getContext('2d');
      if (sctx) {
        const g = sctx.createRadialGradient(96, 48, 8, 96, 48, 92);
        g.addColorStop(0, `rgba(${rgb}, 1)`);
        g.addColorStop(0.58, `rgba(${rgb}, 0.55)`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, 192, 96);
      }
      return sp;
    };

    const lightSprite = makeCloudSprite('226, 232, 240');
    const midSprite = makeCloudSprite('186, 200, 218');
    const rainSprite = makeCloudSprite('100, 116, 139');
    const stormSprite = makeCloudSprite('51, 65, 85');

    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    let lastDraw = 0;
    let cloudScroll = 0;

    const altToY = (altM: number, groundY: number, skyTopY: number) => {
      const norm = Math.max(0, Math.min(1, altM / 12000));
      // Slight non-linear compression so boundary layer (0-3km) has generous visual detail
      const curved = Math.pow(norm, 0.72);
      return groundY - curved * (groundY - skyTopY);
    };

    const draw = (now: number) => {
      if (disposed) return;
      const dt = lastDraw === 0 ? 0.04 : Math.min(0.08, (now - lastDraw) / 1000);
      lastDraw = now;
      const st = drawStateRef.current;
      const { obs, lclM: cloudBaseM, category } = st;

      if (!prefersReducedMotion) {
        cloudScroll += dt * (0.012 + Math.min(0.08, obs.windSpeedKmh / 450));
      }

      const w = cssW;
      const h = cssH;
      const skyTopY = 18;
      const groundY = h - 34;

      // 1. Atmospheric Sky Gradient driven by solar radiation, cloud cover & visibility
      const visKm = Math.max(0.3, obs.visibilityM / 1000);
      const hazeAmount = Math.max(0, Math.min(0.85, 1 - visKm / 18));
      const stormDark = category === 'storm' ? 0.65 : category === 'rain' ? 0.35 : 0;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      if (obs.isDay) {
        const zenithAlpha = 1 - stormDark * 0.45;
        skyGrad.addColorStop(
          0,
          category === 'storm' ? '#0B1324' : `rgba(12, 34, 68, ${zenithAlpha})`
        );
        skyGrad.addColorStop(
          0.55,
          category === 'storm'
            ? '#172338'
            : category === 'fog'
              ? '#324256'
              : '#1B4978'
        );
        skyGrad.addColorStop(
          1,
          hazeAmount > 0.45
            ? '#475569'
            : category === 'storm'
              ? '#1E293B'
              : '#2E628E'
        );
      } else {
        skyGrad.addColorStop(0, '#04070F');
        skyGrad.addColorStop(0.6, '#0A1324');
        skyGrad.addColorStop(1, hazeAmount > 0.4 ? '#1E293B' : '#122038');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Solar / Lunar Scattering & Radiation Field
      if (st.showRadiation) {
        const celestialX = w * 0.78;
        const celestialY = obs.isDay ? skyTopY + 56 : skyTopY + 48;
        const radStrength = obs.isDay
          ? Math.max(0.18, Math.min(1, (obs.directRadiationWm2 + obs.diffuseRadiationWm2) / 800))
          : 0.45;

        const corona = ctx.createRadialGradient(
          celestialX,
          celestialY,
          4,
          celestialX,
          celestialY,
          obs.isDay ? 190 : 95
        );
        if (obs.isDay) {
          corona.addColorStop(0, `rgba(254, 240, 138, ${0.85 * radStrength})`);
          corona.addColorStop(0.25, `rgba(251, 191, 36, ${0.28 * radStrength})`);
          corona.addColorStop(1, 'rgba(251, 191, 36, 0)');
        } else {
          corona.addColorStop(0, 'rgba(226, 232, 240, 0.75)');
          corona.addColorStop(0.35, 'rgba(56, 189, 248, 0.16)');
          corona.addColorStop(1, 'rgba(56, 189, 248, 0)');
        }
        ctx.fillStyle = corona;
        ctx.fillRect(0, 0, w, groundY);

        // Mie horizon haze band proportional to optical extinction
        if (hazeAmount > 0.12) {
          const hazeGrad = ctx.createLinearGradient(0, groundY - 120, 0, groundY);
          hazeGrad.addColorStop(0, 'rgba(148, 163, 184, 0)');
          hazeGrad.addColorStop(1, `rgba(148, 163, 184, ${hazeAmount * 0.55})`);
          ctx.fillStyle = hazeGrad;
          ctx.fillRect(0, groundY - 120, w, 120);
        }
      }

      // 3. Calibrated Altitude & Pressure Grid
      if (st.showGrid) {
        const ticks = [0, 1000, 3000, 6000, 9000, 12000];
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textBaseline = 'middle';
        for (const alt of ticks) {
          const y = altToY(alt, groundY, skyTopY);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();

          if (alt > 0 && alt < 12000) {
            ctx.fillStyle = 'rgba(203, 213, 225, 0.68)';
            ctx.textAlign = 'left';
            ctx.fillText(`${(alt / 1000).toFixed(0)} km`, 10, y - 8);
          }
        }
      }

      // 4. Three-Tier Live Sensor Cloud Strata
      if (st.showClouds) {
        const drawCloudBand = (
          altM: number,
          densityPct: number,
          puffCount: number,
          bandHeight: number,
          sprite: HTMLCanvasElement,
          speedScale: number
        ) => {
          if (densityPct < 5) return;
          const centerY = altToY(altM, groundY, skyTopY);
          const alpha = Math.min(0.85, (densityPct / 100) * 0.8);
          ctx.globalAlpha = alpha;
          for (let i = 0; i < puffCount; i++) {
            const baseSeed = i / puffCount;
            const px = (((baseSeed + cloudScroll * speedScale) % 1.2) - 0.1) * w;
            const py = centerY + Math.sin(i * 2.3) * (bandHeight * 0.25);
            const rw = (w / puffCount) * (1.8 + (densityPct / 100) * 1.4);
            const rh = bandHeight * (1.25 + (i % 3) * 0.3);
            ctx.drawImage(sprite, px - rw * 0.5, py - rh * 0.5, rw, rh);
          }
          ctx.globalAlpha = 1;
        };

        // High Cirrus (~8.2 km)
        drawCloudBand(8200, obs.cloudCoverHighPct, 8, 22, lightSprite, 1.45);
        // Mid Altostratus (~4.0 km)
        drawCloudBand(
          4000,
          obs.cloudCoverMidPct,
          10,
          28,
          category === 'storm' ? stormSprite : midSprite,
          1.0
        );
        // Low Stratus / Cumulus anchored at computed LCL Cloud Base
        const lowSprite =
          category === 'storm'
            ? stormSprite
            : category === 'rain'
              ? rainSprite
              : lightSprite;
        drawCloudBand(cloudBaseM, obs.cloudCoverLowPct, 11, 32, lowSprite, 0.72);

        // LCL Cloud Base reference line
        if (obs.cloudCoverLowPct >= 8 || obs.cloudCoverPct >= 15) {
          const lclY = altToY(cloudBaseM, groundY, skyTopY);
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, lclY);
          ctx.lineTo(w, lclY);
          ctx.stroke();
          ctx.restore();

          const lclLabel = `LCL BASE ${cloudBaseM} m (${Math.round(metersToFeet(cloudBaseM))} ft)`;
          ctx.font = '10px "JetBrains Mono", monospace';
          const textW = ctx.measureText(lclLabel).width;
          ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
          ctx.fillRect(w - textW - 20, lclY - 18, textW + 12, 15);
          ctx.fillStyle = 'rgba(125, 211, 252, 0.96)';
          ctx.textAlign = 'right';
          ctx.fillText(lclLabel, w - 14, lclY - 10);
        }
      }

      // 5. Precipitation Shafts from Low Cloud Base to Terrain
      if (category === 'rain' || category === 'storm' || category === 'snow') {
        const baseAlt = Math.min(3500, Math.max(700, cloudBaseM));
        const baseY = altToY(baseAlt, groundY, skyTopY);
        const dropCount = category === 'storm' ? 75 : 48;
        const slant = Math.max(-18, -obs.windSpeedKmh * 0.25);

        for (let i = 0; i < dropCount; i++) {
          const d = precipDrops[i];
          if (!prefersReducedMotion) {
            d.y += d.speed * (category === 'snow' ? 0.28 : 1.1) * dt;
            d.x += (slant / w) * dt * 2.5;
            if (d.y > 1) d.y = 0;
            if (d.x < 0) d.x = 1;
          }
          const px = d.x * w;
          const py = baseY + d.y * (groundY - baseY);

          if (category === 'snow') {
            ctx.fillStyle = 'rgba(241, 245, 249, 0.72)';
            ctx.beginPath();
            ctx.arc(px, py, d.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + slant * 0.35, py + 11);
            ctx.stroke();
          }
        }
      }

      // 6. Wind Shear Vector Streamlines across altitude column
      if (st.showWind) {
        for (const wt of windTracers) {
          const factor = 1 + (wt.altM / 12000) * 2.1;
          const localKmh = obs.windSpeedKmh * factor;
          const dirSign = Math.sin((obs.windDirectionDeg * Math.PI) / 180) >= 0 ? -1 : 1;
          if (!prefersReducedMotion) {
            wt.x += dirSign * (0.04 + localKmh * 0.0022) * dt;
            if (wt.x > 1.1) wt.x = -0.1;
            if (wt.x < -0.1) wt.x = 1.1;
          }
          const wy = altToY(wt.altM, groundY, skyTopY);
          const wx = wt.x * w;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + dirSign * wt.len, wy);
          ctx.stroke();

          // Tiny arrow head
          const tipX = wx + dirSign * wt.len;
          ctx.beginPath();
          ctx.moveTo(tipX, wy);
          ctx.lineTo(tipX - dirSign * 4, wy - 2.5);
          ctx.lineTo(tipX - dirSign * 4, wy + 2.5);
          ctx.closePath();
          ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.fill();
        }
      }

      // 7. Ground / Terrain Profile Horizon
      ctx.fillStyle = '#090E18';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, groundY + 4);
      for (let x = 0; x <= w; x += 24) {
        const ridge = Math.sin(x * 0.012) * 5 + Math.cos(x * 0.031) * 3;
        ctx.lineTo(x, groundY + ridge);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, groundY + 4);
      for (let x = 0; x <= w; x += 24) {
        const ridge = Math.sin(x * 0.012) * 5 + Math.cos(x * 0.031) * 3;
        ctx.lineTo(x, groundY + ridge);
      }
      ctx.stroke();

      // 8. Interactive Altitude Crosshair Reticle
      const probeY = altToY(st.probeAltitudeM, groundY, skyTopY);
      const probeX = (st.probeAzimuthPct / 100) * w;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, probeY);
      ctx.lineTo(w, probeY);
      ctx.moveTo(probeX, skyTopY);
      ctx.lineTo(probeX, groundY);
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(probeX, probeY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#080C14';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (!prefersReducedMotion && !disposed) {
        timerId = window.setTimeout(() => {
          if (!disposed) {
            rafId = requestAnimationFrame(draw);
          }
        }, 42);
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      clearTimeout(timerId);
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const handleCanvasPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const skyTopY = 18;
    const groundY = rect.height - 34;
    const relY = Math.max(skyTopY, Math.min(groundY, clientY - rect.top));
    const norm = (groundY - relY) / Math.max(1, groundY - skyTopY);
    const altM = Math.round(Math.pow(norm, 1 / 0.72) * 12000);
    setProbeAltitudeM(Math.max(0, Math.min(12000, altM)));
    setProbeAzimuthPct(Math.round(relX * 100));
  };

  const handleCopyMetar = () => {
    navigator.clipboard?.writeText(metar.rawMetar).catch(() => undefined);
    setCopiedMetar(true);
    setTimeout(() => setCopiedMetar(false), 1800);
  };

  const probeWindDisplay =
    unit === 'F'
      ? `${Math.round(kmhToMph(probeSample.windSpeedKmh))} mph`
      : `${probeSample.windSpeedKmh} km/h`;

  return (
    <section
      id="sky-sensor"
      aria-labelledby="sky-sensor-heading"
      className="scroll-mt-20 rounded-xl border border-white/10 bg-[#0C1320]/90 p-5"
    >
      {/* Header & Simulation Mode Controls */}
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300 font-mono">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            <span>INTERACTIVE ATMOSPHERIC SOUNDING</span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">{metar.stationIcao}</span>
            {projectedHourLabel && (
              <>
                <span className="text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className="text-amber-300">PROJECTED HOUR: {projectedHourLabel}</span>
              </>
            )}
          </div>
          <h2 id="sky-sensor-heading" className="mt-1 font-display text-xl font-semibold text-white">
            Interactive Sky Visualization &amp; Live Sensor Report
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projectedHourLabel && (
            <button
              type="button"
              onClick={onResetProjectedHour}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/15 px-3 text-xs font-medium text-amber-200 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Return to Current
            </button>
          )}
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-slate-950/75 p-1"
            role="group"
            aria-label="Sky atmospheric condition mode"
          >
            {SIMULATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSimMode(opt.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  simMode === opt.id
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Interactive Sky Cross-Section Canvas */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-lg border border-white/15 bg-slate-950">
            <canvas
              ref={canvasRef}
              data-testid="interactive-sky-canvas"
              data-altitude-m={probeSample.altitudeM}
              data-sim-mode={simMode}
              onMouseMove={(e) => handleCanvasPointer(e.clientX, e.clientY)}
              onClick={(e) => handleCanvasPointer(e.clientX, e.clientY)}
              className="block h-[360px] w-full cursor-crosshair sm:h-[410px]"
            />

            {/* Floating Live Probe Readout HUD */}
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/15 bg-[#080C14]/85 px-3 py-2 text-xs backdrop-blur-sm">
              <div className="font-mono text-[11px] text-sky-300">
                ALTITUDE PROBE · {probeSample.layerName}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-slate-200 sm:grid-cols-4">
                <div>
                  <span className="text-slate-400">ALT </span>
                  <span className="text-white font-semibold">{probeSample.altitudeM} m</span>
                </div>
                <div>
                  <span className="text-slate-400">TEMP </span>
                  <span className="text-white font-semibold">
                    {formatTemperature(probeSample.temperatureC, unit, 1)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">PRES </span>
                  <span className="text-white font-semibold">{probeSample.pressureHpa} hPa</span>
                </div>
                <div>
                  <span className="text-slate-400">WIND </span>
                  <span className="text-white font-semibold">
                    {formatCompassDirection(probeSample.windDirectionDeg)} {probeWindDisplay}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Layer Visibility Controls + Accessible Altitude Probe Slider */}
          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Sky visualization layers">
              <span className="mr-1 inline-flex items-center gap-1 text-xs text-slate-400">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Layers:
              </span>
              {[
                { label: 'Clouds', active: showClouds, toggle: () => setShowClouds((v) => !v) },
                { label: 'Wind Shear', active: showWind, toggle: () => setShowWind((v) => !v) },
                { label: 'Solar/Haze', active: showRadiation, toggle: () => setShowRadiation((v) => !v) },
                { label: 'Grid', active: showGrid, toggle: () => setShowGrid((v) => !v) },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={item.active}
                  onClick={item.toggle}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    item.active
                      ? 'border-sky-400/50 bg-sky-500/15 text-sky-200'
                      : 'border-white/10 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 sm:min-w-[210px]">
              <label
                htmlFor="altitude-probe-slider"
                className="font-mono text-xs text-slate-400 whitespace-nowrap"
              >
                Probe Alt:
              </label>
              <input
                id="altitude-probe-slider"
                type="range"
                min={0}
                max={12000}
                step={100}
                value={probeAltitudeM}
                onChange={(e) => setProbeAltitudeM(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
              <span className="w-14 text-right font-mono text-xs text-white">
                {probeAltitudeM}m
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live METAR & Atmospheric Sounding Inspector */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Raw METAR Sensor Block */}
          <div className="rounded-lg border border-white/10 bg-slate-950/75 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-white">METAR Surface Report</span>
                <span className="text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className={`font-mono font-semibold ${flightCategoryTone(metar.flightCategory)}`}>
                  {metar.flightCategory}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyMetar}
                className="inline-flex items-center gap-1.5 rounded border border-white/10 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-white/25 hover:text-white transition-colors cursor-pointer"
              >
                {copiedMetar ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Copy METAR
                  </>
                )}
              </button>
            </div>
            <p
              data-testid="metar-raw-string"
              className="mt-2.5 rounded border border-white/10 bg-[#070B12] p-2.5 font-mono text-xs leading-relaxed text-sky-200 break-words"
            >
              {metar.rawMetar}
            </p>

            {/* Decoded Sensor Matrix */}
            <dl className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded border border-white/10 bg-slate-900/60 p-2.5">
                <dt className="text-slate-400">Surface Wind</dt>
                <dd className="mt-0.5 font-mono font-medium text-white">{metar.windSummary}</dd>
              </div>
              <div className="rounded border border-white/10 bg-slate-900/60 p-2.5">
                <dt className="text-slate-400">Optical Visibility</dt>
                <dd className="mt-0.5 font-mono font-medium text-white">
                  {metar.visibilityKm} km ({metar.visibilitySm} SM)
                </dd>
              </div>
              <div className="rounded border border-white/10 bg-slate-900/60 p-2.5">
                <dt className="text-slate-400">Temp / Dew Point</dt>
                <dd className="mt-0.5 font-mono font-medium text-white">
                  {formatTemperature(effectiveObs.temperatureC, unit)} /{' '}
                  {formatTemperature(effectiveObs.dewPointC, unit)}
                </dd>
              </div>
              <div className="rounded border border-white/10 bg-slate-900/60 p-2.5">
                <dt className="text-slate-400">Altimeter / MSL</dt>
                <dd className="mt-0.5 font-mono font-medium text-white">
                  {metar.altimeterInHg.toFixed(2)} inHg · {metar.pressureHpa} hPa
                </dd>
              </div>
            </dl>
          </div>

          {/* Clickable Atmospheric Column Layers */}
          <div className="rounded-lg border border-white/10 bg-slate-950/75 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Vertical Atmospheric Sounding</span>
              <span className="font-mono text-slate-400">Click stratum to lock probe</span>
            </div>

            <div className="mt-3 space-y-2">
              {layers.map((layer) => {
                const isActive =
                  probeAltitudeM >= layer.altitudeRangeM[0] &&
                  probeAltitudeM <= layer.altitudeRangeM[1];
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setProbeAltitudeM(layer.midpointM)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'border-sky-400/60 bg-sky-500/12 text-white'
                        : 'border-white/10 bg-slate-900/50 text-slate-300 hover:border-white/20 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-white">{layer.name}</span>
                      <span className="font-mono text-sky-300 shrink-0">
                        {layer.altitudeRangeM[0]}–{layer.altitudeRangeM[1]} m
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                      <span>{layer.pressureHpa} hPa</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatTemperature(layer.temperatureC, unit, 1)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Wind className="h-3 w-3" aria-hidden="true" />
                        {formatCompassDirection(layer.windDirectionDeg)} {layer.windSpeedKmh} km/h
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Cloud {layer.cloudDensityPct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
