/**
 * The report-analysis schema version this build expects.
 *
 * Shared by the web readiness check and the worker's boot-time schema wait, so
 * the two services cannot drift apart on what "ready" means.
 */
export const EXPECTED_SCHEMA_VERSION = 2
