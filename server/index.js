/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { create } = require('xmlbuilder2');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  })
);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Prepare database
const dataDir = path.resolve(__dirname, '..', 'data');
const dbPath = path.resolve(__dirname, '..', 'data', 'weather.db');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS queries (    
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_text TEXT,
  resolved_name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_id INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);
`);

function isoDate(d) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function isValidDateString(yyyyMmDd) {
  if (typeof yyyyMmDd !== 'string') return false;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(yyyyMmDd);
  if (!m) return false;
  const dt = new Date(yyyyMmDd + 'T00:00:00Z');
  return !Number.isNaN(dt.getTime());
}

function daysBetweenInclusive(start, end) {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return Math.round((e - s) / (24 * 3600 * 1000)) + 1;
}

function parseLatLonText(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  // Accept formats like: "37.7749,-122.4194" or "37.7749 , -122.4194"
  const parts = trimmed.split(/[ ,]+/).filter(Boolean);
  if (parts.length === 2) {
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }
    }
  }
  return null;
}

async function geocodeLocation({ inputText, latitude, longitude }) {
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return {
      lat: latitude,
      lon: longitude,
      name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    };
  }
  // Try parse lat,lon from freeform text first
  const parsed = parseLatLonText(inputText);
  if (parsed) {
    return { lat: parsed.lat, lon: parsed.lon, name: `${parsed.lat}, ${parsed.lon}` };
  }
  const url = 'https://nominatim.openstreetmap.org/search';
  const params = {
    q: inputText,
    format: 'json',
    addressdetails: 1,
    limit: 1,
  };
  const headers = {
    'User-Agent': 'WeatherAppDemo/1.0 (contact: example@example.com)',
  };
  const res = await axios.get(url, { params, headers, timeout: 12000 });
  if (!Array.isArray(res.data) || res.data.length === 0) {
    throw new Error('Location not found');
  }
  const first = res.data[0];
  return { lat: Number(first.lat), lon: Number(first.lon), name: first.display_name };
}

async function reverseGeocode(lat, lon) {
  const url = 'https://nominatim.openstreetmap.org/reverse';
  const params = { lat, lon, format: 'json', zoom: 10 };
  const headers = {
    'User-Agent': 'WeatherAppDemo/1.0 (contact: example@example.com)',
  };
  const res = await axios.get(url, { params, headers, timeout: 12000 });
  if (!res.data) {
    return { lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
  }
  return { lat, lon, name: res.data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
}

async function fetchForecast(lat, lon, startDate, endDate) {
  // Use both daily and hourly for richer data
  const today = isoDate(new Date());
  const url = 'https://api.open-meteo.com/v1/forecast';
  const params = {
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    current_weather: true,
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,weathercode',
    start_date: startDate || today,
    end_date: endDate || today,
  };
  const res = await axios.get(url, { params, timeout: 15000 });
  return { source: 'forecast', payload: res.data };
}

async function fetchArchive(lat, lon, startDate, endDate) {
  const url = 'https://archive-api.open-meteo.com/v1/era5';
  const params = {
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,weathercode',
    start_date: startDate,
    end_date: endDate,
  };
  const res = await axios.get(url, { params, timeout: 20000 });
  return { source: 'archive', payload: res.data };
}

function splitRangeByToday(startDate, endDate) {
  const today = new Date();
  const todayStr = isoDate(today);
  if (endDate < todayStr) {
    return { past: [startDate, endDate], presentFuture: null };
  }
  if (startDate > todayStr) {
    return { past: null, presentFuture: [startDate, endDate] };
  }
  // Overlaps today
  const pastEnd = isoDate(new Date(today.getTime() - 24 * 3600 * 1000));
  return { past: [startDate, pastEnd], presentFuture: [todayStr, endDate] };
}

function validateRangeOrThrow(startDate, endDate) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  if (startDate > endDate) {
    throw new Error('startDate must be before or equal to endDate');
  }
  const span = daysBetweenInclusive(startDate, endDate);
  if (span > 31) {
    throw new Error('Date range too large (max 31 days)');
  }
}

function insertQuery({ inputText, resolvedName, lat, lon, startDate, endDate, source }) {
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO queries (input_text, resolved_name, latitude, longitude, start_date, end_date, source, created_at, updated_at)
    VALUES (@inputText, @resolvedName, @lat, @lon, @startDate, @endDate, @source, @createdAt, @updatedAt)
  `);
  const result = stmt.run({
    inputText: inputText || null,
    resolvedName,
    lat,
    lon,
    startDate,
    endDate,
    source,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return result.lastInsertRowid;
}

function updateQuery({ id, inputText, resolvedName, lat, lon, startDate, endDate, source }) {
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE queries
    SET input_text = @inputText,
        resolved_name = @resolvedName,
        latitude = @lat,
        longitude = @lon,
        start_date = @startDate,
        end_date = @endDate,
        source = @source,
        updated_at = @updatedAt
    WHERE id = @id
  `);
  const res = stmt.run({
    id,
    inputText: inputText || null,
    resolvedName,
    lat,
    lon,
    startDate,
    endDate,
    source,
    updatedAt: nowIso,
  });
  return res.changes;
}

function insertWeatherData(queryId, data) {
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO weather_data (query_id, data_json, created_at)
    VALUES (@queryId, @dataJson, @createdAt)
  `);
  const res = stmt.run({ queryId, dataJson: JSON.stringify(data), createdAt: nowIso });
  return res.lastInsertRowid;
}

