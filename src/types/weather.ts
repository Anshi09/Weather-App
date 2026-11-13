export type TemperatureUnit = 'C' | 'F';

export type WeatherCategory =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow';

export interface WeatherLocation {
  id: string;
  name: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  icaoCode: string;
  elevationM?: number;
}

export interface CurrentObservation {
  time: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPct: number;
  dewPointC: number;
  isDay: boolean;
  precipitationMm: number;
  weatherCode: number;
  cloudCoverPct: number;
  cloudCoverLowPct: number;
  cloudCoverMidPct: number;
  cloudCoverHighPct: number;
  pressureMslHpa: number;
  surfacePressureHpa: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windGustsKmh: number;
  windSpeed80mKmh: number;
  windDirection80mDeg: number;
  windSpeed120mKmh: number;
  visibilityM: number;
  uvIndex: number;
  directRadiationWm2: number;
  diffuseRadiationWm2: number;
}

export interface HourlyForecastPoint {
  time: string;
  hourLabel: string;
  temperatureC: number;
  apparentTemperatureC: number;
  dewPointC: number;
  humidityPct: number;
  precipitationProbPct: number;
  precipitationMm: number;
  weatherCode: number;
  pressureMslHpa: number;
  cloudCoverPct: number;
  cloudCoverLowPct: number;
  cloudCoverMidPct: number;
  cloudCoverHighPct: number;
  visibilityM: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windSpeed80mKmh: number;
  windDirection80mDeg: number;
  windSpeed120mKmh: number;
  uvIndex: number;
  directRadiationWm2: number;
  diffuseRadiationWm2: number;
  isDay: boolean;
}

export interface DailyForecastPoint {
  date: string;
  dayLabel: string;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  precipProbMaxPct: number;
  windSpeedMaxKmh: number;
}

export type AlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Advisory';

export interface WeatherAlert {
  id: string;
  title: string;
  severity: AlertSeverity;
  source: 'NWS Official' | 'Meteorological Sensor';
  area: string;
  effective: string;
  expires: string;
  summary: string;
  instruction: string;
}

export interface CloudStratumReport {
  coverageCode: 'CLR' | 'FEW' | 'SCT' | 'BKN' | 'OVC';
  coverageLabel: string;
  baseAltitudeFt: number;
  baseAltitudeM: number;
  layerName: 'Low' | 'Mid' | 'High';
  densityPct: number;
}

export interface MetarSensorReport {
  rawMetar: string;
  stationIcao: string;
  observationTimeUtc: string;
  windSummary: string;
  visibilityKm: number;
  visibilitySm: number;
  tempDewSummary: string;
  altimeterInHg: number;
  pressureHpa: number;
  ceilingFt: number | null;
  cloudLayers: CloudStratumReport[];
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
}

export interface AtmosphericLayer {
  id: string;
  name: string;
  altitudeRangeM: [number, number];
  midpointM: number;
  pressureHpa: number;
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  cloudDensityPct: number;
  opticalExtinction: number;
  description: string;
}

export interface AtmosphericProbeSample {
  altitudeM: number;
  altitudeFt: number;
  pressureHpa: number;
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  cloudDensityPct: number;
  layerName: string;
}

export type SkySimulationMode =
  | 'live'
  | 'marine-fog'
  | 'squall-line'
  | 'clear-high';

export interface WeatherBundle {
  location: WeatherLocation;
  current: CurrentObservation;
  hourly: HourlyForecastPoint[];
  daily: DailyForecastPoint[];
  alerts: WeatherAlert[];
  sourceMode: 'live' | 'cached';
  fetchedAt: string;
}
