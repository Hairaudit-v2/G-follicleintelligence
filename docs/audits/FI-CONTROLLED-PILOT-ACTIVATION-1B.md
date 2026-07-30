# FI-CONTROLLED-PILOT-ACTIVATION-1B

**Programme:** Governed Pilot Activation and First-Cohort Readiness — Evolved Hair Restoration  
**Phase:** `FI-CONTROLLED-PILOT-ACTIVATION-1B`  
**Date:** 2026-07-30  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Pathway lock:** `quote_to_deposit`  
**Phase verdict:** **GREEN WITH LIMITATIONS** — technical workstream **GREEN**; human approvals incomplete; **not** approved for invites  
**Formal production:** **NO-GO**  
**Stripe:** **Disabled**  
**Initial invitations:** **OFF** — human approval required  
**Governance boundary:** `FI-CONTROLLED-PILOT-ACTIVATION-1B-GOVERNANCE-BOUNDARY`  
**Permission fix:** `707bac907bdc4e2614f2da46d4d6bdaa616da3d9`  
**Governance evidence:** `f2d7dba994e82b57598102d2dcc3d2b89f8b7be9`  
**Governance Closure (technical):** `575dec05` + build fix `df2b4230`  
**Live production deploy:** `dpl_AUR3k5R4eY7ppvDJEurCEB5oiot7` @ `df2b42308d1e71d58d7a7333b8ecfdc70b85d0aa` (**READY**)  
**Recommendation:** **defer**  
**Next phase (after human approvals):** `FI-CONTROLLED-PILOT-INITIAL-COHORT-1C`

---

## Executive summary

1B converts the completed Pilot Control Centre (1A) into an **eligible-for-governance-review** activation environment. Software proves technical controls, preflights, event coverage honesty, and activation-gate completeness. Software does **not** activate the programme, enable invites, enrol real patients, enable Stripe, or auto-set human approvals.

**Successful completion means:** the system is eligible for a human governance decision on whether to invite the first controlled cohort — not that the pilot has succeeded or that FI is production-ready.

---

## Delivered outcomes

| # | Outcome | Status |
|---|---------|--------|
| 1 | Governed remote migration application | Schema on live FI project (`202611041001`–`202611041003`); programme remains planned / invites off |
| 2 | Live tenant / identity isolation proof | **PASS** — remote RLS + wrong-tenant JWT/API proofs (`evidence-fi-pilot-activation-1b-rls-readonly.json`) |
| 3 | Authenticated role-matrix browser proof | **PASS** — live API role matrix after Governance Closure deploy `df2b4230` (CFO→finance); headed screenshots optional |
| 4 | First-cohort event coverage | Register honest (`wired` / `contract_only` / `not_required`) — **not** upgraded without emitter proof |
| 5 | Operational SOP and staff readiness | Docs landed; human training completion **pending** |
| 6 | Incident, support, rollback readiness | Docs + engines landed; human tabletop / named coverage **pending** |
| 7 | Human-governed activation decision | **NOT APPROVED** — `approved_for_initial_invites` remains false |

---

## Governance evidence run — Stage 1 freeze (2026-07-30)

| Item | Result |
|------|--------|
| Branch | `main` (synced with `origin/main`) |
| Commit SHA | `5430235a7e818325a637cd068bf8b1fdbec06db8` |
| Rollback marker (annotated tag) | `FI-CONTROLLED-PILOT-ACTIVATION-1B-GOVERNANCE-BOUNDARY` (pushed) |
| Pilot-control unit tests | **305 pass / 0 fail** |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (pre-existing hook warnings only; unrelated to 1B) |
| `npm run build` | Pass |
| Invitation flag in commit / seed | `real_patient_invites` / `realPatientInvitesEnabled` remain **false** |
| Unrelated working-tree artefacts | **Excluded** — platform deployment audits + mime migration rename remain dirty/untracked and were **not** committed into 1B |

Commit scope confirmed: activation model, decision/candidate-review schema, preflight engines, activation gate, read-only activation UI, SOP/incident/rollback/training docs, governance registers, audit evidence.

**Stage 1 stop conditions:** none tripped (tests green; no secrets/screenshots in commit; invites disabled).

---

## Governance evidence run — Stage 2 deployment target (pending human confirmation)

