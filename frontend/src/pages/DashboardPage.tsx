import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDevices } from '../api/client';
import { DeviceCard } from '../components/DeviceCard';
import type { DeviceDto } from '../types';

export function DashboardPage() {
  const [devices, setDevices] = useState<DeviceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listDevices();
        if (!cancelled) {
          setDevices(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Plug Power Analyser</h1>
        <Link to="/devices/new" className="button-primary">
          + Add device
        </Link>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {devices === null ? (
        <p>Loading…</p>
      ) : devices.length === 0 ? (
        <p className="empty-state">No devices configured yet. Add your first Shelly plug to start monitoring.</p>
      ) : (
        <div className="device-grid">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
