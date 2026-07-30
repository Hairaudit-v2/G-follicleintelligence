# FI Controlled Pilot — Small Team Briefing (1B)

**Programme:** Evolved Hair Restoration controlled pilot  
**Governance tier:** `small_team_pilot`  
**Use when:** ≤10 staff, one clinic, one pathway, limited 3–5 patient cohort, no complex integrations  

This combined briefing replaces separate mandatory SOP-approval, training-register, support-coverage, privacy-committee, and tabletop documents for the Evolved small-team pilot. Those artefacts remain available as templates for `standard_tenant` and `enterprise_or_high_risk` clinics.

---

## Required confirmations

| Gate field | Meaning |
|------------|---------|
| `teamBriefingCompleted` | Combined briefing held; named contacts recorded; staff acknowledgement captured |
| `clinicalWorkflowConfirmed` | Clinical lead confirms quote→deposit clinical operating path |
| `financeWorkflowConfirmed` | Finance contact confirms deposit / reconciliation path (Stripe remains off) |
| `supportContactConfirmed` | Named support / escalation contact known to the team |
| `fallbackConfirmed` | Manual fallback + pause path understood |
| `directorApproval` | Final director approval recorded |

---

## Named contacts (required)

| Role | Name | Contact | Confirmed |
|------|------|---------|-----------|
| Operations lead | | | ☐ |
| Clinical lead | | | ☐ |
| Finance contact | | | ☐ |
| Technical contact | | | ☐ |

---

## Staff acknowledgement

| Staff name | Role | Acknowledged date |
|------------|------|-------------------|
| | | |
| | | |

Briefing topics covered:

- [ ] Pilot pathway lock (`quote_to_deposit`)
- [ ] Blocker ownership and escalation
- [ ] Manual fallback / pause
- [ ] No Stripe / no open invitations until director approval
- [ ] Patient safety: when to stop and escalate

---

## Workflow confirmations

| Confirmation | Named person | Date | Notes |
|--------------|--------------|------|-------|
| Clinical workflow confirmed | | | |
| Finance workflow confirmed | | | |
| Support contact confirmed | | | |
| Fallback / pause confirmed | | | |

---

## Director approval

| Field | Value |
|-------|-------|
| Director name | |
| Decision | approved / deferred / rejected |
| Reason | |
| Decided at | |
| Conditions (if any) | |

**Explicit invite enablement** remains a separate audited decision (`humanApprovedForInitialInvites`). Completing this briefing does **not** turn invitations on.

---

## Not mandatory for this tier

Keep as optional templates for larger tenants — do **not** block Evolved small-team readiness on:

- Formal privacy committee approval  
- Separate training register  
- Separate support coverage document  
- Separate SOP approval document  
- Separate tabletop approval  
- Multi-role segregation proof beyond the actual team  

Templates:

- `docs/governance/FI-CONTROLLED-PILOT-SOP-APPROVAL-1B.md`
- `docs/governance/FI-CONTROLLED-PILOT-TRAINING-REGISTER-1B.md`
- `docs/governance/FI-CONTROLLED-PILOT-SUPPORT-COVERAGE-1B.md`
- `docs/governance/FI-CONTROLLED-PILOT-CONSENT-APPROVAL-1B.md`
- `docs/governance/FI-CONTROLLED-PILOT-TABLETOP-1B.md`