function deleteWeatherDataForQuery(queryId) {
  db.prepare('DELETE FROM weather_data WHERE query_id = ?').run(queryId);
}

function getQueryById(id) {
  const q = db.prepare('SELECT * FROM queries WHERE id = ?').get(id);
  if (!q) return null;
  const data = db.prepare('SELECT * FROM weather_data WHERE query_id = ? ORDER BY id DESC').get(id);
  return { ...q, weather: data ? JSON.parse(data.data_json) : null };
}

// Map Open-Meteo weather codes to simple icons
const weatherCodeToEmoji = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌦️', 63: '🌧️', 65: '🌧️',
  66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  77: '❄️',
  80: '🌧️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 97: '⛈️'
};

// Utilities to shape a concise summary from Open-Meteo daily output
function summarizeDaily(payload) {
  if (!payload || !payload.daily) return [];
  const d = payload.daily;
  const n = d.time.length;
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const code = (d.weathercode && d.weathercode[i]) ?? null;
    rows.push({
      date: d.time[i],
      tmin: d.temperature_2m_min ? d.temperature_2m_min[i] : null,
      tmax: d.temperature_2m_max ? d.temperature_2m_max[i] : null,
      precip: d.precipitation_sum ? d.precipitation_sum[i] : null,
      icon: weatherCodeToEmoji[code] || '❓',
      weathercode: code,
    });
  }
  return rows;
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

// Simple geocode endpoint for front-end convenience
app.get('/api/geocode', async (req, res) => {
  try {
    const { q, lat, lon } = req.query;
    if (lat && lon) {
      const gg = await reverseGeocode(Number(lat), Number(lon));
      return res.json(gg);
    }
    if (!q) return res.status(400).json({ error: 'Provide q or lat/lon' });
    const g = await geocodeLocation({ inputText: String(q) });
    return res.json(g);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Geocoding failed' });
  }
});

