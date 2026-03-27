interface Props {
  source?: string;
}

export default function DataSourceBadge({ source }: Props) {
  if (!source) return null;
  const isLive = source !== 'simulation';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: isLive ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
        border: `1px solid ${isLive ? 'rgba(16,185,129,0.4)' : 'rgba(139,92,246,0.4)'}`,
        color: isLive ? '#34d399' : '#a78bfa',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full pulse-dot"
        style={{ background: isLive ? '#34d399' : '#a78bfa' }}
      />
      {isLive ? source.toUpperCase() : 'SIMULATED · LIVE'}
    </span>
  );
}
