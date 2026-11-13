import type {
  AlertSeverity,
  AtmosphericLayer,
  AtmosphericProbeSample,
  CloudStratumReport,
  CurrentObservation,
  MetarSensorReport,
  SkySimulationMode,
  TemperatureUnit,
  WeatherAlert,
  WeatherCategory,
  WeatherLocation,
} from '../types/weather';

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function formatTemperature(c: number, unit: TemperatureUnit, decimals = 0): string {
  const val = unit === 'F' ? celsiusToFahrenheit(c) : c;
  return `${val.toFixed(decimals)}°`;
}

export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

export function kmhToKnots(kmh: number): number {
  return kmh * 0.539957;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

export function hpaToInHg(hpa: number): number {
  return hpa * 0.029529983;
}

export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export function formatCompassDirection(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const idx = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[idx];
}

/**
 * Magnus formula approximation for dew point (°C)
 */
export function calculateDewPoint(tempC: number, humidityPct: number): number {
  const clampedRh = Math.max(1, Math.min(100, humidityPct));
  const a = 17.625;
  const b = 243.04;
  const alpha = Math.log(clampedRh / 100) + (a * tempC) / (b + tempC);
  return (b * alpha) / (a - alpha);
}

/**
 * Espy's equation for Lifting Condensation Level (cloud base altitude in meters AGL).
 * LCL ≈ 125 * (T - Td) meters
 */
export function calculateLiftingCondensationLevelM(
  tempC: number,
  dewPointC: number
): number {
  const spread = Math.max(0.8, tempC - dewPointC);
  return Math.round(Math.min(4200, Math.max(120, 125 * spread)));
}

export interface DecodedCondition {
  label: string;
  shortLabel: string;
  category: WeatherCategory;
  metarWeatherToken: string;
}

export function decodeWmoCondition(code: number, isDay: boolean): DecodedCondition {
  if (code === 0) {
    return {
      label: isDay ? 'Clear Sky' : 'Clear Night',
      shortLabel: 'Clear',
      category: 'clear',
      metarWeatherToken: '',
    };
  }
  if (code === 1 || code === 2) {
    return {
      label: code === 1 ? 'Mainly Clear' : 'Partly Cloudy',
      shortLabel: 'Partly Cloudy',
      category: 'partly-cloudy',
      metarWeatherToken: '',
    };
  }
  if (code === 3) {
    return {
      label: 'Overcast',
      shortLabel: 'Overcast',
      category: 'cloudy',
      metarWeatherToken: '',
    };
  }
  if (code === 45 || code === 48) {
    return {
      label: code === 48 ? 'Depositing Rime Fog' : 'Dense Fog',
      shortLabel: 'Fog',
      category: 'fog',
      metarWeatherToken: 'FG',
    };
  }
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const heavy = code === 65 || code === 82 || code === 67;
    const drizzle = code >= 51 && code <= 57;
    return {
      label: drizzle ? 'Light Drizzle' : heavy ? 'Heavy Rain' : 'Rain Showers',
      shortLabel: drizzle ? 'Drizzle' : heavy ? 'Heavy Rain' : 'Rain',
      category: 'rain',
      metarWeatherToken: drizzle ? '-DZ' : heavy ? '+RA' : 'RA',
    };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    const heavy = code === 75 || code === 86;
    return {
      label: heavy ? 'Heavy Snow' : 'Snow Showers',
      shortLabel: 'Snow',
      category: 'snow',
      metarWeatherToken: heavy ? '+SN' : 'SN',
    };
  }
  if (code >= 95) {
    return {
      label: code >= 96 ? 'Severe Thunderstorm' : 'Thunderstorm',
      shortLabel: 'Storm',
      category: 'storm',
      metarWeatherToken: 'TSRA',
    };
  }
  return {
    label: 'Variable Cloud',
    shortLabel: 'Cloudy',
    category: 'partly-cloudy',
    metarWeatherToken: '',
  };
}

