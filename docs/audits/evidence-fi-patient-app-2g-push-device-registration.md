# FI-PATIENT-APP-2G — Push Gateway + Device Registry (FiOS Evidence)

**Ticket:** FI-PATIENT-APP-2G  
**Date:** 2026-07-28  
**Repos:** `G:\follicleintelligence`  
**Branch:** `feature/fi-patient-app-2g-push-gateway`  
**Companion mobile branch:** `feature/fi-patient-app-2g-push-notifications`  
**Verdict:** **IMPLEMENTATION COMPLETE — native E2E pending mobile rebuild + migration apply**

---

## Provider-neutral domain model

`NotificationDevice` stored in `fi_patient_notification_devices`:

| Field | Notes |
|-------|--------|
| id, tenant_id, patient_id | Ownership from gateway context |
| platform | android / ios / web |
| provider | expo / fcm / apns |
| provider_token | Secret — never returned on list APIs |
| token_fingerprint | SHA-256 for dedupe / audit |
| app_version, device_label, environment | Optional metadata |
| last_seen_at, disabled_at | Lifecycle |

Initial adapter: `adapters/expoPushAdapter.server.ts`  
Domain dispatch: `sendPatientNotification` — no Expo calls littered in Front Desk / billing code.

---

## Patient device API

| Method | Path | Behaviour |
|--------|------|-----------|
| GET | `/api/patient/v1/devices` | Active devices for authenticated patient (no tokens) |
| POST | `/api/patient/v1/devices` | Register/refresh; rejects client `patientId`/`tenantId` |
| DELETE | `/api/patient/v1/devices/{deviceId}` | Soft-disable owned device only |

Identity always via `requirePatientGatewayContext`.

Token reassignment: active foreign owners of the same fingerprint are disabled before upsert.

---

## Dispatch pipeline

```
policy (decideNotificationDispatch)
→ preferences
→ active devices
→ ExpoPushAdapter
→ delivery result (success / temporary / invalid → disable device)
```

Dedupe ledger: `fi_patient_notification_dispatch_log` unique on `(tenant, patient, channel, dedupe_key)`.

Privacy-safe payloads:

| Event | Body |
|-------|------|
| new_message | New message from your clinic. |
| appointment_upcoming | Your appointment is coming up. |
| images_due | It's time to update your progress photos. |
| payment_received | Your account has been updated. |

Title always: **Follicle Intelligence**.  
Data: `{ eventType, resourceId }` only — no patientId, tenantId, clinical body, amounts.

---

## Event wiring (safe drivers)

| Event | Source |
|-------|--------|
| `new_message` | Front Desk staff reply → `clinic_to_patient` persist |
| `appointment_upcoming` | ReminderOS booking_* jobs (push independent of email/SMS live flag) |
| `payment_received` | After verified `recordGatewayPaymentSuccess` settlement |
| `images_due` | Dispatch-ready via `sendPatientNotification` (no journey-read spam hook) |

Patient→clinic send does **not** trigger patient push.

---

## Preference + transactional policy

Reuses 1F `decideNotificationDispatch`. Push optional unless policy includes channel. Transactional events still force email fallback when all channels off. Push-disabled patients keep mandatory email/SMS paths via ReminderOS / policy.

---

## Audit actions (bounded — fingerprint/id only, no full tokens)

- `patient_device_registered` / `_refreshed` / `_disabled` / `_list`  
- `patient_notification_dispatch_requested` / `_sent` / `_failed`  
- `patient_notification_token_invalidated`  

---

## Tests run

```
npx tsx --test \
  src/lib/patientPortal/patientGatewayDeviceCore.test.ts \
  src/lib/patientPortal/patientGatewayNotificationCore.test.ts \
  src/lib/patientPortal/patientNotificationDispatch.test.ts
→ 16 pass
```

Covers registration validation, fingerprinting, privacy previews, preference gating, invalid-token disable, dedupe.

---

## Migration

`supabase/migrations/20261030120001_fi_patient_notification_devices_2g.sql`

Must be applied before device registration works in a given environment.

---

## Webapp / Front Desk regression

- Webapp messaging UI unchanged  
- Front Desk reply path gains best-effort push hook only after message persist  
- Existing ReminderOS email/SMS behaviour preserved  
- No second messaging backend  

---

## iOS / credentials

- Domain model includes `apns` provider for future adapter  
- Expo Push used initially (no FCM server key required in FiOS for Expo tokens)  
- Apple APNs credentials remain an EAS/ops task for native iOS delivery  

---

## OpenAPI

`docs/architecture/fi-patient-app-1a-openapi.yaml` updated with `/devices` paths and schemas.
