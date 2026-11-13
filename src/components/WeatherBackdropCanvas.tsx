import { useEffect, useRef } from 'react';
import type { WeatherCategory } from '../types/weather';

interface WeatherBackdropCanvasProps {
  category: WeatherCategory;
  isDay: boolean;
  windSpeedKmh: number;
  cloudCoverPct: number;
}

interface Particle {
  x: number;
  y: number;
  vy: number;
  length: number;
  size: number;
  alpha: number;
  phase: number;
}

interface CloudPuff {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
}

function getPalette(category: WeatherCategory, isDay: boolean) {
  if (category === 'storm') {
    return { top: '#070B14', mid: '#111A2E', bottom: '#1A2438' };
  }
  if (category === 'rain' || category === 'fog') {
    return isDay
      ? { top: '#0D1726', mid: '#18283E', bottom: '#22354D' }
      : { top: '#060A12', mid: '#0E1726', bottom: '#152236' };
  }
  if (category === 'snow') {
    return isDay
      ? { top: '#111E31', mid: '#1E314A', bottom: '#2B415E' }
      : { top: '#070D19', mid: '#111C30', bottom: '#1A2A44' };
  }
  if (category === 'cloudy') {
    return isDay
      ? { top: '#0F1C2E', mid: '#1B2D45', bottom: '#243B55' }
      : { top: '#060A13', mid: '#10192B', bottom: '#18243A' };
  }
  return isDay
    ? { top: '#091A32', mid: '#102C4E', bottom: '#1B416B' }
    : { top: '#04070E', mid: '#091224', bottom: '#111E36' };
}

