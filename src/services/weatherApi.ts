import type {
  AlertSeverity,
  CurrentObservation,
  DailyForecastPoint,
  HourlyForecastPoint,
  WeatherAlert,
  WeatherBundle,
  WeatherLocation,
} from '../types/weather';
import { buildFallbackWeatherBundle, PRESET_LOCATIONS } from '../data/presets';
import { calculateDewPoint, evaluateLocationAlerts } from '../utils/atmosphere';

interface OpenMeteoResponse {
  timezone: string;
  elevation: number;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    surface_pressure: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    pressure_msl: number[];
    cloud_cover: number[];
    cloud_cover_low: number[];
    cloud_cover_mid: number[];
    cloud_cover_high: number[];
    visibility: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_speed_80m: number[];
    wind_direction_80m: number[];
    wind_speed_120m: number[];
    uv_index: number[];
    direct_radiation: number[];
    diffuse_radiation: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
  };
}

interface NwsAlertsResponse {
  features?: Array<{
    id?: string;
    properties?: {
      event?: string;
      severity?: string;
      areaDesc?: string;
      effective?: string;
      expires?: string;
      headline?: string;
      description?: string;
      instruction?: string;
    };
  }>;
}

interface GeocodingResponse {
  results?: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation?: number;
    country_code?: string;
    country?: string;
    admin1?: string;
    timezone?: string;
  }>;
}

function mapNwsSeverity(raw?: string): AlertSeverity {
  if (!raw) return 'Advisory';
  const norm = raw.toLowerCase();
  if (norm === 'extreme') return 'Extreme';
  if (norm === 'severe') return 'Severe';
  if (norm === 'moderate') return 'Moderate';
  return 'Advisory';
}

