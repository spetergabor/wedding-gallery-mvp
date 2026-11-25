# Meta Ads Intelligence – Phase 1 operations

This subsystem is a read-only intelligence layer. It cannot publish, pause, delete, retarget, or change budgets in Meta Ads.

## Production prerequisites

1. Apply Prisma migrations to the production database.
2. Configure `META_ADS_ACCESS_TOKEN` with read access to every mapped ad account.
3. Configure `META_AD_ACCOUNT_MAPPINGS_JSON` with an explicit `SPETER` or `IRISMOMENT` brand for each account.
4. Keep `META_GRAPH_API_VERSION` pinned to a currently supported version (`v27.0` at the Phase 1.1 audit) and review it before Meta retires that version.
5. Deploy the Trigger.dev project with `TRIGGER_SECRET_KEY` and the same database/Meta variables.
6. Confirm the four production schedules plus the manual task in Trigger.dev, then set `META_ADS_SCHEDULES_ACTIVE=true` in the web runtime only after verification.
7. Run the manual backfill once, or allow the first scheduled run to backfill 90 days automatically.
8. Verify `/api/meta-ads/monitoring` as a logged-in Spetly super admin. Monitoring is live only after a successful production run appears here.

Example mapping (never use placeholders in production):

```json
[
  { "brand": "SPETER", "accountId": "act_REPLACE_ME", "name": "SPETER" },
  { "brand": "IRISMOMENT", "accountId": "act_REPLACE_ME", "name": "IRISMOMENT" }
]
```

## Schedules

All schedules use `Europe/Vienna`:

- Every three hours: entity collection, recent seven-day insight refresh, anomaly and recommendation evaluation.
- 08:00 daily: daily report.
- 08:00 Monday: weekly report.
- 08:00 on the first day of each month: monthly report.

Trigger.dev stores execution output and retry history. A database lock prevents overlapping synchronization. Each account sync also has an execution key and persisted status.

## Manual execution

- Trigger.dev task: `meta-ads-manual-sync`
- Authenticated API: `POST /api/meta-ads/sync`
- Body for a normal refresh: `{ "lookbackDays": 7 }`
- Body for an explicit initial/recovery import: `{ "backfill": true, "lookbackDays": 90 }`

Recent days are deliberately overwritten through an idempotent upsert so delayed Meta attribution is incorporated. Entity snapshots are only added when their payload changes.

### First production import sequence

Do not start a 90-day import before the smoke test succeeds. Use this sequence and reconcile after every step:

1. `POST /api/meta-ads/smoke-test` — no database writes.
2. 3-day manual sync.
3. 7-day manual sync.
4. 30-day manual sync.
5. 90-day backfill.

For every stage record runtime, rows read/written, request count, partial placement failures and the persisted rate-limit headers. Re-running the same date range updates the unique daily rows and must not create duplicates.

## Dashboard-ready API

Every route requires an approved, non-team-member Spetly super-admin session.

- `GET /api/meta-ads/overview`
- `GET /api/meta-ads/brands`
- `GET /api/meta-ads/campaigns?brand=IRISMOMENT`
- `GET /api/meta-ads/creatives?brand=IRISMOMENT`
- `GET /api/meta-ads/placements?brand=IRISMOMENT&days=30`
- `GET /api/meta-ads/forecast`
- `GET /api/meta-ads/trends?brand=IRISMOMENT&entityLevel=campaign&days=90`
- `GET /api/meta-ads/alerts?status=active`
- `GET /api/meta-ads/recommendations?status=active`
- `GET /api/meta-ads/monitoring`
- `GET /api/meta-ads/reports?kind=weekly`
- `GET/PATCH /api/meta-ads/config`
- `POST /api/meta-ads/smoke-test`

## Data interpretation

- Missing metrics remain `null` and get a `missing` status; a measured zero remains zero.
- The latest 72 hours are provisional because conversions can arrive late.
- Ratios are calculated from summed base values, never averaged from daily ratios.
- Meta leads/purchases are platform-attributed events, not automatically verified SPETER bookings, IRISMOMENT appointments, or revenue.
- Business targets are unconfigured until a human supplies them through the config API.
- Creative performance is reconstructed from ad-level insight rows and each ad's current creative relationship.
- Placement rows are breakdown data. Spend, impressions and event counts can be aggregated in the same scope; reach and frequency are intentionally not summed.
- Static/video/aspect-ratio/carousel labels must not be inferred from names. They remain unclassified unless the creative metadata verifies them.
- `thresholds.anomalyThresholds` configures brand defaults; `thresholds.campaignTypes.<META_OBJECTIVE>` can override them per campaign type.
- IRISMOMENT forecasting also expects `thresholds.averageDailyBookings`; without the event date, capacity, booked count and this rate it reports an unreliable forecast instead of guessing.

Example threshold document:

```json
{
  "averageDailyBookings": 0.5,
  "anomalyThresholds": { "minSpendWithoutLeads": 25 },
  "campaignTypes": {
    "OUTCOME_SALES": { "minSpendWithoutLeads": 40 }
  }
}
```

## Security and failure handling

- The Graph client exposes GET only and sends the token in the authorization header.
- Pagination URLs have any `access_token` parameter removed before use and cannot leave `graph.facebook.com`.
- Rate limits, transient 5xx responses, timeouts, and token-expiration errors are distinct and retried where safe.
- API errors stored in sync logs are truncated and must never contain tokens.
- A failed sync creates a deduplicated critical alert; stale locks expire automatically.
- Stopped campaigns are excluded from live analytics alerts and their prior recommendations are superseded.
- Health states are `NOT_CONFIGURED`, `CONFIGURED`, `CONNECTED`, `SYNCING`, `HEALTHY`, `DEGRADED` and `ERROR`. `HEALTHY` requires a database check, a successful API-backed sync, fresh persisted data, complete mappings and verified active schedules.
