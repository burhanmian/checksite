'use client';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AlertTicker from '@/components/AlertTicker';
import { ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface MetarEntry {
  icaoId: string;
  fltcat: string;
  temp: number;
  wspd: number;
  wgst?: number;
  visib: string | number;
  wxString?: string;
}

interface AirportStatusEntry {
  ARPT?: string;
  Name?: string;
  Programs?: { type?: string; MinDelay?: string; MaxDelay?: string; AvgDelay?: string }[];
  Delays?: { type?: { Value?: string } }[];
}

// Well-known busy routes with IATA pairs
const ROUTES = [
  { origin: 'JFK', destination: 'LAX', originCity: 'New York', destinationCity: 'Los Angeles', originICAO: 'KJFK', destICAO: 'KLAX', dailyFlights: 28 },
  { origin: 'ORD', destination: 'ATL', originCity: 'Chicago', destinationCity: 'Atlanta', originICAO: 'KORD', destICAO: 'KATL', dailyFlights: 42 },
  { origin: 'ATL', destination: 'MIA', originCity: 'Atlanta', destinationCity: 'Miami', originICAO: 'KATL', destICAO: 'KMIA', dailyFlights: 36 },
  { origin: 'LAX', destination: 'SFO', originCity: 'Los Angeles', destinationCity: 'San Francisco', originICAO: 'KLAX', destICAO: 'KSFO', dailyFlights: 52 },
  { origin: 'JFK', destination: 'BOS', originCity: 'New York', destinationCity: 'Boston', originICAO: 'KJFK', destICAO: 'KBOS', dailyFlights: 31 },
  { origin: 'DFW', destination: 'ORD', originCity: 'Dallas', destinationCity: 'Chicago', originICAO: 'KDFW', destICAO: 'KORD', dailyFlights: 25 },
  { origin: 'DEN', destination: 'LAX', originCity: 'Denver', destinationCity: 'Los Angeles', originICAO: 'KDEN', destICAO: 'KLAX', dailyFlights: 18 },
  { origin: 'JFK', destination: 'LHR', originCity: 'New York', destinationCity: 'London', originICAO: 'KJFK', destICAO: 'EGLL', dailyFlights: 18 },
];

type RouteAlert = 'green' | 'yellow' | 'red';

interface RouteWithStatus {
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  dailyFlights: number;
  originStatus: AirportStatusEntry | undefined;
  destStatus: AirportStatusEntry | undefined;
  originMetar: MetarEntry | undefined;
  destMetar: MetarEntry | undefined;
  alertLevel: RouteAlert;
  issues: string[];
}

function getAlertLevel(
  originStatus: AirportStatusEntry | undefined,
  destStatus: AirportStatusEntry | undefined,
  originMetar: MetarEntry | undefined,
  destMetar: MetarEntry | undefined,
): { level: RouteAlert; issues: string[] } {
  const issues: string[] = [];
  let level: RouteAlert = 'green';

  const hasProgram = (s?: AirportStatusEntry) => (s?.Programs?.length ?? 0) > 0 || (s?.Delays?.length ?? 0) > 0;
  if (hasProgram(originStatus)) { issues.push(`${originStatus!.ARPT}: Active delay program`); level = 'red'; }
  if (hasProgram(destStatus)) { issues.push(`${destStatus!.ARPT}: Active delay program`); level = 'red'; }

  const badMetar = (m?: MetarEntry) => m?.fltcat === 'IFR' || m?.fltcat === 'LIFR';
  if (badMetar(originMetar)) { issues.push(`${originMetar!.icaoId}: ${originMetar!.fltcat} conditions`); if (level !== 'red') level = 'yellow'; }
  if (badMetar(destMetar)) { issues.push(`${destMetar!.icaoId}: ${destMetar!.fltcat} conditions`); if (level !== 'red') level = 'yellow'; }

  const strongWind = (m?: MetarEntry) => m && m.wspd > 25;
  if (strongWind(originMetar)) { issues.push(`${originMetar!.icaoId}: Strong winds ${originMetar!.wspd}kt`); if (level === 'green') level = 'yellow'; }
  if (strongWind(destMetar)) { issues.push(`${destMetar!.icaoId}: Strong winds ${destMetar!.wspd}kt`); if (level === 'green') level = 'yellow'; }

  return { level, issues };
}

const LEVEL_META = {
  green:  { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  label: 'On Time',  icon: <TrendingDown size={14} /> },
  yellow: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Delays',   icon: <Minus size={14} /> },
  red:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  label: 'Disrupted', icon: <TrendingUp size={14} /> },
};

