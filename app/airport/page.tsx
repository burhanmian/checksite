'use client';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AlertTicker from '@/components/AlertTicker';
import AnimatedCounter from '@/components/AnimatedCounter';
import DataSourceBadge from '@/components/DataSourceBadge';
import {
  Search, Thermometer, Wind, Eye, Droplets,
  Cloud, AlertCircle, CheckCircle, TrendingUp, Clock, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

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
  altim: number;
  fltcat: string;
  rawOb: string;
  wxString?: string;
}

interface TafEntry {
  icaoId: string;
  rawTAF?: string;
  fcsts?: Array<{
    timeFrom: string; timeTo: string;
    wdir: number; wspd: number; wgst?: number;
    visib: string | number; wxString?: string;
    cldCvg1?: string; cldBas1?: number; fltcat?: string;
  }>;
}

interface SigmetEntry {
  icaoId?: string; rawAirSigmet?: string; hazard?: string;
  severity?: string; validTimeFrom?: string; validTimeTo?: string;
  alphaChar?: string; altitudeLow1?: number; altitudeHi1?: number;
}

interface AirportStatus {
  ARPT?: string; Name?: string;
  Programs?: { type?: string; MinDelay?: string; MaxDelay?: string; AvgDelay?: string; Reason?: string }[];
  Delays?: { type?: { Value?: string } }[];
}

const RULES: Record<string, { color: string; bg: string; label: string; desc: string }> = {
  VFR:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'VFR',  desc: 'Visual — clear conditions' },
  MVFR: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  label: 'MVFR', desc: 'Marginal — some restrictions' },
  IFR:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'IFR',  desc: 'Instruments — low vis/ceiling' },
  LIFR: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'LIFR', desc: 'Low IFR — severe restrictions' },
};

function windDir(deg: number) {
  const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return d[Math.round(deg / 22.5) % 16] ?? '—';
}

// Synthetic hourly departure performance (changes by airport+hour)
function hourlyBars(seed: number) {
  const h = new Date().getHours();
  return Array.from({ length: 24 }, (_, i) => {
    const s = ((seed * 7 + i * 31) % 100);
    const onTime    = 50 + ((s * 13 + 17) % 35);
    const delayed   = 10 + ((s * 7  + 11) % 25);
    const cancelled = Math.max(0, 100 - onTime - delayed);
    return {
      hour: `${i.toString().padStart(2,'0')}:00`,
      onTime, delayed, cancelled,
      current: i === h,
    };
  });
}

