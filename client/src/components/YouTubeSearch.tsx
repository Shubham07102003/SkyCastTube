import { useState, useEffect } from 'react';
import { searchYoutube } from '../api';

interface YouTubeSearchProps {
  location: string;
  weatherCondition?: string;
}

interface YouTubeVideo {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      medium: {
        url: string;
      };
    };
    channelTitle: string;
    publishedAt: string;
  };
}

export default function YouTubeSearch({ location, weatherCondition }: YouTubeSearchProps) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;
    
    const searchForVideos = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Create a search query combining location and weather condition
        let searchQuery = `${location} weather`;
        if (weatherCondition) {
          searchQuery += ` ${weatherCondition}`;
        }
        
        const result = await searchYoutube(searchQuery);
        
        if (result.items && result.items.length > 0) {
          setVideos(result.items);
        } else {
          setVideos([]);
          if (result.note) {
            setError(result.note);
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || 'Failed to fetch videos');
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    searchForVideos();
  }, [location, weatherCondition]);

  if (!location) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        🎥 Weather Videos for {location}
      </h3>
      
      {loading && <div>Loading videos...</div>}
      
      {error && (
        <div style={{ color: 'var(--danger)', marginBottom: 8, fontSize: '14px' }}>
          {error}
        </div>
      )}
      
      {!loading && !error && videos.length === 0 && (
        <div className="muted" style={{ fontSize: '14px' }}>
          No videos found for this location
        </div>
      )}
      
      {videos.length > 0 && (
        <div className="videoGrid">
          {videos.map((video) => (
            <div 
              key={video.id.videoId}
              className="videoCard"
              onClick={() => {
                window.open(`https://www.youtube.com/watch?v=${video.id.videoId}`, '_blank');
              }}
            >
              <img 
                src={video.snippet.thumbnails.medium.url} 
                alt={video.snippet.title}
                className="videoThumb"
              />
              <div className="videoBody">
                <div className="videoTitle">{video.snippet.title}</div>
                <div className="videoMeta" style={{ marginBottom: 4 }}>{video.snippet.channelTitle}</div>
                <div className="videoMeta" style={{ fontSize: '11px' }}>{new Date(video.snippet.publishedAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}