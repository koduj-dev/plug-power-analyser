import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDeviceCurrent } from '../api/client';
import { useLiveDevice } from '../hooks/useLiveDevice';
import { useDeviceHistory } from '../hooks/useDeviceHistory';
import { StatusBadge } from './StatusBadge';
import { PeakGauge } from './PeakGauge';
import { PowerGraph } from './PowerGraph';
import { fmtKwh, fmtNumber, fmtWatts } from '../utils/format';
import type { DeviceCurrentResponse, DeviceDto } from '../types';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function DeviceCard({ device }: { device: DeviceDto }) {
  const live = useLiveDevice(device.id);
  const [current, setCurrent] = useState<DeviceCurrentResponse | null>(null);
  const history = useDeviceHistory(device.id, ONE_HOUR_MS, 20000);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getDeviceCurrent(device.id);
        if (!cancelled) setCurrent(data);
      } catch {
        // keep previous snapshot on transient errors
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [device.id]);

  const status = live.state?.status ?? current?.runtime?.status ?? device.runtime?.status;
  const power = live.status?.power ?? current?.latest?.powerW ?? null;
  const voltage = live.status?.voltage ?? current?.latest?.voltageV ?? null;
  const currentA = live.status?.current ?? current?.latest?.currentA ?? null;
  const frequency = live.status?.frequency ?? current?.latest?.frequencyHz ?? null;
  const temperature = live.status?.temperature ?? current?.latest?.temperatureC ?? null;
  const output = live.status?.output ?? current?.latest?.output ?? null;
  const energyTotal = live.status?.energyTotal ?? current?.cumulativeEnergyWh ?? null;

  return (
    <Link to={`/devices/${device.id}`} className="device-card">
      <div className="device-card-header">
        <h3>{device.name}</h3>
        <StatusBadge status={status} />
      </div>

      <div className="device-card-power">{fmtWatts(power)}</div>

      <div className="device-card-row">
        <span>{fmtNumber(voltage, 'V')}</span>
        <span>{fmtNumber(currentA, 'A', 3)}</span>
        <span>{fmtNumber(frequency, 'Hz')}</span>
        <span>{fmtNumber(temperature, '°C')}</span>
      </div>

      <div className="device-card-row device-card-relay">
        Relay: <strong>{output === null ? '—' : output ? 'ON' : 'OFF'}</strong>
      </div>

      <div className="device-card-stats">
        <div>
          <span>Today</span>
          <strong>{fmtKwh(current?.todayEnergyWh)}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{fmtKwh(energyTotal)}</strong>
        </div>
        <div>
          <span>Today min</span>
          <strong>{fmtWatts(current?.todayMinPowerW)}</strong>
        </div>
        <div>
          <span>Today max</span>
          <strong>{fmtWatts(current?.todayMaxPowerW)}</strong>
        </div>
        <div>
          <span>24h min</span>
          <strong>{fmtWatts(current?.rolling24hMinPowerW)}</strong>
        </div>
        <div>
          <span>24h max</span>
          <strong>{fmtWatts(current?.rolling24hMaxPowerW)}</strong>
        </div>
      </div>

      <PeakGauge currentW={power} peak24hW={current?.rolling24hMaxPowerW ?? null} />
      <PowerGraph samples={history} />
    </Link>
  );
}
