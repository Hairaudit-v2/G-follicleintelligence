# Surgery Intelligence — operator workflow (FI-OUTCOME-INTELLIGENCE)

Short runbook for clinic operators and platform admins running the graft-tray → surgery intelligence chain in production.

## What ships in this release

| Capability | Status |
|------------|--------|
| Graft-tray AI review-gated workflow | Complete — staff review required before final graft counts are trusted |
| Surgery case intelligence facts | Published to `fi_analytics_events` as `surgery_case_intelligence_facts` |
| Surgery Intelligence dashboard | Live — read-only aggregates from published events only |
| Historical backfill | Available — dry-run preview before write |

Facts are **not** rebuilt from live SurgeryOS state on dashboard page load. The dashboard reads published analytics events only.

## Where to work in FI Admin

| Task | Route | Notes |
|------|-------|-------|
| Review graft-tray AI estimates | `/fi-admin/{tenantId}/imaging/review` | Clinical review queue; accept AI, accept manual, correct, reject, or request retake |
| Monitor AI analysis jobs | `/fi-admin/{tenantId}/imaging/ai-jobs` | Job health, superseded/stale estimates, replay controls |
| Live surgery / graft counting | `/fi-admin/{tenantId}/surgery-os` | Command centre; graft tray links and intelligence summaries (read-only facts hook) |
| Surgery Intelligence dashboard | `/fi-admin/{tenantId}/surgery-os/intelligence` | Cases → **Surgery intelligence** in sidebar |
| Rebuild / backfill facts | Same dashboard — **Rebuild intelligence facts** card | Operator-only; dry-run first |

**Access:** Surgery Intelligence requires SurgeryOS access (`surgery_os` module read + SurgeryOS viewer context). Backfill requires `log_event` permission (same as surgery procedure logging).

## Automatic publish paths (no operator action)

Facts publish idempotently on:

1. **Graft tray review finalization** — when staff completes a review with a final accepted count (`accept_ai_estimate`, `accept_manual_count`, `correct_count`).
2. **Surgery completion** — when procedure logs `procedure_completed`.

Both use `tryPublishSurgeryCaseIntelligenceFactsForSurgery()` keyed by `tenant_id + entity_id + facts_version`.

## Historical backfill workflow

Use when older reviewed cases pre-date the publish pipeline and the Surgery Intelligence dashboard shows gaps.

### 1. Dry-run preview (required first step)

1. Open **Surgery Intelligence** (`/surgery-os/intelligence`).
2. In **Rebuild intelligence facts**, leave **Dry run** checked.
3. Set scope:
   - **Single surgery:** paste `surgery_id`, or
   - **Date range:** set procedure from/to (uses `fi_surgeries.scheduled_date`), or
   - **Case:** paste `case_id`.
4. Click **Preview backfill**.
5. Review summary: scanned, eligible, would publish/update, skipped (no final count / missing context / newer version), failed.

Dry-run **never writes** to `fi_analytics_events`.

### 2. Write backfill

1. Confirm dry-run results look correct.
2. Uncheck **Dry run**.
3. Run backfill with the same scope.
4. Refresh dashboard filters if needed.

Only cases with **`has_final_graft_count`** are published. Pending or unreviewed graft-tray estimates are skipped (counted as “skipped no final count”).

### 3. When force overwrite is appropriate

Enable **Force overwrite newer facts version** only when:

- An operator intentionally needs to republish an **older** `facts_version` after a mistaken newer publish, or
- Platform engineering has directed a one-off correction.

**Requirements:**

- Admin key (`FI_ADMIN_API_KEY` or tenant admin key field in the form).
- Force without admin key is rejected by the action schema.

Normal backfill should **not** use force — same-version republish updates safely; newer versions are skipped by default.

## Read-only surfaces (no publish on load)

These loaders **build or read** intelligence data but **do not** call the publisher:

- `surgeryOsCommandCentreLoader.server.ts` — builds `caseIntelligenceFacts` for command centre UI only
- `surgeryIntelligenceDashboardLoader.server.ts` — queries `fi_analytics_events` only

Verified by `surgeryIntelligenceReleaseReadiness.test.ts` in CI.

## Verification commands

```bash
pnpm test:outcome-intelligence-release-readiness-1
pnpm typecheck
```

Full chain script runs imaging graft-tray, AI review ops, SurgeryOS graft tray, outcome facts, dashboard, backfill, and read-only loader guard tests.

## Related docs

- [Graft tray → SurgeryOS bridge](../imaging-os-graft-tray-bridge.md)
- [FI OS Stage 6 Outcome Intelligence](./fi-os-stage6-outcome-intelligence-network.md)