# FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A

**Programme:** Controlled Pilot Control Centre — Evolved Hair Restoration  
**Phase:** `FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A`  
**Current stage:** **1A.5 — Control Centre User Interface**  
**Date:** 2026-07-30  
**Tenant (production programme seed):** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Phase verdict (1A overall):** **AMBER** — UI delivered on 1A.4 APIs; full Control Centre remains limited (empty live cohort, approximate readiness, migrations governance)  
**1A.1 stage verdict:** **GREEN** — cohort SoR + readiness/blocker/health contracts + synthetic proofs landed  
**1A.2 stage verdict:** **GREEN** — read-only readiness engine with provenance, stage map, adapters, and 46-scenario proofs  
**1A.3 stage verdict:** **GREEN** — derived blocker/ownership/escalation engine with persistence, projections, and 56-scenario proofs  
**1A.4 stage verdict:** **GREEN** — authenticated, tenant-isolated, role-sensitive read-only APIs with contracts + acceptance tests  
**1A.5 stage verdict:** **GREEN WITH LIMITATIONS** — Control Centre UI consumes only 1A.4 APIs; empty-cohort honesty + role chrome + architecture proofs landed; live role-matrix E2E and applied remote migrations remain governance gates 

---

## Executive summary

This phase builds a **read-only operational command centre** over existing FI capability. It does **not** change clinical, financial, or journey source-of-truth behaviour, invite real patients, enable Stripe, or enable generative ImagingOS providers.

**1A.1 establishes who belongs to the pilot and freezes the readiness / blocker / escalation / health contracts** before any dashboard is built. Pilot membership is **explicit enrolment only** — never inferred from quotes, appointments, accounts, or clinical activity.

**1A.2 wires a canonical read-only readiness engine** that resolves frozen dimensions against existing domain records with complete provenance. Overall composition remains fail-closed via `deriveOverallReadiness`.

**1A.3 converts readiness failures into actionable, deduplicated, aged operational blockers** with ownership, severity, escalation, and pilot-pause recommendations.

**1A.4 exposes authenticated, tenant-isolated, role-sensitive read-only HTTP APIs** that consume 1A.1–1A.3 engines without reimplementing readiness, severity, ownership, escalation, or health rules.

**1A.5 delivers the authenticated, role-sensitive Pilot Control Centre UI** at `/fi-admin/[tenantId]/pilot-control` (alias `/admin/pilot-control`), consuming only approved 1A.4 contracts. The full Control Centre remains **AMBER** while the live cohort is empty, batch readiness is approximate, and remote migration apply evidence is incomplete.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Control Centre UI (/fi-admin/.../pilot-control) [1A.5]   │
└───────────────────────────┬─────────────────────────────────┘
                            │ read-only (API-only)