| Field | Recorded value |
|-------|----------------|
| Supabase project name | **Follicle Intelligence** |
| Supabase project ID / ref | `iqqvzgxoimxchhcnbzxl` |
| Region | `ap-south-1` |
| Environment classification | **LIVE production project hosting Evolved tenant** (not IIHOR-staging) |
| Evolved tenant | `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`) |
| Programme | `evolved_controlled_pilot_1a` / `a5ede63d-5cad-4d50-96f1-93ba7ee28cf3` |
| Current deployed app commit | `df2b42308d1e71d58d7a7333b8ecfdc70b85d0aa` (Vercel production `dpl_AUR3k5R4eY7ppvDJEurCEB5oiot7`, READY → `follicleintelligence.ai`) |
| Prior Governance Closure commit | `575dec05` (build failed on first prod attempt; fixed by `df2b4230`) |
| Current migration head (pilot chain) | `202611041003` / `platform_pilot_activation_1b` |
| Operator recording this pack | Cursor agent + HairAudit operator context (`manager@evolvedhair.com.au`) |
| Date / time (AEST) | 2026-07-31 ~07:07 AEST (live role-matrix + export re-proof) |
| Backup / recovery position | Production PITR / restore-drill source project `iqqvzgxoimxchhcnbzxl` (see `docs/security/fi-security-restore-drill-1.md`) |
| Rollback procedure | `docs/operations/FI-CONTROLLED-PILOT-ROLLBACK-1B.md` + tag `FI-CONTROLLED-PILOT-ACTIVATION-1B-GOVERNANCE-BOUNDARY` |
| Scope restriction | Evolved tenant only — no other clinic / demo tenant mutations |

**Required human decision before further operational mutation:** confirm whether this governance proof continues against the **live Follicle Intelligence project** (invites + programme activation must remain disabled) or whether a separate staging project must be used. Migrations `202611041001`–`202611041003` are already present on live; re-apply is not required.

---

## Governance evidence run — Stages 3–4 migration review / remote state

### Checksums (local files, SHA-256)

| Migration | SHA-256 |
|-----------|---------|
| `202611041001_platform_pilot_control_centre_1a1_cohort.sql` | `706897D453A6E38A577770178C48757F84A0BF265168F905CEBEFB33FA3B447F` |
| `202611041002_platform_pilot_control_centre_1a3_blockers.sql` | `85E5CC870E713DB8AF4E149DFACB62190E45ACAE126F4944E27FBEEE3E545D00` |
| `202611041003_platform_pilot_activation_1b.sql` | `1F60B7CB440523C05245BA91F3DF8997E9D96C1611231FBA4217B130FA6FBC9C` |

### Remote apply record (already applied — no re-apply performed this run)

| Version | Name | Result |
|---------|------|--------|
| `202611041001` | `platform_pilot_control_centre_1a1_cohort` | Present in `supabase_migrations.schema_migrations` |
| `202611041002` | `platform_pilot_control_centre_1a3_blockers` | Present |
| `202611041003` | `platform_pilot_activation_1b` | Present |

### Post-apply programme safeguards (live query 2026-07-30)

| Check | Value |
|-------|-------|
| `activation_state` | `planned` |
| `metadata.real_patient_invites` | `false` |
| `metadata.stripe_enabled` | `false` |
| `metadata.initial_pathway_lock` | `quote_to_deposit` |
| `approved_for_initial_invites` (state) | **not set** (still `planned`) |
| Evolved enrolments | **0** |
| Evolved candidate reviews | **0** |
| Evolved activation decisions | **0** |
| Tables present + RLS enabled | `fi_pilot_programmes`, `fi_pilot_enrolments`, `fi_pilot_control_events`, `fi_pilot_blockers`, `fi_pilot_activation_decisions`, `fi_pilot_cohort_candidate_reviews` |

**Stage 3/4 stop conditions:** none tripped on reviewed SQL (no real enrolment seed; invites remain false; no destructive patient/finance mutations in 1B migration).

---

## Governance evidence run — Stage 5 remote schema

Verified on live `iqqvzgxoimxchhcnbzxl` (2026-07-30):

