# FI-PATIENT-APP-1F — Messaging + Notifications Foundation

**Verdict: GREEN**

| Field | Value |
|-------|-------|
| Ticket | FI-PATIENT-APP-1F |
| Closed | 2026-07-27 |
| Production identity mutations | **None** |
| Schema / migrations | **Additive** `20261027120002_fi_patient_gateway_messaging_1f.sql` |
| Parallel CRM | **None** |
| Push provider lock-in | **None** (provider-neutral; push inactive) |
| Mobile application | **Not implemented** |

Companion JSON: `evidence-fi-patient-app-1f-messaging-notifications.json`

---

## PART A — Discovery classification

| Source | Class | Notes |
|--------|-------|-------|
| `fi_crm_messages` | D unsuitable / C ambiguous | Preview/metadata only; lead-scoped; not a patient inbox |
| CRM / clinical notes | B staff-only | Never exposed |
| HubSpot conversation backups | D unsuitable | Historical export; not live patient messaging |
| Internal tasks / comments | B staff-only | Not patient-facing |
| Appointment messaging | C ambiguous | No patient-authenticated inbox reuse |
| Patient portal `/patient/*` | D unsuitable for reuse as inbox | No messaging UI/API today |
| Email/SMS outbound (ReceptionOS) | A for clinic→patient notify only | Not a bi-directional thread store |
| `fi_patients.reminder_consent` / `preferred_contact_method` | A seed for prefs | Not a full preference model |
| Staff inbox / Front Desk | A staff surface target | Surfaced via CRM activity + timeline + CRM preview |

**Justified new store:** `fi_patient_gateway_message_threads` + `fi_patient_gateway_messages` because no existing FiOS table safely supports a patient-authenticated inbox without exposing staff notes or inventing CRM semantics.

---

## Scope executed

1. `GET /api/patient/v1/messages` — owned patient-safe threads (+ default `general`)
2. `GET /api/patient/v1/messages/{threadId}` — ownership re-check + messages
3. `POST /api/patient/v1/messages/{threadId}` — send into owned/open thread
4. `GET|PATCH /api/patient/v1/notification-preferences`
5. Ownership wrapper `assertOwnedMessageThreadRow` / `requirePatientGatewayOwnedThread`
6. Provider-neutral notification policy (`decideNotificationDispatch`)
7. Staff visibility via existing CRM activity + patient timeline + CRM message preview
8. OpenAPI updated to **v1.0.5**
9. Fail-closed messaging/notification tests; 1B–1E suites remain GREEN

---

## Staff workflow (acceptance I)

```
Patient App → Patient Gateway → fi_patient_gateway_messages
  → appendCrmActivityEvent (patient_app.message.received)
  → appendPatientTimelineEvent (patient_message_received)
  → createCrmMessagePreview (channel patient_app, when lead linked)
```

Operational view: patient timeline / CRM activity / CRM message preview on the linked lead. No second staff messaging app.

---

## Security proofs

| Case | Result |
|------|--------|
| A Own threads only | success |
| B Own thread read | success |
| C Foreign patient thread | ownership_denied |
| D Wrong tenant | not_found / wrong_tenant |
| E Orphaned | ownership_denied |
| F Staff-only notes | never in gateway store / detector |
| G Foreign patientId | cannot alter identity |
| H Valid send | persisted patient_to_clinic |
| I Staff surface | activity + timeline + CRM preview seams |
| J Foreign send | denied |
| K/L Empty / oversized | rejected |
| M/N Impersonation / status | ignored |
| O Duplicate | message_duplicate |
| P–R Preferences | read/update; cross-patient denied |
| S/U Transactional vs optional | proven in policy core |
| T Category opt-out | skips optional dispatch |
| V Privacy preview | no clinical detail |
| W–Z 1B–1E | GREEN (85 tests) |
| AA/AB CRM + portal | unchanged / non-regression |
| AC lint | pass (scoped) |
| AD typecheck | pass |

---

## Webapp non-regression

**Architecture:** 1F is an additive `/api/patient/v1` path. Existing staff CRM communication services remain the webapp path.

| Area | Changed? |
|------|----------|
| `src/lib/crm/messages.ts` staff API | **No** |
| CRM note semantics | **No** |
| `app/patient/*` portal | **No** |
| Staff auth | **No** |
| Frontend deps on `/api/patient/v1` | **None** |
| Schema | **Additive** gateway tables only |

---

## Deferred (1F.1+)

- Unrestricted new-thread creation with free staff recipient selection
- Push device registration / provider adapter
- Message attachments (use 1C imaging)
- Real-time WebSockets