function coverageToMetarCode(pct: number): 'CLR' | 'FEW' | 'SCT' | 'BKN' | 'OVC' {
  if (pct < 8) return 'CLR';
  if (pct <= 25) return 'FEW';
  if (pct <= 50) return 'SCT';
  if (pct <= 87) return 'BKN';
  return 'OVC';
}

function coverageCodeLabel(code: CloudStratumReport['coverageCode']): string {
  switch (code) {
    case 'CLR':
      return 'Clear';
    case 'FEW':
      return 'Few Clouds';
    case 'SCT':
      return 'Scattered';
    case 'BKN':
      return 'Broken';
    case 'OVC':
      return 'Overcast';
  }
}

function formatMetarTemp(tempC: number): string {
  const rounded = Math.round(tempC);
  const abs = Math.abs(rounded).toString().padStart(2, '0');
  return rounded < 0 ? `M${abs}` : abs;
}

/**
 * Synthesizes an authentic ICAO METAR sensor report and structured sky layers
 * directly from live meteorological telemetry.
 */
export function generateMetarReport(
  stationIcao: string,
  obs: CurrentObservation
): MetarSensorReport {
  const icao = (stationIcao || 'KOBS').toUpperCase().slice(0, 4);
  const dateObj = new Date(obs.time || Date.now());
  const validDate = Number.isNaN(dateObj.getTime()) ? new Date() : dateObj;
  const day = String(validDate.getUTCDate()).padStart(2, '0');
  const hh = String(validDate.getUTCHours()).padStart(2, '0');
  const mm = String(validDate.getUTCMinutes()).padStart(2, '0');
  const obsTimeToken = `${day}${hh}${mm}Z`;

  const windDir = Math.round(((obs.windDirectionDeg % 360) + 360) % 360 / 10) * 10;
  const windDirStr = windDir === 0 && obs.windSpeedKmh < 3 ? '000' : String(windDir === 0 ? 360 : windDir).padStart(3, '0');
  const windKt = Math.round(kmhToKnots(obs.windSpeedKmh));
  const gustKt = Math.round(kmhToKnots(obs.windGustsKmh));
  const windToken =
    gustKt > windKt + 4
      ? `${windDirStr}${String(windKt).padStart(2, '0')}G${String(gustKt).padStart(2, '0')}KT`
      : `${windDirStr}${String(windKt).padStart(2, '0')}KT`;

  const visSm = Math.min(10, Math.max(0.25, metersToMiles(obs.visibilityM)));
  const visToken =
    visSm >= 10
      ? '10SM'
      : visSm >= 1
        ? `${Math.round(visSm)}SM`
        : visSm >= 0.5
          ? '1/2SM'
          : '1/4SM';

  const decodedCond = decodeWmoCondition(obs.weatherCode, obs.isDay);
  const lclM = calculateLiftingCondensationLevelM(obs.temperatureC, obs.dewPointC);
  const lclFt = Math.round(metersToFeet(lclM) / 100) * 100;

  const cloudLayers: CloudStratumReport[] = [];
  const layersInput: Array<{
    layerName: 'Low' | 'Mid' | 'High';
    pct: number;
    baseM: number;
  }> = [
    { layerName: 'Low', pct: obs.cloudCoverLowPct, baseM: lclM },
    { layerName: 'Mid', pct: obs.cloudCoverMidPct, baseM: Math.max(lclM + 1400, 3200) },
    { layerName: 'High', pct: obs.cloudCoverHighPct, baseM: 7600 },
  ];

  for (const item of layersInput) {
    const code = coverageToMetarCode(item.pct);
    if (code !== 'CLR') {
      const baseFt = Math.max(300, Math.round(metersToFeet(item.baseM) / 100) * 100);
      cloudLayers.push({
        coverageCode: code,
        coverageLabel: coverageCodeLabel(code),
        baseAltitudeFt: baseFt,
        baseAltitudeM: Math.round(item.baseM),
        layerName: item.layerName,
        densityPct: Math.round(item.pct),
      });
    }
  }

  const skyTokens =
    cloudLayers.length > 0
      ? cloudLayers
          .map((l) => `${l.coverageCode}${String(Math.round(l.baseAltitudeFt / 100)).padStart(3, '0')}`)
          .join(' ')
      : 'CLR';

  const ceilingLayer = cloudLayers.find(
    (l) => l.coverageCode === 'BKN' || l.coverageCode === 'OVC'
  );
  const ceilingFt = ceilingLayer ? ceilingLayer.baseAltitudeFt : null;

  let flightCategory: MetarSensorReport['flightCategory'] = 'VFR';
  if ((ceilingFt !== null && ceilingFt < 500) || visSm < 1) {
    flightCategory = 'LIFR';
  } else if ((ceilingFt !== null && ceilingFt < 1000) || visSm < 3) {
    flightCategory = 'IFR';
  } else if ((ceilingFt !== null && ceilingFt <= 3000) || visSm <= 5) {
    flightCategory = 'MVFR';
  }

  const tempDewToken = `${formatMetarTemp(obs.temperatureC)}/${formatMetarTemp(obs.dewPointC)}`;
  const altimeterInHg = Number(hpaToInHg(obs.pressureMslHpa).toFixed(2));
  const altimeterToken = `A${Math.round(altimeterInHg * 100)
    .toString()
    .padStart(4, '0')}`;
  const slpTenths = Math.round((obs.pressureMslHpa - 1000) * 10);
  const slpDigits = (((slpTenths % 1000) + 1000) % 1000).toString().padStart(3, '0');

  const parts = [
    icao,
    obsTimeToken,
    windToken,
    visToken,
    decodedCond.metarWeatherToken,
    skyTokens,
    tempDewToken,
    altimeterToken,
    `RMK AO2 SLP${slpDigits}`,
  ].filter(Boolean);

  return {
    rawMetar: parts.join(' '),
    stationIcao: icao,
    observationTimeUtc: `${hh}:${mm} UTC`,
    windSummary: `${formatCompassDirection(obs.windDirectionDeg)} (${Math.round(obs.windDirectionDeg)}°) at ${windKt} kt`,
    visibilityKm: Number((obs.visibilityM / 1000).toFixed(1)),
    visibilitySm: Number(visSm.toFixed(1)),
    tempDewSummary: `${Math.round(obs.temperatureC)}°C / ${Math.round(obs.dewPointC)}°C`,
    altimeterInHg,
    pressureHpa: Math.round(obs.pressureMslHpa),
    ceilingFt: ceilingFt ?? (obs.cloudCoverPct > 60 ? lclFt : null),
    cloudLayers,
    flightCategory,
  };
}

