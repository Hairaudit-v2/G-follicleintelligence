# Surgery Intelligence — operator workflow (FI-OUTCOME-INTELLIGENCE)

Short runbook for clinic operators and platform admins running the graft-tray → surgery intelligence chain in production.

## What ships in this release

| Capability | Status |
|------------|--------|
| Graft-tray AI review-gated workflow | Complete — staff review required before final graft counts are trusted |
| Surgery case intelligence facts | Published to `fi_analytics_events` as `surgery_case_intelligence_facts` |
| Surgery imaging intelligence summary | Live — baseline, donor, recipient, graft tray, immediate post-op, follow-up groups in published facts |
| Longitudinal outcome intelligence | Live — baseline vs immediate post-op vs follow-up comparison in published facts |
| Before/after readiness | Live — longitudinal + imaging summary; dashboard rollup |
| Donor/recipient follow-up readiness | Live — per-track evidence status in `longitudinal_outcome_summary` |
| HairAudit outcome report readiness | Connected — 12-month outcome measured + legacy HairAudit report link |
| Surgery Intelligence dashboard | Live — read-only aggregates from published events only |
| Dashboard imaging completeness metrics | Live — per-case completeness + audit-readiness columns and rollups |
| Dashboard longitudinal outcome metrics | Live — follow-up due, before/after comparison ready, donor/recipient gaps, HairAudit report ready |
| Historical backfill | Available — dry-run preview before write |
| HairAudit linkage | Complete — legacy-compatible resolver + dashboard column |
| HairAudit readiness in imaging summary | Connected — `imaging_intelligence_summary.audit_readiness` uses same resolver |
| HairAudit link backfill | Available — idempotent server workflow; dry-run first |

Facts are **not** rebuilt from live SurgeryOS state on dashboard page load. The dashboard reads published analytics events only. HairAudit links are **resolved read-only** on the dashboard — linkage metadata is never mutated on page load.

## Where to work in FI Admin

| Task | Route | Notes |
|------|-------|-------|
| Review graft-tray AI estimates | `/fi-admin/{tenantId}/imaging/review` | Clinical review queue; accept AI, accept manual, correct, reject, or request retake |
| Monitor AI analysis jobs | `/fi-admin/{tenantId}/imaging/ai-jobs` | Job health, superseded/stale estimates, replay controls |
| Live surgery / graft counting | `/fi-admin/{tenantId}/surgery-os` | Command centre; graft tray links and intelligence summaries (read-only facts hook) |
| Surgery Intelligence dashboard | `/fi-admin/{tenantId}/surgery-os/intelligence` | **Imaging**, **Audit readiness**, **Longitudinal** columns; follow-up due / before-after / donor-recipient / HairAudit outcome rollups |
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

## Surgery imaging intelligence summary

Published facts include `imaging_intelligence_summary` — a read-model of the full surgery imaging set beyond graft-tray counts. Built at publish time from `fi_patient_images` (by `case_id`, or `patient_id` when no case) plus HairAudit link context.

### Imaging groups tracked

| Group | Required views | Typical capture context |
|-------|----------------|-------------------------|
| Baseline / pre-op | front, top, crown | Pre-operative consultation or day-of baseline |
| Donor | donor | Donor mapping / extraction documentation |
| Recipient | front, top, recipient | Recipient design / implantation planning |
| Graft tray | graft_tray | Intraoperative tray photography (links to graft-tray AI) |
| Immediate post-op | front, top | Same-day or immediate post-procedure |
| Follow-up | front, top, crown | Progress / outcome interval (e.g. month 12) |

### What imaging completeness means

- **Completeness score** — percentage of the six groups that are **complete** (usable image present for every required view in that group).
- **Dashboard labels** — `Complete` (100%), `Strong` (≥67%), `Partial` (≥34%), `Gaps` (>0%), `Not started` (0% or no summary in published facts).
- **Per-group detail** — each group lists `present_views`, `missing_required_views`, `usable_image_count`, and `poor_quality_count` inside published `payload_json`.
- **Poor quality** — images with quality status `poor`, `invalid`, `fail`, or `review` are listed in `poor_quality_image_ids` and shown in the dashboard row subtitle.

