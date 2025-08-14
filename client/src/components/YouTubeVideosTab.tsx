import { useState } from 'react';
import YouTubeSearch from './YouTubeSearch';

export default function YouTubeVideosTab() {
  const [searchLocation, setSearchLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');

  const handleSearch = () => {
    if (searchLocation.trim()) {
      setCurrentLocation(searchLocation.trim());
    }
  };

  const handleUseMyLocation = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude: lat, longitude: lon } = pos.coords;
      
      // Use reverse geocoding to get location name
      const response = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
      const data = await response.json();
      
      if (data.name) {
        setSearchLocation(data.name);
        setCurrentLocation(data.name);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
      alert('Failed to get your location. Please enter a location manually.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 600 }}>
          🎥 Weather Videos
        </h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Search for weather-related videos from any location around the world
        </p>
        
        <div className="row">
          <input
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            placeholder="Enter city, country, or location name"
            style={{ flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="button primary" 
            onClick={handleSearch}
            disabled={!searchLocation.trim()}>
            Search Videos
          </button>
          <button className="button" onClick={handleUseMyLocation}>📍 My Location</button>
        </div>
      </div>

      {currentLocation && (
        <YouTubeSearch location={currentLocation} />
      )}

      {!currentLocation && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎥</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>
            Enter a location above to find weather videos
          </div>
          <div className="muted" style={{ fontSize: '14px' }}>
            Get real-time weather footage, forecasts, and weather news from around the world
          </div>
        </div>
      )}
    </div>
  );
}