export default function RoutesPage() {
  const [metars, setMetars] = useState<MetarEntry[]>([]);
  const [airportStatus, setAirportStatus] = useState<AirportStatusEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<RouteWithStatus | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const allICAO = [...new Set(ROUTES.flatMap(r => [r.originICAO, r.destICAO]))].join(',');
      const [mRes, sRes] = await Promise.all([
        fetch(`/api/metar?ids=${allICAO}`),
        fetch('/api/airport-status'),
      ]);
      const [mJson, sJson] = await Promise.all([mRes.json(), sRes.json()]);
      setMetars(Array.isArray(mJson.data) ? mJson.data : []);
      setAirportStatus(Array.isArray(sJson.data) ? sJson.data : []);
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const routes: RouteWithStatus[] = ROUTES.map(r => {
    const originStatus = airportStatus.find(a => a.ARPT === r.origin);
    const destStatus = airportStatus.find(a => a.ARPT === r.destination);
    const originMetar = metars.find(m => m.icaoId === r.originICAO);
    const destMetar = metars.find(m => m.icaoId === r.destICAO);
    const { level, issues } = getAlertLevel(originStatus, destStatus, originMetar, destMetar);
    return { ...r, originStatus, destStatus, originMetar, destMetar, alertLevel: level, issues };
  });

  const summary = {
    green: routes.filter(r => r.alertLevel === 'green').length,
    yellow: routes.filter(r => r.alertLevel === 'yellow').length,
    red: routes.filter(r => r.alertLevel === 'red').length,
  };

  const barData = routes.map(r => ({
    name: `${r.origin}→${r.destination}`,
    flights: r.dailyFlights,
    color: LEVEL_META[r.alertLevel].color,
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AlertTicker />
        <Header title="Route Monitor" subtitle="Real-time route health based on live METAR + FAA NAS data" onRefresh={load} refreshing={refreshing} />
        <main className="flex-1 overflow-y-auto p-6 grid-bg">

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {(['green', 'yellow', 'red'] as const).map(l => (
              <div key={l} className="card p-5" style={{ border: `1px solid ${LEVEL_META[l].border}`, boxShadow: `0 0 20px ${LEVEL_META[l].bg}` }}>
                <div className="text-3xl font-bold mb-1" style={{ color: LEVEL_META[l].color }}>{summary[l]}</div>
                <div className="text-sm font-medium" style={{ color: LEVEL_META[l].color }}>{LEVEL_META[l].label}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>routes</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Route List */}
            <div className="lg:col-span-1 card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Major Routes ({routes.length})</h2>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {routes.map((r, i) => {
                  const meta = LEVEL_META[r.alertLevel];
                  const isSelected = selected?.origin === r.origin && selected?.destination === r.destination;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(r)}
                      className="w-full text-left p-3 rounded-lg transition-all"
                      style={{
                        background: isSelected ? meta.bg : 'var(--bg-secondary)',
                        border: `1px solid ${isSelected ? meta.border : 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm" style={{ color: meta.color }}>{r.origin}</span>
                        <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                        <span className="font-mono font-bold text-sm" style={{ color: meta.color }}>{r.destination}</span>
                        <span className="ml-auto px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {r.originCity} → {r.destinationCity}
                      </div>
                      {r.issues.length > 0 && (
                        <div className="text-xs mt-1" style={{ color: '#fbbf24' }}>{r.issues[0]}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Panel */}
            <div className="lg:col-span-2 space-y-4">
              {selected ? (
                <>
                  <div className="card p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold font-mono" style={{ color: LEVEL_META[selected.alertLevel].color }}>{selected.origin}</span>
                        <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xl font-bold font-mono" style={{ color: LEVEL_META[selected.alertLevel].color }}>{selected.destination}</span>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-bold" style={{ background: LEVEL_META[selected.alertLevel].bg, color: LEVEL_META[selected.alertLevel].color, border: `1px solid ${LEVEL_META[selected.alertLevel].border}` }}>
                        {LEVEL_META[selected.alertLevel].label}
                      </span>
                      <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{selected.dailyFlights} daily flights</span>
                    </div>

                    {selected.issues.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>ACTIVE ISSUES</div>
                        {selected.issues.map((issue, i) => (
                          <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                            <TrendingUp size={12} />
                            {issue}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg mb-4 text-xs" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                        ✓ No active disruptions on this route
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <EndpointCard label="Origin" airport={selected.origin} city={selected.originCity} metar={selected.originMetar} status={selected.originStatus} />
                      <EndpointCard label="Destination" airport={selected.destination} city={selected.destinationCity} metar={selected.destMetar} status={selected.destStatus} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="card p-8 flex flex-col items-center justify-center text-center">
                  <ArrowRight size={32} style={{ color: 'var(--text-muted)' }} className="mb-3" />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a route to view detailed status</p>
                </div>
              )}

              {/* Bar chart */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Daily Flight Volume by Route</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={barData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={40} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} formatter={(v) => [v, 'Flights/day']} />
                    <Bar dataKey="flights" radius={[4, 4, 0, 0]}>
                      {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const FLTCAT_META: Record<string, { color: string; bg: string }> = {
  VFR:  { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  MVFR: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  IFR:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  LIFR: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

function EndpointCard({ label, airport, city, metar, status }: {
  label: string;
  airport: string;
  city: string;
  metar?: MetarEntry;
  status?: AirportStatusEntry;
}) {
  const hasIssue = (status?.Programs?.length ?? 0) > 0 || (status?.Delays?.length ?? 0) > 0;
  const catMeta = metar?.fltcat ? (FLTCAT_META[metar.fltcat] ?? FLTCAT_META['VFR']) : null;
  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
      <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="font-bold font-mono text-lg mb-1" style={{ color: 'var(--accent-cyan)' }}>{airport}</div>
      <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{city}</div>
      {metar ? (
        <div className="space-y-1 text-xs">
          {catMeta && (
            <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: catMeta.bg, color: catMeta.color }}>
              {metar.fltcat}
            </span>
          )}
          <div style={{ color: 'var(--text-secondary)' }}>Wind: {metar.wspd}kt {metar.wgst ? `G${metar.wgst}kt` : ''}</div>
          <div style={{ color: 'var(--text-secondary)' }}>Vis: {metar.visib}SM</div>
          {metar.wxString && <div style={{ color: '#fbbf24' }}>{metar.wxString}</div>}
        </div>
      ) : (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No METAR available</div>
      )}
      {hasIssue && (
        <div className="mt-2 text-xs px-2 py-1 rounded badge-red">
          {status!.Programs?.[0]?.type ?? 'Delay active'}
        </div>
      )}
    </div>
  );
}
