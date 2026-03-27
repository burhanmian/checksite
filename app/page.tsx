'use client';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AlertTicker from '@/components/AlertTicker';
import AnimatedCounter from '@/components/AnimatedCounter';
import DataSourceBadge from '@/components/DataSourceBadge';
import {
  Plane, AlertTriangle, TrendingUp, CheckCircle,
  XCircle, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';

interface MetarEntry {
  icaoId: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  wgst?: number;
  visib: string | number;
  cover: string;
  altim: number;
  fltcat: string;
  rawOb: string;
  wxString?: string;
}

interface AirportStatusEntry {
  ARPT?: string;
  Name?: string;
  Delays?: { type?: { Value?: string }; Reason?: string }[];
  Programs?: { type?: string; Reason?: string; MinDelay?: string; MaxDelay?: string }[];
  Status?: string;
}

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
}

const DELAY_HISTORY = [
  { time: '06:00', avg: 8 },
  { time: '07:00', avg: 12 },
  { time: '08:00', avg: 19 },
  { time: '09:00', avg: 28 },
  { time: '10:00', avg: 41 },
  { time: '11:00', avg: 35 },
  { time: '12:00', avg: 29 },
  { time: '13:00', avg: 22 },
  { time: 'Now', avg: 31 },
];

const DISRUPTION_CAUSES = [
  { name: 'Weather', value: 48, color: '#f59e0b' },
  { name: 'ATC/NAS', value: 22, color: '#3b82f6' },
  { name: 'Staff', value: 18, color: '#ef4444' },
  { name: 'Aircraft', value: 12, color: '#8b5cf6' },
];

const FLIGHT_RULES_COLOR: Record<string, string> = {
  VFR: '#10b981', MVFR: '#3b82f6', IFR: '#f59e0b', LIFR: '#ef4444',
};

