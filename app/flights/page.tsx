'use client';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AlertTicker from '@/components/AlertTicker';
import { RefreshCw, Filter, Plane } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface FlightState {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  squawk: string | null;
}

// Bounding boxes for different regions
const REGIONS = [
  { label: 'North America', lamin: 24, lamax: 50, lomin: -125, lomax: -60 },
  { label: 'Europe', lamin: 36, lamax: 72, lomin: -10, lomax: 40 },
  { label: 'Middle East', lamin: 12, lamax: 42, lomin: 25, lomax: 65 },
  { label: 'Asia Pacific', lamin: -10, lamax: 50, lomin: 90, lomax: 160 },
  { label: 'World (limited)', lamin: -60, lamax: 72, lomin: -130, lomax: 160 },
];

const ALT_BRACKETS = [
  { label: '0–5k ft', min: 0, max: 5000, color: '#10b981' },
  { label: '5–15k ft', min: 5000, max: 15000, color: '#3b82f6' },
  { label: '15–25k ft', min: 15000, max: 25000, color: '#8b5cf6' },
  { label: '25–40k ft', min: 25000, max: 40000, color: '#f59e0b' },
  { label: '40k+ ft', min: 40000, max: Infinity, color: '#ef4444' },
];

function altColor(ft: number | null): string {
  if (ft === null) return '#4a5568';
  const b = ALT_BRACKETS.find(b => ft >= b.min && ft < b.max);
  return b?.color ?? '#4a5568';
}

