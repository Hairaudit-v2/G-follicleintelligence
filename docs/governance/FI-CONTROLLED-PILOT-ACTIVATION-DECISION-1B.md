# FI-CONTROLLED-PILOT-ACTIVATION-DECISION-1B

**Boundary:** `FI-CONTROLLED-PILOT-ACTIVATION-1B-GOVERNANCE-BOUNDARY`  
**Governance Closure:** in progress — technical controls updated; human approvals pending  
**Next phase (only after approvals):** `FI-CONTROLLED-PILOT-INITIAL-COHORT-1C`  
**Do not create:** `FI-CONTROLLED-PILOT-ACTIVATION-1B-APPROVED-BOUNDARY` while recommendation remains `defer`

This document records **human** activation decisions. Software may compute `eligibleForGovernanceReview`. Software must **not** set `approved_for_initial_invites` or `initial_cohort_active`.

Do not infer approval from role membership, attendance, or document authorship.

---

## Decision record

| Field | Value |
|-------|-------|
| Programme | Evolved Controlled Pilot (`evolved_controlled_pilot_1a`) |
| Tenant | Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| Decision type | governance_review |
| Decision version | 1 (Governance Closure) |
| Pathway lock | `quote_to_deposit` |
| Requested at | 2026-07-30 |
| Requested by | Governance Closure workstream |
| Recommendation | **defer** |

### Named approvals (real actors only)

| Area | Approved | Approver name | Role | Decided at | Evidence |
|------|----------|---------------|------|------------|----------|
| Technical | ☐ | | | | |
| Operations | ☐ | | | | |
| Clinical governance | ☐ | | | | |
| Privacy | ☐ | | | | |
| Finance | ☐ | | | | |
| Training | ☐ | | | | |
| Support | ☐ | | | | |
| Incident response | ☐ | | | | |
| Manual fallback | ☐ | | | | |
| Rollback | ☐ | | | | |
| Patient pilot consent | ☐ | | | | |
| Initial pathway | ☐ | | | | |
| Initial cohort | ☐ — remains false while no candidates | | | | |
| Director | ☐ | | | | |

### Confirmations

| Item | Confirmed |
|------|-----------|
| Support coverage | ☐ |
| Rollback readiness | ☐ |
| Incident response / tabletop | ☐ |
| Staff training | ☐ |
| Patient pilot consent approved for use | ☐ |
| Initial pathway approved | ☐ |
| Manual fallback approved | ☐ |
| Operational SOP approved | ☐ |

### Outcome

| Decision | ☑ deferred · ☐ pending · ☐ approved · ☐ rejected · ☐ withdrawn |
| Reason | Technical Governance Closure complete with limitations; named human approvals incomplete. Initial invitations remain prohibited. |
| Blockers at decision | All `human_gate:*` fields; live CFO role-matrix re-probe recommended after deploy |

Rejected and deferred decisions remain in `fi_pilot_activation_decisions` history. A new review creates a new `decision_version`.

---

## Current programme position (software)

| Item | Status |
|------|--------|
| Control Centre 1A | GREEN WITH LIMITATIONS |
| Activation 1B technical controls | GREEN WITH LIMITATIONS (finance mapping + export repaired in Governance Closure) |
| Remote migration apply evidence | Present on live (`202611041001`–`003`) |
| Authenticated role-matrix proof | API PASS; finance mapping corrected in code — live CFO re-probe pending deploy |
| Export surface | Contract repaired (`type=programme_summary` etc.); invalid types return `PILOT_CONTROL_INVALID_EXPORT_TYPE` |
| Minimum quote-to-deposit events | Pathway emitters wired; invite/enrol/activate remain human-gated |
| Initial invitations | **OFF** — human approval required |
| Governance recommendation | **defer** |
| `approved_for_initial_invites` | **false** |
| Formal production | **NO-GO** |
| Stripe | **Disabled** |
| Activation state | **planned** |
