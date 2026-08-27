export function fmtNumber(value: number | null | undefined, unit: string, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)} ${unit}`;
}

export function fmtWatts(value: number | null | undefined): string {
  return fmtNumber(value, 'W', 0);
}

export function fmtKwh(valueWh: number | null | undefined): string {
  if (valueWh === null || valueWh === undefined || Number.isNaN(valueWh)) return '—';
  return `${(valueWh / 1000).toFixed(3)} kWh`;
}