/**
 * Builds a 4-layer vertical atmospheric sounding profile from surface to 12 km.
 */
export function buildAtmosphericLayers(obs: CurrentObservation): AtmosphericLayer[] {
  const lclM = calculateLiftingCondensationLevelM(obs.temperatureC, obs.dewPointC);
  const lowTop = Math.max(2200, lclM + 1100);
  const lapseRate = obs.humidityPct > 75 ? 5.6 : 6.5; // °C per km (moist vs dry lapse)

  const tempAt = (altM: number) =>
    Number((obs.temperatureC - (altM / 1000) * lapseRate).toFixed(1));
  const pressureAt = (altM: number) =>
    Math.round(obs.pressureMslHpa * Math.pow(1 - (0.0065 * altM) / 288.15, 5.255));

  const visKm = Math.max(0.4, obs.visibilityM / 1000);
  const surfaceExtinction = Number(Math.min(1, 3.912 / visKm / 2).toFixed(2));

  return [
    {
      id: 'surface',
      name: 'Surface Boundary Layer',
      altitudeRangeM: [0, 350],
      midpointM: 150,
      pressureHpa: Math.round(obs.surfacePressureHpa || obs.pressureMslHpa),
      temperatureC: Number(obs.temperatureC.toFixed(1)),
      windSpeedKmh: Math.round(obs.windSpeedKmh),
      windDirectionDeg: Math.round(obs.windDirectionDeg),
      cloudDensityPct: obs.weatherCode === 45 || obs.weatherCode === 48 ? 85 : Math.round(obs.cloudCoverLowPct * 0.2),
      opticalExtinction: surfaceExtinction,
      description: `Surface wind ${formatCompassDirection(obs.windDirectionDeg)} ${Math.round(obs.windSpeedKmh)} km/h, RH ${Math.round(obs.humidityPct)}%, visibility ${visKm.toFixed(1)} km.`,
    },
    {
      id: 'low-cloud',
      name: 'Low Troposphere / LCL Deck',
      altitudeRangeM: [350, lowTop],
      midpointM: Math.round((350 + lowTop) / 2),
      pressureHpa: pressureAt(1200),
      temperatureC: tempAt(1200),
      windSpeedKmh: Math.round(obs.windSpeed80mKmh || obs.windSpeedKmh * 1.25),
      windDirectionDeg: Math.round(obs.windDirection80mDeg ?? obs.windDirectionDeg),
      cloudDensityPct: Math.round(obs.cloudCoverLowPct),
      opticalExtinction: Number((obs.cloudCoverLowPct / 100 * 0.7 + surfaceExtinction * 0.3).toFixed(2)),
      description: `Lifting condensation base near ${lclM} m (${Math.round(metersToFeet(lclM))} ft). Low cloud fraction ${Math.round(obs.cloudCoverLowPct)}%.`,
    },
    {
      id: 'mid-tropo',
      name: 'Mid-Tropospheric Column',
      altitudeRangeM: [lowTop, 6200],
      midpointM: Math.round((lowTop + 6200) / 2),
      pressureHpa: pressureAt(4200),
      temperatureC: tempAt(4200),
      windSpeedKmh: Math.round(obs.windSpeed120mKmh ? obs.windSpeed120mKmh * 1.45 : obs.windSpeedKmh * 1.75),
      windDirectionDeg: Math.round((obs.windDirection80mDeg + 15) % 360),
      cloudDensityPct: Math.round(obs.cloudCoverMidPct),
      opticalExtinction: Number((obs.cloudCoverMidPct / 100 * 0.5).toFixed(2)),
      description: `Altostratus / mid-level moisture zone with ${Math.round(obs.cloudCoverMidPct)}% sky cover and veering shear.`,
    },
    {
      id: 'upper-tropo',
      name: 'Upper Troposphere / Jet',
      altitudeRangeM: [6200, 12000],
      midpointM: 9000,
      pressureHpa: pressureAt(9000),
      temperatureC: tempAt(9000),
      windSpeedKmh: Math.round((obs.windSpeed120mKmh || obs.windSpeedKmh * 1.4) * 2.4),
      windDirectionDeg: Math.round((obs.windDirectionDeg + 30) % 360),
      cloudDensityPct: Math.round(obs.cloudCoverHighPct),
      opticalExtinction: Number((obs.cloudCoverHighPct / 100 * 0.25).toFixed(2)),
      description: `High-altitude ice-crystal cirrus deck (${Math.round(obs.cloudCoverHighPct)}% cover) beneath tropopause.`,
    },
  ];
}

