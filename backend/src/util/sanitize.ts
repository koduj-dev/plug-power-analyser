function buildControlCharsRegex(): RegExp {
  const chars: string[] = [];
  for (let code = 0; code <= 0x1f; code++) chars.push(String.fromCharCode(code));
  chars.push(String.fromCharCode(0x7f));
  const escaped = chars.map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  return new RegExp(`[${escaped}]`, 'g');
}

const CONTROL_CHARS = buildControlCharsRegex();

/**
 * Strips control characters and clamps length for free-text, user-provided
 * fields (device name/description/group) before they are stored or rendered.
 */
export function sanitizeText(input: unknown, maxLength = 255): string | null {
  if (input === null || input === undefined) return null;
  const str = String(input);
  const stripped = str.replace(CONTROL_CHARS, '').trim();
  if (stripped.length === 0) return null;
  return stripped.slice(0, maxLength);
}

export function sanitizeRequiredText(input: unknown, maxLength = 255): string {
  const value = sanitizeText(input, maxLength);
  if (value === null) throw new Error('Value must not be empty');
  return value;
}

export function sanitizeHost(input: unknown): string {
  const value = sanitizeText(input, 255);
  if (!value) throw new Error('Host must not be empty');
  const cleaned = value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!/^[a-zA-Z0-9.[\]:-]+$/.test(cleaned)) {
    throw new Error('Host contains invalid characters');
  }
  return cleaned;
}
