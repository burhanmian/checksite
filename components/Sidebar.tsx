'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Plane, Bell, MapPin, BarChart2, Radio,
  Zap, Shield, Globe, Map,
} from 'lucide-react';

const nav = [
  { href: '/',         label: 'Overview',         icon: Globe },
  { href: '/map',      label: 'Live Geo Map',      icon: Map },
  { href: '/flights',  label: 'Live Flights',      icon: Plane },
  { href: '/alerts',   label: 'Alerts',            icon: Bell },
  { href: '/airport',  label: 'Airport Intel',     icon: Radio },
  { href: '/routes',   label: 'Route Monitor',     icon: MapPin },
  { href: '/stats',    label: 'Deep Stats',        icon: BarChart2 },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      className="w-56 shrink-0 flex flex-col h-screen sticky top-0"
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-blue)' }}>
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <div className="font-bold text-sm tracking-wide gradient-text">SkyWatch</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Flight Intel</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                borderLeft: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Live Data</span>
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          OpenSky · AviationWeather<br />FAA NAS Status
        </div>
      </div>

      {/* Shield */}
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <Shield size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pilot-grade data</span>
      </div>
    </aside>
  );
}