// Create a new weather query and persist results
app.post('/api/records', async (req, res) => {
  try {
    const { inputText, latitude, longitude, startDate, endDate } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
    }
    validateRangeOrThrow(startDate, endDate);
    const geo = await geocodeLocation({ inputText, latitude, longitude });
    const { lat, lon, name } = geo;

    const { past, presentFuture } = splitRangeByToday(startDate, endDate);
    let merged = null;
    let source = 'forecast';

    if (past && presentFuture) {
      const [ps, pe] = past;
      const [fs, fe] = presentFuture;
      const [arch, fore] = await Promise.all([
        fetchArchive(lat, lon, ps, pe),
        fetchForecast(lat, lon, fs, fe),
      ]);
      merged = {
        latitude: lat,
        longitude: lon,
        archive: arch.payload,
        forecast: fore.payload,
        daily_summary: [
          ...summarizeDaily(arch.payload),
          ...summarizeDaily(fore.payload),
        ],
      };
      source = 'archive+forecast';
    } else if (past) {
      const [ps, pe] = past;
      const arch = await fetchArchive(lat, lon, ps, pe);
      merged = {
        latitude: lat,
        longitude: lon,
        archive: arch.payload,
        daily_summary: summarizeDaily(arch.payload),
      };
      source = 'archive';
    } else {
      const [fs, fe] = presentFuture || [startDate, endDate];
      const fore = await fetchForecast(lat, lon, fs, fe);
      merged = {
        latitude: lat,
        longitude: lon,
        forecast: fore.payload,
        daily_summary: summarizeDaily(fore.payload),
      };
      source = 'forecast';
    }

    const qid = insertQuery({
      inputText: inputText || null,
      resolvedName: name,
      lat,
      lon,
      startDate,
      endDate,
      source,
    });
    insertWeatherData(qid, merged);

    res.status(201).json({ id: qid, ...getQueryById(qid) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to create record' });
  }
});

// Read - list with optional search
app.get('/api/records', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db
      .prepare(`SELECT * FROM queries WHERE resolved_name LIKE ? OR COALESCE(input_text,'') LIKE ? ORDER BY id DESC`)
      .all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM queries ORDER BY id DESC').all();
  }
  const results = rows.map((r) => {
    const wd = db
      .prepare('SELECT * FROM weather_data WHERE query_id = ? ORDER BY id DESC')
      .get(r.id);
    return { ...r, weather: wd ? JSON.parse(wd.data_json) : null };
  });
  res.json(results);
});

// Export endpoint - must be defined before /:id route to avoid conflicts
app.get('/api/records/export', (req, res) => {
  const { format = 'json', id } = req.query;
  let records;
  if (id) {
    const one = getQueryById(Number(id));
    if (!one) return res.status(404).json({ error: 'Not found' });
    records = [one];
  } else {
    const rows = db.prepare('SELECT * FROM queries ORDER BY id DESC').all();
    records = rows.map((r) => {
      const wd = db
        .prepare('SELECT * FROM weather_data WHERE query_id = ? ORDER BY id DESC')
        .get(r.id);
      return { ...r, weather: wd ? JSON.parse(wd.data_json) : null };
    });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const recordCount = records.length;
  const filename = id ? `weather-record-${id}-${timestamp}` : `weather-records-${recordCount}-${timestamp}`;

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.send(JSON.stringify(records, null, 2));
  }
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(recordsToCSV(records));
  }
  if (format === 'xml') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xml"`);
    return res.send(recordsToXML(records));
  }
  if (format === 'md' || format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.md"`);
    return res.send(recordsToMarkdown(records));
  }
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    const stream = recordsToPDFStream(records);
    return stream.pipe(res);
  }

  return res.status(400).json({ error: 'Unsupported format. Use json,csv,xml,md,pdf' });
});

// Read - single
app.get('/api/records/:id', (req, res) => {
  const id = Number(req.params.id);
  const record = getQueryById(id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  res.json(record);
});

// Update - allows changing input/date range, re-fetches weather
app.put('/api/records/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = getQueryById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { inputText, latitude, longitude, startDate, endDate } = req.body || {};
    const newStart = startDate || existing.start_date;
    const newEnd = endDate || existing.end_date;

    validateRangeOrThrow(newStart, newEnd);
    const geo = await geocodeLocation({
      inputText: inputText || existing.input_text,
      latitude: typeof latitude === 'number' ? latitude : existing.latitude,
      longitude: typeof longitude === 'number' ? longitude : existing.longitude,
    });

    const { lat, lon, name } = geo;
    const { past, presentFuture } = splitRangeByToday(newStart, newEnd);

    let merged = null;
    let source = 'forecast';
    if (past && presentFuture) {
      const [ps, pe] = past;
      const [fs, fe] = presentFuture;
      const [arch, fore] = await Promise.all([
        fetchArchive(lat, lon, ps, pe),
        fetchForecast(lat, lon, fs, fe),
      ]);
      merged = {
        latitude: lat,
        longitude: lon,
        archive: arch.payload,
        forecast: fore.payload,
        daily_summary: [
          ...summarizeDaily(arch.payload),
          ...summarizeDaily(fore.payload),
        ],
      };
      source = 'archive+forecast';
    } else if (past) {
      const [ps, pe] = past;
      const arch = await fetchArchive(lat, lon, ps, pe);
      merged = {
        latitude: lat,
        longitude: lon,
        archive: arch.payload,
        daily_summary: summarizeDaily(arch.payload),
      };
      source = 'archive';
    } else {
      const [fs, fe] = presentFuture || [newStart, newEnd];
      const fore = await fetchForecast(lat, lon, fs, fe);
      merged = {
        latitude: lat,
        longitude: lon,
        forecast: fore.payload,
        daily_summary: summarizeDaily(fore.payload),
      };
      source = 'forecast';
    }

    updateQuery({
      id,
      inputText: inputText || existing.input_text,
      resolvedName: name,
      lat,
      lon,
      startDate: newStart,
      endDate: newEnd,
      source,
    });

    deleteWeatherDataForQuery(id);
    insertWeatherData(id, merged);

    res.json(getQueryById(id));
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to update record' });
  }
});

