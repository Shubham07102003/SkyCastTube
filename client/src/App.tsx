import './App.css';
import WeatherSearch from './components/WeatherSearch';
import RecordsTable from './components/RecordsTable';
import YouTubeVideosTab from './components/YouTubeVideosTab';
import { useState } from 'react';

export default function App() {
  const [tab, setTab] = useState<'weather' | 'records' | 'videos'>('weather');
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Weather App</div>
        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('weather')} style={{ fontWeight: tab === 'weather' ? 700 : 500 }}>Weather</button>
          <button onClick={() => setTab('videos')} style={{ fontWeight: tab === 'videos' ? 700 : 500 }}>Videos</button>
          <button onClick={() => setTab('records')} style={{ fontWeight: tab === 'records' ? 700 : 500 }}>Saved</button>
          <a href="/api/records/export?format=json" target="_blank"><button>Export All JSON</button></a>
        </nav>
      </header>
      {tab === 'weather' ? <WeatherSearch /> : tab === 'videos' ? <YouTubeVideosTab /> : <RecordsTable />}
      <footer style={{ marginTop: 20, color: '#666' }}>
        Data by Open‑Meteo and OpenStreetMap Nominatim
      </footer>
    </div>
  );
}

