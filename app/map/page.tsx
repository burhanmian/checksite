'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AlertTicker from '@/components/AlertTicker';
import { Plane, Globe, TrendingUp, Wind, RefreshCw } from 'lucide-react';

// Load map client-side only (Leaflet needs window)
const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false });

interface Aircraft {
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
}

interface MetarEntry {
  icaoId: string;
  fltcat: string;
  temp: number;
  wspd: number;
  visib: string | number;
  wxString?: string;
  rawOb?: string;
}

const REGIONS = [
  { label: '🌎 North America', lamin: 24, lamax: 55, lomin: -130, lomax: -60 },
  { label: '🌍 Europe',        lamin: 36, lamax: 72, lomin: -10,  lomax: 40  },
  { label: '🌏 Middle East',   lamin: 12, lamax: 42, lomin: 25,   lomax: 65  },
  { label: '🌏 Asia Pacific',  lamin: -10, lamax: 50, lomin: 90,  lomax: 160 },
  { label: '🌐 Atlantic',      lamin: 10, lamax: 65, lomin: -70,  lomax: 0   },
];

function altColor(ft: number | null): string {
  if (!ft || ft === 0) return '#10b981';
  if (ft < 5000) return '#10b981';
  if (ft < 15000) return '#3b82f6';
  if (ft < 25000) return '#8b5cf6';
  if (ft < 35000) return '#f59e0b';
  return '#ef4444';
}

function windDir(deg: number | null): string {
  if (deg === null) return '—';
  const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return d[Math.round(deg / 22.5) % 16];
}