export default function FlightsPage() {
  const [flights, setFlights] = useState<FlightState[]>([]);
  const [region, setRegion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [filter, setFilter] = useState<'all' | 'airborne' | 'ground'>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    setRefreshing(true);
    const r = REGIONS[region];
    try {
      const res = await fetch(`/api/flights?lamin=${r.lamin}&lamax=${r.lamax}&lomin=${r.lomin}&lomax=${r.lomax}`);
      const json = await res.json();
      setFlights(Array.isArray(json.flights) ? json.flights : []);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, [region]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, autoRefresh]);

  const displayed = flights.filter(f => {
    if (filter === 'airborne' && f.onGround) return false;
    if (filter === 'ground' && !f.onGround) return false;
    if (search && !f.callsign.toLowerCase().includes(search.toLowerCase()) && !f.originCountry.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const airborne = flights.filter(f => !f.onGround).length;
  const onGround = flights.filter(f => f.onGround).length;

  // For altitude scatter
  const altData = flights
    .filter(f => !f.onGround && f.baroAltitude && f.velocity)
    .map(f => ({ alt: f.baroAltitude!, speed: f.velocity!, color: altColor(f.baroAltitude) }));

  // Altitude distribution
  const altDist = ALT_BRACKETS.map(b => ({
    ...b,
    count: flights.filter(f => !f.onGround && f.baroAltitude != null && f.baroAltitude >= b.min && f.baroAltitude < b.max).length,
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AlertTicker />
        <Header
          title="Live Flight Tracker"
          subtitle={`OpenSky Network · ${flights.length} aircraft tracked${lastUpdate ? ` · Updated ${lastUpdate}` : ''}`}
          onRefresh={load}
          refreshing={refreshing}
        />
        <main className="flex-1 overflow-y-auto p-6 grid-bg">

          {/* Controls */}
          <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
            {/* Region select */}
            <select
              className="px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={region}
              onChange={e => setRegion(Number(e.target.value))}
            >
              {REGIONS.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
            </select>

            {/* Status filter */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['all', 'airborne', 'ground'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-2 text-xs font-medium capitalize"
                  style={{
                    background: filter === f ? 'rgba(59,130,246,0.2)' : 'var(--bg-secondary)',
                    color: filter === f ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              className="px-3 py-2 text-sm rounded-lg outline-none flex-1 min-w-40"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              placeholder="Search callsign or country..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
              style={{
                background: autoRefresh ? 'rgba(16,185,129,0.1)' : 'var(--bg-secondary)',
                border: `1px solid ${autoRefresh ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                color: autoRefresh ? '#34d399' : 'var(--text-muted)',
              }}
            >
              <RefreshCw size={12} className={autoRefresh ? 'radar-sweep' : ''} />
              Auto (15s)
            </button>

            {/* Stats */}
            <div className="ml-auto flex gap-4 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>
                <span className="font-bold" style={{ color: '#3b82f6' }}>{airborne.toLocaleString()}</span> airborne
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                <span className="font-bold" style={{ color: '#10b981' }}>{onGround.toLocaleString()}</span> on ground
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{displayed.length}</span> shown
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Altitude Distribution */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Altitude Distribution</h3>
              <div className="space-y-2">
                {altDist.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-16 shrink-0" style={{ color: 'var(--text-secondary)' }}>{b.label}</span>
                    <div className="flex-1 h-5 rounded" style={{ background: 'var(--bg-secondary)' }}>
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${Math.min(100, (b.count / Math.max(1, airborne)) * 100)}%`,
                          background: b.color,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono font-bold" style={{ color: b.color }}>{b.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Speed vs Altitude scatter */}
            <div className="card p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Speed (kts) vs Altitude (ft)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="speed" name="Speed" unit=" kts" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} type="number" domain={[0, 700]} />
                  <YAxis dataKey="alt" name="Altitude" unit=" ft" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} type="number" tickFormatter={v => `${Math.round(v/1000)}k`} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }}
                    formatter={(v, name) => [name === 'Speed' ? `${v} kts` : `${Number(v).toLocaleString()} ft`, name]}
                  />
                  <Scatter data={altData.slice(0, 300)} fill="#3b82f6" opacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Flight Table */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Plane size={14} style={{ color: 'var(--accent-blue)' }} />
              Live Aircraft — {REGIONS[region].label} ({displayed.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['ICAO24', 'Callsign', 'Country', 'Status', 'Altitude', 'Speed (kts)', 'Heading', 'Vert Rate', 'Squawk', 'Lat', 'Lon'].map(h => (
                      <th key={h} className="text-left py-2.5 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.slice(0, 100).map((f, i) => (
                    <tr
                      key={i}
                      className="transition-colors hover:bg-[rgba(59,130,246,0.05)]"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td className="py-2 px-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{f.icao24}</td>
                      <td className="py-2 px-3 font-mono font-bold" style={{ color: 'var(--accent-cyan)' }}>{f.callsign || '—'}</td>
                      <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>{f.originCountry}</td>
                      <td className="py-2 px-3">
                        {f.onGround
                          ? <span className="badge-yellow px-2 py-0.5 rounded font-medium">Ground</span>
                          : <span className="badge-green px-2 py-0.5 rounded font-medium">Airborne</span>}
                      </td>
                      <td className="py-2 px-3 font-mono" style={{ color: f.baroAltitude ? altColor(f.baroAltitude) : 'var(--text-muted)' }}>
                        {f.baroAltitude != null ? `${f.baroAltitude.toLocaleString()} ft` : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>{f.velocity ?? '—'}</td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{f.trueTrack != null ? `${Math.round(f.trueTrack)}°` : '—'}</td>
                      <td className="py-2 px-3 font-mono" style={{ color: f.verticalRate != null ? (f.verticalRate > 0 ? '#10b981' : f.verticalRate < 0 ? '#ef4444' : 'var(--text-muted)') : 'var(--text-muted)' }}>
                        {f.verticalRate != null ? `${f.verticalRate > 0 ? '+' : ''}${Math.round(f.verticalRate * 196.85)} fpm` : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-muted)' }}>{f.squawk ?? '—'}</td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-muted)' }}>{f.latitude?.toFixed(3)}</td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-muted)' }}>{f.longitude?.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayed.length === 0 && (
                <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {refreshing ? 'Fetching live flights from OpenSky Network…' : 'No flights match the current filter.'}
                </div>
              )}
              {displayed.length > 100 && (
                <div className="text-center py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Showing first 100 of {displayed.length} aircraft
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
