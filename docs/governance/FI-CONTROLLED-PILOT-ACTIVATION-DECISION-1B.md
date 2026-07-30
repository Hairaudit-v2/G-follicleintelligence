# FI-CONTROLLED-PILOT-ACTIVATION-DECISION-1B

**Boundary:** `FI-CONTROLLED-PILOT-ACTIVATION-1B-GOVERNANCE-BOUNDARY`  
**Next phase (only after approvals):** `FI-CONTROLLED-PILOT-INITIAL-COHORT-1C`  

This document records **human** activation decisions. Software may compute `eligibleForGovernanceReview`. Software must **not** set `approved_for_initial_invites` or `initial_cohort_active`.

---

## Decision record template

| Field | Value |
|-------|-------|
| Programme | Evolved Controlled Pilot (`evolved_controlled_pilot_1a`) |
| Tenant | Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| Decision type | governance_review / initial_invite_approval |
| Decision version | _(increment on each new review)_ |
| Pathway lock | `quote_to_deposit` |
| Requested at | |
| Requested by | |

### Named approvals (real actors only — never inferred from role membership)

| Axis | Approved | Approved by | Approved at |
|------|----------|-------------|-------------|
| Clinical | ☐ | | |
| Privacy | ☐ | | |
| Operations | ☐ | | |
| Technical | ☐ | | |
| Cohort | ☐ | | |
| Director | ☐ | | |

### Confirmations

| Item | Confirmed |
|------|-----------|
| Support coverage | ☐ |
| Rollback readiness | ☐ |
| Incident response | ☐ |
| Staff training | ☐ |
| Patient pilot consent approved for use | ☐ |
| Initial pathway approved | ☐ |
| Manual fallback approved | ☐ |
| Operational SOP approved | ☐ |

### Outcome

| Decision | ☐ pending · ☐ approved · ☐ rejected · ☐ deferred · ☐ withdrawn |
| Reason | |
| Blockers at decision | _(reference gate blockers; no PHI)_ |

Rejected and deferred decisions remain in `fi_pilot_activation_decisions` history. A new review creates a new `decision_version`.

---

## Patient-facing pilot consent (summary for legal/clinical review)

Before use, legal and clinical review must approve wording that explains:

- Participation in a controlled digital workflow pilot  
- Clinical care is not automated; staff remain responsible  
- System may provide reminders and workflow updates  
- Patient may report problems and withdraw  
- Withdrawal does not affect clinical care  
- Privacy / data handling and contacts  
- What happens if the system is unavailable  

Do not overstate AI or automation.

---

## Current programme position (software)

| Item | Status |
|------|--------|
| Control Centre 1A | GREEN WITH LIMITATIONS |
| Activation 1B technical controls | Landed (gate, preflights, decisions schema) |
| Remote migration apply evidence | Pending operator proof |
| Authenticated role-matrix browser proof | Pending live sessions |
| Initial invitations | **OFF** — human approval required |
| Formal production | **NO-GO** |
| Stripe | **Disabled** |
