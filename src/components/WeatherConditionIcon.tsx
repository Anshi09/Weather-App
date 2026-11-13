import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';
import { decodeWmoCondition } from '../utils/atmosphere';

interface WeatherConditionIconProps {
  code: number;
  isDay: boolean;
  className?: string;
}

export function WeatherConditionIcon({
  code,
  isDay,
  className = 'w-5 h-5',
}: WeatherConditionIconProps) {
  const { category } = decodeWmoCondition(code, isDay);

  switch (category) {
    case 'clear':
      return isDay ? (
        <Sun className={`${className} text-amber-300`} aria-hidden="true" />
      ) : (
        <Moon className={`${className} text-sky-200`} aria-hidden="true" />
      );
    case 'partly-cloudy':
      return isDay ? (
        <CloudSun className={`${className} text-amber-200`} aria-hidden="true" />
      ) : (
        <Cloud className={`${className} text-slate-300`} aria-hidden="true" />
      );
    case 'cloudy':
      return <Cloud className={`${className} text-slate-300`} aria-hidden="true" />;
    case 'fog':
      return <CloudFog className={`${className} text-slate-300`} aria-hidden="true" />;
    case 'rain':
      return code >= 51 && code <= 57 ? (
        <CloudDrizzle className={`${className} text-sky-300`} aria-hidden="true" />
      ) : (
        <CloudRain className={`${className} text-sky-400`} aria-hidden="true" />
      );
    case 'snow':
      return <CloudSnow className={`${className} text-cyan-100`} aria-hidden="true" />;
    case 'storm':
      return <CloudLightning className={`${className} text-amber-300`} aria-hidden="true" />;
  }
}
