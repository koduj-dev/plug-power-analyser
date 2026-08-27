import type { DeviceCurrentResponse, DeviceDto, DeviceFormInput, DeviceStatistics, Sample } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? `Request failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listDevices(): Promise<DeviceDto[]> {
  return request('/api/devices');
}

export function getDevice(id: number): Promise<DeviceDto> {
  return request(`/api/devices/${id}`);
}

export function getDeviceCurrent(id: number): Promise<DeviceCurrentResponse> {
  return request(`/api/devices/${id}/current`);
}

export function getDeviceHistory(id: number, fromMs: number, toMs: number): Promise<Sample[]> {
  const params = new URLSearchParams({ from: String(fromMs), to: String(toMs) });
  return request(`/api/devices/${id}/history?${params}`);
}

export function getDeviceStatistics(id: number, fromMs: number, toMs: number): Promise<DeviceStatistics> {
  const params = new URLSearchParams({ from: String(fromMs), to: String(toMs) });
  return request(`/api/devices/${id}/statistics?${params}`);
}

export function createDevice(input: Partial<DeviceFormInput>): Promise<DeviceDto> {
  return request('/api/devices', { method: 'POST', body: JSON.stringify(input) });
}

export function updateDevice(id: number, input: Partial<DeviceFormInput>): Promise<DeviceDto> {
  return request(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteDevice(id: number): Promise<void> {
  return request(`/api/devices/${id}`, { method: 'DELETE' });
}

export function testConnection(input: Partial<DeviceFormInput>): Promise<{ ok: boolean; apower: number }> {
  return request('/api/devices/test-connection', { method: 'POST', body: JSON.stringify(input) });
}
