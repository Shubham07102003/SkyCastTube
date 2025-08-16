import axios from 'axios';
import type { GeocodeResult, RecordItem } from './types';

export const api = axios.create({
  baseURL: 'https://skycastude-backend.onrender.com', // proxied to http://localhost:3001 by Vite
  timeout: 20000,
});

export async function geocode(q: string): Promise<GeocodeResult> {
  const r = await api.get('/api/geocode', { params: { q } });
  return r.data;
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult> {
  const r = await api.get('/api/geocode', { params: { lat, lon } });
  return r.data;
}

export async function currentWeather(lat: number, lon: number) {
  const r = await api.get('/api/weather/current', { params: { lat, lon } });
  return r.data;
}

export async function forecast5(lat: number, lon: number) {
  const r = await api.get('/api/weather/forecast5', { params: { lat, lon } });
  return r.data;
}

export async function listRecords(q?: string): Promise<RecordItem[]> {
  const r = await api.get('/api/records', { params: q ? { q } : {} });
  return r.data;
}

export async function getRecord(id: number): Promise<RecordItem> {
  const r = await api.get(`/api/records/${id}`);
  return r.data;
}

export async function createRecord(data: {
  inputText?: string;
  latitude?: number;
  longitude?: number;
  startDate: string;
  endDate: string;
}): Promise<RecordItem> {
  const r = await api.post('/api/records', data);
  return r.data;
}

export async function updateRecord(id: number, data: Partial<{ inputText: string; latitude: number; longitude: number; startDate: string; endDate: string }>): Promise<RecordItem> {
  const r = await api.put(`/api/records/${id}`, data);
  return r.data;
}

export async function deleteRecord(id: number) {
  await api.delete(`/api/records/${id}`);
}

export async function searchYoutube(q: string) {
  const r = await api.get('/api/media/youtube', { params: { q } });
  return r.data as { items?: any[]; note?: string };
}

