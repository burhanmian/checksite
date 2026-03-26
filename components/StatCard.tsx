import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color?: string;
  glowColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export default function StatCard({ label, value, sub, icon: Icon, color = '#3b82f6', glowColor, trend, trendValue }: Props) {
  return (
    <div
      className="card p-5 flex flex-col gap-3"
      style={{ boxShadow: glowColor ? `0 0 20px ${glowColor}` : undefined }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}20` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
        {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</div>}
      </div>
      {trend && trendValue && (
        <div className={`text-xs font-medium ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : ''}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </div>
      )}
    </div>
  );
}
