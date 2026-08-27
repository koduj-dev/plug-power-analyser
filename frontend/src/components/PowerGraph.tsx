import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Sample } from '../types';

export function PowerGraph({ samples, heightPx = 140 }: { samples: Sample[]; heightPx?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const timestamps = samples.map((s) => s.timestamp / 1000);
    const power = samples.map((s) => s.powerW ?? null);

    if (!plotRef.current) {
      plotRef.current = new uPlot(
        {
          width: containerRef.current.clientWidth || 300,
          height: heightPx,
          padding: [8, 8, 0, 0],
          cursor: { show: false },
          legend: { show: false },
          axes: [
            { stroke: '#9ca3af', grid: { stroke: '#e5e7eb' } },
            { stroke: '#9ca3af', grid: { stroke: '#e5e7eb' } },
          ],
          series: [
            {},
            { stroke: '#3b82f6', width: 2, fill: 'rgba(59,130,246,0.12)' },
          ],
        },
        [timestamps, power],
        containerRef.current,
      );
    } else {
      plotRef.current.setData([timestamps, power]);
    }
  }, [samples, heightPx]);

  useEffect(() => {
    return () => {
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="power-graph" />;
}
