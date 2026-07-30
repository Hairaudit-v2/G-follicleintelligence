# FI-PATIENT-APP-2B — Pilot metrics scorecard

**Privacy:** Never capture patient name, email, pathology result, diagnosis, quote content, document content, or free-text medical information in analytics events.

## Sources

Manual / operational reports; support logs; gateway structured audits; clinic chasing time estimates. Product analytics SDK remains intentionally absent for early pilot.

## Metrics

### Activation

Invitations sent; accepted; accounts activated; activation rate; time to activation.

### Engagement

App opens; active patients; Action Centre views; notification opens; Journey Timeline views; return sessions.

### Completion

Actions completed; time to completion; overdue actions; quote review; document completion; pathology completion.

### Clinic impact

Manual follow-ups; readiness blockers; support contacts; status enquiries; staff chasing time.

### Reliability

Crashes; API failures; auth failures; deep-link failures; journey-state mismatches; duplicate notifications.

### Safety

Identity mismatch; cross-tenant concern; wrong-data display; missed critical action; sensitive notification incident.

### Experience

Patient ease/confidence; clinic usefulness/trust; qualitative feedback (de-identified).

## Review

FI pilot owner reviews weekly with clinic L1 input during active pilot. Safety events escalate immediately per runbook.
