# Patient App controlled pilot — pause, deactivation, and withdrawal

**Ticket:** FI-PATIENT-APP-2B  
**Audience:** FI pilot owner, engineering escalation, clinic pilot owner (process only)  
**Do not** publish personal contact details on the public website.

---

## Control hierarchy

1. **Global:** env `FI_PATIENT_APP_PILOT_GLOBAL=paused|off|disabled` on FiOS (blocks all tenants).
2. **Tenant:** `fi_tenant_settings.metadata.patient_app_pilot.status` = `enabled` | `paused` | `disabled`.
3. **Patient:** `fi_patients.metadata.patient_app_access.status` = `active` | `deactivated` | `withdrawn`.

Preferred operator path for withdrawal: patient-level withdraw (unlink + suppress push) rather than flipping clinical `patient_status`.

---

## Safe patient messages

| Code | Patient-visible meaning |
| --- | --- |
| `pilot_paused` | Pilot temporarily unavailable — contact clinic usual channel |
| `patient_deactivated` | Access no longer active — contact clinic |
| `patient_withdrawn` | Withdrawn from pilot — contact clinic if needed |

Clinic journey rows, completed actions, and audit history are **preserved**.

---

## Tenant pause (kill switch)

### Code API

`setTenantPatientAppPilotStatus({ tenantId, status: "paused" | "enabled" | "disabled", reason, actorId })`  
Module: `src/lib/patientPortal/patientAppPilotControls.server.ts`

### Effects when paused / disabled

- Gateway resolves identity, then denies with `403 pilot_paused`
- Push dispatch skips with `pilot_or_access_suppressed`
- Clinic staff retain FiOS journey records
- No action/milestone corruption

### Recovery

Set status back to `enabled`. Re-test `/api/patient/v1/me` for a demonstration patient.

### Immediate pause criteria

Pause immediately if:

- Cross-patient or cross-tenant data exposure
- Identity mismatch
- Incorrect critical action state
- Sensitive notification exposure
- Severe authentication failure
- Repeated crash affecting the cohort
- App-caused missed clinical requirement
- Support capacity failure

---

## Patient deactivation

`setPatientAppAccess({ tenantId, patientId, status: "deactivated", reasonCategory, actorId })`

- Sets access metadata
- Sets push preference false
- Disables notification devices
- Clears `portal_auth_user_id` (blocks invitation reuse by default)
- Audits `patient_portal_deactivated`

Clinic clinical record remains.

---

## Withdrawal

Same helper with `status: "withdrawn"` and `reasonCategory` one of:

- `patient_request`
- `clinic_request`
- `fi_safety`
- `invitation_expired`
- `relationship_removed`
- `other`

Staff confirm completion out-of-band (clinic L1). Controlled re-enrolment requires explicit FI + clinic approval, new invitation, and writing `status: "active"` only after unlink is intentionally relinked.

---

## Proof evidence (automated)

Unit coverage (no live patients):

- `patientAppPilotControlsCore.test.ts` — parse, decide, merge, suppress
- `patientGatewayGate.server.test.ts` J/K — tenant pause deny; withdraw deny + recovery

Do **not** treat local Expo success as distribution readiness.

---

## Invitation stop boundary

Even with pause proven:

- Do not send real-patient invitations from this runbook alone
- First live invitation batch requires separate written approval
