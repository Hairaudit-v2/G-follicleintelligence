# FI-CONTROLLED-PILOT-ROLLBACK-1B

**Phase:** `FI-CONTROLLED-PILOT-ACTIVATION-1B`  

## May reset / disable

- Programme `activation_state` (to `hold` / `paused` / prior software-settable state)  
- Invitation enablement flag (`real_patient_invites` → false)  
- Pilot UI visibility flags where necessary  
- Event emitter enablement toggles  
- External integration settings introduced for pilot  
- Notification settings introduced for pilot  
- Reversible pilot-specific configuration (not clinical/finance data)

## Must preserve

- Audit history (`fi_pilot_control_events` and related)  
- Patient consent history  
- Financial records  
- Clinical records  
- Blocker history (`fi_pilot_blockers`)  
- Activation decisions (`fi_pilot_activation_decisions`)  

Rollback must preserve evidence. Do not hard-delete decision or blocker rows to hide history.

## Migration rollback

Prefer forward-fix migrations. Do not drop activation decision tables if decisions exist. Document recovery position before remote apply.

## Applying migrations

Applying `202611041003_platform_pilot_activation_1b.sql` must **not** activate the programme, enrol patients, or enable invites.