/**
 * Samples continuous atmospheric state at an arbitrary altitude (0 - 12,000 m)
 * for interactive cursor probing inside the Sky Visualizer.
 */
export function sampleAtmosphereAtAltitude(
  obs: CurrentObservation,
  altitudeM: number
): AtmosphericProbeSample {
  const clampedAlt = Math.max(0, Math.min(12000, altitudeM));
  const layers = buildAtmosphericLayers(obs);
  const matching =
    layers.find(
      (l) => clampedAlt >= l.altitudeRangeM[0] && clampedAlt <= l.altitudeRangeM[1]
    ) ?? layers[layers.length - 1];

  const lapseRate = obs.humidityPct > 75 ? 5.6 : 6.5;
  const temperatureC = Number((obs.temperatureC - (clampedAlt / 1000) * lapseRate).toFixed(1));
  const pressureHpa = Math.round(
    obs.pressureMslHpa * Math.pow(1 - (0.0065 * clampedAlt) / 288.15, 5.255)
  );
  const windFactor = 1 + (clampedAlt / 12000) * 2.1;
  const windSpeedKmh = Math.round(obs.windSpeedKmh * windFactor);
  const windDirectionDeg = Math.round((obs.windDirectionDeg + (clampedAlt / 12000) * 32) % 360);

  return {
    altitudeM: Math.round(clampedAlt),
    altitudeFt: Math.round(metersToFeet(clampedAlt)),
    pressureHpa,
    temperatureC,
    windSpeedKmh,
    windDirectionDeg,
    cloudDensityPct: matching.cloudDensityPct,
    layerName: matching.name,
  };
}

