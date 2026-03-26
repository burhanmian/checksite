'use client';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AlertTicker from '@/components/AlertTicker';
import { BarChart2, Globe, Clock, Plane } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from 'recharts';

interface AirportStatusEntry {
  ARPT?: string;
  Name?: string;
  City?: string;
  State?: string;
  IATA?: string;
  Programs?: { type?: string; MinDelay?: string; MaxDelay?: string; AvgDelay?: string; Reason?: string }[];
  Delays?: { type?: { Value?: string } }[];
  Status?: string;
}

interface MetarEntry {
  icaoId: string;
  fltcat: string;
  temp: number;
  wspd: number;
  visib: string | number;
  name?: string;
}

// Country-level airspace summary (static enrichment)
const COUNTRY_TRAFFIC = [
  { country: 'United States', flights: 45000, color: '#3b82f6' },
  { country: 'Europe (EU)', flights: 32000, color: '#10b981' },
  { country: 'China', flights: 18000, color: '#f59e0b' },
  { country: 'India', flights: 8500, color: '#8b5cf6' },
  { country: 'Japan', flights: 4200, color: '#06b6d4' },
  { country: 'UAE/Gulf', flights: 3800, color: '#f97316' },
  { country: 'Brazil', flights: 3100, color: '#ec4899' },
  { country: 'Australia', flights: 2700, color: '#84cc16' },
];

const AIRLINE_PERF = [
  { airline: 'Delta', onTime: 84, delays: 12, cancels: 4 },
  { airline: 'Southwest', onTime: 78, delays: 16, cancels: 6 },
  { airline: 'United', onTime: 72, delays: 20, cancels: 8 },
  { airline: 'American', onTime: 70, delays: 22, cancels: 8 },
  { airline: 'JetBlue', onTime: 68, delays: 24, cancels: 8 },
  { airline: 'Spirit', onTime: 58, delays: 28, cancels: 14 },
];

const RADAR_STATS = [
  { metric: 'On-Time', value: 74 },
  { metric: 'Weather', value: 52 },
  { metric: 'Capacity', value: 68 },
  { metric: 'Safety', value: 98 },
  { metric: 'TSA Wait', value: 43 },
  { metric: 'Crew Avail', value: 61 },
];

