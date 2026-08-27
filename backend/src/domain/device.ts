import type { Device, DeviceDto } from './types.js';

/** Strips credentials before a device is ever sent through the API. */
export function toDeviceDto(device: Device): DeviceDto {
  const { password, username, ...rest } = device;
  return {
    ...rest,
    hasCredentials: Boolean(username && password),
  };
}