export default function MapPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [metars, setMetars] = useState<MetarEntry[]>([]);
  const [selected, setSelected] = useState<Aircraft | null>(null);
  const [region, setRegion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [filter, setFilter] = useState<'all' | 'airborne' | 'ground'>('airborne');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    const r = REGIONS[region];
    try {
      const [fRes, mRes] = await Promise.all([
        fetch(`/api/flights?lamin=${r.lamin}&lamax=${r.lamax}&lomin=${r.lomin}&lomax=${r.lomax}`),
        fetch('/api/metar'),
      ]);
      const [fJson, mJson] = await Promise.all([fRes.json(), mRes.json()]);
      setAircraft(Array.isArray(fJson.flights) ? fJson.flights : []);
      setMetars(Array.isArray(mJson.data) ? mJson.data : []);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, [region]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, autoRefresh]);

  const displayed = aircraft.filter(a => {
    if (filter === 'airborne' && a.onGround) return false;
    if (filter === 'ground' && !a.onGround) return false;
    if (search && !a.callsign.toLowerCase().includes(search.toLowerCase()) &&
        !a.originCountry.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const airborne = aircraft.filter(a => !a.onGround).length;
  const onGround = aircraft.filter(a => a.onGround).length;
  const ifrCount = metars.filter(m => m.fltcat === 'IFR' || m.fltcat === 'LIFR').length;

  const ALT_LEGEND = [
    { label: '0–5k ft',   color: '#10b981' },
    { label: '5–15k ft',  color: '#3b82f6' },
    { label: '15–25k ft', color: '#8b5cf6' },
    { label: '25–35k ft', color: '#f59e0b' },
    { label: '35k+ ft',   color: '#ef4444' },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AlertTicker />
        <Header
          title="Live Geo Flight Map"
          subtitle={`Real-time aircraft positions · OpenSky Network · ${displayed.length} aircraft shown${lastUpdate ? ` · Updated ${lastUpdate}` : ''}`}
          onRefresh={load}
          refreshing={refreshing}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar — controls + selected aircraft */}
          <div className="w-72 shrink-0 flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2 p-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <MiniStat icon={<Plane size={12} />} label="Airborne" value={airborne} color="#3b82f6" />
              <MiniStat icon={<Globe size={12} />} label="Ground" value={onGround} color="#10b981" />
              <MiniStat icon={<Wind size={12} />} label="IFR" value={ifrCount} color="#f59e0b" />
            </div>

            {/* Region */}
            <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>REGION</div>
              <select
                className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                value={region}
                onChange={e => setRegion(Number(e.target.value))}
              >
                {REGIONS.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
              </select>
            </div>

            {/* Filters */}
            <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>FILTER</div>
              <div className="flex rounded-lg overflow-hidden mb-2" style={{ border: '1px solid var(--border)' }}>
                {(['all', 'airborne', 'ground'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="flex-1 py-1 text-xs font-medium capitalize"
                    style={{ background: filter === f ? 'rgba(59,130,246,0.2)' : 'transparent', color: filter === f ? '#60a5fa' : 'var(--text-muted)' }}>
                    {f}
                  </button>
                ))}
              </div>
              <input
                className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="Search callsign / country..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Auto-refresh */}
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto-refresh (15s)</span>
              <button
                onClick={() => setAutoRefresh(a => !a)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                style={{ background: autoRefresh ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: autoRefresh ? '#34d399' : '#f87171' }}
              >
                <RefreshCw size={10} className={autoRefresh ? 'radar-sweep' : ''} />
                {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Selected aircraft detail */}
            {selected ? (
              <div className="p-3 flex-1 overflow-y-auto">
                <div className="text-xs font-medium mb-3 flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                  SELECTED AIRCRAFT
                  <button onClick={() => setSelected(null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--bg-card)', border: `1px solid ${altColor(selected.baroAltitude)}40` }}>
                    <div className="font-mono font-bold text-lg mb-1" style={{ color: altColor(selected.baroAltitude) }}>
                      {selected.callsign || selected.icao24}
                    </div>
                    <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{selected.originCountry}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <DataPoint label="Status" value={selected.onGround ? 'On Ground' : 'Airborne'} color={selected.onGround ? '#10b981' : '#3b82f6'} />
                      <DataPoint label="Altitude" value={selected.baroAltitude ? `${selected.baroAltitude.toLocaleString()} ft` : '—'} color={altColor(selected.baroAltitude)} />
                      <DataPoint label="Speed" value={selected.velocity ? `${selected.velocity} kts` : '—'} />
                      <DataPoint label="Heading" value={selected.trueTrack != null ? `${Math.round(selected.trueTrack)}° ${windDir(selected.trueTrack)}` : '—'} />
                      <DataPoint label="Vert Rate" value={selected.verticalRate != null ? `${selected.verticalRate > 0 ? '+' : ''}${Math.round(selected.verticalRate * 196.85)} fpm` : '—'} color={selected.verticalRate != null ? (selected.verticalRate > 0 ? '#10b981' : selected.verticalRate < 0 ? '#ef4444' : undefined) : undefined} />
                      <DataPoint label="ICAO24" value={selected.icao24} mono />
                      <DataPoint label="Lat" value={selected.latitude?.toFixed(4)} mono />
                      <DataPoint label="Lon" value={selected.longitude?.toFixed(4)} mono />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <Plane size={28} style={{ color: 'var(--text-muted)' }} className="mb-2" />
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Click any aircraft on the map to see live details</div>
              </div>
            )}

            {/* Altitude legend */}
            <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>ALTITUDE LEGEND</div>
              <div className="space-y-1">
                {ALT_LEGEND.map(l => (
                  <div key={l.label} className="flex items-center gap-2 text-xs">
                    <div className="w-8 h-1.5 rounded" style={{ background: l.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading map…</div>
              </div>
            }>
              <LiveMap aircraft={displayed} onSelect={setSelected} selected={selected} />
            </Suspense>

            {/* Overlay stats */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
              <div className="px-3 py-2 rounded-lg text-xs font-medium backdrop-blur-sm"
                style={{ background: 'rgba(10,14,26,0.85)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
                  <span style={{ color: '#34d399' }}>LIVE</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{displayed.length}</span> aircraft
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-bold" style={{ color: '#3b82f6' }}>{airborne}</span> airborne
                </div>
                {lastUpdate && <div style={{ color: 'var(--text-muted)' }}>Updated {lastUpdate}</div>}
              </div>
            </div>

            {/* Loading overlay */}
            {refreshing && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs z-[1000]"
                style={{ background: 'rgba(59,130,246,0.9)', color: '#fff' }}>
                <TrendingUp size={12} className="inline mr-1.5 radar-sweep" />
                Fetching live positions…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, color = 'var(--text-primary)' }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-card)' }}>
      <div className="flex justify-center mb-1" style={{ color }}>{icon}</div>
      <div className="text-sm font-bold" style={{ color }}>{value.toLocaleString()}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 9 }}>{label}</div>
    </div>
  );
}

function DataPoint({ label, value, color, mono }: { label: string; value?: string | number | null; color?: string; mono?: boolean }) {
  return (
    <div className="p-1.5 rounded" style={{ background: 'var(--bg-secondary)' }}>
      <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)', fontSize: 9 }}>{label}</div>
      <div className={`text-xs font-medium ${mono ? 'font-mono' : ''}`} style={{ color: color ?? 'var(--text-primary)' }}>
        {value ?? '—'}
      </div>
    </div>
  );
}