/**
 * Applies an interactive sky simulation preset onto live observations so users can
 * explore how distinct METAR sensor regimes alter the sky physics.
 */
export function applySkySimulationMode(
  obs: CurrentObservation,
  mode: SkySimulationMode
): CurrentObservation {
  if (mode === 'live') return obs;
  if (mode === 'marine-fog') {
    const tempC = Math.min(obs.temperatureC, 12);
    return {
      ...obs,
      temperatureC: tempC,
      dewPointC: tempC - 0.6,
      humidityPct: 97,
      weatherCode: 45,
      cloudCoverPct: 96,
      cloudCoverLowPct: 94,
      cloudCoverMidPct: 35,
      cloudCoverHighPct: 10,
      visibilityM: 450,
      windSpeedKmh: 16,
      windGustsKmh: 22,
      directRadiationWm2: 65,
      diffuseRadiationWm2: 180,
      precipitationMm: 0.1,
    };
  }
  if (mode === 'squall-line') {
    return {
      ...obs,
      weatherCode: 96,
      cloudCoverPct: 98,
      cloudCoverLowPct: 88,
      cloudCoverMidPct: 94,
      cloudCoverHighPct: 85,
      humidityPct: 91,
      dewPointC: obs.temperatureC - 1.5,
      precipitationMm: 14.2,
      windSpeedKmh: 58,
      windGustsKmh: 88,
      windSpeed80mKmh: 76,
      windSpeed120mKmh: 92,
      pressureMslHpa: Math.min(obs.pressureMslHpa, 994),
      visibilityM: 2100,
      directRadiationWm2: 20,
      diffuseRadiationWm2: 110,
    };
  }
  // clear-high
  return {
    ...obs,
    weatherCode: 0,
    cloudCoverPct: 6,
    cloudCoverLowPct: 2,
    cloudCoverMidPct: 4,
    cloudCoverHighPct: 8,
    humidityPct: 42,
    dewPointC: obs.temperatureC - 11,
    precipitationMm: 0,
    visibilityM: 24000,
    pressureMslHpa: Math.max(obs.pressureMslHpa, 1026),
    windSpeedKmh: 12,
    windGustsKmh: 18,
    directRadiationWm2: obs.isDay ? 780 : 0,
    diffuseRadiationWm2: obs.isDay ? 140 : 0,
  };
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Advisory: 1,
};

/**
 * Combines official external NWS alerts with real-time meteorological sensor advisories
 * derived from visibility, wind gusts, thunderstorms, precipitation, and UV readings.
 */