function derivePseudoIcao(name: string, countryCode: string): string {
  const prefix = countryCode === 'US' ? 'K' : countryCode === 'GB' ? 'E' : countryCode === 'JP' ? 'R' : 'W';
  const clean = name.replace(/[^A-Za-z]/g, '').toUpperCase();
  return (prefix + clean.slice(0, 3)).padEnd(4, 'X');
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 4500, headers?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchWeatherLocations(query: string): Promise<WeatherLocation[]> {
  const trimmed = query.trim();
  if (!trimmed) return PRESET_LOCATIONS;

  const localMatches = PRESET_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(trimmed.toLowerCase()) ||
      loc.country.toLowerCase().includes(trimmed.toLowerCase()) ||
      loc.region.toLowerCase().includes(trimmed.toLowerCase()) ||
      loc.icaoCode.toLowerCase().includes(trimmed.toLowerCase())
  );

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=6&language=en&format=json`;
    const data = await fetchJsonWithTimeout<GeocodingResponse>(url, 3500);
    if (!data.results || data.results.length === 0) {
      return localMatches;
    }

    const remote: WeatherLocation[] = data.results.map((r) => {
      const cc = (r.country_code || 'XX').toUpperCase();
      return {
        id: `geo-${r.id}`,
        name: r.name,
        region: r.admin1 || r.country || '',
        country: r.country || cc,
        countryCode: cc,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone || 'auto',
        icaoCode: derivePseudoIcao(r.name, cc),
        elevationM: r.elevation,
      };
    });

    const seen = new Set(remote.map((r) => `${r.name}-${r.countryCode}`));
    const merged = [...remote];
    for (const loc of localMatches) {
      if (!seen.has(`${loc.name}-${loc.countryCode}`)) {
        merged.push(loc);
      }
    }
    return merged.slice(0, 8);
  } catch {
    return localMatches;
  }
}

async function fetchNwsAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
    const data = await fetchJsonWithTimeout<NwsAlertsResponse>(url, 3200, {
      Accept: 'application/geo+json',
    });
    if (!data.features || data.features.length === 0) return [];
    return data.features.slice(0, 5).map((f, idx) => {
      const p = f.properties ?? {};
      return {
        id: f.id || `nws-${idx}`,
        title: p.event || 'Weather Alert',
        severity: mapNwsSeverity(p.severity),
        source: 'NWS Official',
        area: p.areaDesc || 'Local Warning Zone',
        effective: p.effective || new Date().toISOString(),
        expires: p.expires || new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
        summary: p.headline || p.description?.slice(0, 220) || 'Official National Weather Service advisory in effect.',
        instruction: p.instruction?.slice(0, 220) || 'Monitor local conditions and follow official safety guidance.',
      };
    });
  } catch {
    return [];
  }
}

export async function fetchWeatherForLocation(location: WeatherLocation): Promise<WeatherBundle> {
  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    timezone: 'auto',
    forecast_days: '7',
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'dew_point_2m',
      'apparent_temperature',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'pressure_msl',
      'cloud_cover',
      'cloud_cover_low',
      'cloud_cover_mid',
      'cloud_cover_high',
      'visibility',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_speed_80m',
      'wind_direction_80m',
      'wind_speed_120m',
      'uv_index',
      'direct_radiation',
      'diffuse_radiation',
      'is_day',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'sunrise',
      'sunset',
      'uv_index_max',
      'precipitation_probability_max',
      'wind_speed_10m_max',
    ].join(','),
  });

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  try {
    const [forecastData, nwsAlerts] = await Promise.all([
      fetchJsonWithTimeout<OpenMeteoResponse>(forecastUrl, 4800),
      location.countryCode === 'US' ? fetchNwsAlerts(location.latitude, location.longitude) : Promise.resolve([]),
    ]);

    const cur = forecastData.current;
    const h = forecastData.hourly;

    // Find closest hourly index to current time for extra upper-air/optical fields
    let curHourIdx = 0;
    const curPrefix = cur.time.slice(0, 13);
    const matchedIdx = h.time.findIndex((t) => t.startsWith(curPrefix));
    if (matchedIdx >= 0) curHourIdx = matchedIdx;

    const dewPoint =
      h.dew_point_2m?.[curHourIdx] ?? calculateDewPoint(cur.temperature_2m, cur.relative_humidity_2m);

    const current: CurrentObservation = {
      time: cur.time,
      temperatureC: cur.temperature_2m,
      apparentTemperatureC: cur.apparent_temperature,
      humidityPct: cur.relative_humidity_2m,
      dewPointC: dewPoint,
      isDay: cur.is_day === 1,
      precipitationMm: cur.precipitation,
      weatherCode: cur.weather_code,
      cloudCoverPct: cur.cloud_cover,
      cloudCoverLowPct: h.cloud_cover_low?.[curHourIdx] ?? Math.round(cur.cloud_cover * 0.6),
      cloudCoverMidPct: h.cloud_cover_mid?.[curHourIdx] ?? Math.round(cur.cloud_cover * 0.4),
      cloudCoverHighPct: h.cloud_cover_high?.[curHourIdx] ?? Math.round(cur.cloud_cover * 0.25),
      pressureMslHpa: cur.pressure_msl,
      surfacePressureHpa: cur.surface_pressure,
      windSpeedKmh: cur.wind_speed_10m,
      windDirectionDeg: cur.wind_direction_10m,
      windGustsKmh: cur.wind_gusts_10m,
      windSpeed80mKmh: h.wind_speed_80m?.[curHourIdx] ?? cur.wind_speed_10m * 1.25,
      windDirection80mDeg: h.wind_direction_80m?.[curHourIdx] ?? cur.wind_direction_10m,
      windSpeed120mKmh: h.wind_speed_120m?.[curHourIdx] ?? cur.wind_speed_10m * 1.4,
      visibilityM: h.visibility?.[curHourIdx] ?? 16000,
      uvIndex: h.uv_index?.[curHourIdx] ?? 0,
      directRadiationWm2: h.direct_radiation?.[curHourIdx] ?? 0,
      diffuseRadiationWm2: h.diffuse_radiation?.[curHourIdx] ?? 0,
    };

    const hourlySliceEnd = Math.min(h.time.length, curHourIdx + 24);
    const hourly: HourlyForecastPoint[] = [];
    for (let i = curHourIdx; i < hourlySliceEnd; i++) {
      const tStr = h.time[i];
      const hhmm = tStr.slice(11, 16);
      hourly.push({
        time: tStr,
        hourLabel: i === curHourIdx ? 'Now' : hhmm,
        temperatureC: h.temperature_2m[i],
        apparentTemperatureC: h.apparent_temperature[i],
        dewPointC: h.dew_point_2m[i],
        humidityPct: h.relative_humidity_2m[i],
        precipitationProbPct: h.precipitation_probability[i] ?? 0,
        precipitationMm: h.precipitation[i] ?? 0,
        weatherCode: h.weather_code[i],
        pressureMslHpa: h.pressure_msl[i],
        cloudCoverPct: h.cloud_cover[i],
        cloudCoverLowPct: h.cloud_cover_low[i] ?? 0,
        cloudCoverMidPct: h.cloud_cover_mid[i] ?? 0,
        cloudCoverHighPct: h.cloud_cover_high[i] ?? 0,
        visibilityM: h.visibility[i] ?? 16000,
        windSpeedKmh: h.wind_speed_10m[i],
        windDirectionDeg: h.wind_direction_10m[i],
        windSpeed80mKmh: h.wind_speed_80m[i] ?? h.wind_speed_10m[i] * 1.25,
        windDirection80mDeg: h.wind_direction_80m[i] ?? h.wind_direction_10m[i],
        windSpeed120mKmh: h.wind_speed_120m[i] ?? h.wind_speed_10m[i] * 1.4,
        uvIndex: h.uv_index[i] ?? 0,
        directRadiationWm2: h.direct_radiation[i] ?? 0,
        diffuseRadiationWm2: h.diffuse_radiation[i] ?? 0,
        isDay: h.is_day[i] === 1,
      });
    }

    const d = forecastData.daily;
    const daily: DailyForecastPoint[] = d.time.map((dateStr, idx) => {
      const dt = new Date(`${dateStr}T12:00:00`);
      const label =
        idx === 0
          ? 'Today'
          : idx === 1
            ? 'Tomorrow'
            : dt.toLocaleDateString([], { weekday: 'short' });
      return {
        date: dateStr,
        dayLabel: label,
        weatherCode: d.weather_code[idx],
        tempMaxC: Math.round(d.temperature_2m_max[idx]),
        tempMinC: Math.round(d.temperature_2m_min[idx]),
        sunrise: d.sunrise[idx]?.slice(11, 16) ?? '06:30',
        sunset: d.sunset[idx]?.slice(11, 16) ?? '18:00',
        uvIndexMax: Number((d.uv_index_max[idx] ?? 0).toFixed(1)),
        precipProbMaxPct: d.precipitation_probability_max[idx] ?? 0,
        windSpeedMaxKmh: Math.round(d.wind_speed_10m_max[idx] ?? 0),
      };
    });

    const enrichedLocation: WeatherLocation = {
      ...location,
      timezone: forecastData.timezone || location.timezone,
      elevationM: forecastData.elevation ?? location.elevationM,
    };

    const alerts = evaluateLocationAlerts(enrichedLocation, current, nwsAlerts);

    return {
      location: enrichedLocation,
      current,
      hourly,
      daily,
      alerts,
      sourceMode: 'live',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return buildFallbackWeatherBundle(location);
  }
}
