# FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — Operational Acceptance Packet

**Audience:** Clinic leadership (director, clinic manager) and named operational owners  
**Programme:** Controlled Pilot Control Centre — Evolved Hair Restoration  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Packet date:** 2026-07-30  
**Related audit:** `docs/audits/FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.md` (§1A.6)

This packet explains how to interpret the Pilot Control Centre before any live patient cohort begins. It does **not** authorise invitations, Stripe, clinical writes, or programme activation.

---

## 1. Programme purpose

Provide a **read-only operational command centre** so authorised Evolved staff can observe:

- who is explicitly enrolled in the controlled pilot
- per-patient readiness (canonical batch from the 1A.2 engine)
- open blockers, ownership, and escalation
- programme health (GREEN / AMBER / RED) with evidence confidence
- adoption and engagement metrics (when live events exist)

Domain systems of record (journey, finance, documents, pathology, imaging, bookings, notifications) remain authoritative. The Control Centre observes; it does not replace them.

---

## 2. Approved scope

| In scope | Clarification |
|----------|---------------|
| Explicit cohort observation | Membership only via `fi_pilot_enrolments` |
| Read-only APIs and UI | `/api/pilot-control/*`, `/fi-admin/.../pilot-control` |
| Canonical batch readiness | Derived from 1A.2 per-patient evaluation; aggregated ephemerally |
| Blocker / health / adoption views | Derived read models; no mutation controls |
| Operational exports | Role-gated CSV/JSON; no clinical free text / PHI payloads |

Cohort must be **explicitly enrolled**. Quotes, appointments, accounts, or clinical activity alone never imply pilot membership.

---

## 3. Explicit exclusions

| Exclusion | Status |
|-----------|--------|
| Real patient invites | Disabled (`real_patient_invites_enabled` remains false until governance) |
| Stripe / payment instrument capture | Disabled for this programme |
| Clinical writes from Control Centre | None |
| Blocker acknowledge / resolve / dismiss | None in Control Centre |
| Programme activation / pause / cancel via UI | None (pause is a **recommendation** only) |
| Generative ImagingOS providers | Out of scope |
| Competing readiness snapshot SoR | No `fi_pilot_readiness_snapshots` table — evaluation stays derived |

---

## 4. Roles

| Role | Control Centre focus |
|------|----------------------|
| **Director / administrator** | Full overview, pause recommendation, export, adoption, clinical + financial summaries |
| **Clinic manager** | Clinic overview, register, blockers, adoption; clinical/financial summaries |
| **Reception** | Register, attention queue, activity; no full clinical detail; finance summary only |
| **Consultant** | Journey/readiness summaries; clinical + financial summaries |
| **Clinical** | Clinical detail; no financial detail |
| **Finance** | Financial detail; no clinical detail |
| **Technical** | Technical health, identity integrity flags, evaluation/meta; limited clinical/finance |

API permission remains authoritative. Soft-hidden UI chrome is not a substitute for server gates.

---

## 5. Health interpretation

### Verdicts

| Verdict | Meaning |
|---------|---------|
| **GREEN** | No critical integrity/safety latch; high-blocker and dimension scores within thresholds; **requires live operational evidence** |
| **AMBER** | Attention: elevated high blockers, weak dimensions, partial evidence, or **empty / planned cohort** |
| **RED** | Critical fail-closed: identity integrity, clinical safety, data integrity, or pause-recommended critical blockers |

Empty or planned programmes with zero live enrolments → **AMBER** with **insufficient evidence** / expansion `not_started`. Never interpret empty cohort as GREEN success.

### Dimension classes

| Class | Examples |
|-------|----------|
| **Technical** | Notification reliability, evaluation failures, identity linkage integrity |
| **Operational** | Overdue actions, stalled journeys, staff adoption of Control Centre, exception backlog |
| **Evidence confidence** | `live_verified` · `live_partial` · `synthetic_only` · `insufficient_evidence` · `source_unavailable` |

Technical GREEN without a live cohort is **not** operational proof.

---

## 6. Readiness interpretation

- Overall readiness uses the **1A.2 fail-closed composition** (`deriveOverallReadiness`).
- Cohort distribution comes from **canonical batch readiness** (`source: canonical_batch_readiness`), not blocker severity alone.
- **Partial evaluations never count as Ready.** Unknown mandatory signals fail closed to blocked / attention as per contracts.
- Register cells must not fabricate Ready; unevaluated → honest unknown / not evaluated wording.

---

## 7. Blocker severity interpretation

| Severity | Leadership meaning |
|----------|-------------------|
| **info** | Awareness; no escalation clock |
| **attention** | Action overdue / inactive / unread messaging windows |
| **high** | Surgery window risk, unresolved pathology, identity mismatch, aged blocks, notify failures |
| **critical** | Cross-tenant / wrong-patient / readiness misrepresentation / safety — forces RED; may recommend pause |

Critical always wins over score. Blockers are derived and persisted for observation; Control Centre does not mutate them.

---

## 8. Expansion recommendations

Software emits one of:

| Code | Meaning |
|------|---------|
| `not_started` | Programme planned and/or zero live enrolments |
| `insufficient_evidence` | No adequate live duration/confidence, or synthetic-only |
| `continue_current_scope` | Live evidence healthy enough to continue current cohort size |
| `hold_expansion` | AMBER health or high-blocker load above threshold — do not grow cohort |
| `pause_pilot` | RED / critical stop / pause-recommended blockers |
| `eligible_for_governance_review` | Software + human invitation gates all true **and** live GREEN — still requires humans to invite |

Expansion codes **never** auto-invite patients or flip programme flags.

---

## 9. Stop conditions