export function evaluateLocationAlerts(
  location: WeatherLocation,
  current: CurrentObservation,
  externalAlerts: WeatherAlert[] = []
): WeatherAlert[] {
  const derived: WeatherAlert[] = [];
  const areaLabel = `${location.name}, ${location.region || location.countryCode}`;
  const effectiveIso = current.time || new Date().toISOString();
  const expiresIso = new Date(
    (new Date(effectiveIso).getTime() || Date.now()) + 6 * 3600 * 1000
  ).toISOString();

  if (current.weatherCode >= 95) {
    derived.push({
      id: `sensor-storm-${location.id}`,
      title: 'Convective Thunderstorm Cell Detected',
      severity: 'Severe',
      source: 'Meteorological Sensor',
      area: areaLabel,
      effective: effectiveIso,
      expires: expiresIso,
      summary: `Live telemetry reports active convective storm code (WMO ${current.weatherCode}) with wind gusts up to ${Math.round(current.windGustsKmh)} km/h and pressure ${Math.round(current.pressureMslHpa)} hPa.`,
      instruction: 'Seek sturdy indoor shelter, avoid open elevated terrain, and monitor rapid barometric drops.',
    });
  }

  if (current.windGustsKmh >= 50) {
    derived.push({
      id: `sensor-wind-${location.id}`,
      title: current.windGustsKmh >= 75 ? 'High Wind Warning' : 'Strong Gust Wind Advisory',
      severity: current.windGustsKmh >= 75 ? 'Severe' : 'Moderate',
      source: 'Meteorological Sensor',
      area: areaLabel,
      effective: effectiveIso,
      expires: expiresIso,
      summary: `Surface anemometer gusts reached ${Math.round(current.windGustsKmh)} km/h (${Math.round(kmhToMph(current.windGustsKmh))} mph) from ${formatCompassDirection(current.windDirectionDeg)}.`,
      instruction: 'Secure loose outdoor equipment and use caution for high-profile vehicles on exposed corridors.',
    });
  }

  if (current.visibilityM <= 1500) {
    derived.push({
      id: `sensor-vis-${location.id}`,
      title: 'Low Visibility / Dense Fog Advisory',
      severity: current.visibilityM <= 500 ? 'Moderate' : 'Advisory',
      source: 'Meteorological Sensor',
      area: areaLabel,
      effective: effectiveIso,
      expires: expiresIso,
      summary: `Horizontal optical visibility dropped to ${(current.visibilityM / 1000).toFixed(2)} km (${metersToMiles(current.visibilityM).toFixed(1)} mi) with ${Math.round(current.humidityPct)}% relative humidity.`,
      instruction: 'Allow extra travel distance, use low-beam headlights, and expect reduced VFR flight minimums.',
    });
  }

  if (current.precipitationMm >= 7.5) {
    derived.push({
      id: `sensor-rain-${location.id}`,
      title: 'Heavy Precipitation Rate Alert',
      severity: 'Moderate',
      source: 'Meteorological Sensor',
      area: areaLabel,
      effective: effectiveIso,
      expires: expiresIso,
      summary: `Gauge precipitation rate measured at ${current.precipitationMm.toFixed(1)} mm/h.`,
      instruction: 'Watch for localized street ponding and reduced road traction.',
    });
  }

  if (current.uvIndex >= 8 && current.isDay) {
    derived.push({
      id: `sensor-uv-${location.id}`,
      title: 'Very High UV Irradiance Advisory',
      severity: 'Advisory',
      source: 'Meteorological Sensor',
      area: areaLabel,
      effective: effectiveIso,
      expires: expiresIso,
      summary: `Solar UV index measured at ${current.uvIndex.toFixed(1)} with ${Math.round(current.directRadiationWm2)} W/m² direct irradiance.`,
      instruction: 'Minimize direct sun exposure between 10:00 and 16:00 local time and wear SPF 30+ protection.',
    });
  }

  const combined = [...externalAlerts, ...derived];
  const seenTitles = new Set<string>();
  const deduped = combined.filter((a) => {
    const key = a.title.toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  return deduped.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}