Older published facts **without** `imaging_intelligence_summary` still load on the dashboard — those rows show **Not started** for imaging until republished.

### What audit-ready means

`audit_readiness.overall_audit_ready` is true only when **all** of the following are satisfied:

1. Baseline / pre-op present (usable baseline set)
2. Donor set complete (all required donor views)
3. Recipient set complete (all required recipient views)
4. Immediate post-op present
5. Follow-up captured **or** due (procedure date ≥ 10 months ago and follow-up not yet required to block readiness)
6. Reviewed graft count present (`has_final_graft_count`)
7. HairAudit link resolved (`hairaudit_case_id` present, no `linkage_conflict`)

Dashboard **Audit readiness** column labels:

| Label | Meaning |
|-------|---------|
| **Audit ready** | All seven criteria met |
| **Before/after ready** | Baseline + immediate post-op + follow-up (captured or due) + no HairAudit conflict — but other criteria (e.g. donor/recipient sets, graft count) may still be open |
| **Building** | One or more criteria still open |
| **Conflict — review** | HairAudit `linkage_conflict` — resolve before trusting audit readiness |

Rollup metrics on the dashboard: **Audit-ready cases**, **Avg imaging completeness**, **Before/after ready** count, **Imaging gaps** count, and **Imaging audit readiness** distribution.

### How missing imaging views are surfaced

1. **Published facts** — `missing_required_views` at summary level; per-group `missing_required_views` inside `imaging_intelligence_summary.groups`.
2. **Dashboard row** — **Imaging** column shows completeness label, score %, and poor-quality count; **Audit readiness** column shows open requirement count via `missing_requirements`.
3. **ImagingOS** — open **Imaging** link on the row (`/fi-admin/{tenantId}/patients/{patientId}/imaging`) to capture or retake missing views.
4. **Republish** — after imaging capture or graft-tray review, facts republish automatically on review finalization / `procedure_completed`, or via operator backfill for historical cases.

### Before/after readiness

`before_after_ready` is true when:

- Baseline / pre-op is present
- Immediate post-op is present
- Follow-up is **captured** (usable follow-up images exist) **or** **due** (≥ 10 months since procedure date)
- No HairAudit `linkage_conflict`

This is a **subset** of full audit readiness — useful for marketing / progress storytelling before donor/recipient sets or graft count are complete.

## Longitudinal outcome comparison (FI-OUTCOME-INTELLIGENCE-LONGITUDINAL-COMPARISON-1)

Published facts include `longitudinal_outcome_summary` — a time-series comparison of baseline/pre-op, immediate post-op, and follow-up imaging evidence. Built at publish time from the same `fi_patient_images` inputs as the imaging summary, plus HairAudit link context via `resolveHairAuditLinkForSurgery()` (legacy-first).

Top-level fact fields (additive on `surgery_case_intelligence_facts_v1`):

| Field | Meaning |
|-------|---------|
| `longitudinal_outcome_summary` | Full comparison object (image sets, readiness, windows, HairAudit IDs) |
| `before_after_ready` | Case is ready for before/after storytelling (see below) |
| `donor_recovery_ready` | Donor baseline + donor follow-up evidence sufficient for comparison |
| `recipient_growth_ready` | Recipient baseline + recipient follow-up evidence sufficient for comparison |
| `follow_up_window_status` | Per-window due/captured/ready/measured status (3/6/9/12 months + custom) |
| `missing_outcome_evidence` | Machine-readable gap list for dashboard rollups |

Older published facts **without** `longitudinal_outcome_summary` still load on the dashboard — those rows show empty longitudinal state until republished.

### What before/after readiness means (longitudinal)

`before_after_ready` on published facts is true when:

