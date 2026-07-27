# FI-PATIENT-APP-2F.3 — Front Desk Patient Message Inbox

**Verdict:** **GREEN** (part of FI-PATIENT-APP-2F closeout — see `evidence-fi-patient-app-2f-closeout.md`)  
**Date:** 2026-07-28

## Summary

First-class Front Desk **Patient Messages** work queue over the existing canonical
gateway store (`fi_patient_gateway_message_threads` / `fi_patient_gateway_messages`).

No second inbox database. No duplicated message bodies. Patient OpenAPI / mobile 2F
contract unchanged.

Closes the staff leg of the 2F round-trip: patient send → Front Desk inbox → staff
open/reply → same thread on mobile.

## Surfaces

| Surface | Path |
|--------|------|
| Front Desk tab | `/fi-admin/[tenantId]/front-desk/messages` |
| Queue API | `GET /api/tenants/[tenantId]/front-desk/patient-messages` |
| Thread + ack | `GET /api/tenants/[tenantId]/front-desk/patient-messages/[threadId]` |
| Handle | `POST .../[threadId]/handle` |
| Reply | `POST .../[threadId]/reply` |

## Staff unread model (PART B)

- Patient read remains `patient_read_at` (clinic→patient).
- Staff unread uses additive `staff_read_at` on **patient_to_clinic** messages.
- Explicit handled uses thread `staff_handled_at` / `staff_handled_by`.
- Toast **Dismiss does not** mark handled or acknowledged.
- Opening a thread acknowledges (sets `staff_read_at`).

Migration: `supabase/migrations/20261029120001_fi_patient_gateway_staff_inbox_2f3.sql`

## Preview policy (PART F)

| Category | Queue / toast |
|----------|----------------|
| `general`, `appointment`, `billing` | Bounded text preview (≤120 chars) |
| `post_op`, `medication` | Generic: “New patient message — open to view” |

## Realtime (PART D)

Gateway message tables are **not** on the Today Realtime plan. Front Desk uses the
proven **30s bounded polling** pattern (`FRONT_DESK_PATIENT_MESSAGE_POLL_MS`), same
family as Reception Board refresh. Payload documents `refreshStrategy: "bounded_polling"`.

## Permissions (PART I)

Requires `clinic_os` **or** `patient_os` (read for queue/view; edit for reply/handle).
Tenant membership gate via `assertCrmTenantReadAllowed` + Front Desk portal gate.
Investor / roles without those modules are denied when SA-1 enforces.

## Audit (PART L)

Structured log event `front_desk_patient_message_audit`:

- `patient_message_staff_viewed`
- `patient_message_staff_acknowledged`
- `patient_message_staff_replied`
- `patient_message_staff_handled`

No full message body in audit payloads.

## Reply (PART H)

Staff replies insert `clinic_to_patient` into the **same** gateway thread the mobile
app reads. One conversation.

## Tests

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/fiOs/frontDesk/frontDeskPatientMessagesCore.test.ts \
  src/lib/fiOs/frontDesk/frontDeskPatientMessages.server.test.ts \
  src/lib/fiOs/frontDesk/fiOsFrontDeskConsolidation.test.ts
```

Coverage maps to ticket PART M cases A–L (unit), N (Front Desk tab additive), O (mobile
contract untouched in patient app), P (lint/typecheck).

## Acceptance checklist

- [x] Patient message visible on Front Desk without hunting patient records
- [x] Unread badge on Messages tab
- [x] Polling updates while Front Desk is open + in-app alert
- [x] View opens canonical staff thread panel + patient profile link
- [x] Staff reply into same gateway thread
- [x] No second message datastore
- [x] Sensitive preview protected
- [x] Tenant-scoped queries + role gate
- [x] Existing Today/Tomorrow Front Desk flows retained (Messages is additive tab)

**2F.3 status: GREEN**
