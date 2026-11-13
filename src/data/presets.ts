import type {
  CurrentObservation,
  DailyForecastPoint,
  HourlyForecastPoint,
  WeatherAlert,
  WeatherBundle,
  WeatherLocation,
} from '../types/weather';
import { evaluateLocationAlerts } from '../utils/atmosphere';

export const PRESET_LOCATIONS: WeatherLocation[] = [
  {
    id: 'ksfo',
    name: 'San Francisco',
    region: 'California',
    country: 'United States',
    countryCode: 'US',
    latitude: 37.7749,
    longitude: -122.4194,
    timezone: 'America/Los_Angeles',
    icaoCode: 'KSFO',
    elevationM: 16,
  },
  {
    id: 'kmia',
    name: 'Miami',
    region: 'Florida',
    country: 'United States',
    countryCode: 'US',
    latitude: 25.7617,
    longitude: -80.1918,
    timezone: 'America/New_York',
    icaoCode: 'KMIA',
    elevationM: 2,
  },
  {
    id: 'birk',
    name: 'Reykjavik',
    region: 'Capital Region',
    country: 'Iceland',
    countryCode: 'IS',
    latitude: 64.1466,
    longitude: -21.9426,
    timezone: 'Atlantic/Reykjavik',
    icaoCode: 'BIRK',
    elevationM: 14,
  },
  {
    id: 'rjtt',
    name: 'Tokyo',
    region: 'Kanto',
    country: 'Japan',
    countryCode: 'JP',
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: 'Asia/Tokyo',
    icaoCode: 'RJTT',
    elevationM: 40,
  },
  {
    id: 'kden',
    name: 'Denver',
    region: 'Colorado',
    country: 'United States',
    countryCode: 'US',
    latitude: 39.7392,
    longitude: -104.9903,
    timezone: 'America/Denver',
    icaoCode: 'KDEN',
    elevationM: 1609,
  },
  {
    id: 'egll',
    name: 'London',
    region: 'Greater London',
    country: 'United Kingdom',
    countryCode: 'GB',
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: 'Europe/London',
    icaoCode: 'EGLL',
    elevationM: 25,
  },
];

interface StationSeed {
  tempC: number;
  humidityPct: number;
  weatherCode: number;
  cloudLow: number;
  cloudMid: number;
  cloudHigh: number;
  windKmh: number;
  windDir: number;
  gustsKmh: number;
  pressureHpa: number;
  visibilityM: number;
  precipMm: number;
  uvIndex: number;
  isDay: boolean;
  seedAlerts?: WeatherAlert[];
}

