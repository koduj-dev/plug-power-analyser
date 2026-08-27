import { useState } from 'react';
import type { FormEvent } from 'react';
import { testConnection } from '../api/client';
import type { DeviceDto, DeviceFormInput } from '../types';

export interface DeviceFormProps {
  initial?: DeviceDto;
  submitLabel: string;
  onSubmit: (input: Partial<DeviceFormInput>) => Promise<void>;
}

function toFormState(device?: DeviceDto): DeviceFormInput {
  return {
    name: device?.name ?? '',
    host: device?.host ?? '',
    switchId: device?.switchId ?? 0,
    username: '',
    password: '',
    pollIntervalMs: device?.pollIntervalMs ?? 1000,
    groupName: device?.groupName ?? '',
    description: device?.description ?? '',
    enabled: device?.enabled ?? true,
  };
}

export function DeviceForm({ initial, submitLabel, onSubmit }: DeviceFormProps) {
  const [form, setForm] = useState<DeviceFormInput>(() => toFormState(initial));
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof DeviceFormInput>(key: K, value: DeviceFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(form);
      setTestResult(`OK — output ${result.ok ? 'reachable' : 'unknown'}, ${result.apower} W`);
    } catch (err) {
      setTestResult(`Failed: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.host.trim()) {
      setError('Name and host are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Partial<DeviceFormInput> = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.username) delete payload.username;
      await onSubmit(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="device-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
      </label>
      <label>
        Host / IP
        <input value={form.host} onChange={(e) => update('host', e.target.value)} placeholder="192.168.0.28" required />
      </label>
      <label>
        Switch ID
        <input
          type="number"
          value={form.switchId}
          onChange={(e) => update('switchId', Number(e.target.value))}
          min={0}
        />
      </label>
      <label>
        Poll interval (ms)
        <input
          type="number"
          value={form.pollIntervalMs}
          onChange={(e) => update('pollIntervalMs', Number(e.target.value))}
          min={250}
          step={250}
        />
      </label>
      <label>
        Username {initial?.hasCredentials && <em>(leave blank to keep existing)</em>}
        <input value={form.username} onChange={(e) => update('username', e.target.value)} autoComplete="off" />
      </label>
      <label>
        Password {initial?.hasCredentials && <em>(leave blank to keep existing)</em>}
        <input
          type="password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label>
        Group
        <input value={form.groupName} onChange={(e) => update('groupName', e.target.value)} />
      </label>
      <label>
        Description
        <textarea value={form.description} onChange={(e) => update('description', e.target.value)} />
      </label>
      <label className="device-form-checkbox">
        <input type="checkbox" checked={form.enabled} onChange={(e) => update('enabled', e.target.checked)} />
        Enabled
      </label>

      <div className="device-form-actions">
        <button type="button" onClick={handleTest} disabled={testing || !form.host}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>

      {testResult && <p className="device-form-test-result">{testResult}</p>}
      {error && <p className="device-form-error">{error}</p>}
    </form>
  );
}
