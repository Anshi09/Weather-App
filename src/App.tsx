import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CurrentObservation,
  TemperatureUnit,
  WeatherBundle,
  WeatherLocation,
} from './types/weather';
import { buildFallbackWeatherBundle, PRESET_LOCATIONS } from './data/presets';
import { fetchWeatherForLocation } from './services/weatherApi';
import { decodeWmoCondition } from './utils/atmosphere';
import { TopBar } from './components/TopBar';
import { WeatherBackdropCanvas } from './components/WeatherBackdropCanvas';
import { CurrentHeroSection } from './components/CurrentHeroSection';
import { AlertsBanner } from './components/AlertsBanner';
import { HourlyForecastWidget } from './components/HourlyForecastWidget';
import { InteractiveSkyVisualizer } from './components/InteractiveSkyVisualizer';
import { SevenDayOutlook } from './components/SevenDayOutlook';
import { LocationSearchDialog } from './components/LocationSearchDialog';

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation>(
    PRESET_LOCATIONS[0]
  );
  const [bundle, setBundle] = useState<WeatherBundle>(() =>
    buildFallbackWeatherBundle(PRESET_LOCATIONS[0])
  );
  const [unit, setUnit] = useState<TemperatureUnit>('C');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(0);
  const [projectedHourIdx, setProjectedHourIdx] = useState<number | null>(null);

  const loadStation = useCallback(async (loc: WeatherLocation) => {
    setLoading(true);
    setSelectedHourIdx(0);
    setProjectedHourIdx(null);
    const result = await fetchWeatherForLocation(loc);
    setBundle(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStation(selectedLocation);
  }, [selectedLocation, loadStation]);

  const handleSelectLocation = (loc: WeatherLocation) => {
    setSelectedLocation(loc);
  };

  // Observation driving the Interactive Sky Visualizer (either live current or projected hourly slice)
  const skyObservation: CurrentObservation = useMemo(() => {
    if (projectedHourIdx === null || !bundle.hourly[projectedHourIdx]) {
      return bundle.current;
    }
    const h = bundle.hourly[projectedHourIdx];
    return {
      time: h.time,
      temperatureC: h.temperatureC,
      apparentTemperatureC: h.apparentTemperatureC,
      humidityPct: h.humidityPct,
      dewPointC: h.dewPointC,
      isDay: h.isDay,
      precipitationMm: h.precipitationMm,
      weatherCode: h.weatherCode,
      cloudCoverPct: h.cloudCoverPct,
      cloudCoverLowPct: h.cloudCoverLowPct,
      cloudCoverMidPct: h.cloudCoverMidPct,
      cloudCoverHighPct: h.cloudCoverHighPct,
      pressureMslHpa: h.pressureMslHpa,
      surfacePressureHpa: h.pressureMslHpa - 2,
      windSpeedKmh: h.windSpeedKmh,
      windDirectionDeg: h.windDirectionDeg,
      windGustsKmh: Math.round(h.windSpeedKmh * 1.35),
      windSpeed80mKmh: h.windSpeed80mKmh,
      windDirection80mDeg: h.windDirection80mDeg,
      windSpeed120mKmh: h.windSpeed120mKmh,
      visibilityM: h.visibilityM,
      uvIndex: h.uvIndex,
      directRadiationWm2: h.directRadiationWm2,
      diffuseRadiationWm2: h.diffuseRadiationWm2,
    };
  }, [bundle.current, bundle.hourly, projectedHourIdx]);

  const backdropCondition = decodeWmoCondition(
    skyObservation.weatherCode,
    skyObservation.isDay
  );

  const projectedHourLabel =
    projectedHourIdx !== null && bundle.hourly[projectedHourIdx]
      ? bundle.hourly[projectedHourIdx].hourLabel
      : null;

  return (
    <div className="relative min-h-screen text-slate-100">
      {/* Live Animated Weather Conditions Backdrop */}
      <WeatherBackdropCanvas
        category={backdropCondition.category}
        isDay={skyObservation.isDay}
        windSpeedKmh={skyObservation.windSpeedKmh}
        cloudCoverPct={skyObservation.cloudCoverPct}
      />

      {/* Measured contrast scrim for guaranteed text legibility */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#080C14]/55 via-[#080C14]/45 to-[#080C14]/85"
      />

      <TopBar onOpenLocationSearch={() => setSearchOpen(true)} />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        <CurrentHeroSection
          location={bundle.location}
          current={bundle.current}
          unit={unit}
          onChangeUnit={setUnit}
          onSelectPreset={handleSelectLocation}
          onRefresh={() => void loadStation(selectedLocation)}
          loading={loading}
          sourceMode={bundle.sourceMode}
        />

        <AlertsBanner locationName={bundle.location.name} alerts={bundle.alerts} />

        <HourlyForecastWidget
          hourly={bundle.hourly}
          selectedIndex={selectedHourIdx}
          onSelectHour={(idx) => setSelectedHourIdx(idx)}
          unit={unit}
          onInspectInSky={(idx) => {
            setProjectedHourIdx(idx);
            document.getElementById('sky-sensor')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <InteractiveSkyVisualizer
          location={bundle.location}
          observation={skyObservation}
          unit={unit}
          projectedHourLabel={projectedHourLabel}
          onResetProjectedHour={() => setProjectedHourIdx(null)}
        />

        <SevenDayOutlook daily={bundle.daily} unit={unit} />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-xs text-slate-400 sm:px-6">
        <div className="flex flex-col justify-between gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
          <span>Stratum Weather Observatory</span>
          <span>
            Live meteorological data via Open-Meteo &amp; National Weather Service · Updated{' '}
            {new Date(bundle.fetchedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </footer>

      <LocationSearchDialog
        open={searchOpen}
        currentLocation={selectedLocation}
        onClose={() => setSearchOpen(false)}
        onSelectLocation={handleSelectLocation}
      />
    </div>
  );
}