const STATION_SEEDS: Record<string, StationSeed> = {
  ksfo: {
    tempC: 15,
    humidityPct: 76,
    weatherCode: 2,
    cloudLow: 42,
    cloudMid: 18,
    cloudHigh: 12,
    windKmh: 24,
    windDir: 290,
    gustsKmh: 38,
    pressureHpa: 1017,
    visibilityM: 14500,
    precipMm: 0,
    uvIndex: 4.1,
    isDay: true,
    seedAlerts: [
      {
        id: 'seed-ksfo-marine',
        title: 'Coastal Marine Layer & Bay Breeze Advisory',
        severity: 'Advisory',
        source: 'NWS Official',
        area: 'San Francisco Bay Shoreline',
        effective: '2026-11-13T08:00:00Z',
        expires: '2026-11-13T23:00:00Z',
        summary: 'Onshore westerly flow bringing patchy marine stratus decks near 1,800 ft AGL and afternoon gusts through the Golden Gate.',
        instruction: 'Expect cooler coastal temperatures and reduced visibility along Highway 1 after dusk.',
      },
    ],
  },
  kmia: {
    tempC: 27,
    humidityPct: 82,
    weatherCode: 95,
    cloudLow: 78,
    cloudMid: 85,
    cloudHigh: 72,
    windKmh: 38,
    windDir: 135,
    gustsKmh: 62,
    pressureHpa: 1005,
    visibilityM: 4800,
    precipMm: 9.4,
    uvIndex: 7.5,
    isDay: true,
    seedAlerts: [
      {
        id: 'seed-kmia-storm',
        title: 'Tropical Squall & Flood Advisory',
        severity: 'Severe',
        source: 'NWS Official',
        area: 'Miami-Dade Coastal Metro',
        effective: '2026-11-13T07:30:00Z',
        expires: '2026-11-13T20:00:00Z',
        summary: 'Fast-moving convective cells moving northwest at 25 kt producing heavy downpours and gusty winds.',
        instruction: 'Avoid flooded underpasses and move marine vessels to protected moorings.',
      },
    ],
  },
  birk: {
    tempC: 1,
    humidityPct: 84,
    weatherCode: 73,
    cloudLow: 74,
    cloudMid: 65,
    cloudHigh: 40,
    windKmh: 34,
    windDir: 45,
    gustsKmh: 54,
    pressureHpa: 996,
    visibilityM: 2200,
    precipMm: 2.6,
    uvIndex: 0.4,
    isDay: false,
  },
  rjtt: {
    tempC: 18,
    humidityPct: 54,
    weatherCode: 1,
    cloudLow: 12,
    cloudMid: 18,
    cloudHigh: 28,
    windKmh: 16,
    windDir: 190,
    gustsKmh: 24,
    pressureHpa: 1023,
    visibilityM: 20000,
    precipMm: 0,
    uvIndex: 5.0,
    isDay: true,
  },
  kden: {
    tempC: 9,
    humidityPct: 36,
    weatherCode: 0,
    cloudLow: 4,
    cloudMid: 8,
    cloudHigh: 15,
    windKmh: 19,
    windDir: 260,
    gustsKmh: 29,
    pressureHpa: 1021,
    visibilityM: 24000,
    precipMm: 0,
    uvIndex: 5.8,
    isDay: true,
  },
  egll: {
    tempC: 11,
    humidityPct: 91,
    weatherCode: 61,
    cloudLow: 88,
    cloudMid: 76,
    cloudHigh: 45,
    windKmh: 22,
    windDir: 235,
    gustsKmh: 34,
    pressureHpa: 1004,
    visibilityM: 4200,
    precipMm: 3.1,
    uvIndex: 1.2,
    isDay: true,
  },
};

