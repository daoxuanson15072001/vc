/**
 * Process role. `all` (default, main.ts) runs everything; `connector`
 * (connector.ts) runs ingest/webhooks/outbox only; `web` serves the API but
 * leaves background jobs (OutboxDispatcher, Zalo OA token refresh) to the
 * connector so they never run twice.
 */
export const processRole = (): 'all' | 'web' | 'connector' => {
  const r = process.env.VCLINKS_ROLE;
  return r === 'web' || r === 'connector' ? r : 'all';
};

export const runsBackgroundJobs = () => processRole() !== 'web';
