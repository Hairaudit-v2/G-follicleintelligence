# FI-CONTROLLED-PILOT-TABLETOP-1B

**Status:** Pending exercise  
**Scenario version:** `wrong-synthetic-deposit-linkage-1`  
**Programme:** `evolved_controlled_pilot_1a`  

## Scenario

> A deposit verification is associated with the wrong **synthetic** patient.

Use synthetic records only. Do not intentionally create a real wrong-patient association. Do not expose private patient information in evidence.

## Required demonstration steps

1. Detection  
2. Critical blocker generation  
3. Correct ownership  
4. Director escalation  
5. Pilot-pause recommendation  
6. Finance fallback  
7. Preservation of evidence  
8. Correction of the synthetic linkage  
9. Re-evaluation  
10. Resolution  
11. Restart decision authority  
12. SOP update where required  

## Required participants

| Name | Role |
|------|------|
| | Operations |
| | Finance |
| | Technical |
| | Director / authorised incident decision-maker |

Clinical or privacy should participate if the scenario crosses their responsibilities.

## Tabletop record

| Field | Value |
|-------|-------|
| Exercise ID | |
| Conducted at | |
| Facilitator | |
| Detected at step | |
| Pause recommended | ☐ |
| Fallback activated | ☐ |
| Evidence preserved | ☐ |
| Correction verified | ☐ |
| Restart authority identified | ☐ |
| Restart decision | |
| Findings | |
| SOP changes | |
| Unresolved actions | |
| Result | ☐ passed · ☐ passed_with_actions · ☐ failed |

`passed_with_actions` does **not** satisfy the incident gate until mandatory actions are closed.

Until the tabletop and required actions are complete:

- `incidentResponseConfirmed = false`  
- `manualFallbackConfirmed = false`
