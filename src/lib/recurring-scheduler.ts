import { processRecurringTransactions } from '@/lib/db';

const DEFAULT_MIN_INTERVAL_MS = 60_000;

let lastRunAtMs = 0;
let inFlight: Promise<{ created: number }> | null = null;

interface RecurringSchedulerOptions {
  force?: boolean;
  minIntervalMs?: number;
}

function isDynamicServerUsageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { digest?: unknown; message?: unknown };
  if (candidate.digest === 'DYNAMIC_SERVER_USAGE') {
    return true;
  }

  return (
    typeof candidate.message === 'string' &&
    candidate.message.toLowerCase().includes('dynamic server usage')
  );
}

export function scheduleRecurringProcessing(
  options: RecurringSchedulerOptions = {}
): Promise<{ created: number }> {
  const { force = false, minIntervalMs = DEFAULT_MIN_INTERVAL_MS } = options;

  if (inFlight) {
    return inFlight;
  }

  const nowMs = Date.now();
  if (!force && nowMs - lastRunAtMs < minIntervalMs) {
    return Promise.resolve({ created: 0 });
  }

  inFlight = processRecurringTransactions()
    .then((result) => {
      lastRunAtMs = Date.now();
      return result;
    })
    .catch((error) => {
      if (!isDynamicServerUsageError(error)) {
        console.error('Recurring processing failed:', error);
      }
      return { created: 0 };
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
