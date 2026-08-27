export type DeviceStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'AUTH_ERROR';

export interface Device {
  id: number;
  name: string;
  host: string;
  switchId: number;
  username: string | null;
  password: string | null;
  pollIntervalMs: number;
  groupName: string | null;
  description: string | null;
  enabled: boolean;
  energyOffsetWh: number;
  lastRawEnergyWh: number | null;
  returnedEnergyOffsetWh: number;
  lastRawReturnedEnergyWh: number | null;
  createdAt: string;
  updatedAt: string;
}

export type DeviceDto = Omit<Device, 'password' | 'username'> & { hasCredentials: boolean };

export interface DeviceInput {
  name: string;
  host: string;
  switchId: number;
  username: string | null;
  password: string | null;
  pollIntervalMs: number;
  groupName: string | null;
  description: string | null;
  enabled: boolean;
}

export interface Sample {
  id: number;
  deviceId: number;
  timestamp: number;
  powerW: number | null;
  voltageV: number | null;
  currentA: number | null;
  frequencyHz: number | null;
  temperatureC: number | null;
  energyTotalWh: number | null;
  returnedEnergyTotalWh: number | null;
  output: boolean | null;
  rawEnergyTotalWh: number | null;
  source: string;
}

export interface NewSample {
  deviceId: number;
  timestamp: number;
  powerW: number | null;
  voltageV: number | null;
  currentA: number | null;
  frequencyHz: number | null;
  temperatureC: number | null;
  energyTotalWh: number | null;
  returnedEnergyTotalWh: number | null;
  output: boolean | null;
  rawEnergyTotalWh: number | null;
  source?: string;
}

export interface ShellySwitchStatus {
  id: number;
  source: string;
  output: boolean;
  apower: number;
  voltage: number;
  freq: number;
  current: number;
  aenergy: { total: number };
  ret_aenergy?: { total: number };
  temperature?: { tC: number };
}
