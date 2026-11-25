# Spetly delivery workflow

- When the user asks to implement, change, fix, or build something, finish and verify the scoped work, then commit it and push it to `origin/main` without requiring a separate "push" request.
- After pushing, verify the Vercel deployment status and report whether production deployment completed successfully.
- Do not commit, push, or deploy when the user explicitly asks only for planning, review, diagnosis, or a report, or explicitly says not to publish yet.
- Never include unrelated user changes in a commit. If unrelated changes prevent a safe isolated commit, stop and explain the conflict.

## Meta Ads Intelligence

- Goal: maintain a read-only, explainable intelligence layer for the SPETER wedding business and IRISMOMENT event/iris-photography business. Keep brand/account mappings explicit; never infer a brand from campaign naming alone.
- Architecture: Next.js API routes, Prisma/PostgreSQL persistence, Trigger.dev schedules, and the isolated `lib/meta-ads` domain. Reuse these components before introducing new infrastructure.
- Safety: Meta Graph API access in Phase 1 is GET-only. Never publish, pause, delete, retarget, change budgets, or otherwise mutate a live Meta asset. Recommendations must remain advisory and require a human decision.
- Secrets: keep Meta tokens and account mappings in environment variables. Never put tokens in source, URLs, logs, snapshots, errors, fixtures, commits, or reports.
- Data quality: never invent missing Meta or business values. Persist unavailable metrics as null with an explicit availability status; distinguish missing, measured zero, provisional attribution data, and not-applicable data.
- History: daily insight imports must remain idempotent. Re-fetch recent days to absorb delayed attribution, retain timestamped status/budget/creative snapshots, and protect scheduled jobs with a database lock.
- Analytics: calculate ratios from aggregated base metrics instead of averaging daily ratios. Always surface window, evidence, reliability, attribution caveats, and low-volume caveats with alerts and recommendations.
- Business truth: Meta-reported conversions are not automatically bookings or revenue. SPETER CRM and IRISMOMENT booking data may become verified business sources in a later phase; do not silently equate them in Phase 1.
- Testing: changes under `lib/meta-ads`, its API routes, schema, or schedules must pass `npm run test:meta-ads`, `npx tsc --noEmit`, Prisma validation/generation, and the production build. Add regression coverage for parsing, missing data, period math, deduplication, retries, anomaly logic, recommendation logic, and GET-only enforcement.
- Operations: do not claim background monitoring is live until the production database migration, Meta environment variables, Meta permissions, and Trigger.dev deployment/schedules have all been verified. Use `/api/meta-ads/monitoring` to report the actual state.
- API lifecycle: keep `META_GRAPH_API_VERSION` pinned to a supported version (Phase 1.1 uses `v27.0`) and verify the official Meta version schedule before changing it.
- Breakdowns: placement rows are scoped breakdown data. Never sum reach or frequency across placement/device rows, and never infer creative format from names or dimensions that were not verified by creative metadata.
- Account truth: the verified mappings are `IRISMOMENT → act_1664159937695658` and `SPETER → act_509645602062811`; production secrets and Graph API access must still independently validate them.
- Activation: production migration, deployment, schedule activation, permission changes, and any new paid resource require the user's approval after costs and rollback/backup readiness are shown.
