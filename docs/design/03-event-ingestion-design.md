# Event Ingestion Design

Follicle Intelligence consumes **events** from Hair Longevity Institute (HLI) and HairAudit. Events are the sole mechanism for FI to learn about things that happened in source systems; FI does not read from source databases.

---

## Event naming convention

Format: **`{source_system}.{domain}.{action}`**

- **source_system**: `hli` | `hairaudit` (and future systems).
- **domain**: entity or area (e.g. intake, document, case, report, audit, blood_request).
- **action**: past-tense verb (e.g. submitted, uploaded, generated, released, completed).

Examples:

| Event | System | Meaning |
|-------|--------|--------|
| hli.intake.submitted | HLI | Trichology intake form submitted. |
| hli.document.uploaded | HLI | A document (e.g. blood PDF, scalp image) was uploaded. |
| hli.blood_request.generated | HLI | Blood test request generated. |
| hairaudit.case.submitted | HairAudit | Case submitted for audit. |
| hairaudit.report.released | HairAudit | Report released to client. |
| hairaudit.audit.completed | HairAudit | Audit workflow completed. |

---

## Normalized event schema (FI internal)

Every ingested event is stored in a single, append-only table keyed by canonical entities where possible.

### fi_events (append-only)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK. |
| tenant_id | uuid | FK fi_tenants. |
| event_type | text | e.g. `hli.intake.submitted`. |
| source_system | text | `hli` \| `hairaudit`. |
| source_event_id | text | Idempotency key from source (optional). |
| occurred_at | timestamptz | When it happened (from source or receive time). |
| global_person_id | uuid | Resolved (nullable). |
| global_case_id | uuid | Resolved (nullable). |
| global_provider_id | uuid | Resolved (nullable). |
| global_clinic_id | uuid | Resolved (nullable). |
| global_document_id | uuid | Resolved (nullable). |
| payload | jsonb | Original payload (opaque). |
| created_at | timestamptz | When FI received the event. |

- **Idempotency**: unique on `(tenant_id, source_system, source_event_id)` when `source_event_id` is present. Duplicate requests are ignored (same event_id ⇒ no second row).
- Indexes: tenant_id, event_type, source_system, occurred_at, global_case_id, global_person_id.

---

## Ingest API contract (FI exposes to sources)

Source systems **POST** events to FI (e.g. `/api/fi/events` or webhook).

**Request body (minimal):**

```json
{
  "event_type": "hli.intake.submitted",
  "source_event_id": "hli-ev-12345",
  "occurred_at": "2025-03-15T10:00:00Z",
  "tenant_id": "<tenant_uuid>",
  "identifiers": {
    "source_person_id": "hli-patient-abc",
    "source_case_id": "hli-case-xyz"
  },
  "payload": { ... }
}
```

**Response:**

- **202 Accepted**: event accepted (stored or deduplicated).
- **400 Bad Request**: invalid event_type or missing required fields.
- **409 Conflict**: optional; only if you use a different idempotency strategy.

**Idempotency**: If `source_event_id` is sent again with same tenant_id/source_system, FI returns 202 and does not insert a duplicate row.

---

## Ingestion pipeline (steps)

1. **Validate**  
   Check `event_type` against an allowed list (e.g. known `hli.*` and `hairaudit.*`), validate `tenant_id`, `occurred_at`.

2. **Resolve canonical entities**  
   From `identifiers` and optionally `payload`, resolve:
   - source_person_id → global_person_id  
   - source_case_id → global_case_id (create fi_global_cases if needed)  
   - source_provider_id → global_provider_id  
   - source_clinic_id → global_clinic_id  
   - source_document_id → global_document_id  

3. **Insert fi_events**  
   One row per event; if `source_event_id` is present, use unique constraint to enforce idempotency.

4. **Trigger downstream processing** (async)  
   - **Signal extraction**: for events that carry signal-bearing payloads (e.g. document.uploaded, intake.submitted), enqueue or run signal normalization (see 04-signal-normalization-model.md).  
   - **Case state**: update fi_cases / fi_global_cases status if event implies a state change (e.g. case.submitted → status = submitted).  
   - **Model triggers**: e.g. when “signals ready” for a case, enqueue risk model run (existing pipeline).

No deletion or update of events; append-only.

---

## Transport options

- **REST API**: source systems POST to FI on occurrence (with retries and `source_event_id` for idempotency).
- **Webhook**: FI provides a URL; source systems call it (same schema).
- **Queue (future)**: FI can consume from a message queue (e.g. SQS, Pub/Sub); message body = same JSON; deduplication by `source_event_id` in FI.

---

## Allowed event types (reference)

HLI:

- `hli.intake.submitted`
- `hli.document.uploaded`
- `hli.blood_request.generated`
- `hli.scalp_imaging.captured` (example)
- `hli.treatment.recorded` (example)

HairAudit:

- `hairaudit.case.submitted`
- `hairaudit.report.released`
- `hairaudit.audit.completed`
- `hairaudit.verification.completed` (example)

FI can maintain an allow-list in config or code and reject unknown `event_type` with 400.

---

## Exposing analytics back to source systems

FI does **not** write events back into source DBs. It exposes:

- **Read APIs**: e.g. GET `/api/fi/cases/{global_case_id}/scorecard`, GET `/api/fi/persons/{global_person_id}/insights`, GET `/api/fi/benchmarks?clinic_id=...`.
- **Webhooks (optional)**: FI can call back a source system URL when a derived artifact is ready (e.g. “report approved”) so the source can update its UI or state. The source remains the system of record; the webhook is a notification.

This keeps the rule: **FI is intelligence-only; operational data stays in HLI and HairAudit.**