const HOUR_DELAY = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h.toString().padStart(2, '0')}:00`,
  delay: Math.round(5 + 30 * Math.sin((h - 6) * Math.PI / 12) * Math.max(0, Math.sin((h - 6) * Math.PI / 12))),
}));

export default function StatsPage() {
  const [airportStatus, setAirportStatus] = useState<AirportStatusEntry[]>([]);
  const [metars, setMetars] = useState<MetarEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [sRes, mRes] = await Promise.all([
        fetch('/api/airport-status'),
        fetch('/api/metar'),
      ]);
      const [sJson, mJson] = await Promise.all([sRes.json(), mRes.json()]);
      setAirportStatus(Array.isArray(sJson.data) ? sJson.data : []);
      setMetars(Array.isArray(mJson.data) ? mJson.data : []);
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120000);
    return () => clearInterval(t);
  }, [load]);

  const totalDelayPrograms = airportStatus.filter(a => (a.Programs?.length ?? 0) > 0).length;
  const totalDelays = airportStatus.filter(a => (a.Delays?.length ?? 0) > 0).length;
  const ifrAirports = metars.filter(m => m.fltcat === 'IFR' || m.fltcat === 'LIFR').length;
  const vfrAirports = metars.filter(m => m.fltcat === 'VFR').length;

  const flightRulesPie = [
    { name: 'VFR', count: metars.filter(m => m.fltcat === 'VFR').length, color: '#10b981' },
    { name: 'MVFR', count: metars.filter(m => m.fltcat === 'MVFR').length, color: '#3b82f6' },
    { name: 'IFR', count: metars.filter(m => m.fltcat === 'IFR').length, color: '#f59e0b' },
    { name: 'LIFR', count: metars.filter(m => m.fltcat === 'LIFR').length, color: '#ef4444' },
  ].filter(d => d.count > 0);

  // Worst delay airports from FAA data
  const worstAirports = airportStatus
    .filter(a => (a.Programs?.length ?? 0) > 0)
    .map(a => {
      const max = parseInt(String(a.Programs?.[0]?.MaxDelay ?? '0').replace(/\D/g, '')) || 0;
      const avg = parseInt(String(a.Programs?.[0]?.AvgDelay ?? '0').replace(/\D/g, '')) || 0;
      return { name: a.ARPT ?? '', maxDelay: max, avgDelay: avg, reason: a.Programs?.[0]?.type ?? 'Unknown' };
    })
    .sort((a, b) => b.maxDelay - a.maxDelay)
    .slice(0, 8);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AlertTicker />
        <Header title="Deep Airport Stats" subtitle="Airline performance · NAS status · Global airspace intelligence" onRefresh={load} refreshing={refreshing} />
        <main className="flex-1 overflow-y-auto p-6 grid-bg">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatBadge icon={<BarChart2 size={18} style={{ color: '#ef4444' }} />} label="Delay Programs" value={totalDelayPrograms} color="#ef4444" />
            <StatBadge icon={<Clock size={18} style={{ color: '#f59e0b' }} />} label="Arrival Delays" value={totalDelays} color="#f59e0b" />
            <StatBadge icon={<Globe size={18} style={{ color: '#8b5cf6' }} />} label="IFR/LIFR Airports" value={ifrAirports} color="#8b5cf6" />
            <StatBadge icon={<Plane size={18} style={{ color: '#10b981' }} />} label="VFR Airports" value={vfrAirports} color="#10b981" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Airline Performance */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Airline On-Time Performance (%)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={AIRLINE_PERF} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="airline" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="onTime" name="On Time %" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delays" name="Delayed %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cancels" name="Cancelled %" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Hourly delay pattern */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Typical Delay by Hour (avg min)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={HOUR_DELAY} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} unit=" min" />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} formatter={(v) => [`${v} min`, 'Avg Delay']} />
                  <Bar dataKey="delay" radius={[3, 3, 0, 0]}>
                    {HOUR_DELAY.map((d, i) => (
                      <Cell key={i} fill={d.delay > 20 ? '#ef4444' : d.delay > 10 ? '#f59e0b' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Global traffic by country */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Global Traffic by Region</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={COUNTRY_TRAFFIC} dataKey="flights" nameKey="country" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                    {COUNTRY_TRAFFIC.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} formatter={(v) => [`${Number(v).toLocaleString()} flights`, 'Volume']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {COUNTRY_TRAFFIC.map(d => (
                  <div key={d.country} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} />
                    <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{d.country}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* NAS Performance Radar */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>NAS Health Radar</h2>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={RADAR_STATS}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} formatter={(v) => [`${v}%`, 'Score']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Flight Rules from live METARs */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Flight Rules — Live</h2>
              {flightRulesPie.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={flightRulesPie} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={40}>
                        {flightRulesPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {flightRulesPie.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        </div>
                        <span className="font-bold" style={{ color: d.color }}>{d.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
              )}
            </div>
          </div>

          {/* Worst delay airports from FAA */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="w-2 h-2 rounded-full bg-red-400 pulse-dot" />
              Airports with Active Delay Programs — FAA NAS Live Data
            </h2>
            {worstAirports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Airport', 'Program Type', 'Max Delay', 'Avg Delay'].map(h => (
                        <th key={h} className="text-left py-2.5 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {worstAirports.map((a, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-2 px-3 font-mono font-bold" style={{ color: 'var(--accent-cyan)' }}>{a.name}</td>
                        <td className="py-2 px-3"><span className="badge-orange px-2 py-0.5 rounded">{a.reason}</span></td>
                        <td className="py-2 px-3 font-mono font-bold" style={{ color: '#ef4444' }}>{a.maxDelay ? `${a.maxDelay} min` : '—'}</td>
                        <td className="py-2 px-3 font-mono" style={{ color: '#fbbf24' }}>{a.avgDelay ? `${a.avgDelay} min` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-lg text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {airportStatus.length === 0 ? 'Loading FAA NAS data…' : '✅ No active delay programs at this time'}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatBadge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card p-5 flex flex-col gap-2" style={{ boxShadow: `0 0 20px ${color}20` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>{icon}</div>
      </div>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
