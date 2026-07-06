// Next.js server bootstrap hook (runs once on server start).
// Extension point for initializing error tracking / tracing / structured logging.
// Kept dependency-free; wire Sentry.init() or an OTEL SDK here when adopted.
import { log } from '@/lib/monitoring';

export async function register(): Promise<void> {
  log('info', 'server-start', { runtime: process.env.NEXT_RUNTIME ?? 'nodejs' });
}