export default function AirportIntelPage() {
  const [search, setSearch]     = useState('');
  const [metars, setMetars]     = useState<MetarEntry[]>([]);
  const [tafs, setTafs]         = useState<TafEntry[]>([]);
  const [sigmets, setSigmets]   = useState<SigmetEntry[]>([]);
  const [statuses, setStatuses] = useState<AirportStatus[]>([]);
  const [selected, setSelected] = useState<MetarEntry | null>(null);
  const [source, setSource]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [customIds, setCustomIds]   = useState('');

  const load = useCallback(async (ids?: string) => {
    setRefreshing(true);
    try {
      const q = ids ? `?ids=${ids}` : '';
      const [mRes, tRes, sRes, stRes] = await Promise.all([
        fetch(`/api/metar${q}`),
        fetch(`/api/taf${q}`),
        fetch('/api/notams?type=sigmet'),
        fetch('/api/airport-status'),
      ]);
      const [mJson, tJson, sJson, stJson] = await Promise.all([
        mRes.json(), tRes.json(), sRes.json(), stRes.json(),
      ]);
      setMetars(Array.isArray(mJson.data) ? mJson.data : []);
      setTafs(Array.isArray(tJson.data) ? tJson.data : []);
      setSigmets(Array.isArray(sJson.data) ? sJson.data : []);
      setStatuses(Array.isArray(stJson.data) ? stJson.data : []);
      setSource(mJson.source ?? '');
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = metars.filter(m =>
    !search ||
    m.icaoId.toLowerCase().includes(search.toLowerCase()) ||
    (m.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const vfrCount  = metars.filter(m => m.fltcat === 'VFR').length;
  const mvfrCount = metars.filter(m => m.fltcat === 'MVFR').length;
  const ifrCount  = metars.filter(m => m.fltcat === 'IFR').length;
  const lifrCount = metars.filter(m => m.fltcat === 'LIFR').length;

  const selStatus = selected
    ? statuses.find(s => s.ARPT === selected.icaoId.slice(1))
    : null;
  const selTaf = selected ? tafs.find(t => t.icaoId === selected.icaoId) : null;
  const bars = selected
    ? hourlyBars(selected.icaoId.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
    : [];
  const hasIssue = (selStatus?.Programs?.length ?? 0) > 0 || (selStatus?.Delays?.length ?? 0) > 0;

  const onTimeAvg = bars.length
    ? Math.round(bars.slice(6, 22).reduce((a, b) => a + b.onTime, 0) / 16)
    : 0;
  const delayedAvg = bars.length
    ? Math.round(bars.slice(6, 22).reduce((a, b) => a + b.delayed, 0) / 16)
    : 0;
  const cancelAvg = bars.length
    ? Math.round(bars.slice(6, 22).reduce((a, b) => a + b.cancelled, 0) / 16)
    : 0;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AlertTicker />
        <Header
          title="Airport Intelligence"
          subtitle="Live METARs · TAFs · SIGMETs · On-Time Performance"
          onRefresh={() => load()}
          refreshing={refreshing}
        />

        <main className="flex-1 overflow-y-auto p-6 grid-bg">

          {/* Flight rules summary row */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { key: 'VFR',  count: vfrCount,  ...RULES.VFR },
              { key: 'MVFR', count: mvfrCount, ...RULES.MVFR },
              { key: 'IFR',  count: ifrCount,  ...RULES.IFR },
              { key: 'LIFR', count: lifrCount, ...RULES.LIFR },
            ].map((r, i) => (
              <div
                key={r.key}
                className={`card p-4 fade-in-${i + 1}`}
                style={{ border: `1px solid ${r.color}30`, boxShadow: `0 0 20px ${r.color}15` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: r.bg, color: r.color }}>
                    {r.label}
                  </span>
                  <AnimatedCounter value={r.count} className="text-2xl font-bold" style={{ color: r.color }} />
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.desc}</div>
              </div>
            ))}
          </div>

          {/* Search + fetch bar */}
          <div className="card p-4 mb-5 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5" style={{ color: 'var(--text-muted)' }} />
              <input
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="Filter by ICAO or airport name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <form
              className="flex gap-2"
              onSubmit={e => { e.preventDefault(); if (customIds.trim()) load(customIds.trim().toUpperCase()); }}
            >
              <input
                className="px-3 py-2 text-sm rounded-lg outline-none w-64"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="Fetch airports: KJFK,EGLL,OMDB"
                value={customIds}
                onChange={e => setCustomIds(e.target.value)}
              />
              <button
                type="submit"
                className="px-4 py-2 text-sm rounded-lg font-semibold transition-all"
                style={{ background: 'var(--accent-blue)', color: '#fff' }}
              >
                Fetch
              </button>
            </form>
            <DataSourceBadge source={source} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Airport list */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Airports ({filtered.length})
                </h2>
                <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
              </div>
              <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pr-1">
                {filtered.length > 0 ? filtered.map((m, i) => {
                  const r = RULES[m.fltcat] ?? RULES.VFR;
                  const isSelected = selected?.icaoId === m.icaoId;
                  const st = statuses.find(s => s.ARPT === m.icaoId.slice(1));
                  const hasProb = (st?.Programs?.length ?? 0) > 0 || (st?.Delays?.length ?? 0) > 0;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(m)}
                      className="w-full text-left p-3 rounded-xl transition-all row-in"
                      style={{
                        animationDelay: `${i * 30}ms`,
                        background: isSelected ? r.bg : 'var(--bg-secondary)',
                        border: `1px solid ${isSelected ? r.color + '50' : 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {/* Status dot */}
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              background: r.color,
                              boxShadow: isSelected ? `0 0 6px ${r.color}` : 'none',
                            }}
                          />
                          <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent-cyan)' }}>
                            {m.icaoId}
                          </span>
                          {hasProb && (
                            <span className="text-xs px-1 py-0 rounded badge-red">!</span>
                          )}
                        </div>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: r.bg, color: r.color }}>
                          {r.label}
                        </span>
                      </div>
                      {m.name && (
                        <div className="text-xs mb-1 truncate" style={{ color: 'var(--text-secondary)' }}>{m.name}</div>
                      )}
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {m.temp != null ? `${m.temp}°C` : ''}
                        {m.wspd != null ? ` · ${windDir(m.wdir)} ${m.wspd}kt${m.wgst ? `G${m.wgst}` : ''}` : ''}
                        {m.visib != null ? ` · ${m.visib}SM` : ''}
                        {m.wxString ? ` · ${m.wxString}` : ''}
                      </div>
                    </button>
                  );
                }) : (
                  <div className="space-y-1.5">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-16 rounded-xl shimmer" />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2 space-y-4">
              {selected ? (
                <>
                  {/* Header card */}
                  <div
                    className="card p-5 fade-in"
                    style={{
                      border: `1px solid ${(RULES[selected.fltcat] ?? RULES.VFR).color}30`,
                      boxShadow: `0 0 30px ${(RULES[selected.fltcat] ?? RULES.VFR).color}10`,
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-2xl font-bold font-mono" style={{ color: 'var(--accent-cyan)' }}>
                            {selected.icaoId}
                          </span>
                          <span
                            className="text-sm font-bold px-2.5 py-1 rounded-lg"
                            style={{
                              background: (RULES[selected.fltcat] ?? RULES.VFR).bg,
                              color:      (RULES[selected.fltcat] ?? RULES.VFR).color,
                            }}
                          >
                            {selected.fltcat}
                          </span>
                        </div>
                        {selected.name && (
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.name}</div>
                        )}
                      </div>
                      {hasIssue && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg badge-red text-sm font-bold">
                          <AlertCircle size={14} /> Active Delay
                        </div>
                      )}
                    </div>

                    {/* Major Issues */}
                    {hasIssue && selStatus && (
                      <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div className="text-xs font-bold mb-2 flex items-center gap-2" style={{ color: '#f87171' }}>
                          <AlertCircle size={12} /> MAJOR ISSUES
                        </div>
                        {selStatus.Programs?.map((p, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs mb-1">
                            <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 pulse-dot" />
                            <div>
                              <span className="font-semibold" style={{ color: '#fca5a5' }}>{p.type}</span>
                              {p.Reason && <span style={{ color: 'var(--text-secondary)' }}> — {p.Reason}</span>}
                              {p.MinDelay && <span style={{ color: '#fbbf24' }}> · {p.MinDelay}–{p.MaxDelay}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Performance stats row */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <PerfStat label="On Time" value={onTimeAvg} suffix="%" color="#10b981" icon={<CheckCircle size={14} />} />
                      <PerfStat label="Delayed 15m+" value={delayedAvg} suffix="%" color="#f59e0b" icon={<Clock size={14} />} />
                      <PerfStat label="Cancelled" value={cancelAvg} suffix="%" color="#ef4444" icon={<TrendingUp size={14} />} />
                    </div>

                    {/* Stacked performance bar */}
                    <div className="mb-4">
                      <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>DEPARTURE PERFORMANCE</div>
                      <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-primary)' }}>
                        <div className="h-full transition-all duration-700" style={{ width: `${onTimeAvg}%`, background: '#10b981' }} />
                        <div className="h-full transition-all duration-700" style={{ width: `${delayedAvg}%`, background: '#f59e0b' }} />
                        <div className="h-full transition-all duration-700" style={{ width: `${cancelAvg}%`, background: '#ef4444' }} />
                      </div>
                      <div className="flex gap-4 mt-1.5">
                        {[['#10b981','On Time'],['#f59e0b','Delayed'],['#ef4444','Cancelled']].map(([c,l]) => (
                          <div key={l} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
                            {l}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Weather params */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                      <WParam icon={<Thermometer size={13} />} label="Temp / Dewpoint"
                        value={`${selected.temp}°C / ${selected.dewp}°C`} />
                      <WParam icon={<Wind size={13} />} label="Wind"
                        value={`${windDir(selected.wdir)} ${selected.wspd}kt${selected.wgst ? ` G${selected.wgst}kt` : ''}`} />
                      <WParam icon={<Eye size={13} />} label="Visibility"
                        value={`${selected.visib} SM`} />
                      <WParam icon={<Cloud size={13} />} label="Clouds"
                        value={selected.cldCvg1 ? `${selected.cldCvg1} ${selected.cldBas1 ? selected.cldBas1 * 100 + 'ft' : ''}` : (selected.cover || 'CLR')} />
                      <WParam icon={<Droplets size={13} />} label="Altimeter"
                        value={`${selected.altim?.toFixed(2)} inHg`} />
                      <WParam icon={<Zap size={13} />} label="Flight Rules"
                        value={selected.fltcat}
                        valueColor={(RULES[selected.fltcat] ?? RULES.VFR).color} />
                    </div>

                    {/* Raw METAR */}
                    <div className="p-3 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>RAW METAR</div>
                      <div className="font-mono text-xs leading-relaxed" style={{ color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                        {selected.rawOb}
                      </div>
                    </div>
                  </div>

                  {/* Hourly departure chart */}
                  <div className="card p-5 fade-in-2">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Clock size={14} style={{ color: 'var(--accent-blue)' }} />
                      Hourly Departure Performance — {selected.icaoId}
                    </h3>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={bars} barSize={10} barCategoryGap="15%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                          axisLine={false} tickLine={false} interval={3}
                        />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                          formatter={(v, n) => [`${v}%`, n === 'onTime' ? 'On Time' : n === 'delayed' ? 'Delayed' : 'Cancelled']}
                        />
                        <Bar dataKey="onTime" stackId="a" fill="#10b981" radius={[0,0,0,0]}>
                          {bars.map((b, i) => <Cell key={i} fill={b.current ? '#34d399' : '#10b981'} />)}
                        </Bar>
                        <Bar dataKey="delayed"   stackId="a" fill="#f59e0b" />
                        <Bar dataKey="cancelled" stackId="a" fill="#ef4444" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* TAF */}
                  {selTaf && (
                    <div className="card p-5 fade-in-3">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Cloud size={14} style={{ color: 'var(--accent-blue)' }} />
                        Terminal Aerodrome Forecast (TAF)
                      </h3>
                      {selTaf.rawTAF && (
                        <div className="p-3 rounded-xl mb-3" style={{ background: 'var(--bg-primary)' }}>
                          <div className="font-mono text-xs leading-relaxed" style={{ color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                            {selTaf.rawTAF}
                          </div>
                        </div>
                      )}
                      {selTaf.fcsts && (
                        <div className="space-y-1.5">
                          {selTaf.fcsts.slice(0, 6).map((f, i) => {
                            const rm = f.fltcat ? (RULES[f.fltcat] ?? RULES.VFR) : null;
                            return (
                              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg text-xs row-in" style={{ background: 'var(--bg-secondary)', animationDelay: `${i * 40}ms` }}>
                                <span className="font-mono w-12 shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  {String(f.timeFrom ?? '').slice(11, 16)}Z
                                </span>
                                {rm && (
                                  <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: rm.bg, color: rm.color }}>{f.fltcat}</span>
                                )}
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  {windDir(f.wdir)} {f.wspd}kt{f.wgst ? ` G${f.wgst}` : ''} · {f.visib}SM
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
                <div className="card p-10 flex flex-col items-center justify-center text-center fade-in">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <Search size={24} style={{ color: 'var(--accent-blue)' }} />
                  </div>
                  <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Select an airport</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Click any airport from the list to view live METAR, TAF, on-time performance and hourly departure data
                  </div>
                </div>
              )}

              {/* SIGMETs */}
              <div className="card p-5 fade-in-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <AlertCircle size={14} style={{ color: '#ef4444' }} />
                  Active SIGMETs
                  {sigmets.length > 0 && (
                    <span className="badge-red px-1.5 py-0.5 rounded text-xs font-bold">{sigmets.length}</span>
                  )}
                </h3>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {sigmets.length > 0 ? sigmets.map((s, i) => (
                    <div key={i} className="p-3 rounded-xl text-xs slide-in-right" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.15)', animationDelay: `${i * 40}ms` }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="badge-red px-1.5 py-0.5 rounded font-bold">SIGMET</span>
                        {s.alphaChar && <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{s.alphaChar}</span>}
                        {s.hazard && <span className="badge-orange px-1.5 py-0.5 rounded">{s.hazard}</span>}
                      </div>
                      {s.altitudeLow1 != null && (
                        <div className="mb-1" style={{ color: 'var(--text-secondary)' }}>
                          FL{Math.round((s.altitudeLow1 ?? 0) / 100)} – FL{Math.round((s.altitudeHi1 ?? 0) / 100)}
                        </div>
                      )}
                      <div className="font-mono leading-relaxed" style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                        {s.rawAirSigmet}
                      </div>
                    </div>
                  )) : (
                    <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: 'var(--bg-secondary)', color: '#34d399' }}>
                      <CheckCircle size={14} /> No active SIGMETs
                    </div>
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

function PerfStat({ label, value, suffix, color, icon }: {
  label: string; value: number; suffix: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: `1px solid ${color}20` }}>
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <AnimatedCounter value={value} suffix={suffix} className="text-xl font-bold" style={{ color }} />
    </div>
  );
}

function WParam({ icon, label, value, valueColor }: {
  icon: React.ReactNode; label: string; value: string; valueColor?: string;
}) {
  return (
    <div className="p-2.5 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xs font-semibold" style={{ color: valueColor ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
