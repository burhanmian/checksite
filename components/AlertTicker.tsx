'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface TickerItem {
  airport: string;
  message: string;
  severity: string;
}

export default function AlertTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    // Fetch real FAA airport status data for ticker
    const load = async () => {
      try {
        const res = await fetch('/api/airport-status');
        const json = await res.json();
        const data = json.data ?? [];

        const mapped: TickerItem[] = [];

        if (Array.isArray(data)) {
          data.forEach((item: Record<string, unknown>) => {
            const delays = (item.Delays as Record<string, unknown>[]) ?? [];
            delays.forEach((d: Record<string, unknown>) => {
              const type = d.type as Record<string, unknown> | undefined;
              mapped.push({
                airport: String(item.ARPT ?? ''),
                message: String(type?.Value ?? d.Reason ?? JSON.stringify(d)),
                severity: 'high',
              });
            });
            const programs = (item.Programs as Record<string, unknown>[]) ?? [];
            programs.forEach((p: Record<string, unknown>) => {
              mapped.push({
                airport: String(item.ARPT ?? ''),
                message: String(p.type ?? p.Reason ?? JSON.stringify(p)),
                severity: 'critical',
              });
            });
          });
        }

        if (mapped.length === 0) {
          mapped.push(
            { airport: 'FAA', message: 'No active ground stops or delay programs at this time', severity: 'info' },
          );
        }

        setItems(mapped);
      } catch {
        setItems([{ airport: 'SYSTEM', message: 'Live alert feed — connecting to FAA NAS Status...', severity: 'info' }]);
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const doubled = [...items, ...items]; // seamless loop

  return (
    <div
      className="flex items-center overflow-hidden text-xs"
      style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', height: '32px' }}
    >
      <div className="flex items-center gap-2 px-3 shrink-0" style={{ color: '#f87171' }}>
        <AlertTriangle size={12} />
        <span className="font-bold tracking-wide">ALERTS</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="flex whitespace-nowrap ticker-text gap-16">
          {doubled.map((item, i) => (
            <span key={i} style={{ color: item.severity === 'critical' ? '#f87171' : '#fbbf24' }}>
              <span className="font-bold">{item.airport}</span>
              {' — '}
              {item.message}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