export default function OverviewPage() {
  const [metars, setMetars] = useState<MetarEntry[]>([]);
  const [airportStatus, setAirportStatus] = useState<AirportStatusEntry[]>([]);
  const [flights, setFlights] = useState<FlightState[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [flightSource, setFlightSource] = useState('');
  const [metarSource, setMetarSource] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [mRes, sRes, fRes] = await Promise.all([
        fetch('/api/metar'),
        fetch('/api/airport-status'),
        fetch('/api/flights'),
      ]);
      const [mJson, sJson, fJson] = await Promise.all([
        mRes.json(), sRes.json(), fRes.json(),
      ]);
      setMetars(Array.isArray(mJson.data) ? mJson.data : []);
      setAirportStatus(Array.isArray(sJson.data) ? sJson.data : []);
      setFlights(Array.isArray(fJson.flights) ? fJson.flights : []);
      setFlightSource(fJson.source ?? '');
      setMetarSource(mJson.source ?? '');
      setLastUpdate(new Date().toLocaleTimeString());
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const airborne = flights.filter(f => !f.onGround).length;
  const onGround = flights.filter(f => f.onGround).length;
  const ifrCount = metars.filter(m => m.fltcat === 'IFR' || m.fltcat === 'LIFR').length;
  const activeDelays = airportStatus.filter(a =>
    (a.Delays?.length ?? 0) > 0 || (a.Programs?.length ?? 0) > 0
  ).length;

  const flightRulesData = ['VFR', 'MVFR', 'IFR', 'LIFR']
    .map(cat => ({ name: cat, count: metars.filter(m => m.fltcat === cat).length, color: FLIGHT_RULES_COLOR[cat] }))
    .filter(d => d.count > 0);

  const airportDelayBars = airportStatus
    .filter(a => (a.Programs ?? []).length > 0)
    .slice(0, 8)
    .map(a => {
      const max = parseInt(String(a.Programs?.[0]?.MaxDelay ?? '0').replace(/\D/g, '')) || 0;
      return { name: a.ARPT ?? '', delay: max };
    });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AlertTicker />
        <Header
          title="Flight Intelligence Overview"
          subtitle={`Live · OpenSky Network · AviationWeather.gov · FAA NAS${lastUpdate ? ` · Updated ${lastUpdate}` : ''}`}
          onRefresh={load}
          refreshing={refreshing}
        />
        <main className="flex-1 overflow-y-auto p-6 grid-bg">

          {/* Data source badges */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Data sources:</span>
            <DataSourceBadge source={flightSource} />
            <DataSourceBadge source={metarSource} />
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPICard icon={<Plane size={18} style={{ color: '#3b82f6' }} />} label="Airborne Now" value={airborne} sub="in tracked region" color="rgba(59,130,246,0.1)" glow="rgba(59,130,246,0.15)" delay="fade-in-1" />
            <KPICard icon={<AlertTriangle size={18} style={{ color: '#ef4444' }} />} label="IFR / LIFR Airports" value={ifrCount} sub="low visibility ops" color="rgba(239,68,68,0.1)" glow="rgba(239,68,68,0.15)" delay="fade-in-2" />
            <KPICard icon={<Clock size={18} style={{ color: '#f59e0b' }} />} label="Delay Programs" value={activeDelays} sub="FAA active programs" color="rgba(245,158,11,0.1)" glow="rgba(245,158,11,0.15)" delay="fade-in-3" />
            <KPICard icon={<TrendingUp size={18} style={{ color: '#10b981' }} />} label="On Ground" value={onGround} sub="gates & taxiways" color="rgba(16,185,129,0.1)" glow="rgba(16,185,129,0.15)" delay="fade-in-4" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Flight Rules Pie */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Flight Rules — Live METARs</h2>
              {flightRulesData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={flightRulesData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                        {flightRulesData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-3 mt-2 flex-wrap">
                    {flightRulesData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-sm" style={{ background: d.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name} ({d.count})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
              )}
            </div>

            {/* Disruption Causes */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Disruption Causes</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={DISRUPTION_CAUSES} layout="vertical" barSize={14}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={55} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} formatter={(v) => [`${v}%`, 'Share']} />
                  <Bar dataKey="value" radius={4}>
                    {DISRUPTION_CAUSES.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Delay Trend */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Avg Delay Trend (min)</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={DELAY_HISTORY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Live METAR Feed */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
                Live METAR Reports — AviationWeather.gov
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {metars.length > 0 ? metars.map((m, i) => (
                  <MetarRow key={i} metar={m} />
                )) : (
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Fetching live METAR data…</div>
                )}
              </div>
            </div>

            {/* FAA Status */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <span className="w-2 h-2 rounded-full bg-red-400 pulse-dot" />
                FAA NAS Status — Airport Delay Programs
              </h2>
              {airportDelayBars.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={airportDelayBars} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} unit=" min" />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} formatter={(v) => [`${v} min`, 'Max Delay']} />
                    <Bar dataKey="delay" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="space-y-2">
                  {airportStatus.slice(0, 8).map((a, i) => (
                    <AirportStatusRow key={i} airport={a} />
                  ))}
                  {airportStatus.length === 0 && (
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Fetching FAA NAS Status…</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Live Flights Table */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="w-2 h-2 rounded-full bg-blue-400 pulse-dot" />
              Live Aircraft — OpenSky Network ({flights.length} aircraft in view)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Callsign', 'Country', 'Status', 'Altitude (ft)', 'Speed (kts)', 'Heading', 'Lat', 'Lon'].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flights.slice(0, 15).map((f, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 px-3 font-mono font-bold" style={{ color: 'var(--accent-blue)' }}>{f.callsign || '—'}</td>
                      <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>{f.originCountry}</td>
                      <td className="py-2 px-3">
                        {f.onGround
                          ? <span className="badge-yellow px-2 py-0.5 rounded font-medium">On Ground</span>
                          : <span className="badge-green px-2 py-0.5 rounded font-medium">Airborne</span>}
                      </td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>{f.baroAltitude?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>{f.velocity ?? '—'}</td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{f.trueTrack != null ? `${Math.round(f.trueTrack)}°` : '—'}</td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-muted)' }}>{f.latitude?.toFixed(2)}</td>
                      <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-muted)' }}>{f.longitude?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {flights.length === 0 && (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Fetching live flights from OpenSky Network…</div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, sub, color, glow, delay }: {
  icon: React.ReactNode; label: string; value: number; sub: string; color: string; glow: string; delay?: string;
}) {
  return (
    <div className={`card p-5 flex flex-col gap-2${delay ? ` ${delay}` : ''}`} style={{ boxShadow: `0 0 20px ${glow}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color }}>{icon}</div>
      </div>
      <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
        <AnimatedCounter value={value} />
      </div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</div>
    </div>
  );
}

function MetarRow({ metar }: { metar: MetarEntry }) {
  const catColor: Record<string, string> = {
    VFR: '#10b981', MVFR: '#3b82f6', IFR: '#f59e0b', LIFR: '#ef4444',
  };
  const color = catColor[metar.fltcat] ?? '#8b9ab5';
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg text-xs" style={{ background: 'var(--bg-secondary)' }}>
      <div className="font-bold font-mono w-12 shrink-0 pt-0.5" style={{ color: 'var(--accent-cyan)' }}>{metar.icaoId}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>
            {metar.fltcat || '?'}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {metar.temp != null ? `${metar.temp}°C` : ''}{metar.wspd != null ? ` · ${metar.wspd}kt` : ''}{metar.visib != null ? ` · ${metar.visib}SM` : ''}
          </span>
          {metar.wxString && <span style={{ color: '#fbbf24' }}>{metar.wxString}</span>}
        </div>
        <div className="font-mono truncate" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{metar.rawOb}</div>
      </div>
    </div>
  );
}

function AirportStatusRow({ airport }: { airport: AirportStatusEntry }) {
  const hasIssue = (airport.Delays?.length ?? 0) > 0 || (airport.Programs?.length ?? 0) > 0;
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg text-xs" style={{ background: 'var(--bg-secondary)' }}>
      <div className="font-bold font-mono w-12 shrink-0" style={{ color: 'var(--accent-cyan)' }}>{airport.ARPT}</div>
      {hasIssue
        ? <div className="flex items-center gap-1.5 text-red-400"><XCircle size={12} /><span>{airport.Programs?.[0]?.type ?? airport.Delays?.[0]?.type?.Value ?? 'Delay Active'}</span></div>
        : <div className="flex items-center gap-1.5 text-green-400"><CheckCircle size={12} /><span>No active delays</span></div>}
    </div>
  );
}
