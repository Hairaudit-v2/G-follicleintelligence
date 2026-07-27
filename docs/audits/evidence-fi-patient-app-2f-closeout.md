# FI-PATIENT-APP-2F — Closeout (GREEN)

**Ticket:** FI-PATIENT-APP-2F  
**Date:** 2026-07-28  
**Verdict:** **GREEN**

## Milestone

Patient messaging is a complete operational loop across mobile and FiOS:

```text
Patient app
  → FiOS gateway (canonical fi_patient_gateway_message_*)
  → Front Desk inbox
  → staff opens / replies
  → same thread returns to patient app
```

No second messaging datastore. Mobile OpenAPI / 1F–2F contract unchanged. Existing FiOS webapp surfaces preserved (Front Desk Messages is additive).

## Included and GREEN

| Area | Evidence |
|------|----------|
| Patient thread list / detail / replies | Patient app `evidence-fi-patient-app-2f-messaging.md` |
| Notification preferences | Same + FiOS 1F notification prefs |
| CRM activity → message thread navigation | FiOS 2F.2 (patient messaging CRM activity deep-link) |
| Front Desk queue, badge, popup, preview policy | `evidence-fi-patient-app-2f3-front-desk-inbox.md` |
| Staff unread / handled | Migration `20261029120001_fi_patient_gateway_staff_inbox_2f3.sql` |
| Staff reply same canonical thread | Front Desk `.../reply` → `clinic_to_patient` |
| Tenant / role controls | `frontDeskPatientMessagesAccess.server.ts` (`clinic_os` / `patient_os`) |
| Audit coverage | `front_desk_patient_message_audit` + patient gateway audits |
| Gateway foundation | `evidence-fi-patient-app-1f-messaging-notifications.md` |

## Acceptance

- [x] Patient can list threads, open detail, reply
- [x] Notification preferences load / persist under 1F policy
- [x] Patient send surfaces to staff without hunting patient records
- [x] Front Desk unread badge + in-app alert while open (bounded polling)
- [x] Staff open / ack updates staff unread (not patient_read_at)
- [x] Explicit handled; dismiss does not handle
- [x] Safe preview for sensitive categories
- [x] Staff reply visible on mobile in the same thread
- [x] Tenant isolation + role gate
- [x] No duplicate message store / no mobile contract break

## Residual non-blockers

- Physical Android operator smoke remains optional regression hygiene (offline proofs + FiOS unit suite already GREEN for this milestone).
- Gateway Realtime websockets remain deferred; Front Desk uses documented 30s polling.
