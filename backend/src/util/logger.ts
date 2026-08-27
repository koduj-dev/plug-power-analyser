import pino from 'pino';
import type { LoggerOptions } from 'pino';

const level = process.env.PPA_LOG_LEVEL ?? 'info';
const pretty = process.env.NODE_ENV !== 'production';

export function pinoOptions(): LoggerOptions {
  return {
    level,
    redact: {
      paths: [
        'password',
        'device.password',
        '*.password',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    transport: pretty
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  };
}

export const logger = pino(pinoOptions());

export function childLogger(name: string) {
  return logger.child({ module: name });
}
