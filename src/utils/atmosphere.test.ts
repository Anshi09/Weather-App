import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySkySimulationMode,
  buildAtmosphericLayers,
  calculateDewPoint,
  calculateLiftingCondensationLevelM,
  decodeWmoCondition,
  evaluateLocationAlerts,
  formatCompassDirection,
  generateMetarReport,
  sampleAtmosphereAtAltitude,
} from './atmosphere';
import type { CurrentObservation, WeatherLocation } from '../types/weather';

const sampleLocation: WeatherLocation = {
  id: 'ksfo',
  name: 'San Francisco',
  region: 'California',
  country: 'United States',
  countryCode: 'US',
  latitude: 37.7749,
  longitude: -122.4194,
  timezone: 'America/Los_Angeles',
  icaoCode: 'KSFO',
};

const sampleObs: CurrentObservation = {
  time: '2026-11-13T16:56:00Z',
  temperatureC: 15,
  apparentTemperatureC: 14,
  humidityPct: 72,
  dewPointC: 10,
  isDay: true,
  precipitationMm: 0,
  weatherCode: 2,
  cloudCoverPct: 48,
  cloudCoverLowPct: 38,
  cloudCoverMidPct: 22,
  cloudCoverHighPct: 12,
  pressureMslHpa: 1017,
  surfacePressureHpa: 1015,
  windSpeedKmh: 24,
  windDirectionDeg: 290,
  windGustsKmh: 37,
  windSpeed80mKmh: 31,
  windDirection80mDeg: 300,
  windSpeed120mKmh: 36,
  visibilityM: 16093,
  uvIndex: 4.2,
  directRadiationWm2: 460,
  diffuseRadiationWm2: 145,
};

test('formatCompassDirection maps azimuth degrees accurately', () => {
  assert.equal(formatCompassDirection(0), 'N');
  assert.equal(formatCompassDirection(360), 'N');
  assert.equal(formatCompassDirection(90), 'E');
  assert.equal(formatCompassDirection(225), 'SW');
  assert.equal(formatCompassDirection(290), 'WNW');
  assert.equal(formatCompassDirection(-45), 'NW');
});

test('calculateDewPoint and LCL produce physically consistent cloud base', () => {
  const td = calculateDewPoint(20, 50);
  assert.ok(td > 8 && td < 11, `Expected dew point around 9.3°C, got ${td}`);
  const lcl = calculateLiftingCondensationLevelM(20, td);
  assert.ok(lcl > 1100 && lcl < 1500, `Expected LCL around 1330m, got ${lcl}`);
});

test('generateMetarReport formats valid ICAO METAR string and cloud strata', () => {
  const report = generateMetarReport('KSFO', sampleObs);
  assert.ok(report.rawMetar.startsWith('KSFO 131656Z'));
  assert.ok(report.rawMetar.includes('29013G20KT'));
  assert.ok(report.rawMetar.includes('10SM'));
  assert.ok(report.rawMetar.includes('15/10'));
  assert.equal(report.flightCategory, 'VFR');
  assert.equal(report.cloudLayers.length, 3);
  assert.equal(report.cloudLayers[0].coverageCode, 'SCT');
});

test('buildAtmosphericLayers and sampleAtmosphereAtAltitude produce monotonic lapse & pressure drop', () => {
  const layers = buildAtmosphericLayers(sampleObs);
  assert.equal(layers.length, 4);
  assert.ok(layers[0].pressureHpa > layers[3].pressureHpa);
  assert.ok(layers[0].temperatureC > layers[3].temperatureC);

  const surfaceSample = sampleAtmosphereAtAltitude(sampleObs, 0);
  const highSample = sampleAtmosphereAtAltitude(sampleObs, 9000);
  assert.ok(surfaceSample.pressureHpa > highSample.pressureHpa);
  assert.ok(surfaceSample.temperatureC > highSample.temperatureC);
  assert.ok(highSample.windSpeedKmh > surfaceSample.windSpeedKmh);
});

test('applySkySimulationMode squall-line triggers severe sensor alerts', () => {
  const squallObs = applySkySimulationMode(sampleObs, 'squall-line');
  const decoded = decodeWmoCondition(squallObs.weatherCode, true);
  assert.equal(decoded.category, 'storm');

  const alerts = evaluateLocationAlerts(sampleLocation, squallObs);
  assert.ok(alerts.length >= 2);
  assert.equal(alerts[0].severity, 'Severe');
  assert.ok(alerts.some((a) => a.title.includes('Thunderstorm')));
  assert.ok(alerts.some((a) => a.title.includes('Wind')));
});
