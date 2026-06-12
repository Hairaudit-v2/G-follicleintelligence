# FI OS Stage 6 — Outcome Intelligence Network

Runbook for developers and operators. Stage 6 adds **data architecture and read surfaces** for tenant-safe outcome intelligence; it does **not** change existing clinical workflows unless new rows exist.

## What Stage 6 adds

- **Typed vocabulary** — `src/config/fiOutcomeIntelligenceRegistry.ts` (checkpoints, metrics, protocols; labels, categories, visibility, anonymisation suitability).
- **Four tables** (migration `20260726120001_fi_os_stage6_outcome_intelligence.sql`):
  - `fi_outcome_protocols` — structured protocol capture per tenant (optional case/patient link).
  - `fi_patient_outcome_measurements` — checkpoint-scoped metric JSON + imaging/audit refs + provenance.
  - `fi_tenant_outcome_aggregates` — tenant-level rollups (cohort + period).
  - `fi_global_outcome_aggregates` — **identifier-free** multi-tenant rollups; read-gated when thresholds are met.
- **Pure TS** — `outcomeIntelligenceSignals.ts`, `outcomeAggregation.ts`, `outcomeIntelligenceDrafts.ts` (normalisation, confidence heuristics, anonymisation gate, draft aggregates).
- **Server loaders + events** — `outcomeIntelligence.server.ts`, `outcomeIntelligenceEvents.server.ts` (+ Zod schema); inserts via **service_role**; loaders fail softly if tables are missing.
- **UI** — dashboard widget `outcome_intelligence_summary`, case **Outcome intelligence** section, Patient Twin **Outcome Journey** card.

## Relation to Stage 5 (clinical intelligence)

| Stage 5 | Stage 6 |
|--------|---------|
| Journey **signals** and patient **snapshots** (`fi_clinical_intelligence_events`, `fi_patient_clinical_intelligence_snapshots`) | **Structured** outcome checkpoints, metrics, protocols, and aggregate rows for reporting / future benchmarking |
| RLS: `fi_os_can_select_clinical_intelligence_tenant_data` for tenant + platform reads | Protocols + **measurements** reuse the **same** SELECT helper; tenant aggregates use a **narrower** leadership/admin read function |

Stage 6 **complements** Stage 5; it does not replace twin or clinical signal loaders.

## Outcome registry purpose

Single source of truth for **keys and copy**: which checkpoints exist in the product vocabulary, which metric keys are allowed, which protocol keys exist, and whether each item is **tenant-only**, **anonymisable**, or **not for network** aggregation. Prevents drift between UI, loaders, and future jobs.

## Protocol table purpose (`fi_outcome_protocols`)

Captures **surgical and adjunct** protocols (type + key + label + JSON details) with optional linkage to `fi_cases` / `fi_patients` and optional `source_table` / `source_id` for lineage. Intended to normalise what is today scattered in procedure-day text and planning notes—not to auto-sync those sources in Stage 6.

## Patient outcome measurement table purpose (`fi_patient_outcome_measurements`)

One row per tenant/patient/(optional case)/checkpoint/(optional date) with `metric_values` JSON, `imaging_refs` / `audit_refs`, `confidence_level`, and `visibility_scope`. Bridges **registry checkpoints** (wider than `fi_case_follow_ups` CHECK) and future scored ingestion without altering legacy follow-up tables.

## Tenant aggregate table purpose (`fi_tenant_outcome_aggregates`)

Stores **per-tenant** cohort summaries over a period (`cohort_key`, `metric_summary`, `protocol_mix`, `sample_size`, etc.) for director/manager views and as **input** to anonymised global drafts. Contract: summaries should not embed patient/case/staff identifiers in JSON (enforced in app aggregation helpers + leakage scan for globals).

## Global aggregate table purpose (`fi_global_outcome_aggregates`)

