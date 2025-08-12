export type DailySummary = {
  date: string;
  tmin: number | null;
  tmax: number | null;
  precip?: number | null;
  icon: string;
  weathercode: number | null;
};

export type WeatherPayload = {
  latitude?: number;
  longitude?: number;
  forecast?: unknown;
  archive?: unknown;
  daily_summary?: DailySummary[];
};

export type RecordItem = {
  id: number;
  input_text: string | null;
  resolved_name: string;
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
  source: string;
  created_at: string;
  updated_at: string;
  weather: WeatherPayload | null;
};

export type GeocodeResult = { lat: number; lon: number; name: string };

