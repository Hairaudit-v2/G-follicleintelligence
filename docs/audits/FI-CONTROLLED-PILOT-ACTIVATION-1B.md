# FI-CONTROLLED-PILOT-ACTIVATION-1B

**Programme:** Governed Pilot Activation and First-Cohort Readiness — Evolved Hair Restoration  
**Phase:** `FI-CONTROLLED-PILOT-ACTIVATION-1B`  
**Date:** 2026-07-30  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Pathway lock:** `quote_to_deposit`  
**Phase verdict:** **GREEN WITH LIMITATIONS**  
**Formal production:** **NO-GO**  
**Stripe:** **Disabled**  
**Initial invitations:** **OFF** — human approval required  
**Governance boundary:** `FI-CONTROLLED-PILOT-ACTIVATION-1B-GOVERNANCE-BOUNDARY`  
**Next phase (after human approvals):** `FI-CONTROLLED-PILOT-INITIAL-COHORT-1C`

---

## Executive summary

1B converts the completed Pilot Control Centre (1A) into an **eligible-for-governance-review** activation environment. Software proves technical controls, preflights, event coverage honesty, and activation-gate completeness. Software does **not** activate the programme, enable invites, enrol real patients, enable Stripe, or auto-set human approvals.

**Successful completion means:** the system is eligible for a human governance decision on whether to invite the first controlled cohort — not that the pilot has succeeded or that FI is production-ready.

---

## Delivered outcomes

| # | Outcome | Status |
|---|---------|--------|
| 1 | Governed remote migration application | Schema landed (`202611041003`); **remote apply evidence pending** |
| 2 | Live tenant / identity isolation proof | RLS policies on new tables; live remote proof **pending** |
| 3 | Authenticated role-matrix browser proof | Contract matrix + scopes; live browser sessions **pending** |
| 4 | First-cohort event coverage | Register honest (`wired` / `contract_only` / `not_required`) |
| 5 | Operational SOP and staff readiness | Docs landed; human training completion **pending** |
| 6 | Incident, support, rollback readiness | Docs + pure rollback/pause engines landed; human confirm **pending** |
| 7 | Human-governed activation decision | Decision table + gate + governance template; **no auto-approve** |

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
| Prior pilot-control baseline | 219 |
| New 1B activation scenarios | 86 |
| **Total pilot-control unit tests** | **305** (all passing) |

---

## Limitations (honest)

1. Remote Supabase migration apply + checksum / operator evidence not yet recorded  
2. Live authenticated role-matrix browser sessions pending  
3. Live remote RLS negative query evidence pending  
4. Many first-cohort domain event emitters remain `contract_only`  
5. Human SOP/training/support/privacy/clinical/director approvals not yet recorded  
6. Patient-facing consent text requires legal/clinical review before use  
7. Invitation write path remains disabled (correct for this boundary)  

---

## Documents

| Doc | Path |
|-----|------|
| Operating SOP | `docs/operations/FI-CONTROLLED-PILOT-OPERATING-SOP-1B.md` |
| Incident response | `docs/operations/FI-CONTROLLED-PILOT-INCIDENT-RESPONSE-1B.md` |
| Rollback | `docs/operations/FI-CONTROLLED-PILOT-ROLLBACK-1B.md` |
| Training | `docs/operations/FI-CONTROLLED-PILOT-TRAINING-1B.md` |
| Activation decision | `docs/governance/FI-CONTROLLED-PILOT-ACTIVATION-DECISION-1B.md` |
| Gate register | `docs/audits/fi-pilot-activation-gate-register.json` |
| Event coverage | `docs/audits/fi-pilot-event-coverage-register.json` |
| Role acceptance | `docs/audits/fi-pilot-role-acceptance-register.json` |
| Cohort candidates | `docs/audits/fi-pilot-cohort-candidate-register.json` |

---

## Verdict model application

| Scope | Status |
|-------|--------|
| Pilot Control Centre 1A | GREEN WITH LIMITATIONS |
| Pilot Activation 1B | **GREEN WITH LIMITATIONS** |
| Initial patient invitations | Human approval required |
| Initial cohort | Not active |
| Formal production | NO-GO |
| Stripe | Disabled |
| External clinic rollout | Not approved |

**Stop before invitations.** Do not start `FI-CONTROLLED-PILOT-INITIAL-COHORT-1C` until named clinical, privacy, operational, and director approvers complete the governance boundary.