Treat as stop / escalate immediately when health surfaces:

- Unresolved **identity integrity** blockers
- Blockers with **pilot pause recommended**
- Critical **clinical safety** blockers
- Cross-tenant or wrong-patient signals
- Systematic readiness misrepresentation

Stop conditions are observational. Human directors decide pause/withdraw; the UI does not execute pause.

---

## 10. Empty-cohort meaning

| Observation | Correct reading |
|-------------|-----------------|
| Zero live enrolments | Insufficient live evidence — **not** a failed pilot |
| Health AMBER | Expected for planned empty programme |
| Activation / completion rates `—` | Zero denominator; do not invent rates |
| Adoption empty copy | Framework ready; live adoption not assessable yet |
| Expansion `not_started` | Correct; do not expand |

---

## 11. Live versus synthetic evidence

| Class | Use |
|-------|-----|
| `live_patient` | Counts toward live rates and operational health |
| `synthetic_fixture` / `staff_test` / `smoke_test` / `migration_test` | Acceptance proofs only — **excluded** from live rates |

Mixing synthetic into live denominators is forbidden. Synthetic-only evidence → confidence `synthetic_only`, never “live verified”.

---

## 12. Staff workflow (observe only)

1. Open Pilot Control Centre for the Evolved programme.
2. Confirm header health, evidence confidence, and invites-disabled state.
3. Review attention queue (critical → high → attention → age).
4. Use patient register and drawer for readiness / blockers (role-filtered).
5. Review adoption section when live events exist; otherwise accept empty-state honesty.
6. Export only if permitted and needed for governance packs.
7. Escalate stop conditions via existing clinic incident channels — do not “fix” blockers in Control Centre.

No invite, message, payment, or clinical write actions exist on this surface.

---

## 13. Incident process (high level)

1. **Detect** — Control Centre health RED / critical blocker / technical error event.
2. **Contain** — Named operational owner + technical support; consider pausing new enrolments (human process).
3. **Preserve evidence** — Correlation IDs, export programme summary / blockers (role-safe).
4. **Remediate** — Fix in domain SoR / infrastructure; Control Centre will re-derive on next evaluation.
5. **Review** — Director sign-off before resuming or expanding cohort.

Detailed SOPs remain clinic-owned; this packet only defines Control Centre’s role (observe + escalate).

---

## 14. Human approval requirements

Software may compute **gate completeness**. It must **never** set human approvals, invite patients, enable `real_patient_invites_enabled`, or activate the programme.

Human gates (all required for invitation eligibility):

- Clinical governance approved  
- Privacy approved  
- Operational SOP approved  
- Staff training completed  
- Support coverage confirmed  
- Incident response confirmed  
- Rollback confirmed  
- Pilot cohort approved  
- Director approval  

---

## 15. Pilot activation checklist

All items remain **false / pending** until governance explicitly completes them:

| Item | Current |
|------|---------|
| Programme status beyond `planned` | Pending |
| `real_patient_invites_enabled` | **false** |
| Stripe enabled for pilot | **Disabled** |
| Live enrolments present | **None** (seeded programme only) |
| Remote migrations applied (governed proof) | **Incomplete** — local migrations exist; remote apply evidence governance-gated |
| Authenticated multi-role live E2E | **Pending** live credentials |
| Operational acceptance (this packet) signed | Pending leadership sign-off |
| Technical acceptance complete | Partial (unit/API/UI proofs; live gates open) |

---

## 16. Real-patient invitation checklist (gate fields)

Software completeness fields (must be proven, then recorded):

| Gate field | Intent |
|------------|--------|
| `technicalAcceptance` | 1A engines + APIs + UI acceptance proofs |
| `migrationsApplied` | Governed remote apply of pilot control migrations |
| `tenantIsolationProven` | Cross-tenant leakage tests pass in target env |
| `roleMatrixProven` | Authenticated role matrix on deployed tenant |
| `identityIntegrityProven` | Fail-closed identity behaviour verified live |
| `financeIntegrityProven` | Clearance / wrong-patient payment protections verified |
| `consentControlsProven` | Consent / document controls verified |

Plus **all human gates** in §14. `eligible` is true only when every software and human gate is true — still does not invite.

---

## 17. Rollback plan

| Layer | Rollback |
|-------|----------|
| UI / nav | Hide Pilot Control nav / revoke role scopes; routes remain read-only |
| APIs | Disable access via permissions; no write surface to roll back |
| Derived blockers / events | Additive tables; stop writing events; retain for audit |
| Enrolments | Withdraw / exclude via governed process (not Control Centre UI) |
| Programme | Keep `planned` or cancel; never leave invites enabled after rollback |
| Migrations | Do not destructive-drop without DBA governance; additive schema is fail-safe if unused |

Rollback does not require reversing clinical SoR changes because Control Centre made none.

---

## 18. Recommended initial cohort

When (and only when) invitation gates pass:

| Parameter | Recommendation |
|-----------|----------------|
| Patients | **3–5** |
| Clinics | **One** |
| Pathway | **One** |
| Staff | Trained named operational owner + technical support |
| Exclusions | Complex identity, unresolved financial disputes, high-risk clinical complexity, cross-clinic treatment |
| Consent | Explicit pilot consent required |

Do not expand beyond this model until expansion recommendation is `continue_current_scope` or `eligible_for_governance_review` **and** leadership re-approves.

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Director | | | |
| Clinic manager / operational owner | | | |
| Technical support owner | | | |

**Verdict at packet issue:** Formal production **NO-GO**. Stripe **Disabled**. Real invitations **Disabled**. Proceed only under governance after 1A.6 limitations are cleared and this packet is signed.