| Check | Result |
|-------|--------|
| Tables | All six `fi_pilot_*` present |
| RLS enabled | **true** on all six |
| Tenant / programme / patient FKs | Present |
| Unique active blocker fingerprint | `uq_fi_pilot_blockers_active_fingerprint` |
| Unique programme enrolment | `fi_pilot_enrolments_patient_programme_unique` |
| Activation-state check | `fi_pilot_programmes_activation_state_check` |
| Candidate lifecycle check | `fi_pilot_cohort_candidate_reviews_status_check` |
| Indexes (tenant/programme/patient/enrolment/blocker state/severity/decision/candidate status) | Present |
| Owner index on blockers | **Not present** (limitation — owner filtered via `owner_user_id` column without dedicated btree) |

---

## Governance evidence run — Stage 6 remote RLS

Script: `scripts/audits/proof-pilot-control-1b-rls-readonly.mjs`  
Evidence: `docs/audits/evidence-fi-pilot-activation-1b-rls-readonly.json`

| Proof | Result |
|-------|--------|
| Anon SELECT all pilot tables | 0 rows |
| Anon/authenticated INSERT events | RLS deny |
| Evolved authorised SELECT programme | PASS (`planned`, invites false) |
| Wrong-tenant JWT (`reception@evolvedhair.com.au`) | Cannot discover Evolved programme; 0 Evolved rows |
| Wrong-tenant API | `403 PILOT_CONTROL_TENANT_MISMATCH` |
| Unauth API | `401 PILOT_CONTROL_UNAUTHENTICATED` |
| **RED stop** | **Not tripped** (no cross-tenant leakage observed) |

---

## Governance evidence run — Stage 7 role matrix

Script: `scripts/audits/proof-pilot-control-1b-role-matrix-api.mjs`  
Evidence (canonical live): `docs/audits/evidence-fi-pilot-control-1b-live-role-matrix.json`  
Legacy mirror: `docs/audits/evidence-fi-pilot-activation-1b-role-matrix-api.json`  
Register: `docs/audits/fi-pilot-role-acceptance-register.json`

**Permission defect found and stopped progression:** API selected non-existent `fi_staff.primary_clinic_id`, wiping `staffRole` and falsely returning `PILOT_CONTROL_FORBIDDEN` for owner/manager/reception/clinical. Fixed in `707bac90`, deployed `dpl_4SV6831rvs4H5oU6dj44prNy7SkR`, then re-proved.

**Live re-proof after Governance Closure deploy `df2b4230` / `dpl_AUR3k5R4eY7ppvDJEurCEB5oiot7` (2026-07-31):**

| Role | Live API overview | Notes |
|------|-------------------|-------|
| director (paul) | 200 | PASS; export 200 |
| clinic_manager (manager) | 200 | PASS; export 403 |
| reception (jesika) | 200 | PASS; export 403 |
| consultant (connor) | 200 | PASS; export 403 |
| clinical (tlbpmg) | 200 | PASS; export 403 |
| finance (harsh/CFO) | 200 | **PASS** — `actorRole=finance` (not administrator); export 200; `activationGate` absent; clinical detail `404 PILOT_CONTROL_PATIENT_NOT_ENROLLED` / no clinical leak |
| administrator (auditor) | 200 | PASS; export 200 |
| wrong_tenant | 403 | PASS (`PILOT_CONTROL_TENANT_MISMATCH`) |
| inactive staff | 403 | PASS (`PILOT_CONTROL_FORBIDDEN`) |
| unauthenticated | 401 | PASS |
| Sensitive keys in API bodies | none | PASS |

Headed browser nav/screenshot matrix remains optional; API proofs cover access, denial, empty-cohort honesty, and field absence.

---

## Governance evidence run — Stages 8–10 events and synthetic preflight

| Item | Result |
|------|--------|
| Event register honesty | Unchanged — most pathway events remain `contract_only`; blockers/technical/access_denied remain `wired` |
| No false “wired” upgrades | Confirmed |
| Synthetic preflight unit scenarios | **86/86** pass in `pilotActivation1B.test.ts` (identity/finance/consent/candidate fail-closed cases) |
| Live candidate DB writes | **Not performed** (restriction) |

---

## Governance evidence run — Stages 11–16 operational readiness