1. Baseline comparison views (front, top) are present and usable
2. Immediate post-op comparison views (front, top) are present and usable
3. No HairAudit `linkage_conflict`
4. Either imaging-summary before/after criteria are met **or** longitudinal baseline + immediate sets are complete enough for comparison storytelling

Use this for marketing collateral and patient progress views — **not** as a clinical outcome conclusion on its own.

### What donor recovery readiness means

`donor_recovery_ready` is true when `donor_recovery_evidence_status` is `ready_for_comparison` or `outcome_measured`:

- **Baseline donor** — usable donor-mapping image at donor group
- **Follow-up donor** — usable donor view at the active follow-up window (month 3/6/9/12 or custom)

When donor follow-up is missing, status is `blocked_missing_evidence` and `missing_outcome_evidence` includes `donor_follow_up`. Dashboard rollup: **Missing donor follow-up**.

### What recipient growth readiness means

`recipient_growth_ready` is true when `recipient_growth_evidence_status` is `ready_for_comparison` or `outcome_measured`:

- **Baseline recipient** — usable front + top at baseline/pre-op or recipient design
- **Follow-up recipient** — usable front + top at the active follow-up window

Missing recipient follow-up views block readiness; dashboard rollup: **Missing recipient follow-up**.

### Ready for comparison vs outcome measured

These are **distinct** states inside `comparison_readiness`:

| State | `ready_for_comparison` | `outcome_measured` | Operator meaning |
|-------|------------------------|--------------------|----------------|
| Building evidence | false | false | Missing baseline, immediate, follow-up, or quality blocks comparison |
| Ready for comparison | true | false | Enough usable images to **compare** intervals — no survival/growth claim yet |
| Outcome measured | true | true | Baseline + immediate + follow-up sets are **complete** with acceptable quality — suitable for audited outcome reporting |

**Safety rule:** the system never sets `outcome_measured` from missing or poor-quality follow-up images. Poor quality (`poor`, `invalid`, `fail`, `review`) or `is_clinically_usable: false` blocks both readiness and measurement.

### Follow-up due windows

`follow_up_window_status` tracks five windows: `month_3`, `month_6`, `month_9`, `month_12`, and `custom` (follow-up images without a standard interval tag).

For each window:

- **Due** — months since `procedure_date` ≥ window threshold (3/6/9/12) **and** no usable follow-up captured for that window
- **Captured** — at least one usable follow-up image resolves to that window (via `follow_up_interval`, `procedure_stage`, `visit_type`, or `surgical_event`)
- **Ready for comparison** — baseline + immediate + captured follow-up with required views and no poor quality
- **Outcome measured** — all three sets complete for that window

Months-since-procedure uses a 30.44-day month approximation from procedure date to reference date (publish time). Custom follow-up dates use image `captured_at` when present.

Dashboard rollup **Due for follow-up** counts cases where any window is `due: true`.

### How poor-quality images block outcome conclusions

1. Images with quality status `poor`, `invalid`, `fail`, or `review` increment `poor_quality_count` on the relevant set.
2. `is_clinically_usable: false` excludes an image from usable counts.
3. If follow-up has poor quality or missing required views, `comparison_readiness.outcome_measured` stays **false**.
4. Donor/recipient tracks can show `blocked_poor_quality` when follow-up quality blocks the required views.
5. `missing_outcome_evidence` may include `follow_up_poor_quality` or `follow_up_comparison_views`.

**Operator action:** retake affected views in ImagingOS; republish facts after capture (automatic on review/completion or via backfill).

### HairAudit outcome report readiness

`hairaudit_report_ready` is true only when **all** of:

1. Month-12 window shows `outcome_measured: true`
2. Legacy HairAudit `hairaudit_case_id` resolves
3. FI/HairAudit report ID resolves (`fi_report_id` or `audit_report_id`)
4. No `linkage_conflict`

Dashboard rollup: **HairAudit outcome report ready**. Open the report via **Audit report** link → `/fi-admin/{tenantId}/audit/{reportId}`.

### Legacy HairAudit report links remain source-of-truth

