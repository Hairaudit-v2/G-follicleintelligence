# Canonical Entity Model

Follicle Intelligence uses **canonical global IDs** so that the same person, case, provider, clinic, or document can be recognized across Hair Longevity Institute (HLI) and HairAudit (and future systems) without FI being the operational database.

---

## Global ID entities

| Entity | Purpose |
|--------|--------|
| **global_person_id** | One person across HLI patient portal, HairAudit cases, and future systems. |
| **global_case_id** | One “case” or “episode” (e.g. one HLI intake+report, or one HairAudit audit). |
| **global_provider_id** | One clinician/doctor across systems. |
| **global_clinic_id** | One clinic/organization across systems. |
| **global_document_id** | One document (e.g. report, upload, audit report) across systems. |

All canonical entities are **tenant-scoped**: `tenant_id` is required. Uniqueness is per tenant.

---

## Conceptual schema

### fi_global_persons

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | **global_person_id** (PK). |
| tenant_id | uuid | FK fi_tenants. |
| created_at, updated_at | timestamptz | Audit. |

- **Mappings**: `fi_global_person_sources` (see below) stores (tenant_id, source_system, source_person_id) → global_person_id.

### fi_global_cases

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | **global_case_id** (PK). |
| tenant_id | uuid | FK fi_tenants. |
| global_person_id | uuid | FK fi_global_persons (optional at creation). |
| source_system | text | e.g. `hli`, `hairaudit`. |
| source_case_id | text | ID in source system. |
| status | text | e.g. draft, submitted, processing, complete. |
| metadata | jsonb | Optional. |
| created_at, updated_at | timestamptz | |

- Unique: `(tenant_id, source_system, source_case_id)`.
- Existing `fi_cases` can be treated as the first incarnation of “global case” or gradually migrated to reference `fi_global_cases.id` as `global_case_id`.

### fi_global_providers

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | **global_provider_id** (PK). |
| tenant_id | uuid | FK fi_tenants. |
| created_at, updated_at | timestamptz | |

- **Mappings**: `fi_global_provider_sources` (tenant_id, source_system, source_provider_id) → global_provider_id.

### fi_global_clinics

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | **global_clinic_id** (PK). |
| tenant_id | uuid | FK fi_tenants. |
| created_at, updated_at | timestamptz | |

- **Mappings**: `fi_global_clinic_sources` (tenant_id, source_system, source_clinic_id) → global_clinic_id.

### fi_global_documents

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | **global_document_id** (PK). |
| tenant_id | uuid | FK fi_tenants. |
| global_case_id | uuid | FK fi_global_cases (optional). |
| source_system | text | e.g. `hli`, `hairaudit`. |
| source_document_id | text | ID in source system. |
| document_kind | text | e.g. report, blood_upload, scalp_image, audit_report. |
| created_at, updated_at | timestamptz | |

- **Mappings** (if needed): `(tenant_id, source_system, source_document_id)` → global_document_id.

---

## Source mapping tables

Purpose: resolve “source system + source ID” to one canonical ID. Inserts are idempotent: same (tenant_id, source_system, source_id) always returns the same global ID.

### fi_global_person_sources

| Column | Type |
|--------|------|
| tenant_id | uuid |
| source_system | text |
| source_person_id | text |
| global_person_id | uuid (FK fi_global_persons) |

- Unique: `(tenant_id, source_system, source_person_id)`.
- **Resolution**: on event ingest, look up by (tenant_id, source_system, source_person_id); if missing, create fi_global_persons row and insert mapping.

### fi_global_provider_sources

| Column | Type |
|--------|------|
| tenant_id | uuid |
| source_system | text |
| source_provider_id | text |
| global_provider_id | uuid (FK fi_global_providers) |

- Unique: `(tenant_id, source_system, source_provider_id)`.

### fi_global_clinic_sources

| Column | Type |
|--------|------|
| tenant_id | uuid |
| source_system | text |
| source_clinic_id | text |
| global_clinic_id | uuid (FK fi_global_clinics) |

- Unique: `(tenant_id, source_system, source_clinic_id)`.

---

## Relation to existing fi_* tables

- **fi_cases**: Can remain the primary “case” table for the current pipeline; add optional `global_case_id` FK to `fi_global_cases` when that table exists. New event-driven cases can create both `fi_global_cases` and `fi_cases` (or a single “case” table that holds global_case_id).
- **fi_intakes**: Can reference `global_person_id` (from fi_global_persons) when present; otherwise keep current patient fields for backward compatibility.
- **fi_tenants**: Unchanged; all global entity tables reference `fi_tenants(id)`.
- **Reports / uploads**: Can be linked to `global_document_id` for cross-system document identity.

---

## Resolution API (conceptual)

- **Input**: `(tenant_id, source_system, source_entity_type, source_id)`.
- **Output**: `global_*_id` (create mapping + canonical row if first time).
- **Idempotent**: same input ⇒ same output; no duplicate canonical entities for the same source identity.

This resolution runs during **event ingestion** before writing normalized signals or running models.
