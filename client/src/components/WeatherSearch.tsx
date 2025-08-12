import { useEffect, useMemo, useState } from 'react';
import { createRecord, currentWeather, forecast5, geocode, reverseGeocode } from '../api';
import MapView from './MapView';
import YouTubeSearch from './YouTubeSearch';
import type { DailySummary } from '../types';

const weatherCodeToEmoji: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌦️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 77: '❄️', 80: '🌧️', 81: '🌧️', 82: '⛈️', 85: '🌨️', 86: '❄️', 95: '⛈️', 96: '⛈️', 97: '⛈️',
};

function ForecastCards({ daily }: { daily: DailySummary[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
      {daily.map((d) => (
        <div key={d.date} style={{ border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
          <div style={{ fontWeight: 600 }}>{d.date}</div>
          <div style={{ fontSize: 24 }}>{d.icon}</div>
          <div>{d.tmin ?? '–'}°C / {d.tmax ?? '–'}°C</div>
        </div>
      ))}
    </div>
  );
}

export default function WeatherSearch() {
  const [input, setInput] = useState('');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().slice(0, 10);
  });

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [name, setName] = useState<string>('');
  const [current, setCurrent] = useState<any | null>(null);
  const [forecast, setForecast] = useState<any | null>(null);
  const [forecastDaily, setForecastDaily] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<number | null>(null);

  const canSave = useMemo(() => lat !== null && lon !== null && startDate && endDate, [lat, lon, startDate, endDate]);

  const doGeocode = async () => {
    setError(null);
    try {
      const g = await geocode(input);
      setLat(g.lat); setLon(g.lon); setName(g.name);
      return g;
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Geocoding failed');
      throw e;
    }
  };

  const doCurrentAndForecast = async (latv: number, lonv: number) => {
    const [cw, fc] = await Promise.all([
      currentWeather(latv, lonv),
      forecast5(latv, lonv),
    ]);
    setCurrent(cw);
    setForecast(fc);
    const daily = fc?.daily;
    if (daily?.time?.length) {
      const rows: DailySummary[] = daily.time.map((t: string, i: number) => ({
        date: t,
        tmin: daily.temperature_2m_min?.[i] ?? null,
        tmax: daily.temperature_2m_max?.[i] ?? null,
        precip: daily.precipitation_sum?.[i] ?? null,
        weathercode: daily.weathercode?.[i] ?? null,
        icon: weatherCodeToEmoji[daily.weathercode?.[i]] || '❓',
      }));
      setForecastDaily(rows);
    } else {
      setForecastDaily([]);
    }
  };

  const onSearch = async () => {
    setLoading(true); setError(null); setSavedRecordId(null);
    try {
      const g = await doGeocode();
      await doCurrentAndForecast(g.lat, g.lon);
    } finally { setLoading(false); }
  };

  const onUseMyLocation = async () => {
    setError(null); setLoading(true); setSavedRecordId(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude: lt, longitude: ln } = pos.coords;
      const g = await reverseGeocode(lt, ln);
      setInput(g.name);
      setLat(g.lat); setLon(g.lon); setName(g.name);
      await doCurrentAndForecast(g.lat, g.lon);
    } catch (e: any) {
      setError(e?.message || 'Failed to get location');
    } finally { setLoading(false); }
  };

  const onSave = async () => {
    if (!canSave) return;
    setLoading(true); setError(null);
    try {
      const rec = await createRecord({ inputText: input, startDate, endDate, latitude: lat!, longitude: lon! });
      setSavedRecordId(rec.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter city, zip, landmark, or 'lat, lon'"
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }}
        />
        <button onClick={onSearch} disabled={!input || loading}>Search</button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={onUseMyLocation} disabled={loading}>Use my location</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <label>From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label>To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <button onClick={onSave} disabled={!canSave || loading}>Save to DB</button>
        </div>
      </div>
      {error && <div style={{ color: '#b00020', marginBottom: 8 }}>{error}</div>}
      {loading && <div>Loading…</div>}
      {(lat !== null && lon !== null) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{name}</div>
            {current?.current_weather && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ fontSize: 40 }}>
                  {weatherCodeToEmoji[current.current_weather.weathercode] || '❓'}
                </div>
                <div style={{ fontSize: 28 }}>{current.current_weather.temperature}°C</div>
                <div style={{ color: '#666' }}>Wind {current.current_weather.windspeed} km/h</div>
              </div>
            )}
            <h3 style={{ margin: '8px 0' }}>Next 5 days</h3>
            <ForecastCards daily={forecastDaily} />
            {savedRecordId && (
              <div style={{ marginTop: 10, color: 'green' }}>Saved record #{savedRecordId}</div>
            )}
            
            {/* YouTube Weather Videos */}
            <YouTubeSearch 
              location={name} 
              weatherCondition={current?.current_weather?.weathercode ? 
                weatherCodeToEmoji[current.current_weather.weathercode] : undefined
              }
            />
          </div>
          <div>
            <MapView lat={lat} lon={lon} name={name} />
          </div>
        </div>
      )}
    </div>
  );
}


