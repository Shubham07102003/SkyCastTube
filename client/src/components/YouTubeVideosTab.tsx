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
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '600' }}>
          🎥 Weather Videos
        </h2>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Search for weather-related videos from any location around the world
        </p>
        
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            placeholder="Enter city, country, or location name"
            style={{ 
              flex: 1,
              padding: '12px 16px', 
              borderRadius: 8, 
              border: '1px solid #ddd',
              fontSize: '16px'
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            onClick={handleSearch}
            disabled={!searchLocation.trim()}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#007bff',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Search Videos
          </button>
          <button 
            onClick={handleUseMyLocation}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #ddd',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            📍 My Location
          </button>
        </div>
      </div>

      {currentLocation && (
        <YouTubeSearch location={currentLocation} />
      )}

      {!currentLocation && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: '#666'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎥</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>
            Enter a location above to find weather videos
          </div>
          <div style={{ fontSize: '14px' }}>
            Get real-time weather footage, forecasts, and weather news from around the world
          </div>
        </div>
      )}
    </div>
  );
}
