'use client';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AlertTicker from '@/components/AlertTicker';
import { Search, Thermometer, Wind, Eye, Droplets, Cloud, AlertCircle } from 'lucide-react';

interface MetarEntry {
  icaoId: string;
  name?: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  wgst?: number;
  visib: string | number;
  cover: string;
  cldBas1?: number;
  cldCvg1?: string;
  cldBas2?: number;
  cldCvg2?: string;
  altim: number;
  fltcat: string;
  rawOb: string;
  wxString?: string;
  reportTime?: string;
}

interface TafEntry {
  icaoId: string;
  rawTAF?: string;
  fcsts?: Array<{
    timeFrom: string;
    timeTo: string;
    wdir: number;
    wspd: number;
    wgst?: number;
    visib: string | number;
    wxString?: string;
    cldCvg1?: string;
    cldBas1?: number;
    fltcat?: string;
  }>;
}

interface SigmetEntry {
  icaoId?: string;
  rawAirSigmet?: string;
  hazard?: string;
  severity?: string;
  validTimeFrom?: string;
  validTimeTo?: string;
  airsigmetType?: string;
  alphaChar?: string;
}

const RULES_META: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  VFR:  { label: 'VFR',  desc: 'Visual Flight Rules — Clear conditions',           color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  MVFR: { label: 'MVFR', desc: 'Marginal VFR — Some restrictions',                 color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  IFR:  { label: 'IFR',  desc: 'Instrument Flight Rules — Low visibility/ceilings', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  LIFR: { label: 'LIFR', desc: 'Low IFR — Severe restrictions',                    color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

function windDir(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16] ?? '—';
}

export default function AirportIntelPage() {
  const [search, setSearch] = useState('');
  const [metars, setMetars] = useState<MetarEntry[]>([]);
  const [tafs, setTafs] = useState<TafEntry[]>([]);
  const [sigmets, setSigmets] = useState<SigmetEntry[]>([]);
  const [selected, setSelected] = useState<MetarEntry | null>(null);
  const [selectedTaf, setSelectedTaf] = useState<TafEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [customIds, setCustomIds] = useState('');

  const load = useCallback(async (ids?: string) => {
    setRefreshing(true);
    try {
      const idsParam = ids ? `?ids=${ids}` : '';
      const [mRes, tRes, sRes] = await Promise.all([
        fetch(`/api/metar${idsParam}`),
        fetch(`/api/taf${idsParam}`),
        fetch('/api/notams?type=sigmet'),
      ]);
      const [mJson, tJson, sJson] = await Promise.all([mRes.json(), tRes.json(), sRes.json()]);
      setMetars(Array.isArray(mJson.data) ? mJson.data : []);
      setTafs(Array.isArray(tJson.data) ? tJson.data : []);
      setSigmets(Array.isArray(sJson.data) ? sJson.data.slice(0, 20) : []);
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(), 60000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = metars.filter(m =>
    !search || m.icaoId.toLowerCase().includes(search.toLowerCase()) || (m.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customIds.trim()) load(customIds.trim().toUpperCase());
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AlertTicker />
        <Header title="Airport Intelligence" subtitle="Live METARs · TAFs · SIGMETs from AviationWeather.gov" onRefresh={() => load()} refreshing={refreshing} />
        <main className="flex-1 overflow-y-auto p-6 grid-bg">

          {/* Search Bar */}
          <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-3" style={{ color: 'var(--text-muted)' }} />
              <input
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="Filter loaded airports (e.g. KJFK)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                className="px-3 py-2 text-sm rounded-lg outline-none w-64"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="Fetch new airports: KJFK,EGLL,OMDB"
                value={customIds}
                onChange={e => setCustomIds(e.target.value)}
              />
              <button type="submit" className="px-4 py-2 text-sm rounded-lg font-medium" style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                Fetch
              </button>
            </form>
          </div>

          {/* Flight Rules Legend */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {Object.entries(RULES_META).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: v.bg, border: `1px solid ${v.color}40`, color: v.color }}>
                <span className="font-bold">{v.label}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{v.desc}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* METAR List */}
            <div className="lg:col-span-1 card p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
                Live METARs ({filtered.length})
              </h2>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {filtered.length > 0 ? filtered.map((m, i) => {
                  const meta = RULES_META[m.fltcat] ?? RULES_META['VFR'];
                  const isSelected = selected?.icaoId === m.icaoId;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelected(m);
                        setSelectedTaf(tafs.find(t => t.icaoId === m.icaoId) ?? null);
                      }}
                      className="w-full text-left p-3 rounded-lg transition-all"
                      style={{
                        background: isSelected ? meta.bg : 'var(--bg-secondary)',
                        border: `1px solid ${isSelected ? meta.color + '60' : 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent-cyan)' }}>{m.icaoId}</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>{m.fltcat}</span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {m.temp != null ? `${m.temp}°C` : ''} · {m.wspd}kt · {m.visib}SM
                        {m.wxString ? ` · ${m.wxString}` : ''}
                      </div>
                    </button>
                  );
                }) : (
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading METAR data…</div>
                )}
              </div>
            </div>

            {/* Detail Panel */}
            <div className="lg:col-span-2 space-y-4">
              {selected ? (
                <>
                  {/* METAR Detail */}
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold font-mono" style={{ color: 'var(--accent-cyan)' }}>{selected.icaoId}</h2>
                        {selected.name && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.name}</p>}
                      </div>
                      {(() => {
                        const meta = RULES_META[selected.fltcat] ?? RULES_META['VFR'];
                        return (
                          <div className="text-right">
                            <div className="text-lg font-bold" style={{ color: meta.color }}>{meta.label}</div>
                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{meta.desc}</div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Weather params grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      <WeatherParam icon={<Thermometer size={14} />} label="Temperature" value={`${selected.temp}°C / ${Math.round(selected.temp * 9/5 + 32)}°F`} />
                      <WeatherParam icon={<Droplets size={14} />} label="Dewpoint" value={`${selected.dewp}°C`} />
                      <WeatherParam icon={<Wind size={14} />} label="Wind" value={`${windDir(selected.wdir)} ${selected.wspd}kt${selected.wgst ? ` G${selected.wgst}kt` : ''}`} />
                      <WeatherParam icon={<Eye size={14} />} label="Visibility" value={`${selected.visib} SM`} />
                      <WeatherParam icon={<Cloud size={14} />} label="Clouds" value={selected.cldCvg1 ? `${selected.cldCvg1} ${selected.cldBas1 ? selected.cldBas1 * 100 + 'ft' : ''}` : selected.cover || 'CLR'} />
                      <WeatherParam icon={<AlertCircle size={14} />} label="Altimeter" value={`${selected.altim?.toFixed(2)} inHg`} />
                    </div>

                    {/* Raw METAR */}
                    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>RAW METAR</div>
                      <div className="font-mono text-xs" style={{ color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>{selected.rawOb}</div>
                    </div>
                  </div>

                  {/* TAF */}
                  {selectedTaf && (
                    <div className="card p-5">
                      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Terminal Aerodrome Forecast (TAF)</h3>
                      {selectedTaf.rawTAF && (
                        <div className="p-3 rounded-lg mb-3" style={{ background: 'var(--bg-primary)' }}>
                          <div className="font-mono text-xs" style={{ color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>{selectedTaf.rawTAF}</div>
                        </div>
                      )}
                      {selectedTaf.fcsts && selectedTaf.fcsts.length > 0 && (
                        <div className="space-y-2">
                          {selectedTaf.fcsts.slice(0, 6).map((f, i) => {
                            const meta = f.fltcat ? (RULES_META[f.fltcat] ?? RULES_META['VFR']) : null;
                            return (
                              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg text-xs" style={{ background: 'var(--bg-secondary)' }}>
                                <div className="font-mono" style={{ color: 'var(--text-muted)', minWidth: 80 }}>
                                  {String(f.timeFrom ?? '').slice(0, 10)} {String(f.timeFrom ?? '').slice(11, 16)}Z
                                </div>
                                {meta && <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: meta.bg, color: meta.color }}>{f.fltcat}</span>}
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  {windDir(f.wdir)} {f.wspd}kt{f.wgst ? ` G${f.wgst}kt` : ''} · {f.visib}SM
                                  {f.wxString ? ` · ${f.wxString}` : ''}
                                  {f.cldCvg1 ? ` · ${f.cldCvg1} ${f.cldBas1 ? f.cldBas1 * 100 + 'ft' : ''}` : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="card p-8 flex flex-col items-center justify-center text-center">
                  <Search size={32} style={{ color: 'var(--text-muted)' }} className="mb-3" />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select an airport from the list to view detailed METAR and TAF data</p>
                </div>
              )}

              {/* SIGMETs */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <AlertCircle size={14} style={{ color: '#ef4444' }} />
                  Active SIGMETs ({sigmets.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sigmets.length > 0 ? sigmets.map((s, i) => (
                    <div key={i} className="p-2.5 rounded-lg text-xs" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold badge-red px-1.5 py-0.5 rounded">SIGMET</span>
                        <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{s.alphaChar ?? s.icaoId ?? ''}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{s.hazard ?? s.airsigmetType ?? ''}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{s.rawAirSigmet ?? ''}</div>
                    </div>
                  )) : (
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No active SIGMETs or loading…</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function WeatherParam({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
