# FI-CONTROLLED-PILOT-OPERATING-SOP-1B

**Programme:** Controlled Pilot — Evolved Hair Restoration  
**Phase:** `FI-CONTROLLED-PILOT-ACTIVATION-1B`  
**Pathway lock:** `quote_to_deposit`  
**Status:** Draft for governance approval — does not authorise invitations  

---

## 1. Purpose

Operate a tightly controlled first real-patient pilot observation and readiness process using the Pilot Control Centre. Clinical care remains staff-owned. Software observes; it does not automate clinical decisions, enable Stripe, or send invitations without explicit human approval.

## 2. Pilot scope

| In scope | Out of scope |
|----------|--------------|
| Evolved Hair Restoration only | External clinics |
| Quote-to-deposit pathway | Multi-pathway cohorts |
| 3–5 approved patients (after 1C) | Bulk enrolment |
| Control Centre observation | Clinical write-backs from Control Centre |
| Manual finance clearance | Stripe |

## 3. Selected pathway — quote_to_deposit

**Entry:** Accepted quote on canonical patient; deposit required or verified per FinancialOS.  
**Completion:** Financial clearance achieved for deposit path; patient actions for quote/deposit complete.  
**Patient actions:** View quote, accept (if required), complete deposit payment / confirmation.  
**Clinic actions:** Verify quote ownership, allocate payment, confirm clearance, follow overdue actions.  
**Owners:** Reception (activation/comms), Consultant (quote), Finance (clearance), Clinic manager (daily oversight).

## 4. Patient eligibility

- One clinic, one pathway, trained staff support  
- Pass identity, finance, and consent preflight  
- No disputed finance, ambiguous identity, high-complexity clinical exceptions  
- Explicit pilot consent process ready  
- Named operational owner (+ clinical owner where applicable)  
- Not smoke/synthetic fixtures  

## 5. Role responsibilities

| Role | Responsibility |
|------|----------------|
| Director | Final programme approval, pause/restart, expansion |
| Clinic manager | Daily oversight, escalation, support coverage |
| Reception | Activation, appointments, documents, fallback capture |
| Consultant | Consultation progression, quote delivery, questions |
| Clinical | Clinical review, pathology, consent, escalation |
| Finance | Quote/invoice/deposit/plan/reconciliation/clearance |
| Technical | Identity integrity, integrations, notifications, incidents |

Every high/critical blocker must have a clinic-side owner.

## 6. Daily Control Centre review

1. Open health banner — note AMBER/RED and reasons  
2. Review attention queue (high/critical first)  
3. Confirm ownership and ageing  
4. Check overdue patient/clinic actions  
5. Record manual fallbacks without sensitive content  
6. Escalate stop conditions immediately  

## 7. Blocker ownership & escalation

Follow 1A.3 ownership/escalation rules. Critical integrity blockers recommend immediate pause (human action).

## 8. Critical stop conditions

Identity mismatch, cross-tenant exposure, wrong-patient linkage (record/payment/consent), material privacy incident, incorrect readiness affecting care, repeated system-wide failure, inability to support safely, governance approval withdrawn.

## 9–12. Communication, clinical, financial, consent review

Use existing approved clinic processes. Control Centre shows readiness only. Human clinical and privacy approval remain mandatory before cohort activation.

## 13. Technical support

Named technical contact during support hours. Log correlation IDs from Control Centre errors. Do not retry unsafe writes.

## 14. Incident reporting

Follow `FI-CONTROLLED-PILOT-INCIDENT-RESPONSE-1B.md`.

## 15. Manual fallback

See fallback table in rollback/ops packet. Record `manual_channel_fallback_recorded` class only — no message bodies or PHI in telemetry.

## 16. Pilot pause

1. Stop new invites  
2. Preserve records  
3. Notify staff  
4. Identify affected patients  
5. Switch to fallback  
6. Investigate → resolve → validate  
7. Obtain restart approval  
8. Record decision  

Software must not silently continue after a critical stop recommendation without human acknowledgement.

## 17. Patient withdrawal

Withdrawal from pilot must not affect clinical care. Record reason class only; preserve consent/financial/clinical history.

## 18. End-of-day review

Confirm open critical blockers, support coverage for next window, and that invitations remain off unless explicitly enabled.

## 19. Evidence retention

Retain activation decisions, blockers, audit events, consent history. Do not delete to “clean” dashboards.

## 20. Pilot close-out

Complete programme status only after governance review. Formal production remains NO-GO until separately authorised.
