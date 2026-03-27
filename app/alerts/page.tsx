'use client';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AlertTicker from '@/components/AlertTicker';
import AnimatedCounter from '@/components/AnimatedCounter';
import DataSourceBadge from '@/components/DataSourceBadge';
import { AlertTriangle, CloudLightning, Wind, Eye, Thermometer, Info, MapPin } from 'lucide-react';

interface SigmetEntry {
  icaoId?: string;
  rawAirSigmet?: string;
  hazard?: string;
  severity?: string;
  validTimeFrom?: string;
  validTimeTo?: string;
  airsigmetType?: string;
  alphaChar?: string;
  receiptTime?: string;
  forecast?: string;
  altitudeLow1?: number;
  altitudeHi1?: number;
}

interface AirmetEntry {
  icaoId?: string;
  rawAirmet?: string;
  hazard?: string;
  validTimeFrom?: string;
  validTimeTo?: string;
  airsigmetType?: string;
  alphaChar?: string;
}

interface PirepEntry {
  icaoId?: string;
  rawOb?: string;
  temp?: number;
  wdir?: number;
  wspd?: number;
  sky?: string;
  turbInten?: string;
  iceInten?: string;
  altitude?: number;
  flightLevel?: number;
  aicraft?: string;
  obsTime?: string;
  latitude?: number;
  longitude?: number;
}

interface AirportStatusEntry {
  ARPT?: string;
  Name?: string;
  City?: string;
  State?: string;
  Delays?: { type?: { Value?: string }; Reason?: string }[];
  Programs?: {
    type?: string;
    Reason?: string;
    MinDelay?: string;
    MaxDelay?: string;
    AvgDelay?: string;
  }[];
  Status?: string;
}

const HAZARD_ICONS: Record<string, React.ReactNode> = {
  TS: <CloudLightning size={14} />,
  TURB: <Wind size={14} />,
  ICE: <Thermometer size={14} />,
  IFR: <Eye size={14} />,
  LLWS: <Wind size={14} />,
  MTN: <Info size={14} />,
};

