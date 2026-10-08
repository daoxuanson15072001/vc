// Test defaults (M1b-04): legacy tokens without a user keep full access, permission facts are not cached.
process.env.AUTHZ_LEGACY_TOKENS ??= '1';
process.env.AUTHZ_CACHE_MS ??= '0';
process.env.CUSTOMERS_SWEEP_MS ??= '0';
// Plan C6: no background VCsales checks in tests; GET /api/admin/vcsales checks once on demand.
process.env.VCSALE_PING_MS ??= '0';
// M1a-06: the per-nick send pace is off in tests unless a suite turns it on (outbox-pace.e2e-spec.ts).
process.env.SEND_PACE_DISABLED ??= '1';
