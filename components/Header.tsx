'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, Clock, Wifi } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function Header({ title, subtitle, onRefresh, refreshing }: Props) {
  const [time, setTime] = useState('');
  const [utc, setUtc] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }));
      setUtc(now.toUTCString().slice(17, 25) + 'Z');
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
      style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
    >
      <div>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Live indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
          <Wifi size={12} className="pulse-dot" />
          LIVE
        </div>

        {/* UTC Clock */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <Clock size={12} />
          <span className="font-mono">{time}</span>
          <span style={{ color: 'var(--text-muted)' }}>/{utc}</span>
        </div>

        {/* Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: 'var(--accent-blue)',
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'radar-sweep' : ''} />
            Refresh
          </button>
        )}
      </div>
    </header>
  );
}
