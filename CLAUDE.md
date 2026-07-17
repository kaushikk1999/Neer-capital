# Project instructions

Analyse affected dependencies before editing. Preserve existing behaviour, use the
smallest complete diff, and avoid unrelated refactors. Validate runtime changes on an
isolated Railway environment before production deployment. Do not run the application
locally unless the user explicitly changes this instruction.

## Deployment

- Railway service `neer-web` is GitHub-linked (`kaushikk1999/Neer-capital`, branch `main`)
  and also accepts CLI source uploads. A CLI upload does **not** update GitHub, so
  production can drift ahead of `main`; always push, or a later GitHub-triggered redeploy
  will roll production back to whatever `main` holds.
- Web and worker share one container: `npm run start` runs
  `concurrently "next start" "npm run worker"`.

## Document pipeline

- The queue is MySQL-backed polling (`AnalysisJob`, 5s poll) — there is no Redis.
- `pdf-parse` is pinned to **1.1.1**. Its v2 line exports a class rather than a callable,
  which breaks `src/worker/pdf-extractor.ts`. Do not bump it without changing that call site.
- Uploaded PDFs live in Cloudflare R2 (`STORAGE_PROVIDER=r2`), not on the container disk.
