# FI OS Stage 5 — Clinical intelligence (runbook)

Concise reference for developers. Stage 5 is **foundational**: structured signals, safe loaders, explainable UI, and DB hooks for later automation — **not** clinical AI or automated medical decisions.

---

## What Stage 5 adds

- **Typed signal registry** (`src/config/fiClinicalIntelligenceSignals.ts`) — stable keys, neutral copy, categories, visibility hints, and “recommended next step” text for operators.
- **Pure helpers** — `src/lib/fi-os/clinicalIntelligenceSignals.ts`, `clinicalIntelligenceRecommendations.ts` (severity from counts, twin/case normalization, rule-based wording only).
- **Server loaders** — `src/lib/fi-os/clinicalIntelligence.server.ts` (bounded tenant summary; optional twin-level view via existing twin loader).
- **Event + snapshot tables** (migration below) — append-friendly storage for future workflows and scheduled jobs.
- **Event API helpers** — `src/lib/fi-os/clinicalIntelligenceEvents.server.ts` + `clinicalIntelligenceEventsSchema.ts` (`record` / `acknowledge` / `resolve`); **no automatic writes** from business workflows in Stage 5.
- **UI** — dashboard widget, Patient Twin section, SurgeryOS case “Case intelligence” section (see below).

---

## Clinical signal registry — purpose

- Single **source of truth for signal metadata** (key, label, description, category, optional count thresholds, workspace hints, `sourceModule`, recommended next step).
- Keeps product copy **neutral** (“attention”, “review”, “missing”, “pending”, “support”) and aligned across loaders and UI when signals are wired.
- New signals should be **added here first**, then referenced from loaders/helpers/tests.

---

## `fi_clinical_intelligence_events` — purpose

- Tenant-scoped rows for **auditable intelligence events** (signal key, severity, title, optional links to patient/case/consultation/booking/staff, `source_table` / `source_id`, status lifecycle).
- Intended for **future** integrations (e.g. record on explicit milestones or scheduled reconcilers), not for spamming every save.
- **Writes:** service role from trusted app code only. **Reads:** authenticated users in the tenant (or platform OS roles per policy); see migration RLS.

---

## `fi_patient_clinical_intelligence_snapshots` — purpose

- **Append-friendly** patient-level JSON summaries (`signal_summary`, journey/outcome blobs, `visibility_scope`, `computed_at` / `computed_by`).
- Reserved for **scheduled or on-demand rollups** (Stage 6); Stage 5 does not require populating it for the UI to work.

---

## Signals computed today (implemented loaders / derivations)

**Tenant home — `clinical_intelligence_summary` widget** (`loadTenantClinicalIntelligenceSummary`)

- **Readiness attention** — reuses operational `actionCentre.surgeryReadinessAlerts` (surgery bookings in horizon without linked case).
- **Follow-ups overdue** — reuses `actionCentre.followUpsDue` (follow-up/review bookings in horizon).
- **Pathology pending** — count of `fi_pathology_results` with `status = 'draft'` for the tenant.
- **Imaging gaps (approx.)** — among up to **400** active cases (`fi_cases` not `complete`/`failed`), cases with **no** `fi_patient_images` row for that `case_id` (best-effort; not a full imaging protocol check).
- **Outcome data missing (approx.)** — count of `fi_case_post_op_tracking` with `post_op_status = 'not_started'` for those same case ids (coarse proxy, not full outcome modelling).

**Patient Twin** — `derivePatientTwinIntegritySignals` on the assembled twin (e.g. twin warnings/completeness, draft pathology results, zero imaging when cases exist).

**SurgeryOS case page** — `deriveCaseClinicalSignals` from `buildCaseReadiness` output (readiness %, procedure day / post-op / follow-ups / **images** section health — not a separate “outcomes” section).

---

## Signals TODO (registry present; wiring incomplete or needs product rules)

Examples: dedicated tenant aggregates for **medication review**, **consultation completion** as its own card, **audit review pending**, **PRP / exosome follow-up due**, **satisfaction / complication / treatment response** thresholds, **graft / donor / implantation / donor safety / density** as KPIs, cross-cutting **audit** signals. These remain in `fiClinicalIntelligenceSignals.ts` for naming and copy consistency until loaders and thresholds are agreed.

---

## Where UI appears