| Item | Status |
|------|--------|
| Operating SOP | Document landed — clinic team review / acknowledgement **pending** |
| Staff training records | Template landed — named completions **pending** |
| Patient consent wording | Summary for legal/clinical review — **not approved for patient use** |
| Support coverage named people | **pending** human roster |
| Incident tabletop | Procedure documented — exercise **not yet conducted** this run |
| Rollback proof | Docs + pure engines; live disable-invite already true; destructive rollback drill deferred |

---

## Governance evidence run — Stages 17–21 cohort and decision

| Item | Status |
|------|--------|
| Real candidate selection | **Not started** (restriction: no real patients) |
| Candidate reviews / enrolments | Still **0** |
| Named governance approvals | **None recorded** |
| Recommendation | **defer** — technical isolation + finance/export live-proven; human gates incomplete |
| `approved_for_initial_invites` | **false** |

---

## Governance evidence run — Stage 22 stop before 1C

| Flag | Value |
|------|--------|
| eligibleForGovernanceReview (software-computable) | Not asserted true without complete human evidence pack |
| approvedForInitialInvites | **false** |
| initialCohortActive | **false** |
| realPatientInvitesEnabled | **false** |
| Stripe | **disabled** |
| formalProduction | **NO-GO** |
| Approved boundary tag | **Not created** (approval not granted) |
| Freeze marker retained | `FI-CONTROLLED-PILOT-ACTIVATION-1B-GOVERNANCE-BOUNDARY` @ `5430235a` |
| Permission fix SHA | `707bac90` |

**Do not start `FI-CONTROLLED-PILOT-INITIAL-COHORT-1C`.**

---

## Governance Closure

**Objective:** Close remaining technical, operational and human-governance limitations without enabling invitations.

### Finance role correction

| Item | Result |
|------|--------|
| Problem | CFO / `tenant_backend` resolved to administrator |
| Fix | `resolvePilotControlRole` — staff/finance titles (CFO, finance manager, bookkeeper) map to `finance` before fi_users fallback; job title alone cannot elevate to administrator |
| Finance scopes | Overview/register/finance detail + **export**; **no** `activation_readiness_read`, clinical full, or admin elevation |
| Unit proof | CFO → finance; CFO ≠ administrator; finance export allowed; activation denied |
| Live re-probe | **PASS** — evidence `docs/audits/evidence-fi-pilot-control-1b-live-role-matrix.json` @ SHA `df2b4230` |

### Export repair

| Item | Result |
|------|--------|
| Root cause | Proof/UI mismatch used invalid `type=overview`; approved types are `patient_register` \| `active_blockers` \| `programme_summary` \| `activity_summary` |
| Errors | `PILOT_CONTROL_INVALID_EXPORT_TYPE` / `PILOT_CONTROL_INVALID_EXPORT_FORMAT` |
| Projection | Server-side `projectExportRowsForRole` before serialisation |
| Audit | `pilot_control_export_created` without row contents |
| Live export proof | **PASS** — evidence `docs/audits/evidence-fi-pilot-control-1b-live-export.json` |

### Authenticated matrix rerun (live)

Live CFO/finance matrix re-proved on production after deploy. Wrong-tenant / inactive / unauth proofs remain PASS. See **Live production proof pack** below.

### Event wiring status

Minimum quote-to-deposit emitters wired (best-effort, enrolled patients only):

- `quote_delivered` / `quote_viewed` (first view) / `quote_accepted`
- `deposit_requested` / `payment_verified` / `payment_reconciliation_required` / `financial_clearance_achieved`
- `notification_sent` / `notification_failed` (`notification_delivered` = wired_with_limitation — no Expo receipt)
- Blockers / access_denied / technical_error remain wired

Human-gated lifecycle (`pilot_patient_enrolled` / `invited` / `activated`) remain blocked until invite approval. No real enrolment or invitation emitted.

### Tiered human governance (1B.1.0)

Evolved uses **`small_team_pilot`**. Formal SOP / training / support / privacy-committee / tabletop documents remain in-repo as templates for `standard_tenant` and `enterprise_or_high_risk` clinics — they are **not** mandatory for Evolved’s first small pilot.