// Exports
function recordsToCSV(records) {
  const headers = [
    'ID',
    'Location Name',
    'Coordinates',
    'Date Range',
    'Weather Source',
    'Daily Summary',
    'Created',
    'Updated'
  ];
  const lines = [headers.join(',')];
  
  for (const r of records) {
    const daily = r.weather && r.weather.daily_summary ? r.weather.daily_summary : [];
    const dailySummary = daily.map((d) => 
      `${d.date}: ${d.icon} Min: ${d.tmin}°C, Max: ${d.tmax}°C${d.precip ? `, Rain: ${d.precip}mm` : ''}`
    ).join('; ');
    
    const coordinates = `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`;
    const dateRange = `${r.start_date} to ${r.end_date}`;
    const created = new Date(r.created_at).toLocaleDateString();
    const updated = new Date(r.updated_at).toLocaleDateString();
    
    const row = [
      r.id,
      JSON.stringify(r.resolved_name),
      JSON.stringify(coordinates),
      JSON.stringify(dateRange),
      r.source,
      JSON.stringify(dailySummary),
      created,
      updated
    ];
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

function recordsToMarkdown(records) {
  const title = `# Weather Records Export\n\n*Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*\n\n`;
  const summary = `## Summary\n\nTotal Records: **${records.length}**\n\n`;
  
  const head = '| ID | Location | Coordinates | Date Range | Weather Source | Daily Summary |\n|---:|---|---|---|---|---|';
  const rows = records.map((r) => {
    const daily = r.weather && r.weather.daily_summary ? r.weather.daily_summary : [];
    const dailySummary = daily.map((d) => 
      `**${d.date}**: ${d.icon} Min: ${d.tmin}°C, Max: ${d.tmax}°C${d.precip ? `, Rain: ${d.precip}mm` : ''}`
    ).join('<br/>');
    
    const coordinates = `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`;
    const dateRange = `${r.start_date} → ${r.end_date}`;
    
    return `| ${r.id} | **${r.resolved_name}** | \`${coordinates}\` | ${dateRange} | ${r.source} | ${dailySummary} |`;
  });
  
  return title + summary + head + '\n' + rows.join('\n');
}

function recordsToXML(records) {
  const root = create({ version: '1.0' }).ele('weather_records');
  
  // Add metadata
  const metadata = root.ele('metadata');
  metadata.ele('export_date').txt(new Date().toISOString());
  metadata.ele('total_records').txt(String(records.length));
  metadata.ele('generated_by').txt('Weather App Export System');
  
  for (const r of records) {
    const rec = root.ele('record');
    rec.ele('id').txt(String(r.id));
    rec.ele('location').ele('name').txt(r.resolved_name);
    if (r.input_text) rec.ele('location').ele('input_text').txt(r.input_text);
    rec.ele('coordinates').ele('latitude').txt(String(r.latitude));
    rec.ele('coordinates').ele('longitude').txt(String(r.longitude));
    rec.ele('date_range').ele('start_date').txt(r.start_date);
    rec.ele('date_range').ele('end_date').txt(r.end_date);
    rec.ele('weather_source').txt(r.source);
    rec.ele('created_at').txt(r.created_at);
    rec.ele('updated_at').txt(r.updated_at);
    
    const daily = rec.ele('daily_summary');
    const ds = r.weather && r.weather.daily_summary ? r.weather.daily_summary : [];
    for (const d of ds) {
      const item = daily.ele('day');
      item.ele('date').txt(d.date);
      item.ele('temperature').ele('min').txt(String(d.tmin || 'N/A'));
      item.ele('temperature').ele('max').txt(String(d.tmax || 'N/A'));
      item.ele('weather').ele('code').txt(String(d.weathercode || 'N/A'));
      item.ele('weather').ele('icon').txt(d.icon || 'N/A');
      if (d.precip) item.ele('precipitation').txt(String(d.precip));
    }
  }
  return root.end({ prettyPrint: true });
}

function recordsToPDFStream(records) {
  const doc = new PDFDocument({ 
    margin: 36,
    size: 'A4',
    info: {
      Title: 'Weather Records Export',
      Author: 'Weather App',
      Subject: 'Weather Data Export',
      Keywords: 'weather, climate, export, data',
      CreationDate: new Date()
    }
  });
  
  // Header
  doc.fontSize(24).text('Weather Records Export', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, { align: 'center' });
  doc.moveDown(1);
  
  // Summary
  doc.fontSize(14).text('Summary', { underline: true });
  doc.fontSize(12).text(`Total Records: ${records.length}`);
  doc.moveDown(1);
  
  for (const r of records) {
    // Record header
    doc.fontSize(16).text(`Record #${r.id}`, { underline: true });
    doc.moveDown(0.3);
    
    // Location info
    doc.fontSize(12).text(`Location: ${r.resolved_name}`);
    doc.text(`Coordinates: ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`);
    doc.text(`Date Range: ${r.start_date} → ${r.end_date}`);
    doc.text(`Weather Source: ${r.source}`);
    doc.moveDown(0.5);
    
    // Daily weather summary
    const daily = r.weather && r.weather.daily_summary ? r.weather.daily_summary : [];
    if (daily.length > 0) {
      doc.fontSize(12).text('Daily Weather Summary:', { underline: true });
      doc.moveDown(0.3);
      
      for (const d of daily) {
        const tempText = `  ${d.date}: ${d.icon} Min: ${d.tmin || 'N/A'}°C, Max: ${d.tmax || 'N/A'}°C`;
        doc.text(tempText);
        
        if (d.precip && d.precip > 0) {
          doc.text(`    Precipitation: ${d.precip}mm`);
        }
      }
    }
    
    doc.moveDown(1);
    
    // Add page break if not the last record and we have many records
    if (records.indexOf(r) < records.length - 1 && records.length > 3) {
      doc.addPage();
    }
  }
  
  doc.end();
  return doc;
}

// Delete
app.delete('/api/records/:id', (req, res) => {
  const id = Number(req.params.id);
  const del = db.prepare('DELETE FROM queries WHERE id = ?').run(id);
  if (del.changes === 0) return res.status(404).json({ error: 'Not found' });
  // weather_data has ON DELETE CASCADE, but we also proactively removed on update
  res.json({ ok: true });
});

// Quick endpoints for current and 5-day forecast without persistence
app.get('/api/weather/current', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const url = 'https://api.open-meteo.com/v1/forecast';
    const params = { latitude: lat, longitude: lon, current_weather: true, timezone: 'auto' };
    const r = await axios.get(url, { params, timeout: 12000 });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch current weather' });
  }
});

app.get('/api/weather/forecast5', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const today = isoDate(new Date());
    const five = new Date();
    five.setDate(five.getDate() + 4);
    const end = isoDate(five);
    const r = await fetchForecast(Number(lat), Number(lon), today, end);
    res.json(r.payload);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

// Optional YouTube integration if API key provided
app.get('/api/media/youtube', async (req, res) => {
  try {
    const key = process.env.YOUTUBE_API_KEY;
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q is required' });
    if (!key) return res.json({ items: [], note: 'Set YOUTUBE_API_KEY to enable' });
    const url = 'https://www.googleapis.com/youtube/v3/search';
    const r = await axios.get(url, {
      params: { key, q, part: 'snippet', maxResults: 6, type: 'video', safeSearch: 'moderate' },
      timeout: 12000,
    });
    return res.json(r.data);
  } catch (e) {
    return res.status(500).json({ error: 'YouTube fetch failed' });
  }
});

// Fallback route
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