| Surface | What |
|--------|------|
| **Tenant home** | Widget key `clinical_intelligence_summary` — “Clinical Intelligence” cards + empty state (`FiOsControlCentreHome`, data from `app/(fi-admin)/fi-admin/[tenantId]/page.tsx`). |
| **Patient Twin** | `PatientTwinClinicalIntelligenceCard` on the twin route (`.../patients/[patientId]/twin`). |
| **SurgeryOS case** | Section id `case-intelligence` — `CaseClinicalIntelligencePanel` (`CaseDetailPageView` + `caseDetailNavConstants`). |

**Workspace defaults:** widget appears in **director**, **clinic_manager**, **surgeon**, **doctor**, **nurse** (optional in stack), **platform_admin** profiles — subject to Stage 2 (below). **Consultant** / **reception** default stacks omit it.

---

## Visibility / security model

- **Stage 2 feature access** — widget requires `dashboard` **and** at least one of `patients`, `cases`, `pathology`, `imaging`, `audit` (`fiDashboardWidgetVisibleByFeatureAccess` in `stage2FeatureVisibility.ts`). This does **not** replace RBAC or route guards elsewhere.
- **App** — tenant portal access unchanged; loaders use **service-role** Supabase from trusted server routes only.
- **DB (migration)** — RLS: tenant members (`fi_users` for `auth.uid()` + `tenant_id`) may **SELECT**; platform OS identities (`fi_os_identities` with allowed roles) may **SELECT** cross-tenant for support/audit. **INSERT/UPDATE/DELETE** on these tables are for **service_role** (event helpers), not broad authenticated writes.

---

## What Stage 5 does **not** do

- No **diagnosis**, no **medication or dosing advice**, no **predictive AI** or external LLM calls for this feature set.
- No **automatic** clinical intelligence **writes** to `fi_clinical_intelligence_events` from every workflow.
- No **cross-tenant patient-identifiable benchmarking** (tenant boundary stays strict in app design; Stage 6 benchmarking needs its own spec).

---

## Migration requirement

Apply:

`supabase/migrations/20260725120001_fi_os_stage5_clinical_intelligence.sql`

Until this runs in an environment, `recordClinicalIntelligenceEvent` will fail if invoked, and RLS/policies for the new tables will not exist. The **read-only dashboard and case/twin derivations** do not strictly require these tables (they query existing tables), but production should run migrations to keep schema and runbooks aligned.

---

## Stage 6–7 roadmap (forward-looking)

**Stage 6 (outcome intelligence network foundation)** is implemented — see **[Outcome intelligence network foundation](../fi-os-outcome-intelligence-network-foundation.md)** and **[Stage 6 runbook](../runbooks/fi-os-stage6-outcome-intelligence-network.md)** (tables, RLS, UI, anonymisation).

Remaining from the original Stage 6 bullet list:

1. **Scheduled patient snapshots** — populate `fi_patient_clinical_intelligence_snapshots` from a cron or queue worker (tenant-scoped).
2. **HairAudit / formal score ingestion** — structured refs or metrics into outcome measurements (governed).
3. **Network publish pipeline** — job-driven `fi_global_outcome_aggregates` when app-layer gates pass; tenant-vs-network UI (Stage 7).
4. **Predictive analytics** — only after governance, opt-in policy, and explainability; Stage 5 registry and events table are intended to support **source-linked** narratives, not black-box scores.

---

## Key file index

| Area | Path |
|------|------|
| Registry | `src/config/fiClinicalIntelligenceSignals.ts` |
| Signals / severity / twin & case derive | `src/lib/fi-os/clinicalIntelligenceSignals.ts` |
| Recommendations (copy guard) | `src/lib/fi-os/clinicalIntelligenceRecommendations.ts` |
| Tenant loader | `src/lib/fi-os/clinicalIntelligence.server.ts` |
| Events Zod + server | `src/lib/fi-os/clinicalIntelligenceEventsSchema.ts`, `clinicalIntelligenceEvents.server.ts` |
| Dashboard widget | `src/components/fi-admin/dashboard/DashboardClinicalIntelligenceSummary.tsx` |
| Migration | `supabase/migrations/20260725120001_fi_os_stage5_clinical_intelligence.sql` |
| Stage 2 widget gate | `src/lib/fi-os/stage2FeatureVisibility.ts` |
