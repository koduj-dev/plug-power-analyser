export type DeviceStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'AUTH_ERROR';

export interface DeviceRuntimeState {
  status: DeviceStatus;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  lastError: string | null;
  lastLatencyMs: number | null;
}

export interface DeviceDto {
  id: number;
  name: string;
  host: string;
  switchId: number;
  pollIntervalMs: number;
  groupName: string | null;
  description: string | null;
  enabled: boolean;
  hasCredentials: boolean;
  createdAt: string;
  updatedAt: string;
  runtime?: DeviceRuntimeState | null;
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

export interface DeviceCurrentResponse {
  device: DeviceDto;
  runtime: DeviceRuntimeState | null;
  latest: Sample | null;
  todayMinPowerW: number | null;
  todayMaxPowerW: number | null;
  rolling24hMinPowerW: number | null;
  rolling24hMaxPowerW: number | null;
  todayEnergyWh: number | null;
  cumulativeEnergyWh: number | null;
}

export interface DeviceStatistics {
  sampleCount: number;
  powerAvg: number | null;
  powerMin: number | null;
  powerMax: number | null;
  powerMedian: number | null;
  voltageAvg: number | null;
  voltageMin: number | null;
  voltageMax: number | null;
  currentAvg: number | null;
  currentMin: number | null;
  currentMax: number | null;
  temperatureAvg: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  energyWh: number | null;
}

export interface DeviceFormInput {
  name: string;
  host: string;
  switchId: number;
  username: string;
  password: string;
  pollIntervalMs: number;
  groupName: string;
  description: string;
  enabled: boolean;
}

export interface DeviceStatusMessage {
  type: 'device.status';
  deviceId: number;
  timestamp: number;
  power: number | null;
  voltage: number | null;
  current: number | null;
  frequency: number | null;
  temperature: number | null;
  energyTotal: number | null;
  output: boolean | null;
}

export interface DeviceStateMessage {
  type: 'device.state';
  deviceId: number;
  status: DeviceStatus;
  consecutiveFailures: number;
  lastError: string | null;
}

export type WsMessage = DeviceStatusMessage | DeviceStateMessage;