| Tier | When | Required human gates |
|------|------|----------------------|
| `small_team_pilot` | ≤10 staff, one clinic, one pathway, 3–5 patients | Compact briefing set (below) |
| `standard_tenant` | Multi-role clinic, formal artefacts | Role appointments, access matrix, training register, support coverage, operating acceptance, activation decision |
| `enterprise_or_high_risk` | Multi-clinic / integrations / high risk | Standard + privacy committee, multi-clinic governance, incident exercise, SoD, integration approvals, staged rollout |

**Evolved small-team required gates**

| Gate | Status |
|------|--------|
| `teamBriefingCompleted` | Pending — template `docs/governance/FI-CONTROLLED-PILOT-SMALL-TEAM-BRIEFING-1B.md` |
| `clinicalWorkflowConfirmed` | Pending named clinical lead confirmation |
| `financeWorkflowConfirmed` | Pending named finance contact confirmation |
| `supportContactConfirmed` | Pending named support contact |
| `fallbackConfirmed` | Pending fallback / pause confirmation |
| `directorApproval` | Pending |

**Deferred / not applicable for Evolved small-team**

| Artefact | Status |
|----------|--------|
| Formal privacy committee approval | **N/A** (template retained) |
| Separate training register | **N/A** (template retained) |
| Separate support coverage document | **N/A** (template retained) |
| Separate SOP approval document | **N/A** (template retained) |
| Separate tabletop approval | **N/A** (template retained) |
| Multi-role segregation beyond actual team | **N/A** |

Activation decision template `…-ACTIVATION-DECISION-1B.md` remains available; recommendation stays **defer** until small-team confirmations + explicit invite decision.

### Activation gate (recalculated — Evolved `small_team_pilot`)

```text
governanceTier = small_team_pilot

controlCentreAccepted = true
migrationsApplied = true
tenantIsolationProven = true
roleMatrixProven = true
financeRoleMappingCorrect = true
exportSurfaceProven = true
identityPreflightProven = true
financePreflightProven = true
consentControlsProven = true
eventCoverageSufficient = true

teamBriefingCompleted = false
clinicalWorkflowConfirmed = false
financeWorkflowConfirmed = false
supportContactConfirmed = false
fallbackConfirmed = false
directorApproval = false

# Not mandatory for this tier (templates only):
# operationalSopApproved / staffTrainingCompleted / supportCoverageConfirmed /
# incidentResponseConfirmed / privacyApproved / formalPrivacyCommitteeApproval / …

eligibleForGovernanceReview = true
approvedForInitialInvites = false
recommendation = defer
```

### Open blockers

Small-team `human_gate:*` fields only (`teamBriefingCompleted`, `clinicalWorkflowConfirmed`, `financeWorkflowConfirmed`, `supportContactConfirmed`, `fallbackConfirmed`, `directorApproval`). Headed browser screenshots optional. Technical CFO/export live re-probes **closed**.

### Live production proof pack (2026-07-31)

| Field | Value |
|-------|-------|
| Deployment SHA | `df2b42308d1e71d58d7a7333b8ecfdc70b85d0aa` |
| Deployment ID | `dpl_AUR3k5R4eY7ppvDJEurCEB5oiot7` |
| Target | production → `follicleintelligence.ai` |
| Ready state | **READY** |
| Operator | HairAudit / `manager@evolvedhair.com.au` |
| Post-deploy programme | `activation_state=planned`; invites `false`; Stripe `false`; enrolments `0`; candidates `0` |

**CFO → finance live result**

| Check | Result |
|-------|--------|
| `actorRole` | `finance` |
| Not administrator | **PASS** |
| Finance overview | **200** |
| Finance permitted export | **200** |
| Finance activation surface | **denied** (`activationGate` absent) |
| Finance clinical detail | **denied / not enrolled** (`404 PILOT_CONTROL_PATIENT_NOT_ENROLLED`; no clinical leak) |
| Wrong tenant | **403** `PILOT_CONTROL_TENANT_MISMATCH` |
| Inactive membership | **403** `PILOT_CONTROL_FORBIDDEN` |

**Export 200 proofs** (`evidence-fi-pilot-control-1b-live-export.json`)

| Combination | Status |
|-------------|--------|
| `patient_register` + csv | **200** |
| `patient_register` + json | **200** |
| `active_blockers` + csv | **200** |
| `programme_summary` + csv | **200** |
| `activity_summary` + valid ≤31d range | **200** |
| CSV formula injection | **neutralised** (`formulaInjectionDetected=false`) |
| Finance permitted fields only | **PASS** (no clinical/pathology leak) |

