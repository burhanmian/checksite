interface Props { rules: string }

const colors: Record<string, { bg: string; text: string; label: string }> = {
  VFR:  { bg: 'rgba(16,185,129,0.15)',  text: '#34d399', label: 'VFR' },
  MVFR: { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', label: 'MVFR' },
  IFR:  { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', label: 'IFR' },
  LIFR: { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', label: 'LIFR' },
};

export default function FlightRulesBadge({ rules }: Props) {
  const c = colors[rules] ?? colors['VFR'];
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}
