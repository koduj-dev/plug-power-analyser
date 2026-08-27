export function PeakGauge({ currentW, peak24hW }: { currentW: number | null; peak24hW: number | null }) {
  const pct = peak24hW && peak24hW > 0 && currentW !== null ? Math.min(100, (currentW / peak24hW) * 100) : 0;
  return (
    <div className="peak-gauge">
      <div className="peak-gauge-track">
        <div className="peak-gauge-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="peak-gauge-label">{Math.round(pct)}% of 24h observed peak</span>
    </div>
  );
}