function createCloudSprite(rgb: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = 256;
  sprite.height = 128;
  const sctx = sprite.getContext('2d');
  if (sctx) {
    const grad = sctx.createRadialGradient(128, 64, 12, 128, 64, 124);
    grad.addColorStop(0, `rgba(${rgb}, 1)`);
    grad.addColorStop(0.55, `rgba(${rgb}, 0.45)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 256, 128);
  }
  return sprite;
}

export function WeatherBackdropCanvas({
  category,
  isDay,
  windSpeedKmh,
  cloudCoverPct,
}: WeatherBackdropCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ category, isDay, windSpeedKmh, cloudCoverPct });
  stateRef.current = { category, isDay, windSpeedKmh, cloudCoverPct };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = Math.max(320, Math.ceil(window.innerWidth * 0.5));
    let height = Math.max(240, Math.ceil(window.innerHeight * 0.5));

    const resize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      width = Math.max(320, Math.ceil(vw * 0.5));
      height = Math.max(240, Math.ceil(vh * 0.5));
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    const lightCloudSprite = createCloudSprite('203, 213, 225');
    const darkCloudSprite = createCloudSprite('51, 65, 85');

    const stars: Star[] = Array.from({ length: 65 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.65,
      r: 0.5 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
    }));

    const clouds: CloudPuff[] = Array.from({ length: 12 }, (_, i) => ({
      x: (i / 12) * 1.3 - 0.15,
      y: 0.06 + (i % 5) * 0.11 + Math.random() * 0.04,
      w: 180 + Math.random() * 190,
      h: 48 + Math.random() * 45,
      speed: 0.008 + Math.random() * 0.014,
      alpha: 0.06 + Math.random() * 0.09,
    }));

    const particles: Particle[] = Array.from({ length: 110 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vy: 5 + Math.random() * 3.5,
      length: 8 + Math.random() * 9,
      size: 0.9 + Math.random() * 1.3,
      alpha: 0.25 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
    }));

    let lightningFlash = 0;
    let nextLightningAt = performance.now() + 2800;
    let lastDraw = 0;
    let rafId = 0;
    let timerId = 0;
    let disposed = false;

    const scheduleNext = () => {
      if (disposed || prefersReducedMotion) return;
      timerId = window.setTimeout(() => {
        if (!disposed) {
          rafId = requestAnimationFrame(renderFrame);
        }
      }, 42);
    };

    const renderFrame = (now: number) => {
      if (disposed) return;
      const dt = lastDraw === 0 ? 0.04 : Math.min(0.08, (now - lastDraw) / 1000);
      lastDraw = now;

      const { category: cat, isDay: day, windSpeedKmh: wind, cloudCoverPct: cloudsPct } =
        stateRef.current;

      const palette = getPalette(cat, day);
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, palette.top);
      grad.addColorStop(0.55, palette.mid);
      grad.addColorStop(1, palette.bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      if (day && (cat === 'clear' || cat === 'partly-cloudy')) {
        const sunX = width * 0.78;
        const sunY = height * 0.18;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 150);
        sunGrad.addColorStop(0, 'rgba(253, 224, 71, 0.34)');
        sunGrad.addColorStop(0.32, 'rgba(251, 191, 36, 0.16)');
        sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, width, height);
      } else if (!day && (cat === 'clear' || cat === 'partly-cloudy')) {
        for (const s of stars) {
          const twinkle = prefersReducedMotion
            ? 0.7
            : 0.45 + 0.55 * Math.sin(now * 0.0014 + s.phase);
          ctx.fillStyle = `rgba(226, 232, 240, ${twinkle * 0.72})`;
          ctx.beginPath();
          ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const cloudFactor = Math.max(0.18, cloudsPct / 100);
      const windFactor = 0.4 + Math.min(3.2, wind / 22);
      const visibleClouds = Math.max(3, Math.round(clouds.length * cloudFactor));
      const sprite = cat === 'storm' || !day ? darkCloudSprite : lightCloudSprite;

      for (let i = 0; i < visibleClouds; i++) {
        const c = clouds[i];
        if (!prefersReducedMotion) {
          c.x += c.speed * windFactor * dt;
          if (c.x > 1.25) c.x = -0.25;
        }
        ctx.globalAlpha =
          cat === 'fog' ? c.alpha * 1.8 : c.alpha * (0.65 + cloudFactor * 0.65);
        ctx.drawImage(sprite, c.x * width - c.w * 0.5, c.y * height - c.h * 0.5, c.w, c.h);
      }
      ctx.globalAlpha = 1;

      if (cat === 'fog') {
        const fogGrad = ctx.createLinearGradient(0, height * 0.35, 0, height);
        fogGrad.addColorStop(0, 'rgba(148, 163, 184, 0)');
        fogGrad.addColorStop(0.6, 'rgba(148, 163, 184, 0.16)');
        fogGrad.addColorStop(1, 'rgba(100, 116, 139, 0.24)');
        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, 0, width, height);
      }

      if (cat === 'rain' || cat === 'storm') {
        const count = cat === 'storm' ? 110 : 78;
        const slant = Math.max(-2.5, -wind * 0.05);
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.36)';
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const p = particles[i];
          if (!prefersReducedMotion) {
            p.x += slant * dt * 50;
            p.y += p.vy * (cat === 'storm' ? 1.35 : 1) * dt * 50;
            if (p.y > height + 15) {
              p.y = -15;
              p.x = Math.random() * (width + 80);
            }
            if (p.x < -30) p.x = width + 20;
          }
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + slant * 1.4, p.y + p.length);
        }
        ctx.stroke();
      } else if (cat === 'snow') {
        const count = 75;
        ctx.fillStyle = 'rgba(241, 245, 249, 0.65)';
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const p = particles[i];
          if (!prefersReducedMotion) {
            const drift = Math.sin(now * 0.0015 + p.phase) * 0.4 + Math.min(1.2, wind * 0.025);
            p.x += drift * dt * 38;
            p.y += (0.9 + p.size * 0.4) * dt * 38;
            if (p.y > height + 10) {
              p.y = -10;
              p.x = Math.random() * width;
            }
            if (p.x > width + 10) p.x = -10;
          }
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      if (cat === 'storm' && !prefersReducedMotion) {
        if (now >= nextLightningAt) {
          lightningFlash = 0.32;
          nextLightningAt = now + 3200 + Math.random() * 4800;
        }
        if (lightningFlash > 0.01) {
          ctx.fillStyle = `rgba(186, 230, 253, ${lightningFlash})`;
          ctx.fillRect(0, 0, width, height);
          lightningFlash *= 0.85;
        }
      }

      scheduleNext();
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      clearTimeout(timerId);
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="weather-backdrop-canvas"
      data-condition={category}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}