function hazardColor(hazard?: string): { color: string; bg: string } {
  switch (hazard) {
    case 'TS': return { color: '#f87171', bg: 'rgba(239,68,68,0.1)' };
    case 'TURB': return { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)' };
    case 'ICE': return { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' };
    case 'IFR': return { color: '#a78bfa', bg: 'rgba(139,92,246,0.1)' };
    default: return { color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' };
  }
}

function formatTime(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toUTCString().slice(0, 25) + 'Z'; } catch { return iso; }
}

interface NWSAlert {
  id: string; event?: string; headline?: string; area?: string;
  severity?: string; urgency?: string; description?: string;
  onset?: string; expires?: string; affectedAirports?: string[];
}

export default function AlertsPage() {
  const [sigmets, setSigmets] = useState<SigmetEntry[]>([]);
  const [airmets, setAirmets] = useState<AirmetEntry[]>([]);
  const [pireps, setPireps] = useState<PirepEntry[]>([]);
  const [airportStatus, setAirportStatus] = useState<AirportStatusEntry[]>([]);
  const [nwsAlerts, setNwsAlerts] = useState<NWSAlert[]>([]);
  const [tab, setTab] = useState<'programs' | 'nws' | 'sigmets' | 'airmets' | 'pireps'>('programs');
  const [source, setSource] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [sRes, aRes, pRes, stRes, nRes] = await Promise.all([
        fetch('/api/notams?type=sigmet'),
        fetch('/api/notams?type=airmet'),
        fetch('/api/notams?type=pirep'),
        fetch('/api/airport-status'),
        fetch('/api/nws-alerts'),
      ]);
      const [sJson, aJson, pJson, stJson, nJson] = await Promise.all([
        sRes.json(), aRes.json(), pRes.json(), stRes.json(), nRes.json(),
      ]);
      setSigmets(Array.isArray(sJson.data) ? sJson.data : []);
      setAirmets(Array.isArray(aJson.data) ? aJson.data : []);
      setNwsAlerts(Array.isArray(nJson.data) ? nJson.data : []);
      setSource(nJson.source ?? '');
      setPireps(Array.isArray(pJson.data) ? pJson.data.slice(0, 50) : []);
      setAirportStatus(Array.isArray(stJson.data) ? stJson.data : []);
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const activePrograms = airportStatus.filter(a => (a.Delays?.length ?? 0) > 0 || (a.Programs?.length ?? 0) > 0);
  const tabs = [
    { key: 'programs', label: 'FAA Programs',  count: activePrograms.length, color: '#ef4444' },
    { key: 'nws',      label: 'NWS Alerts',    count: nwsAlerts.length,      color: '#f97316' },
    { key: 'sigmets',  label: 'SIGMETs',       count: sigmets.length,        color: '#f59e0b' },
    { key: 'airmets',  label: 'AIRMETs',       count: airmets.length,        color: '#3b82f6' },
    { key: 'pireps',   label: 'PIREPs',        count: pireps.length,         color: '#10b981' },
  ] as const;

  const sevColor = (s?: string) =>
    s === 'Extreme' ? '#f87171' : s === 'Severe' ? '#fb923c' : s === 'Moderate' ? '#fbbf24' : '#60a5fa';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AlertTicker />
        <Header
          title="Alerts & Disruptions"
          subtitle="FAA NAS · NWS Weather Alerts · SIGMETs · AIRMETs · PIREPs"
          onRefresh={load}
          refreshing={refreshing}
        />
        <main className="flex-1 overflow-y-auto p-6 grid-bg">

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {tabs.map((t, i) => (
              <div
                key={t.key}
                className={`card p-4 cursor-pointer transition-all fade-in-${i+1}`}
                style={{ border: tab === t.key ? `1px solid ${t.color}40` : '1px solid var(--border)', boxShadow: tab === t.key ? `0 0 20px ${t.color}20` : 'none' }}
                onClick={() => setTab(t.key)}
              >
                <AnimatedCounter value={t.count} className="text-2xl font-bold mb-1" style={{ color: t.color }} />
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.label}</div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', width: 'fit-content' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: tab === t.key ? 'var(--bg-card)' : 'transparent',
                  color: tab === t.key ? t.color : 'var(--text-secondary)',
                  boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: `${t.color}20`, color: t.color }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* NWS Weather Alerts */}
          {tab === 'nws' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>National Weather Service active aviation alerts</span>
                <DataSourceBadge source={source} />
              </div>
              {nwsAlerts.length > 0 ? nwsAlerts.map((a, i) => {
                const sc = sevColor(a.severity);
                return (
                  <div key={i} className="card p-5 slide-in-right" style={{ border: `1px solid ${sc}25`, animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <AlertTriangle size={15} style={{ color: sc }} />
                          <span className="font-bold text-sm" style={{ color: sc }}>{a.event}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: `${sc}15`, color: sc, border: `1px solid ${sc}30` }}>
                            {a.severity}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.urgency}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <MapPin size={11} />
                          {a.area}
                        </div>
                      </div>
                      <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {a.expires && <div>Expires {new Date(a.expires).toLocaleTimeString()}</div>}
                      </div>
                    </div>
                    {a.headline && (
                      <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{a.headline}</div>
                    )}
                    {a.description && (
                      <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {a.description}
                      </div>
                    )}
                    {a.affectedAirports && a.affectedAirports.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Affected airports:</span>
                        {a.affectedAirports.map(ap => (
                          <span key={ap} className="font-mono text-xs px-2 py-0.5 rounded badge-yellow">{ap}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="card p-8 text-center">
                  <div className="text-3xl mb-3">✅</div>
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>No Active NWS Alerts</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>No NWS weather alerts affecting aviation at this time</div>
                </div>
              )}
            </div>
          )}

          {/* FAA Delay Programs */}
          {tab === 'programs' && (
            <div className="space-y-4">
              {activePrograms.length > 0 ? activePrograms.map((a, i) => (
                <div key={i} className="card p-5" style={{ border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 0 20px rgba(239,68,68,0.05)' }}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                        <span className="font-bold font-mono" style={{ color: 'var(--accent-cyan)' }}>{a.ARPT}</span>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{a.Name}</span>
                      </div>
                      {a.City && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.City}, {a.State}</div>}
                    </div>
                    <span className="badge-red px-2 py-1 rounded text-xs font-bold shrink-0">ACTIVE</span>
                  </div>

                  {(a.Programs ?? []).length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>DELAY PROGRAMS</div>
                      {a.Programs!.map((p, j) => (
                        <div key={j} className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="badge-orange px-2 py-0.5 rounded text-xs font-bold">{p.type}</span>
                            {p.MinDelay && p.MaxDelay && (
                              <span className="text-xs" style={{ color: '#fbbf24' }}>Delay: {p.MinDelay}–{p.MaxDelay}</span>
                            )}
                          </div>
                          {p.Reason && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.Reason}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {(a.Delays ?? []).length > 0 && (
                    <div className="space-y-2 mt-2">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>ARRIVAL DELAYS</div>
                      {a.Delays!.map((d, j) => (
                        <div key={j} className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.type?.Value ?? d.Reason ?? 'Delay'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>No Active FAA Delay Programs</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>The National Airspace System is operating normally</div>
                </div>
              )}
              {airportStatus.length === 0 && (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading FAA NAS Status data…</div>
              )}
            </div>
          )}

          {/* SIGMETs */}
          {tab === 'sigmets' && (
            <div className="space-y-3">
              {sigmets.length > 0 ? sigmets.map((s, i) => {
                const { color, bg } = hazardColor(s.hazard);
                return (
                  <div key={i} className="card p-5" style={{ border: `1px solid ${color}30` }}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span style={{ color }}>{HAZARD_ICONS[s.hazard ?? ''] ?? <AlertTriangle size={14} />}</span>
                        <span className="font-bold" style={{ color }}>SIGMET</span>
                        {s.alphaChar && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: bg, color }}>{s.alphaChar}</span>}
                        {s.hazard && <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: bg, color }}>{s.hazard}</span>}
                        {s.severity && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.severity}</span>}
                      </div>
                      <div className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                        <div>From: {formatTime(s.validTimeFrom)}</div>
                        <div>To: {formatTime(s.validTimeTo)}</div>
                      </div>
                    </div>
                    {s.altitudeLow1 != null && (
                      <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Altitudes: {s.altitudeLow1 ? `FL${Math.round(s.altitudeLow1/100)}` : 'SFC'} – {s.altitudeHi1 ? `FL${Math.round(s.altitudeHi1/100)}` : '—'}
                      </div>
                    )}
                    {s.rawAirSigmet && (
                      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                        <div className="font-mono text-xs" style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{s.rawAirSigmet}</div>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>No Active SIGMETs</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>No significant meteorological conditions affecting aviation at this time</div>
                </div>
              )}
            </div>
          )}

          {/* AIRMETs */}
          {tab === 'airmets' && (
            <div className="space-y-3">
              {airmets.length > 0 ? airmets.map((a, i) => {
                const { color, bg } = hazardColor(a.hazard);
                return (
                  <div key={i} className="card p-4" style={{ border: `1px solid ${color}25` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ color }}>{HAZARD_ICONS[a.hazard ?? ''] ?? <Info size={14} />}</span>
                      <span className="font-bold text-sm" style={{ color }}>AIRMET</span>
                      {a.alphaChar && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: bg, color }}>{a.alphaChar}</span>}
                      {a.hazard && <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: bg, color }}>{a.hazard}</span>}
                      <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                        Valid: {formatTime(a.validTimeFrom)} – {formatTime(a.validTimeTo)}
                      </span>
                    </div>
                    {a.rawAirmet && (
                      <div className="font-mono text-xs p-3 rounded-lg" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                        {a.rawAirmet}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>No Active AIRMETs</div>
                </div>
              )}
            </div>
          )}

          {/* PIREPs */}
          {tab === 'pireps' && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Pilot Weather Reports (PIREPs) — Last 3 Hours
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Station', 'Altitude', 'Turbulence', 'Icing', 'Wind', 'Temp', 'Raw'].map(h => (
                        <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pireps.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-2 px-3 font-mono font-bold" style={{ color: 'var(--accent-cyan)' }}>{p.icaoId ?? '—'}</td>
                        <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {p.altitude ? `${p.altitude}ft` : p.flightLevel ? `FL${p.flightLevel}` : '—'}
                        </td>
                        <td className="py-2 px-3">
                          {p.turbInten
                            ? <span className="px-1.5 py-0.5 rounded" style={{ background: p.turbInten.includes('SEV') ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: p.turbInten.includes('SEV') ? '#f87171' : '#fbbf24' }}>{p.turbInten}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="py-2 px-3">
                          {p.iceInten
                            ? <span className="px-1.5 py-0.5 rounded badge-blue">{p.iceInten}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {p.wdir != null && p.wspd != null ? `${p.wdir}°/${p.wspd}kt` : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {p.temp != null ? `${p.temp}°C` : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.rawOb ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pireps.length === 0 && (
                  <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Loading PIREPs…</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
