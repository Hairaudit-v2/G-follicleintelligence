# FI-CONTROLLED-PILOT-INCIDENT-RESPONSE-1B

**Phase:** `FI-CONTROLLED-PILOT-ACTIVATION-1B`  
**Audience:** Clinic manager, technical, director, privacy  

---

## Incident classes

| Class | Immediate pause recommended |
|-------|----------------------------|
| Identity mismatch | Yes |
| Cross-tenant exposure | Yes |
| Wrong-patient linkage | Yes |
| Consent integrity issue | Yes |
| Clinical readiness error affecting care | Yes |
| Financial allocation / wrong-patient payment | Yes |
| Notification failure (isolated) | No — escalate if repeated |
| Patient access failure | Case-by-case |
| Integration outage | Case-by-case |
| Data-loss concern | Yes |
| Control Centre outage | No — use fallback; escalate |
| Privacy incident | Yes |

## Process

1. **Detect** — Control Centre, staff report, monitoring, patient report  
2. **Contain** — stop invites; restrict access if tenant/privacy risk  
3. **Assess** — severity, affected patients, data classes  
4. **Pause** where required (human action; software recommends)  
5. **Notify** — operational owner, technical, clinical, privacy, director as required  
6. **Preserve evidence** — correlation IDs, timestamps, blocker fingerprints; no PHI in tickets if avoidable  
7. **Correct** — fix source system; do not invent cohort membership  
8. **Verify** — re-run identity/finance/consent preflight; confirm RLS  
9. **Decide restart** — named director (+ clinical/privacy as required)  
10. **Document closure** — activation decision or incident record  

Critical incidents must recommend immediate pilot pause. Restart requires explicit human approval.