**Network-level** rollups only: no `tenant_id`, `patient_id`, `case_id`, `staff_id`, `clinic_id`. Rows are readable by authenticated users only when `anonymisation_threshold_met` is true (see below). Stage 6 does **not** schedule jobs to populate this table automatically.

## RLS and anonymisation model

**Protocols & measurements**

- **SELECT**: authenticated users who pass `fi_os_can_select_clinical_intelligence_tenant_data(tenant_id)` (tenant membership + platform support roles, same pattern as Stage 5 clinical intel).
- **INSERT/UPDATE/DELETE**: `service_role` only (trusted app server).

**Tenant aggregates**

- **SELECT**: `fi_os_can_select_tenant_outcome_aggregate(tenant_id)` — platform OS identities, active `fi_tenant_admin_users`, or active `fi_staff` linked to the viewer with role text heuristic (director / manager / operations). **Not** all clinicians by default.

**Global aggregates**

- **SELECT**: `anonymisation_threshold_met = true` and signed-in user (`auth.uid()` is not null).
- **Writes**: `service_role` only.

**App-layer gate** (see `outcomeAggregation.ts`): minimum sample size **25**, minimum contributing tenants **3**, plus **deep JSON scan** for forbidden identifier keys and UUID-like strings in `metric_summary` / `protocol_mix` before treating a payload as safe for network drafts. `computeGlobalOutcomeAggregateDraft` sets `anonymisation_threshold_met` from this gate; Stage 6 does not auto-publish rows.

## What is measurable today

- **Existing**: `fi_case_follow_ups` completion + `linked_image_ids`; `fi_case_post_op_tracking.patient_satisfaction_score`; procedure-day text fields and counts; `fi_patient_images` presence by case/patient; Stage 5 clinical intel / twin completeness signals (elsewhere).
- **After migration + writes**: structured rows in `fi_outcome_protocols` and `fi_patient_outcome_measurements` drive dashboard counts, case panel, and Twin **Outcome Journey**.

## What remains TODO

- Backfill or sync from procedure day, surgery plans, MedicationOS, and follow-ups into protocol/measurement tables (explicit ETL or actions—not implicit in Stage 6).
- Extend DB follow-up checkpoint enum if product registry must match `fi_case_follow_ups` CHECK one-to-one.
- Real **HairAudit** (or formal audit) score ingestion and refs.
- **Scheduled** tenant/global snapshot jobs and tenant-vs-network **benchmarking UI** (Stage 7).

## Where UI appears

| Surface | Location |
|---------|----------|
| Dashboard | Widget key `outcome_intelligence_summary` — Stage 2: `dashboard` plus at least one of `analytics`, `audit`, `cases`, `patient_twin`. Default stack for director, clinic_manager, surgeon, doctor, platform_admin; optional for auditor. |
| Case page | Section **Outcome intelligence** (`#case-outcome-intelligence`) — checkpoints, refs, protocol summary, eligibility copy. |
| Patient Twin | **Outcome Journey** card — measurements + protocol timeline for the foundation patient. |

## Explicit non-goals (Stage 6)

- **No** predictive or generative clinical advice.
- **No** cross-tenant patient-level reads or views.
- **No** public benchmarking of individual clinicians.
- **No** automatic global aggregate generation or cron (helpers and schema only).

## Migration requirement

Apply:

`supabase/migrations/20260726120001_fi_os_stage6_outcome_intelligence.sql`

Until this migration is applied, loaders return empty arrays / soft notes; dashboard copy explains that outcome intelligence appears as data is captured.

## Stage 7 roadmap

1. **Scheduled snapshots** — periodic writes to `fi_tenant_outcome_aggregates` (and optional promotion to `fi_global_outcome_aggregates` when gates pass).
2. **HairAudit / audit score ingestion** — structured scores and provenance into measurements or refs.
3. **Tenant vs network UI** — explainable cohorts, threshold state, and read-only comparison using aggregate tables only.
4. **Predictive analytics** — only after explicit governance approval; not part of Stage 6–7 unless separately scoped.
