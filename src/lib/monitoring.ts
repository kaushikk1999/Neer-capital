// Monitoring abstraction — dependency-free scaffolding.
// Swap the bodies for Sentry / OpenTelemetry / a logging backend when ready;
// callers (error.tsx, web-vitals.tsx, instrumentation.ts) stay unchanged.

type Level = 'info' | 'warn' | 'error';

/** Structured log line. Replace with a real logger/transport in production. */
export function log(level: Level, message: string, context: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, message, ...context });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Runtime error capture. Wire to Sentry.captureException (or equivalent) here. */
export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  log('error', message, { ...context, stack: error instanceof Error ? error.stack : undefined });
}

/** Web Vitals sink. Forward to an analytics/RUM endpoint here. */
export function reportWebVital(metric: { name: string; value: number; id: string }): void {
  log('info', 'web-vital', { name: metric.name, value: Math.round(metric.value), id: metric.id });
}
