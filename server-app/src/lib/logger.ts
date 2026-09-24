import { env } from '@/lib/env';

/**
 * Minimal structured logger (NFR-11). Emits one JSON object per line so the
 * container's log driver can ship it without further parsing. Application
 * logging is deliberately separate from the audit trail: audit records are
 * durable business facts in the database, these are operational diagnostics.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type Level = keyof typeof LEVELS;

function threshold(): number {
  const configured = env.logLevel.toLowerCase() as Level;
  return LEVELS[configured] ?? LEVELS.info;
}

function emit(level: Level, message: string, fields?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold()) return;

  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg: message,
    ...fields,
  });

  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => emit('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => emit('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit('error', message, fields),
};