┌───────────────────────────▼─────────────────────────────────┐
│  Pilot Control APIs                         [1A.4 DONE]   │
│  GET programmes | overview | patients | blockers |        │
│  activity | health | export                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Derived engines (app-layer; not competing SoR)            │
│  Readiness [1A.2 DONE] · Blockers/escalation [1A.3 DONE]  │
│  Health pure rules [1A.1] · live metrics [1A.6]           │
│  Contracts frozen in src/lib/pilotControl/* (1A.1)         │
└─────────────┬───────────────────────────────┬───────────────┘
              │ observes                      │ membership SoR
              ▼                               ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│ Existing domain SoR      │    │ fi_pilot_programmes         │
│ Journey · Finance · Docs │    │ fi_pilot_enrolments         │
│ Pathology · Imaging ·    │    │ fi_pilot_control_events     │
│ Bookings · Inbox · Notify│    │ (telemetry; no clinical PHI)│
└──────────────────────────┘    └─────────────────────────────┘
```

**Design rules**

- Prefer derived read models over new competing systems of record.
- Only `fi_pilot_programmes` / `fi_pilot_enrolments` are new membership SoR.
- Domain engines (quotes, clearance, pathology, journey) remain authoritative for their domains.
- Fail closed on identity ambiguity, unknown mandatory states, and cross-tenant leakage.

---

## Reused source systems

| Dimension | Canonical sources | Module path |
|-----------|-------------------|-------------|
| Journey milestones / actions | `fi_patient_journey_milestones`, `fi_patient_actions` | `src/lib/patientJourneyControl/` |
| Clinic readiness projection | Same + docs/pathology/quote | `clinicJourneyReadiness.server.ts` |
| Identity | `fi_patients`, `fi_persons`, `v_fi_patient_resolution` | `src/lib/fi/foundation/` |
| Patient App activation | `fi_patients.portal_auth_user_id` | `patientGatewayGate.server.ts` |
| Reception messaging | Gateway message threads/messages | Patient gateway + ReceptionOS inbox |
| Financial readiness | `fi_financial_clearance_snapshots`, `fi_crm_quotes` | `financialClearanceCore.ts` |
| Documents / consent | Document packets/sections + `fi_patient_documents` | Consent gate + gateway docs |
| Pathology | `fi_pathology_requests`, `fi_pathology_results` | `src/lib/pathology/` |
| Images | `fi_patient_images`, `v_fi_media_unified` | ImagingOS / gateway images |
| Appointments | `fi_bookings` | Bookings + gateway appointments |
| Notifications | `fi_patient_notifications`, devices | Notification dispatch |
| Staff roles / field perms | SA-1/SA-2, `fiOsRoles` | Entitlements + FiOS roles |
| Ops telemetry pattern | Reception Phase 7 usage/feedback | Shape reference only |

Full binding table: `src/lib/pilotControl/pilotSourceBindings.ts`.  
1A.2 signal register: `docs/audits/fi-pilot-readiness-source-bindings.json`.

**Not reused as cohort sources:** `fi_reception_pilot_feedback`, HubSpot contact-lead pilot decisions, go-live readiness, marketing “controlled pilot” copy.

---

## New objects (1A.1)

| Object | Type | Purpose |
|--------|------|---------|
| `fi_pilot_programmes` | Table | Tenant-scoped programme + configurable escalation thresholds |
| `fi_pilot_enrolments` | Table | Explicit patient membership + lifecycle timestamps |
| `fi_pilot_control_events` | Table | Operational telemetry (no clinical content / message bodies) |
| `src/lib/pilotControl/pilotControlContracts.ts` | TS contracts | Statuses, readiness enums, blockers, permissions, events |
| `pilotEnrolmentCore.ts` | Pure | Transitions, membership resolution, operational filters |
| `pilotReadinessCore.ts` | Pure | Fail-closed overall readiness composition |
| `pilotBlockerCore.ts` | Pure | Escalation thresholds + severity |
| `pilotHealthCore.ts` | Pure | Deterministic GREEN/AMBER/RED (critical fail-closed) |
| `pilotSyntheticCohort.ts` | Fixture | Synthetic enrolments for acceptance proofs |
| `pilotCohortQuery.server.ts` | Server | Tenant-safe read queries |
| Migration | `202611041001_platform_pilot_control_centre_1a1_cohort.sql` | Schema + Evolved programme seed (no patient enrolments) |

**Not created (deferred / avoided)**

- Parallel milestone, clearance, or pathology tables
- Real patient invite tokens
- Control Centre UI route
- Public REST `/api/pilot-control/*` (delivered in 1A.4; UI deferred)

---

## Readiness rules

Domain states are calculated separately. **Overall readiness is not an average.**

Fail-closed composition (`deriveOverallReadiness`):

1. Enrolment completed → `completed`
2. Identity / tenant integrity issue → `blocked`
3. Any clinical blocker → `blocked`
4. Mandatory consent gap / blocked consent → `blocked`
5. Mandatory document gap (blocked) → `blocked`
6. Required financial gate unmet / financial blocked / reconciliation required → `blocked`
7. Pathology blocked or unknown → `blocked`
8. Any unknown mandatory provenance → `blocked`
9. Other domain `blocked` → `blocked`
10. Technical delivery failures → `attention_required` (never silent pass)
11. All mandatory domains ready and no technical attention → `ready`
12. Otherwise `in_progress` / `not_started`

Optional documents must not set mandatory flags (`optionalDocumentDoesNotBlock`).

Suggested domain state enums are frozen in `pilotControlContracts.ts`.

---

## Blocker rules

Every blocker carries: type, severity, source module, source record, first/last detected, owner, recommended next action, resolution state.

Categories (19): identity, patient activation, patient/clinic action overdue, clinical review, pathology, medication, consent, documents, images, appointment, financial, payment reconciliation, communication, notification delivery, integration, technical failure, data-quality, governance approval.

Severities: `info` | `attention` | `high` | `critical`.

---

## Escalation rules

Configurable on `fi_pilot_programmes.escalation_thresholds` (defaults in contracts):

| Level | Examples |
|-------|----------|
| Attention | Patient action overdue >24h; clinic action overdue >1 business day; inactive ≥3 days; unread message >4 business hours |
| High | Surgery ≤7 days without consent or financial clearance; pathology unresolved; identity mismatch; notification failed past retry; blocked >3 days |
| Critical | Cross-tenant identity; wrong-patient linkage; ready despite mandatory blocker; payment/consent wrong patient; cross-patient data access; readiness misrepresented |

Critical always wins; health score cannot override.

---

## Permission model

Role scopes frozen in `PILOT_CONTROL_ROLE_SCOPES`:

| Role | Clinical detail | Financial detail |
|------|-----------------|------------------|
| Director / administrator | Full | Full |
| Clinic manager | Summary | Summary |
| Reception | None (full clinical) | Summary only |
| Consultant | Summary | Summary |
| Clinical | Full | None |
| Finance | None | Full |

List views must not expose sensitive clinical findings. Drill-downs respect existing module permissions (enforced in 1A.4/1A.5).  
1A.2 exposes `projectReadinessForRole` for role-sensitive output proofs.

---

## Tenant-isolation proof (1A.1)

| Proof | Result |
|-------|--------|
| Synthetic other-tenant enrolment filtered by `filterEnrolmentsForTenant` | PASS |
| Ambiguous duplicate enrolment → `resolvePilotMembership` returns null | PASS |
| Blank tenant → empty filter result | Covered by trim/empty fail-closed |
| SQL RLS: tenant member SELECT only; writes `service_role` | In migration |
| Server query always `.eq("tenant_id", tid)` + defence-in-depth filter | `pilotCohortQuery.server.ts` |
| Programme seed keyed to Evolved tenant id/slug only | Migration `ON CONFLICT DO NOTHING` |

Live cross-tenant API proofs deferred to 1A.4 / 1A.7.

---

## Acceptance results (1A.1 pure proofs)

| # | Scenario | Status |
|---|----------|--------|
| 1 | Ready patient → overall ready | PASS |
| 2 | Mandatory consent missing → blocked | PASS |
| 3 | Pathology unresolved → blocked | PASS |
| 4 | Deposit gate unmet → blocked | PASS |
| 5 | Optional document does not block | PASS |
| 6 | Unread message → Reception attention | Deferred 1A.3/1A.5 (escalation signal covered) |
| 7 | Overdue clinic action escalates | PASS (attention) |
| 8 | Inactive patient identified | PASS |
| 9 | Failed push → technical attention | Partial (readiness attention rule PASS; live notify wiring 1A.2+) |
| 10 | App not activated → activation blocker | Fixture present (`invited`); engine 1A.2/1A.3 |
| 11 | Wrong-tenant not returned | PASS (filter) |
| 12 | Ambiguous identity fails closed | PASS (enrolment ambiguity); foundation identity engine 1A.2 |
| 13 | Payment cannot clear wrong patient | Deferred 1A.2 financial binding |
| 14 | Clinical blocker overrides ready domains | PASS |
| 15 | Unknown mandatory ≠ ready | PASS |
| 16 | Health RED on critical integrity | PASS |
| 17 | Health AMBER on excessive high blockers | PASS |
| 18 | Staff see only permitted details | Contract PASS; API enforcement 1A.4 |
| 19 | Completed remain in historical reporting | PASS (filter helpers + fixture) |
| 20 | Withdrawn excluded from active metrics | PASS |

**Unit test command**

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test src/lib/pilotControl/pilotControlContracts.test.ts
```

---

# 1A.2 — Readiness Engine and Domain Signal Wiring

## Adapter architecture

```
evaluatePilotPatientReadiness (server)
  → loadPilotEnrolmentForPatient (explicit membership only)
  → loadPilotReadinessSourceBag (tenant-scoped domain reads)
  → evaluatePilotPatientReadinessFromSources (pure)
       1. resolve identity gate
       2. resolve journey stage
       3. run clinical / financial / patient / operational / technical resolvers
       4. composeDimensionState per dimension
       5. assemblePilotPatientReadiness → deriveOverallReadiness (1A.1)
```

| Path | Role |
|------|------|
| `src/lib/pilotControl/readiness/readinessTypes.ts` | Signal / dimension / overall contracts |
| `readinessProvenance.ts` | Safe provenance builders |
| `readinessMilestones.ts` | Stage → requirement map |
| `readinessSourceBag.ts` | Injectable source bag |
| `adapters/*ReadinessAdapter.ts` | Pure signal resolvers |
| `adapters/*.server.ts` | Thin server wrappers |
| `loadPilotReadinessSources.server.ts` | Live SoR bag loader |
| `evaluateFromSources.ts` | Pure orchestration |
| `evaluatePilotPatientReadiness.server.ts` | Patient + cohort entrypoints |
| `composeOverallReadiness.ts` | Bridge to frozen `deriveOverallReadiness` |
| `roleSensitiveProjection.ts` | Finance / reception provenance redaction |
| `docs/audits/fi-pilot-readiness-source-bindings.json` | Machine-readable register |

Adapters do **not** decide overall readiness. They return signals + provenance only.

## Source bindings used

See `fi-pilot-readiness-source-bindings.json` (`implementationStatus: wired` / `wired_with_limitation`).

Primary live reads: `fi_patients`, `fi_pilot_enrolments`, `fi_patient_journey_milestones`, `fi_patient_actions` (via clinic readiness), `fi_pathology_*`, `fi_crm_quotes`, `fi_financial_clearance_snapshots`, `fi_patient_document_*`, `fi_patient_images`, `fi_bookings`, `fi_patient_notification_dispatch_log`.

## Source bindings unavailable

| Area | Status | Behaviour |
|------|--------|-----------|
| Canonical theatre staff assignment SoR | `source_unavailable` | `operational.staff_assignment` stays `unknown` (non-blocking) |
| Full unallocated-payment ledger beyond snapshot flags | `wired_with_limitation` | Consumes flags; does not recompute ledger |
| Dedicated postoperative journey milestone keys | `contract_only` | Stage map ready; derivation limited to P1 keys |
| Expected success correlation events | `contract_only` | Absence ≠ success |

## Readiness requirement map

Stages: `pre_invitation` → `consultation_preparation` → `procedure_preparation` → `postoperative_follow_up` → `completed`.

Derived from enrolment status + `fi_patient_journey_milestones` (`resolvePilotJourneyStage`).  
Examples: pre-invitation does not require app/forms/images/consent; procedure prep requires accepted quote, deposit/clearance, pathology when required, consent, confirmed appointment.

## Provenance model

Every signal includes `ReadinessProvenance` with source system, table/view, record id (when safe), observed value class, and `resolverVersion` (`1A.2.0`).  
Never includes pathology values, medication names, clinical free text, card data, payment tokens, document contents, image URLs, or message bodies.

## Identity fail-closed behaviour

Identity is evaluated first. Failures (≥ high; critical for cross-tenant / wrong-patient / ambiguous app linkage):

- Override all other dimensions to `blocked`
- Force overall `blocked`
- Cross-patient technical linkage also sets `identityIntegrityBlocked`

## Clinical readiness rules

- No pathology requirement → `not_applicable`
- Required pathology with no result → `pending` / `missing`
- Received but unreviewed → `review_required`
- Clinical escalation blocks where required
- Approved consultation alone does not imply surgical readiness
- Unknown clinical approval ≠ ready
- Superseded records do not satisfy

## Financial readiness rules

- Manual verified payments may satisfy deposit
- Stripe never required; branch-only Stripe ignored with warning
- Unallocated payment must not clear
- Wrong-patient payment → critical blocker
- Quote without accepted state does not satisfy
- Payment plan satisfies only when canonical flag permits
- Consumes clearance snapshot; does not recalculate ledger independently

## Patient readiness rules

- No invitation ≠ patient failure when invites disabled
- Approved-not-invited uses pre-invitation state
- App activation conditional after invitation
- Optional forms/docs/images do not block
- Missing mandatory consent blocks
- Missing required image roles block only at applicable milestone
- Inactivity → attention, not clinical failure

## Operational readiness rules

- Do not invent requirements without source bindings
- Appointment readiness is stage-aware
- Missing surgery info does not block consultation-stage patients
- Staff assignment remains `unknown` when no canonical scheduling SoR
- Surgery readiness cannot be ready while consent incomplete

## Technical readiness rules

- Failed push → `attention_required`
- Repeated failures escalate past threshold
- Absence of expected success remains unknown/pending (never inferred success)
- Cross-patient technical linkage → critical + identity override

## Journey-stage awareness

`PILOT_STAGE_REQUIREMENT_MAP` in `readinessMilestones.ts` gates requirement type and blocking per signal.

## Performance characteristics

- Explicit tenant + programme filters; no full-tenant scans for membership
- Cohort evaluation: stable patientId sort, pagination (`page`/`pageSize` ≤ 100), bounded concurrency (default 4)
- Per-patient source bag still issues several domain queries (documented N+1 limitation until batch loaders expand)
- No persistent cache in 1A.2 (any future cache must be tenant+programme scoped, short TTL, versioned, bypassable)

## Test results (1A.2)

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/pilotControl/pilotControlContracts.test.ts \
  src/lib/pilotControl/readiness/pilotReadinessEngine.test.ts
```

**Result:** 72 tests, 0 failures (1A.1 baseline retained; 46+ 1A.2 scenarios covering identity, clinical, financial, patient, operational, technical, composition, security).

## Known limitations (1A.2)

1. Image role requirements for live patients are stage-aware in pure engine; live loader currently supplies empty `requiredRoles` until ImagingOS role catalogue is bound per milestone (`wired_with_limitation`).
2. Staff assignment remains `unknown` without scheduling SoR.
3. Patient inactivity days are not yet derived from live last-activity timestamps in the loader (fixture/engine covered).
4. No readiness telemetry writers hooked yet (`pilot_readiness_*` events deferred; schema already permits safe ops events).
5. No UI / public API.
6. Real patient invites remain disabled.

## Deferred live wiring

- Batch finance/document/notification summaries for large cohorts
- Communication unread ageing (Reception) → 1A.3
- Deduplicated blocker ownership engine → 1A.3
- Role enforcement at HTTP boundary → 1A.4

## Production impact (1A.2)

| Area | Impact |
|------|--------|
| Clinical / finance / journey SoR | None (read-only observation) |
| Patient invites | None |
| Stripe / generative ImagingOS | None |
| Schema | No new tables in 1A.2 |
| Existing screens | Unchanged |

## Final phase verdict (1A.2)

| Scope | Verdict | Rationale |
|-------|---------|-----------|
| **1A.1** | **GREEN** | Explicit cohort SoR + frozen contracts |
| **1A.2** | **GREEN** | Read-only readiness engine, provenance, stage map, adapters, isolation/role proofs |
| **1A overall (Control Centre usable)** | **AMBER** | No APIs/UI yet; staff cannot operate from one screen |
| **Real patient pilot** | Not started | |
| **Formal production** | **NO-GO** | |

**At 1A.2 completion the next authorised step was 1A.3** (delivered below).

---

# 1A.3 — Blocker, Ownership and Escalation Engine

## Blocker architecture

```
evaluatePilotPatientBlockers (server)
  → loadPilotEnrolmentForPatient (explicit membership only)
  → evaluatePilotPatientReadiness (1A.2 — read-only)
  → detectBlockerCandidates (signals → candidates via rule register)
  → fingerprint → reconcile with fi_pilot_blockers
  → ownership + severity + ageing + escalation
  → persist derived rows (optional) · return health inputs
```

| Path | Role |
|------|------|
| `src/lib/pilotControl/blockers/blockerTypes.ts` | Full operational blocker / ownership / escalation contracts |
| `blockerRules.ts` | Frozen taxonomy → owners, severity base, resolution, pause |
| `detectBlockerCandidates.ts` | Readiness-signal detection (no domain re-evaluation) |
| `blockerFingerprint.ts` | Stable sha256 fingerprint (no timestamps / display text) |
| `ownershipEngine.ts` | Deterministic ownership precedence |
| `severityEngine.ts` | Recalculated severity (critical integrity latch) |
| `ageingEngine.ts` | UTC age + Brisbane business-hour contract |
| `escalationEngine.ts` | `evaluateBlockerEscalation` |
| `resolutionEngine.ts` | Source-state resolve / supersede / dismissal gates |
| `reconcileBlockers.ts` | Idempotent reconcile algorithm |
| `blockerHealthInput.ts` | Counts/flags for frozen health engine |
| `roleSensitiveBlockerProjection.ts` | Role redaction for future UI/API |
| `evaluateFromReadiness.ts` | Pure entry + in-memory store |
| `*.server.ts` | Enrolment-gated entrypoints + persistence |
| `docs/audits/fi-pilot-blocker-rules.json` | Machine-readable register |

Blockers answer four fields: what / why / who owns next action / how long unresolved.

## Persistence model

Table `fi_pilot_blockers` (migration `202611041002_platform_pilot_control_centre_1a3_blockers.sql`):

- Derived operational register only — not a clinical/financial SoR
- Unique active fingerprint per `(programme_id, enrolment_id)` where state ∈ open/acknowledged/in_progress
- No delete-on-resolution; terminal states retain audit history
- RLS: tenant member SELECT; writes `service_role` / domain service only
- Titles/summaries must not contain clinical free text, pathology values, or payment tokens

## Fingerprinting

Stable fields: `programmeId | tenantId | patientId | category | sourceModule | sourceSignalKey | sourceRecordId | milestoneContext`.

Must **not** depend on evaluation timestamp, display wording, temporary correlation IDs, patient names, or mutable summaries.

## Deduplication and recurrence

- Same unresolved source issue → same fingerprint; updates `lastConfirmedAt` only
- `firstDetectedAt` preserved across re-evaluations
- Severity may change without changing fingerprint
- **Recurrence policy:** `new_occurrence_on_reopen` — after resolve/supersede/dismiss, a returning condition creates a **new** occurrence (new `firstDetectedAt`); terminal history is preserved

## Reconciliation

1. Evaluate readiness → candidates → fingerprints  
2. Load active blockers for programme/enrolment (tenant-scoped)  
3. Match → update confirmed/severity/ownership/escalation  
4. Insert new · resolve missing · supersede replaced source records  
5. Idempotent: unchanged source data does not duplicate or reset age  

Concurrent evaluations: unique active fingerprint index; persist layer retries update-on-conflict.

## Resolution detection

Resolution is from canonical source state only. Acknowledgement never resolves. Category rules live in `blockerRules.ts` (consent, pathology, financial clearance, unallocated payment, notification delivery, identity conflict, etc.).

Dismissal requires reason + actor; forbidden for critical integrity, wrong-patient, mandatory consent gaps, active clinical blockers, and governance hard gates.

## Ownership rules

Precedence: canonical assignee → programme/enrolment owner → module default → escalation owner → unassigned.

High/critical blockers cannot remain patient-only — clinic monitoring owner is promoted. Patient-owned actions also carry `monitoringOwnerType` (typically reception).

## Severity rules

Combines category base, age, procedure proximity, repeated failures, and integrity impact. Recalculated every evaluation. Critical integrity severity is never reduced by acknowledgement.

## Ageing rules

- Timestamps stored UTC; Evolved clinic timezone `Australia/Brisbane`
- Business hours: Mon–Fri 09:00–17:00 Brisbane; **no holiday calendar contracted** in 1A.3
- Paused enrolments may pause patient-action / activation / notification timers
- Critical identity/integrity timers **never** pause

## Escalation rules

`evaluateBlockerEscalation` uses programme thresholds from `fi_pilot_programmes.escalation_thresholds`. Acknowledgement does not stop escalation. Unowned high blockers escalate. Procedure proximity elevates consent/financial/pathology/clinical review.

## Pilot-pause conditions

Engine returns `requiresPilotPause` / `requiresImmediateReview` only — does **not** pause the programme. Triggers include cross-tenant identity, wrong-patient payment/consent/linkage, cross-patient technical linkage, and governance stop rules.

## Role-sensitive projections

`projectBlockerForRole` redacts clinical provenance for reception/finance/technical as appropriate. Critical identity/privacy blockers never emit patient-safe summaries. Role `technical` added to frozen permission scopes (identity + technical only).

## Pilot-health integration

`buildPilotBlockerHealthInput` supplies open-by-severity counts, oldest age, overdue action counts, identity/financial/clinical safety counts, and pilot-pause flags. Does **not** redefine GREEN/AMBER/RED — consumes frozen `derivePilotHealthVerdict`.

## Security and RLS

- Tenant filter on every load/persist path; refuse cross-tenant/patient writes
- Wrong-patient association cannot transfer blockers between enrolments
- Service-role persistence still requires explicit tenant/programme/enrolment/patient match

## Test evidence

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/pilotControl/pilotControlContracts.test.ts \
  src/lib/pilotControl/readiness/pilotReadinessEngine.test.ts \
  src/lib/pilotControl/blockers/pilotBlockerEngine.test.ts
```

**Result:** 107 tests, 0 failures (72 prior retained; 35 new covering detection, resolution, ownership, severity, ageing, escalation, security, health, idempotency — scenarios 1–56 in the 1A.3 brief).

## Performance

- Per-patient: readiness evaluation + one active-blocker load + upsert set
- Cohort: stable patientId sort, pagination ≤100, concurrency default 4
- No full-tenant scans for membership
- Fingerprint is sha256 truncated to 40 hex chars

## Known limitations (1A.3)

1. Governance approval gate is `contract_only` until approved operational events are wired.
2. Image / inactivity live bindings inherit 1A.2 limitations.
3. Business-hour ageing excludes weekends only — no public-holiday calendar.
4. Supersede path depends on stable `sourceRecordId` changes from adapters; some signals omit record ids.
5. No UI / public API; acknowledgement writes not exposed to staff yet.
6. Migration not applied to remote in this delivery step.

## Production impact (1A.3)

| Area | Impact |
|------|--------|
| Clinical / finance / journey SoR | None (read-only observation) |
| Patient invites / Stripe / generative ImagingOS | None |
| Schema | Additive `fi_pilot_blockers` + RLS |
| Existing screens | Unchanged |

## Final phase verdict (1A.3)

| Scope | Verdict | Rationale |
|-------|---------|-----------|
| **1A.1** | **GREEN** | Explicit cohort SoR + frozen contracts |
| **1A.2** | **GREEN** | Read-only readiness engine |
| **1A.3** | **GREEN** | Blocker/ownership/escalation engine, persistence, projections, tests, register |
| **1A overall (Control Centre usable)** | **AMBER** | No APIs/UI yet |
| **Real patient pilot** | Not started | |
| **Formal production** | **NO-GO** | |

**Next authorised step (at 1A.3 close):** `FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4` — Read-Only Pilot Control APIs.

---

# 1A.4 — Read-Only Pilot Control APIs

## Route architecture

```
app/api/pilot-control/
  programmes/route.ts
  overview/route.ts
  patients/route.ts
  patients/[patientId]/route.ts
  blockers/route.ts
  activity/route.ts
  health/route.ts
  export/route.ts

src/lib/pilotControl/api/
  resolvePilotControlRequestContext.server.ts
  pilotControlServices.server.ts
  assemblePilotHealth.ts
  pilotControlSerializers.ts
  queryPilotBlockers.server.ts
  pilotControlActivity.server.ts
  …errors, envelope, pagination, rate limits, export safety, permissions, role map, source links
```

Routes are thin. Domain logic is consumed from 1A.1–1A.3 (`evaluatePilotPatientReadiness`, `evaluatePilotPatientBlockers`, `derivePilotHealthVerdict`, enrolment/cohort queries, role projections).

## Request-context resolution

`resolvePilotControlRequestContext`:

1. Authenticate (`resolveAuthUserId`) — fail closed if missing  
2. Resolve tenant from verified membership (hint via `x-fi-tenant-id` / `tenantId` only after membership check; ambiguous multi-tenant → `PILOT_CONTROL_IDENTITY_AMBIGUOUS`)  
3. `assertCrmTenantReadAllowed`  
4. Map staff / fi_users / tenant-admin / platform-admin → `PilotControlRoleKey` (fail closed if unmapped)  
5. Resolve programme by UUID or key within tenant  
6. Attach frozen permission scopes + correlation ID + Brisbane timezone  

Query params are never trusted as authority for tenant, role, or permissions.

## Authentication / tenant isolation / programme access

| Control | Behaviour |
|---------|-----------|
| Unauthenticated | 401 `PILOT_CONTROL_UNAUTHENTICATED` |
| Wrong tenant / no membership | 403 `PILOT_CONTROL_TENANT_MISMATCH` / `FORBIDDEN` |
| Unknown programme | 404 `PILOT_CONTROL_PROGRAMME_NOT_FOUND` (tenant-scoped lookup) |
| Non-enrolled patient | 404 `PILOT_CONTROL_PATIENT_NOT_ENROLLED` (no foreign existence leak) |
| Ambiguous enrolment | 409 `PILOT_CONTROL_IDENTITY_AMBIGUOUS` |

## Permission model

Frozen 1A.1 scopes enforced via `pilotControlRoleHasScope`. Spec-facing dotted aliases documented in `docs/audits/fi-pilot-control-api-contracts.json` and `pilotControlPermissions.ts`.

Export requires `export`. Pilot-pause recommendation fields require `overview_full` (director/administrator).

## Role-sensitive serialization

- Readiness: `projectReadinessForRole` before detail serialize  
- Blockers: `projectBlockerForRole` / list serializer  
- Activity: `safeSummary` only — payloads never echoed  
- Source links: permission-filtered; canonical patient UUID only  
- Register rows: no pathology, amounts, image URLs, message bodies, clinical free text  

Serializers do not mutate canonical engine objects or alter severity / overall readiness.

## API contracts

- Machine register: `docs/audits/fi-pilot-control-api-contracts.json`  
- OpenAPI supplement: `docs/architecture/fi-pilot-control-1a4-openapi-supplement.md`  
- Envelope: `{ data, meta }` / `{ data, pagination, meta }` with `apiVersion`, evaluation versions, correlation ID, `partial`, warnings  

## Pagination and filters

- Register: **mandatory** `page` + `pageSize` (max 100)  
- Sorts/filters allowlisted only  
- Search max 80 characters  
- Activity date range max **31 days** (documented default)  
- Blockers default to active states; resolved requires explicit `state`  

## Partial-result handling

- `meta.partial` + warnings when readiness adapters emit warnings  
- Mandatory identity failure fails closed (engine + enrolment ambiguity)  
- Optional source gaps must not silently become ready (engine invariant retained)  

## Freshness metadata

`meta.evaluation` includes:

- `readinessVersion` `1A.2.0`  
- `blockerVersion` `1A.3.0`  
- `healthVersion` `1A.1.0`  
- `blockerPersistenceMode`: default **`read_only`** on GET  

### Persistence strategy (documented)

| Item | Policy |
|------|--------|
| Readiness | Calculated read-only on demand |
| Blockers | Prefer `fi_pilot_blockers` reads; GET uses `persistDerivedState: false` |
| Broad cohort reconcile | **Not** on every UI refresh |
| Patient detail | Targeted re-evaluation allowed; persistence off by default |
| Authorised refresh mutation endpoint | **Deferred** |

## Error model

Stable codes in `PILOT_CONTROL_*` family. Public messages omit SQL, stack traces, DB names, and foreign patient existence.

## Rate limiting

Process-local controls:

- 120 requests / user / minute  
- 5 exports / user / 10 minutes  
- Max 3 simultaneous evaluations / user  
- Page/search/date/export row caps  

## Export safety

- Requires `export` scope  
- CSV formula injection neutralised (`sanitizeCsvCell`)  
- Safe filenames; row limit 500  
- Activity export requires bounded date range  
- Audit event records actor/tenant/programme/type/rowCount/correlation — **not** exported rows  

## Audit events

Added to `PILOT_CONTROL_EVENT_KINDS`:

- `pilot_control_overview_viewed`  
- `pilot_control_patient_register_viewed`  
- `pilot_control_patient_detail_viewed`  
- `pilot_control_blockers_viewed`  
- `pilot_control_health_viewed`  
- `pilot_control_activity_viewed`  
- `pilot_control_export_created`  
- `pilot_control_access_denied`  
- `pilot_control_evaluation_failed`  

Automatic refresh (`x-fi-pilot-refresh: 1` or `refresh=auto`) skips noisy view audits.

## Performance evidence

| Route | Strategy |
|-------|----------|
| Overview | Enrolment counts + bounded active blocker register (no unrestricted patient-by-patient eval) |
| Register | Mandatory pagination; page-scoped blocker join; search tenant-scoped |
| Detail | Single-patient readiness + blockers; concurrency guard |
| Activity | Indexed tenant/programme/created_at query; bounded range |
| Blockers | Indexed tenant/programme/state filters; no JSON provenance scan for ordinary filters |
| Empty / planned | Valid zero-state; health `insufficient_evidence` (not GREEN) |

Expected: empty and planned Evolved programme are cheap. Synthetic/intended pilot cohort sizes remain within pageSize ≤100 and concurrency 4 patterns from 1A.2/1A.3.

## Tests

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/pilotControl/pilotControlContracts.test.ts \
  src/lib/pilotControl/readiness/pilotReadinessEngine.test.ts \
  src/lib/pilotControl/blockers/pilotBlockerEngine.test.ts \
  src/lib/pilotControl/api/pilotControlApi.test.ts
```

**Result:** **146** passing (107 prior engine/contract proofs + **39** API-layer acceptance proofs). Existing 107 retained.

Coverage includes: pagination/filter abuse controls, empty-cohort health, critical/AMBER health, role redaction, CSV injection, export rate limits, source-link canonical IDs, serializer non-mutation, pause visibility, activity content exclusion.

Live HTTP auth/tenant proofs against a running deployment remain partially deferred to 1A.7 (same pattern as prior stages).

## Known limitations (1A.4)

1. Register rows do not yet batch full readiness evaluation for every cell — journey/readiness may show `unknown` until a materialised register/cache (UI phase may drive this).  
2. Overview readiness distribution is approximated from blocker severity, not a full cohort readiness rollup.  
3. App push availability metrics return zeros until notification inventory is wired for pilot control.  
4. Some optional register filter query params are accepted but not fully applied pending indexed register materialisation.  
5. Rate limits are process-local (not distributed).  
6. Migrations for 1A.1/1A.3 must still be applied via governed workflow before live API use.  
7. Control Centre UI delivered in 1A.5 (see below).  

## Production impact

| Area | Impact |
|------|--------|
| Clinical / financial / journey SoR | **None** (read-only consumption) |
| Patient invites | **None** — Evolved `realPatientInvitesEnabled` remains false |
| Stripe | **None** / irrelevant to API readiness |
| Schema | No new 1A.4 migration; uses existing pilot tables |
| Writes on GET | Blocker persistence **off** by default; audit events only |

## Final verdict (1A.4)

| Scope | Verdict | Rationale |
|-------|---------|-----------|
| **1A.1** | **GREEN** | Unchanged |
| **1A.2** | **GREEN** | Unchanged |
| **1A.3** | **GREEN** | Unchanged |
| **1A.4** | **GREEN** | Authenticated read-only APIs, role projection, contracts, limits, tests |
| **Full Pilot Control Centre** | **AMBER** | No UI yet |
| **Real patient pilot** | Not started | |
| **Formal production** | **NO-GO** | |

**1A.4 recommendation (complete):** Proceeded to **1A.5 Control Centre User Interface**.

---

## 1A.5 — Control Centre User Interface

### UI architecture

- **Route:** `/fi-admin/[tenantId]/pilot-control` (+ optional `/[programmeId]`); alias `/admin/pilot-control` → `/fi-admin`.
- **Components:** `src/components/pilotControl/*` (page, header, health banner, metrics, attention queue, register, drawer, blockers, activity, technical, export, empty/partial/error).
- **Hooks:** `src/hooks/pilotControl/*` — fetch-only against `/api/pilot-control/*`.
- **Pure UI helpers:** `src/lib/pilotControl/ui/*` (formatters, filters, role columns, metrics, client, page access).
- **Boundary:** No readiness/blocker engine imports in client UI; no DB clients in components; no mutation controls.

### Route and access control

- Server page: `assertFiTenantPortalAccess` + `resolvePilotControlPageAccess` requiring `pilot_control.overview.read`.
- Unauthorised direct access → `notFound()` (hidden nav is not the only control).
- Nav: Front desk workflow group → **Pilot Control Centre**, gated by `showPilotControlNav`.

### API-only data boundary

UI consumes only:

`programmes | overview | patients | patients/:id | blockers | activity | health | export`

### Programme header / health / metrics

- Planned empty cohort → **AMBER** + “Insufficient live evidence”; never GREEN success.
- Real invitations disabled surfaced.
- Health banner text+icon for GREEN/AMBER/RED/insufficient evidence.
- Metric cards from `/overview`; approximate readiness labelled; zero denominators → `—`.

### Attention queue / register / drawer

- Active blockers sorted critical → high → attention → oldest.
- No dismiss/resolve/invite/message/pause controls.
- Role-default columns (reception / clinical / finance / director / technical).
- Register cells never fabricate Ready; unknown → “Not evaluated in register”.
- Drawer read-only; clinical/financial/technical sections permission-gated; source links from API only.

### Role-sensitive UI / empty / partial / refresh / export

- Soft-hide export/pause chrome via frozen scopes; API remains authoritative.
- Empty cohort copy honest; partial/stale notices; correlation IDs on errors.
- Overview/blockers auto-refresh 60–120s; pause when document hidden.
- Export dialog: type/format/row-limit confirm; activity requires date range; role notice.

### Accessibility / responsive

- Text + icon severity; table headers; drawer focus restore on Escape; keyboard-focus rings.
- Desktop table; tablet reduced columns; mobile cards retain severity/owner/blocker.

### Migration status

- Page checks presence of `fi_pilot_programmes`, `fi_pilot_enrolments`, `fi_pilot_control_events`, `fi_pilot_blockers`.
- Does **not** auto-apply migrations. Local migrations exist (`202611041001`, `202611041002`); remote apply remains governed.

### Test evidence

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/pilotControl/pilotControlContracts.test.ts \
  src/lib/pilotControl/readiness/pilotReadinessEngine.test.ts \
  src/lib/pilotControl/blockers/pilotBlockerEngine.test.ts \
  src/lib/pilotControl/api/pilotControlApi.test.ts \
  src/lib/pilotControl/ui/pilotControlUi.test.ts
```

**Result:** **168** passing (146 prior + **22** UI acceptance proofs). Architecture guards confirm no engine/DB imports in UI/hooks.

Playwright: `e2e/journeys/pilot-control-centre.spec.ts` — unauthenticated route/API denial + alias redirect.

### E2E evidence

| Journey | Status |
|---------|--------|
| Unauthenticated page/API denial | Covered (Playwright) |
| Director empty-cohort AMBER / invites disabled | Covered in pure UI proofs + API empty-cohort proofs |
| Role column / pause / export gating | Covered in pure UI permission proofs |
| Live authenticated role matrix (reception/clinical/finance/technical) against deployed tenant | **Partial** — deferred to governed live acceptance |

### Screenshots

Deferred to live authenticated deploy (empty planned programme). Capture checklist: header AMBER, health insufficient evidence, empty register, attention queue empty, export hidden for reception.

### Known limitations (1A.5)

1. Empty live cohort — insufficient evidence is correct, not a failure of the UI.
2. Overview/register readiness still blocker-derived / unknown until 1A.6 batch aggregation.
3. Remote migrations must be applied via governed workflow before production use.
4. Full authenticated multi-role Playwright matrix not yet run against production credentials.
5. Screenshots pending live session capture.

### Production impact (1A.5)

| Area | Impact |
|------|--------|
| Clinical / financial / journey SoR | **None** |
| Patient invites | **None** — disabled flag surfaced |
| Stripe | **None** |
| Schema | No new 1A.5 migration |
| New UI route | Read-only; server permission gated |
| Nav | Pilot Control Centre for authorised roles only |

### Final verdict (1A.5)

| Scope | Verdict | Rationale |
|-------|---------|-----------|
| **1A.1–1A.4** | **GREEN** | Unchanged |
| **1A.5** | **GREEN WITH LIMITATIONS** | UI API-only, access gated, empty-cohort honest, tests + surface register |
| **Full Pilot Control Centre** | **AMBER** | Empty cohort + approximate readiness + migration/live E2E gates |
| **Real patient pilot** | Not started | |
| **Formal production** | **NO-GO** | |

**Next authorised step:** `FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6` — Pilot Health, Adoption Metrics and Operational Validation (canonical batch readiness; no real invites until governance gates pass).

Machine-readable UI register: `docs/audits/fi-pilot-control-ui-surface-register.json`.

---

## Known limitations

1. **No live patient enrolments** — Evolved programme row is seeded; cohort remains empty until authorised staff approve synthetic/real enrolments via a later controlled process (real invites still out of scope).
2. **Domain readiness engines wired in 1A.2** (pure + server loaders); some live fields remain limited as listed above.
3. **Control Centre UI (1A.5)** landed; still limited by empty cohort and approximate readiness aggregation.
4. **Adoption event writers** not hooked to journey/finance/notify pipelines (schema ready; API can read events).
5. **`npm run check:migrations`** currently reports a pre-existing duplicate version `20260729120001` unrelated to this phase.
6. Migration not applied to remote in this delivery step — apply via governed Supabase workflow before relying on live APIs/UI.

---

## Production impact

| Area | Impact |
|------|--------|
| Clinical decisions | None |
| Financial clearance behaviour | None |
| Journey state machine | None |
| Patient App invites | None (explicitly disabled in programme metadata) |
| Stripe / generative ImagingOS | None |
| Schema | Additive tables + RLS; Evolved programme seed only if tenant exists |
| Existing screens | Unchanged except optional Pilot Control nav for authorised roles |
| New HTTP surface | Read-only `/api/pilot-control/*` (auth + tenant + role gated) |
| New UI surface | `/fi-admin/[tenantId]/pilot-control` (API-only; server gated) |

---

## Pilot expansion recommendation

**Do not expand the live patient pilot** until:

1. 1A.6 replaces blocker-derived readiness approximations with canonical batch aggregation  
2. 1A.7 acceptance scenarios 1–20 pass against a synthetic (then authorised) cohort  
3. Phase verdict reaches **GREEN** under the programme rule: authorised staff can identify every active pilot patient, readiness, actions, blockers, and relevant system errors from one screen  

**1A.5 recommendation:** Proceed to **1A.6**. Keep programme status `planned`; do not invite real patients. Stripe remains disabled.

---

## Delivery stage status

| Stage | Status |
|-------|--------|
| 1A.1 Canonical pilot cohort + readiness contract | **DONE** |
| 1A.2 Readiness engine | **DONE** |
| 1A.3 Blocker and escalation engine | **DONE** |
| 1A.4 Read-only APIs | **DONE** |
| 1A.5 Control Centre UI | **DONE** (GREEN WITH LIMITATIONS) |
| 1A.6 Pilot health and adoption metrics | Health pure rules done; live metrics partial via API health route |
| 1A.7 Validation and evidence | Partial (pure + readiness + blocker + API + UI proofs); full live evidence later |

---

## Final verdict

| Scope | Verdict | Rationale |
|-------|---------|-----------|
| **1A.1** | **GREEN** | Explicit cohort SoR, frozen readiness/blocker/escalation/health/permission contracts, tenant-safe queries, synthetic fixture, unit proofs |
| **1A.2** | **GREEN** | Read-only readiness engine with provenance, stage-aware requirements, domain adapters, cohort pagination entrypoint, 46-scenario tests |
| **1A.3** | **GREEN** | Derived blocker/ownership/escalation engine, `fi_pilot_blockers`, role projections, health inputs, 56-scenario proofs |
| **1A.4** | **GREEN** | Authenticated tenant-isolated role-sensitive read-only APIs; contracts register; 39 API proofs; 107 prior tests retained |
| **1A.5** | **GREEN WITH LIMITATIONS** | API-only Control Centre UI; access gated; empty-cohort honesty; 168 tests; surface register |
| **1A overall (Control Centre usable)** | **AMBER** | UI exists but live cohort empty; readiness still approximate; migrations/live E2E incomplete |

**Next authorised step:** `FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6` — Pilot Health, Adoption Metrics and Operational Validation.
