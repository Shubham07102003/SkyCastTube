import { useEffect, useMemo, useState } from 'react';
import { deleteRecord, listRecords, updateRecord } from '../api';
import type { RecordItem } from '../types';

function Summary({ record }: { record: RecordItem }) {
  const daily = record.weather?.daily_summary || [];
  if (!daily.length) return <div style={{ color: '#666' }}>No summary</div>;
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

export default function RecordsTable() {
  const [rows, setRows] = useState<RecordItem[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchRows = async () => {
    const r = await listRecords(search || undefined);
    setRows(r);
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchRows, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onUpdate = async (r: RecordItem) => {
    setSavingId(r.id);
    try {
      await updateRecord(r.id, {
        inputText: r.input_text || undefined,
        startDate: r.start_date,
        endDate: r.end_date,
        latitude: r.latitude,
        longitude: r.longitude,
      });
      await fetchRows();
    } finally {
      setSavingId(null);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this record?')) return;
    await deleteRecord(id);
    await fetchRows();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved records"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
        />
        <button onClick={fetchRows}>Refresh</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>#</th>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th>Dates</th>
              <th>Coords</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                <td>{r.id}</td>
                <td>
                  <input
                    value={r.input_text || ''}
                    placeholder={r.resolved_name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((old) => old.map((x) => (x.id === r.id ? { ...x, input_text: v } : x)));
                    }}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd' }}
                  />
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{r.resolved_name}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="date"
                      value={r.start_date}
                      onChange={(e) => setRows((old) => old.map((x) => (x.id === r.id ? { ...x, start_date: e.target.value } : x)))}
                    />
                    <span>→</span>
                    <input
                      type="date"
                      value={r.end_date}
                      onChange={(e) => setRows((old) => old.map((x) => (x.id === r.id ? { ...x, end_date: e.target.value } : x)))}
                    />
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="number"
                      step="0.0001"
                      value={r.latitude}
                      onChange={(e) => setRows((old) => old.map((x) => (x.id === r.id ? { ...x, latitude: Number(e.target.value) } : x)))}
                      style={{ width: 110 }}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={r.longitude}
                      onChange={(e) => setRows((old) => old.map((x) => (x.id === r.id ? { ...x, longitude: Number(e.target.value) } : x)))}
                      style={{ width: 110 }}
                    />
                  </div>
                </td>
                <td>{r.source}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button disabled={savingId === r.id} onClick={() => onUpdate(r)}>{savingId === r.id ? 'Saving…' : 'Update'}</button>{' '}
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{expanded === r.id ? 'Hide' : 'View'}</button>{' '}
                  <button onClick={() => onDelete(r.id)} style={{ color: '#b00020' }}>Delete</button>{' '}
                  <a href={`/api/records/export?format=md&id=${r.id}`} target="_blank">MD</a>{' | '}
                  <a href={`/api/records/export?format=csv&id=${r.id}`} target="_blank">CSV</a>{' | '}
                  <a href={`/api/records/export?format=xml&id=${r.id}`} target="_blank">XML</a>{' | '}
                  <a href={`/api/records/export?format=pdf&id=${r.id}`} target="_blank">PDF</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.map((r) => (
        <div key={`exp-${r.id}`} style={{ display: expanded === r.id ? 'block' : 'none', border: '1px solid #eee', borderRadius: 8, padding: 12, marginTop: 10 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>{r.resolved_name} — {r.start_date} → {r.end_date}</div>
          <Summary record={r} />
        </div>
      ))}
    </div>
  );
}