**Negative export proofs**

| Case | Result |
|------|--------|
| `type=overview` | **400** `PILOT_CONTROL_INVALID_EXPORT_TYPE` |
| invalid format `xlsx` | **400** `PILOT_CONTROL_INVALID_EXPORT_FORMAT` |
| activity range >31 days | **400** `PILOT_CONTROL_DATE_RANGE_TOO_WIDE` |
| wrong tenant | **403** `PILOT_CONTROL_TENANT_MISMATCH` — no information disclosure |

**Audit-event proof**

| Check | Result |
|-------|--------|
| Event written | **PASS** — `pilot_control_export_created` id `944f37e2-7050-474b-8956-4783aa5484ae` |
| Metadata only | **PASS** — keys `role`, `format`, `rowCount`, `exportType` (no rows/body) |

**Remaining event limitations**

- `notification_delivered` = `wired_with_limitation` (no Expo delivery-receipt producer)
- Some non-pathway domain emitters remain `contract_only` (documents/messages/journey actions)
- Human-gated lifecycle events (`pilot_patient_enrolled` / `invited` / `activated`) correctly unwired until invite approval

**Human approval state (Evolved `small_team_pilot`)**

| Gate | Status |
|------|--------|
| Compact briefing confirmations (team / clinical / finance / support / fallback / director) | **incomplete** |
| Formal SOP / training / support / tabletop / privacy-committee docs | **N/A for this tier** (templates retained) |
| `approved_for_initial_invites` | **false** |
| Recommendation | **defer** |

### Final recommendation / phase verdict

| Scope | Verdict |
|-------|---------|
| Technical controls | **GREEN** |
| Human governance | **AMBER — pending** |
| Overall 1B | **GREEN WITH LIMITATIONS** |
| Formal production | **NO-GO** |
| Stripe | **disabled** |
| Activation state | **planned** |
| Initial cohort | **not selected** |
| Approved boundary tag | **Not created** (recommendation remains defer) |

**Stop before invitations.** Do not create `FI-CONTROLLED-PILOT-ACTIVATION-1B-APPROVED-BOUNDARY` or start `FI-CONTROLLED-PILOT-INITIAL-COHORT-1C`.

---

## Activation state model

States: `planned` · `technical_validation` · `governance_review` · `approved_for_initial_invites` · `initial_cohort_active` · `hold` · `paused` · `completed` · `cancelled`

Rules enforced in `src/lib/pilotControl/activation/activationState.ts`:

- Software may set software-settable states only  
- `approved_for_initial_invites` and `initial_cohort_active` require `humanDecision`  
- Critical stop conditions block progression (containment to `hold`/`paused` only)  
- `hold` and `paused` remain distinguishable  
- Transitions append history  

---

## Schema (1B migration)

`supabase/migrations/202611041003_platform_pilot_activation_1b.sql`

- `fi_pilot_programmes.activation_state`  
- `fi_pilot_activation_decisions` (auditable, versioned, named approvals)  
- `fi_pilot_cohort_candidate_reviews` (no bulk approval)  
- Tenant-member SELECT RLS; service_role writes only  
- Seed metadata keeps `real_patient_invites: false`, `stripe_enabled: false`  
- Migration does **not** activate the programme  

---

## Preflight engines (fail-closed)

| Engine | Module |
|--------|--------|
| Identity | `activation/identityPreflight.ts` |
| Finance | `activation/financePreflight.ts` |
| Clinical / consent | `activation/clinicalConsentPreflight.ts` |
| Candidate workflow | `activation/cohortCandidate.ts` |
| Activation gate | `activation/controlledPilotActivationGate.ts` |

Clinical suitability remains **human_required**. Stripe enabled fails finance preflight.

---

## Activation gate

`evaluateControlledPilotActivationGate`:

- `eligibleForGovernanceReview` — computable when software fields complete and no critical blockers  
- `approvedForInitialInvites` — requires explicit `humanApprovedForInitialInvites` (never inferred from completeness)  

Director/admin read-only UI: **Pilot Activation Readiness** on Control Centre (`PilotActivationSection`). No approval write controls in 1B.

---

## Tests

