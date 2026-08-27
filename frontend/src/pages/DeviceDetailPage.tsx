import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDevice, getDeviceCurrent, getDeviceStatistics } from '../api/client';
import { useLiveDevice } from '../hooks/useLiveDevice';
import { useDeviceHistory } from '../hooks/useDeviceHistory';
import { StatusBadge } from '../components/StatusBadge';
import { PowerGraph } from '../components/PowerGraph';
import { fmtKwh, fmtNumber, fmtWatts } from '../utils/format';
import type { DeviceCurrentResponse, DeviceDto, DeviceStatistics } from '../types';

type PeriodKey = 'hour' | 'today' | 'yesterday' | '7d';

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'hour', label: 'Last hour' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
];

function periodRange(key: PeriodKey): { from: number; to: number } {
  const now = Date.now();
  if (key === 'hour') return { from: now - 60 * 60 * 1000, to: now };
  if (key === '7d') return { from: now - 7 * 24 * 60 * 60 * 1000, to: now };
  const d = new Date();
  const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (key === 'today') return { from: startOfToday, to: now };
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  return { from: startOfYesterday, to: startOfToday };
}

export function DeviceDetailPage() {
  const { id } = useParams();
  const deviceId = Number(id);
  const live = useLiveDevice(deviceId);
  const [device, setDevice] = useState<DeviceDto | null>(null);
  const [current, setCurrent] = useState<DeviceCurrentResponse | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [stats, setStats] = useState<DeviceStatistics | null>(null);
  const history = useDeviceHistory(deviceId, 60 * 60 * 1000, 10000);

  useEffect(() => {
    let cancelled = false;
    getDevice(deviceId).then((d) => !cancelled && setDevice(d));
    async function loadCurrent() {
      const data = await getDeviceCurrent(deviceId);
      if (!cancelled) setCurrent(data);
    }
    loadCurrent();
    const interval = setInterval(loadCurrent, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [deviceId]);

  const range = useMemo(() => periodRange(period), [period]);

  useEffect(() => {
    let cancelled = false;
    getDeviceStatistics(deviceId, range.from, range.to).then((data) => !cancelled && setStats(data));
    return () => {
      cancelled = true;
    };
  }, [deviceId, range.from, range.to]);

  const status = live.state?.status ?? current?.runtime?.status ?? device?.runtime?.status;
  const power = live.status?.power ?? current?.latest?.powerW ?? null;
  const voltage = live.status?.voltage ?? current?.latest?.voltageV ?? null;
  const currentA = live.status?.current ?? current?.latest?.currentA ?? null;
  const frequency = live.status?.frequency ?? current?.latest?.frequencyHz ?? null;
  const temperature = live.status?.temperature ?? current?.latest?.temperatureC ?? null;
  const output = live.status?.output ?? current?.latest?.output ?? null;
  const energyTotal = live.status?.energyTotal ?? current?.cumulativeEnergyWh ?? null;

  if (!device) return <p>Loading…</p>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{device.name}</h1>
        <div className="page-header-actions">
          <StatusBadge status={status} />
          <Link to={`/devices/${device.id}/edit`}>Edit</Link>
          <Link to="/">← Back</Link>
        </div>
      </div>

      {device.description && <p className="device-description">{device.description}</p>}

      <section className="detail-section">
        <h2>Current state</h2>
        <div className="detail-grid">
          <div>
            <span>Power</span>
            <strong>{fmtWatts(power)}</strong>
          </div>
          <div>
            <span>Voltage</span>
            <strong>{fmtNumber(voltage, 'V')}</strong>
          </div>
          <div>
            <span>Current</span>
            <strong>{fmtNumber(currentA, 'A', 3)}</strong>
          </div>
          <div>
            <span>Frequency</span>
            <strong>{fmtNumber(frequency, 'Hz')}</strong>
          </div>
          <div>
            <span>Temperature</span>
            <strong>{fmtNumber(temperature, '°C')}</strong>
          </div>
          <div>
            <span>Relay</span>
            <strong>{output === null ? '—' : output ? 'ON' : 'OFF'}</strong>
          </div>
          <div>
            <span>Total energy</span>
            <strong>{fmtKwh(energyTotal)}</strong>
          </div>
          <div>
            <span>Last update</span>
            <strong>
              {current?.latest ? new Date(current.latest.timestamp).toLocaleTimeString() : '—'}
            </strong>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h2>Power — last hour</h2>
        <PowerGraph samples={history} heightPx={220} />
      </section>

      <section className="detail-section">
        <h2>Statistics</h2>
        <div className="period-selector">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={p.key === period ? 'period-active' : ''}
              onClick={() => setPeriod(p.key)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>

        {stats && (
          <div className="stats-tables">
            <table>
              <caption>Power (W)</caption>
              <tbody>
                <tr>
                  <td>Average</td>
                  <td>{fmtWatts(stats.powerAvg)}</td>
                </tr>
                <tr>
                  <td>Minimum</td>
                  <td>{fmtWatts(stats.powerMin)}</td>
                </tr>
                <tr>
                  <td>Maximum</td>
                  <td>{fmtWatts(stats.powerMax)}</td>
                </tr>
                <tr>
                  <td>Median</td>
                  <td>{fmtWatts(stats.powerMedian)}</td>
                </tr>
              </tbody>
            </table>
            <table>
              <caption>Voltage (V)</caption>
              <tbody>
                <tr>
                  <td>Average</td>
                  <td>{fmtNumber(stats.voltageAvg, 'V')}</td>
                </tr>
                <tr>
                  <td>Minimum</td>
                  <td>{fmtNumber(stats.voltageMin, 'V')}</td>
                </tr>
                <tr>
                  <td>Maximum</td>
                  <td>{fmtNumber(stats.voltageMax, 'V')}</td>
                </tr>
              </tbody>
            </table>
            <table>
              <caption>Current (A)</caption>
              <tbody>
                <tr>
                  <td>Average</td>
                  <td>{fmtNumber(stats.currentAvg, 'A', 3)}</td>
                </tr>
                <tr>
                  <td>Minimum</td>
                  <td>{fmtNumber(stats.currentMin, 'A', 3)}</td>
                </tr>
                <tr>
                  <td>Maximum</td>
                  <td>{fmtNumber(stats.currentMax, 'A', 3)}</td>
                </tr>
              </tbody>
            </table>
            <table>
              <caption>Temperature (°C)</caption>
              <tbody>
                <tr>
                  <td>Average</td>
                  <td>{fmtNumber(stats.temperatureAvg, '°C')}</td>
                </tr>
                <tr>
                  <td>Minimum</td>
                  <td>{fmtNumber(stats.temperatureMin, '°C')}</td>
                </tr>
                <tr>
                  <td>Maximum</td>
                  <td>{fmtNumber(stats.temperatureMax, '°C')}</td>
                </tr>
              </tbody>
            </table>
            <table>
              <caption>Energy</caption>
              <tbody>
                <tr>
                  <td>Consumed this period</td>
                  <td>{fmtKwh(stats.energyWh)}</td>
                </tr>
                <tr>
                  <td>Samples</td>
                  <td>{stats.sampleCount}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