Longitudinal comparison uses `resolveHairAuditLinkForSurgery()` — same legacy-first contract as imaging summary:

1. Legacy metadata keys on `fi_cases.metadata` and image metadata win over structured `hair_audit_link`
2. Structured fields are merged **additively** — legacy IDs are never overwritten
3. Conflicts surface as `linkage_conflict` and block comparison readiness and HairAudit report readiness
4. Existing `/fi-admin/{tenantId}/audit/{reportId}` and `/hair-audit/admin` routes are unchanged

### Dashboard longitudinal rollups

Stat cards on **Surgery Intelligence**:

| Card | Source |
|------|--------|
| Due for follow-up | `follow_up_windows` where `due: true` |
| Before/after comparison ready | `comparison_readiness.ready_for_comparison` |
| Missing donor follow-up | `missing_outcome_evidence` includes `donor_follow_up` |
| Missing recipient follow-up | `missing_outcome_evidence` includes `recipient_follow_up` |
| HairAudit outcome report ready | `hairaudit_report_ready` |

Table **Longitudinal** column shows comparison readiness label and active follow-up window.

### When longitudinal evidence is incomplete — operator actions

| Gap | What staff should do |
|-----|----------------------|
| Follow-up window due | Schedule and capture follow-up in ImagingOS for the due interval (3/6/9/12 months) |
| Missing donor follow-up | Capture donor-area follow-up at the outcome visit |
| Missing recipient follow-up | Capture front + top recipient views at follow-up |
| Poor-quality follow-up | Retake; confirm acceptable quality before republish |
| Ready for comparison but not outcome measured | Expected mid-journey — do not claim growth/survival until outcome measured |
| HairAudit report not ready | Complete 12-month outcome evidence + confirm legacy report link; resolve conflicts first |
| Dashboard shows no longitudinal data on old case | Run **Rebuild intelligence facts** backfill (dry-run first) |

### When cases are not audit-ready — operator actions

| Gap | What staff should do |
|-----|----------------------|
| Missing baseline, donor, recipient, immediate, or follow-up views | Open **Imaging** from the dashboard row; complete guided capture in ImagingOS for the missing group/views |
| Poor-quality images flagged | Retake affected views; confirm `quality_status` is acceptable before republish |
| No reviewed graft count | Complete graft-tray AI review at `/fi-admin/{tenantId}/imaging/review` |
| HairAudit not linked | Confirm legacy metadata on the case; run HairAudit link backfill (dry-run first) if legacy IDs exist |
| **Conflict — review** | Do **not** overwrite legacy `hairaudit_case_id` / `report_id`; reconcile with audit ops (see HairAudit section below) |
| Dashboard shows **Not started** for imaging on an old case | Run **Rebuild intelligence facts** backfill (dry-run first) to republish with imaging summary |

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

Verified by `surgeryIntelligenceReleaseReadiness.test.ts`, `surgeryIntelligenceHairAuditReleaseReadiness.test.ts`, `surgeryIntelligenceImagingReleaseReadiness.test.ts`, and `surgeryIntelligenceLongitudinalOutcomeReleaseReadiness.test.ts` in CI.

## Verification commands

```bash
pnpm test:longitudinal-outcome-release-check-1
pnpm test:outcome-intelligence-longitudinal-comparison-1
pnpm test:surgery-imaging-intelligence-release-check-1
pnpm test:outcome-intelligence-surgery-dashboard-1
pnpm test:hairaudit-link-compatibility-audit-1
pnpm test:outcome-intelligence-hairaudit-link-1
pnpm typecheck
```

Full longitudinal release-check script runs longitudinal comparison core, release guards (backward-compatible facts, read-only dashboard, HairAudit legacy-first, poor-quality blocks, donor follow-up blocks), surgery dashboard derive, HairAudit linkage, and compatibility audit.

## Related docs

- [Graft tray → SurgeryOS bridge](../imaging-os-graft-tray-bridge.md)
- [FI OS Stage 6 Outcome Intelligence](./fi-os-stage6-outcome-intelligence-network.md)