export function buildFallbackWeatherBundle(location: WeatherLocation): WeatherBundle {
  const seed = STATION_SEEDS[location.id] ?? STATION_SEEDS.ksfo;
  const now = new Date();
  const dewPointC = Number((seed.tempC - (100 - seed.humidityPct) / 5).toFixed(1));

  const current: CurrentObservation = {
    time: now.toISOString(),
    temperatureC: seed.tempC,
    apparentTemperatureC: seed.tempC - (seed.windKmh > 25 ? 2 : 0),
    humidityPct: seed.humidityPct,
    dewPointC,
    isDay: seed.isDay,
    precipitationMm: seed.precipMm,
    weatherCode: seed.weatherCode,
    cloudCoverPct: Math.round(Math.max(seed.cloudLow, seed.cloudMid * 0.85, seed.cloudHigh * 0.6)),
    cloudCoverLowPct: seed.cloudLow,
    cloudCoverMidPct: seed.cloudMid,
    cloudCoverHighPct: seed.cloudHigh,
    pressureMslHpa: seed.pressureHpa,
    surfacePressureHpa: seed.pressureHpa - Math.round((location.elevationM ?? 10) * 0.11),
    windSpeedKmh: seed.windKmh,
    windDirectionDeg: seed.windDir,
    windGustsKmh: seed.gustsKmh,
    windSpeed80mKmh: Math.round(seed.windKmh * 1.25),
    windDirection80mDeg: (seed.windDir + 10) % 360,
    windSpeed120mKmh: Math.round(seed.windKmh * 1.42),
    visibilityM: seed.visibilityM,
    uvIndex: seed.uvIndex,
    directRadiationWm2: seed.isDay ? Math.max(40, Math.round((100 - seed.cloudLow) * 7.2)) : 0,
    diffuseRadiationWm2: seed.isDay ? 125 : 0,
  };

  const hourly: HourlyForecastPoint[] = Array.from({ length: 24 }, (_, idx) => {
    const dt = new Date(now.getTime() + idx * 3600 * 1000);
    const diurnal = Math.sin(((dt.getUTCHours() - 6) / 24) * Math.PI * 2) * 3.2;
    const tempC = Number((seed.tempC + diurnal).toFixed(1));
    const hourIsDay = idx < 10 ? seed.isDay : (dt.getHours() >= 7 && dt.getHours() <= 18);
    const cloudMod = Math.max(0, Math.min(100, Math.round(seed.cloudLow + Math.sin(idx * 0.6) * 14)));
    const precipProb =
      seed.precipMm > 0
        ? Math.min(95, Math.max(25, Math.round(65 + Math.cos(idx * 0.5) * 20)))
        : Math.max(0, Math.min(45, Math.round(cloudMod * 0.3)));

    return {
      time: dt.toISOString(),
      hourLabel:
        idx === 0
          ? 'Now'
          : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      temperatureC: tempC,
      apparentTemperatureC: Number((tempC - 1.1).toFixed(1)),
      dewPointC: Number((tempC - (100 - seed.humidityPct) / 5).toFixed(1)),
      humidityPct: Math.min(98, Math.max(25, Math.round(seed.humidityPct - diurnal * 2))),
      precipitationProbPct: precipProb,
      precipitationMm: seed.precipMm > 0 ? Number((seed.precipMm * (0.6 + (idx % 3) * 0.25)).toFixed(1)) : 0,
      weatherCode: idx === 0 ? seed.weatherCode : precipProb > 60 ? seed.weatherCode : cloudMod > 70 ? 3 : cloudMod > 30 ? 2 : 0,
      pressureMslHpa: Math.round(seed.pressureHpa + Math.sin(idx * 0.3) * 2),
      cloudCoverPct: cloudMod,
      cloudCoverLowPct: cloudMod,
      cloudCoverMidPct: Math.max(5, Math.round(seed.cloudMid + Math.cos(idx * 0.4) * 10)),
      cloudCoverHighPct: seed.cloudHigh,
      visibilityM: seed.visibilityM,
      windSpeedKmh: Math.max(4, Math.round(seed.windKmh + Math.sin(idx * 0.5) * 6)),
      windDirectionDeg: (seed.windDir + idx * 3) % 360,
      windSpeed80mKmh: Math.round((seed.windKmh + Math.sin(idx * 0.5) * 6) * 1.25),
      windDirection80mDeg: (seed.windDir + idx * 3 + 12) % 360,
      windSpeed120mKmh: Math.round((seed.windKmh + Math.sin(idx * 0.5) * 6) * 1.42),
      uvIndex: hourIsDay ? Math.max(0.5, Number((seed.uvIndex * Math.max(0.2, 1 - idx * 0.04)).toFixed(1))) : 0,
      directRadiationWm2: hourIsDay ? Math.max(30, Math.round((100 - cloudMod) * 6.5)) : 0,
      diffuseRadiationWm2: hourIsDay ? 120 : 0,
      isDay: hourIsDay,
    };
  });

  const dayNames = ['Today', 'Tomorrow', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
  const daily: DailyForecastPoint[] = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(now.getTime() + i * 86400 * 1000);
    const shift = Math.sin(i * 1.1) * 2.5;
    return {
      date: dt.toISOString().slice(0, 10),
      dayLabel: i < 2 ? dayNames[i] : dt.toLocaleDateString([], { weekday: 'short' }),
      weatherCode: i === 0 ? seed.weatherCode : i % 3 === 1 ? 2 : i % 3 === 2 ? 3 : seed.weatherCode,
      tempMaxC: Math.round(seed.tempC + 4 + shift),
      tempMinC: Math.round(seed.tempC - 4 + shift * 0.6),
      sunrise: '06:48',
      sunset: '17:04',
      uvIndexMax: Math.max(1, Number((seed.uvIndex + 1).toFixed(1))),
      precipProbMaxPct: seed.precipMm > 0 ? 75 : Math.min(40, 10 + i * 5),
      windSpeedMaxKmh: Math.round(seed.gustsKmh * 0.9),
    };
  });

  const alerts = evaluateLocationAlerts(location, current, seed.seedAlerts ?? []);

  return {
    location,
    current,
    hourly,
    daily,
    alerts,
    sourceMode: 'cached',
    fetchedAt: now.toISOString(),
  };
}
