# Surgery Intelligence — operator workflow (FI-OUTCOME-INTELLIGENCE)

Short runbook for clinic operators and platform admins running the graft-tray → surgery intelligence chain in production.

## What ships in this release

| Capability | Status |
|------------|--------|
| Graft-tray AI review-gated workflow | Complete — staff review required before final graft counts are trusted |
| Surgery case intelligence facts | Published to `fi_analytics_events` as `surgery_case_intelligence_facts` |
| Surgery Intelligence dashboard | Live — read-only aggregates from published events only |
| Historical backfill | Available — dry-run preview before write |
| HairAudit linkage | Complete — legacy-compatible resolver + dashboard column |
| HairAudit link backfill | Available — idempotent server workflow; dry-run first |

Facts are **not** rebuilt from live SurgeryOS state on dashboard page load. The dashboard reads published analytics events only. HairAudit links are **resolved read-only** on the dashboard — linkage metadata is never mutated on page load.

## Where to work in FI Admin

| Task | Route | Notes |
|------|-------|-------|
| Review graft-tray AI estimates | `/fi-admin/{tenantId}/imaging/review` | Clinical review queue; accept AI, accept manual, correct, reject, or request retake |
| Monitor AI analysis jobs | `/fi-admin/{tenantId}/imaging/ai-jobs` | Job health, superseded/stale estimates, replay controls |
| Live surgery / graft counting | `/fi-admin/{tenantId}/surgery-os` | Command centre; graft tray links and intelligence summaries (read-only facts hook) |
| Surgery Intelligence dashboard | `/fi-admin/{tenantId}/surgery-os/intelligence` | Cases → **Surgery intelligence** in sidebar; **HairAudit** column shows link status |
| Rebuild / backfill facts | Same dashboard — **Rebuild intelligence facts** card | Operator-only; dry-run first |
| HairAudit OS admin hub | `/hair-audit/admin` | External HairAudit product entry (case ID not in URL — legacy contract) |
| FI audit report review | `/fi-admin/{tenantId}/audit/{reportId}` | Open from dashboard **Audit report** link when `fi_report_id` resolves |

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

## HairAudit linkage (SurgeryOS → ImagingOS → Outcome Intelligence → HairAudit)

### How links are resolved

`resolveHairAuditLinkForSurgery()` checks sources in order:

1. **Legacy metadata** on `fi_cases.metadata` and image metadata (`hairaudit_case_id`, `hair_audit_case_id`, `hairaudit_source_case_id`, `source_case_id` when `source_system=hairaudit`, `report_id`, `audit_report_id`, `patient_review_pathway`).
2. **Structured block** `fi_cases.metadata.hair_audit_link` (additive only).
3. **Safe bridge match** — `fi_global_cases` where `source_system=hairaudit`, or latest `fi_reports` for the case.

Legacy identifiers are **never overwritten**. Structured fields are merged additively.

### Link origin labels (dashboard HairAudit column)

| Label / `link_origin` | Meaning |
|-----------------------|---------|
| `legacy` | Copied from pre-ticket metadata keys or backfill from legacy |
| `structured` | Written explicitly into `hair_audit_link` (e.g. after `procedure_completed`) |
| `resolved_match` | Inferred from `fi_global_cases` / `fi_reports` bridge when no explicit case ID |
| **Conflict — review** | `linkage_conflict` — legacy and structured (or resolved) disagree; **not auto-repaired** |

Dashboard status labels: **Audit ready** (case + report linked), **Linked — no report**, **Not linked**, **Conflict — review**.

### Opening HairAudit from Surgery Intelligence

1. Open **Surgery Intelligence** (`/fi-admin/{tenantId}/surgery-os/intelligence`).
2. In the case table, check the **HairAudit** column.
3. Click **HairAudit** → `/hair-audit/admin` (legacy hub; existing contract unchanged).
4. Click **Audit report** → `/fi-admin/{tenantId}/audit/{reportId}` when `fi_report_id` resolves.

### Automatic HairAudit link write (mutation only)

On **`procedure_completed`**, `tryEnsureStructuredHairAuditLinkForSurgery()` may write additive `hair_audit_link` when a safe match exists. Skips when structured linkage already exists or `linkage_conflict` is present.

### HairAudit link backfill (optional, idempotent)

Use when older cases have legacy HairAudit metadata but no structured `hair_audit_link` block.

1. **Dry-run first** — `runHairAuditLinkBackfill({ tenantId, caseId | surgeryId, dryRun: true })`.
2. Review: would-copy vs skipped (no legacy / already structured / conflict).
3. Write run with `dryRun: false` — copies legacy into `hair_audit_link` with `link_origin: "legacy"`; **never deletes** old metadata keys.

### Handling `linkage_conflict`

When the dashboard shows **Conflict — review**:

1. Do **not** force-overwrite legacy `hairaudit_case_id` or `report_id` keys.
2. Compare legacy top-level metadata vs `hair_audit_link` block in `fi_cases.metadata`.
3. Confirm correct HairAudit case and FI report with clinical/audit ops.
4. Resolve manually in HairAudit / AuditOS workflows; platform engineering may clear conflict after verification.
5. Re-run HairAudit link backfill only after conflict root cause is understood — backfill **skips** conflict rows.

## Read-only surfaces (no publish on load)

These loaders **build or read** intelligence data but **do not** call the publisher:

- `surgeryOsCommandCentreLoader.server.ts` — builds `caseIntelligenceFacts` for command centre UI only
- `surgeryIntelligenceDashboardLoader.server.ts` — queries `fi_analytics_events` only; resolves HairAudit links read-only
- `surgery-os/intelligence/page.tsx` — loads dashboard only; no backfill or linkage writes on page load

Verified by `surgeryIntelligenceReleaseReadiness.test.ts` and `surgeryIntelligenceHairAuditReleaseReadiness.test.ts` in CI.

## Verification commands

```bash
pnpm test:surgery-intelligence-hairaudit-release-check-1
pnpm typecheck
```

Full release-check script runs HairAudit compatibility, surgery-to-HairAudit linkage, surgery dashboard, surgery facts backfill, graft-tray context, and read-only loader guard tests.

## Related docs

- [Graft tray → SurgeryOS bridge](../imaging-os-graft-tray-bridge.md)
- [FI OS Stage 6 Outcome Intelligence](./fi-os-stage6-outcome-intelligence-network.md)