| Suite | Count |
|-------|-------|
| Prior pilot-control baseline | 305 |
| Governance Closure + tiered human gates | +47 (net) |
| **Total pilot-control unit tests** | **352** (all passing) |

---

## Limitations (honest)

1. Excess `anon`/`authenticated` table GRANTs on `fi_pilot_*` remain; RLS denies non-SELECT — prefer later REVOKE hardening  
2. No dedicated `owner_user_id` btree index on `fi_pilot_blockers`  
3. Headed browser nav/screenshot matrix not captured (API auth matrix completed)  
4. Some non-pathway domain emitters remain `contract_only` (documents/messages/journey actions)  
5. Human SOP/training/support/privacy/clinical/director approvals not yet recorded  
6. Patient-facing consent text requires legal/clinical review before use  
7. Invitation write path remains disabled (correct for this boundary)  
8. ~~CFO → administrator~~ **Corrected and live-proven** — CFO → `finance`; export 200; activation denied (`df2b4230` / `dpl_AUR3k5R4eY7ppvDJEurCEB5oiot7`)  
9. ~~Export `type=overview` 400~~ **Corrected and live-proven** — approved types 200; invalid type/format/range fail safely  
10. No live incident tabletop or named support roster completed  
11. Permission defect `primary_clinic_id` was found during Stage 7 and fixed in `707bac90` before re-proof  
12. `notification_delivered` remains `wired_with_limitation` (no Expo delivery-receipt producer)  
13. Process-local export rate limit (5/user/10min) can throttle dense live proof scripts — not a product defect; proofs rotated actors / waited for quota  

---

## Documents

| Doc | Path |
|-----|------|
| Operating SOP | `docs/operations/FI-CONTROLLED-PILOT-OPERATING-SOP-1B.md` |
| Incident response | `docs/operations/FI-CONTROLLED-PILOT-INCIDENT-RESPONSE-1B.md` |
| Rollback | `docs/operations/FI-CONTROLLED-PILOT-ROLLBACK-1B.md` |
| Training | `docs/operations/FI-CONTROLLED-PILOT-TRAINING-1B.md` |
| Small-team briefing (Evolved) | `docs/governance/FI-CONTROLLED-PILOT-SMALL-TEAM-BRIEFING-1B.md` |
| SOP approval (larger tenants) | `docs/governance/FI-CONTROLLED-PILOT-SOP-APPROVAL-1B.md` |
| Training register (template) | `docs/governance/FI-CONTROLLED-PILOT-TRAINING-REGISTER-1B.md` |
| Support coverage (template) | `docs/governance/FI-CONTROLLED-PILOT-SUPPORT-COVERAGE-1B.md` |
| Consent approval (template) | `docs/governance/FI-CONTROLLED-PILOT-CONSENT-APPROVAL-1B.md` |
| Tabletop (template) | `docs/governance/FI-CONTROLLED-PILOT-TABLETOP-1B.md` |
| Activation decision | `docs/governance/FI-CONTROLLED-PILOT-ACTIVATION-DECISION-1B.md` |
| Gate register | `docs/audits/fi-pilot-activation-gate-register.json` |
| Event coverage | `docs/audits/fi-pilot-event-coverage-register.json` |
| Role acceptance | `docs/audits/fi-pilot-role-acceptance-register.json` |
| Cohort candidates | `docs/audits/fi-pilot-cohort-candidate-register.json` |
| Live role-matrix evidence | `docs/audits/evidence-fi-pilot-control-1b-live-role-matrix.json` |
| Live export evidence | `docs/audits/evidence-fi-pilot-control-1b-live-export.json` |

---

## Verdict model application

| Scope | Status |
|-------|--------|
| Pilot Control Centre 1A | GREEN WITH LIMITATIONS |
| Pilot Activation 1B (technical) | **GREEN** |
| Pilot Activation 1B (overall) | **GREEN WITH LIMITATIONS** (human gates incomplete) |
| Initial patient invitations | Human approval required |
| Initial cohort | Not active |
| Formal production | NO-GO |
| Stripe | Disabled |
| External clinic rollout | Not approved |

**Stop before invitations.** Do not start `FI-CONTROLLED-PILOT-INITIAL-COHORT-1C` until named clinical, privacy, operational, and director approvers complete the governance boundary.
