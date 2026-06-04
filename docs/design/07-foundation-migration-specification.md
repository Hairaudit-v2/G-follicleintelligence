# Stage 1B — Foundation Migration Specification

**Status:** Specification only — **no SQL migration files and no application code** in this stage.  
**Parent document:** [06-foundation-layer-architecture](./06-foundation-layer-architecture.md).  
**Purpose:** Define ordered Supabase migration artifacts, physical table shapes (`fi_*`), relationships, indexes, RLS intent, compatibility with existing HairAudit/HLI ingest paths, dual-write, rollback, and owner decisions.

**Naming convention:** Physical tables use the `fi_` prefix to match existing Follicle Intelligence migrations. Logical entities from Section 6 of doc 06 map as: `organisations` → `fi_organisations`, `clinics` → `fi_clinics`, `persons` → `fi_persons`, `patients` → `fi_patients`, `person_roles` → `fi_person_roles`, `cases` → **`fi_cases` (extended, not a second case table)**, `timeline_events` → `fi_timeline_events`, `media_assets` → `fi_media_assets`.

---

## 1. Proposed Supabase migration filenames (exact order)

Timestamps are placeholders; replace with the real sequence used in the repo (must sort after `20260324000010_fi_events_global_foundation.sql`).

| # | Filename | Scope |
|---|----------|--------|
| 1 | `20260606120001_fi_organisations.sql` | `fi_organisations`; optional `organisation_id` on `fi_partners`; indexes. |
| 2 | `20260606120002_fi_clinics_and_sources.sql` | `fi_clinics`, `fi_clinic_source_ids` (or `fi_clinic_source_mappings`); nullable `clinic_id` on `fi_cases` if not deferred to file 6. |
| 3 | `20260606120003_fi_persons_and_roles.sql` | `fi_persons`, `fi_person_roles`, `fi_person_source_ids`; indexes and CHECKs. |
| 4 | `20260606120004_fi_patients_and_sources.sql` | `fi_patients`, `fi_patient_source_ids`; optional nullable FKs from `fi_global_patients` **or** documentation-only link strategy (see Section 4). |
| 5 | `20260606120005_fi_cases_foundation_fks.sql` | **Alter** `fi_cases`: add `patient_id` → `fi_patients`, `clinic_id` → `fi_clinics`, `organisation_id` → `fi_organisations` (all nullable); indexes. Does **not** remove `patient_id` legacy usage until backfill verified (see Section 4). |
| 6 | `20260606120006_fi_global_cases_patient_fk.sql` | **Alter** `fi_global_cases`: add nullable `foundation_patient_id` → `fi_patients` (parallel to `global_patient_id`); index. |
| 7 | `20260606120007_fi_event_links_foundation_fks.sql` | **Alter** `fi_event_links`: add nullable `patient_id` → `fi_patients`, `clinic_id` → `fi_clinics` (optional); indexes. |
| 8 | `20260606120008_fi_timeline_events.sql` | `fi_timeline_events`; FK to `fi_events`, `fi_cases`; indexes. |
| 9 | `20260606120009_fi_media_assets.sql` | `fi_media_assets`; FKs; unique partial index for idempotent ingest. |
| 10 | `20260606120010_fi_intakes_foundation_fks.sql` | **Alter** `fi_intakes`: nullable `person_id`, `patient_id` (optional for Stage 1B — can be merged into file 5/7 if preferred). |
| 11 | `20260606120011_fi_foundation_rls.sql` | Enable RLS on all new foundation tables; policies per Section 6; **no** policy changes to `fi_events` unless explicitly required. |
| 12 | `20260606120012_fi_foundation_compat_views.sql` | Backward-compatibility views (Section 7). |

**Ordering rationale:** Organisations before clinics; persons before patients (patients reference persons); patients before case-level FKs; global/event link extensions after `fi_patients` exists; timeline and media after `fi_cases` is addressable; intake FKs optional last before RLS; views after RLS so views can respect security invoker/owner as designed.

---

## 2. Exact table definitions

Conventions: `id uuid PK default gen_random_uuid()` unless noted; `created_at timestamptz not null default now()`; `updated_at timestamptz not null default now()` on mutable tables. All foundation entities reference `fi_tenants(id) on delete cascade` unless stated otherwise.

### 2.1 `fi_organisations`

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| name | text | no | |
| slug | text | yes | Unique per tenant: `UNIQUE (tenant_id, slug)` where slug is not null |
| organisation_type | text | no | CHECK in `('clinical_network','commercial_partner','standards_program','internal','other')` — exact enum to be frozen in implementation |
| metadata | jsonb | no | default `'{}'` |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

**Indexes:** `(tenant_id)`, `(tenant_id, organisation_type)`.

---

### 2.2 `fi_clinics`

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| organisation_id | uuid | yes | FK `fi_organisations(id) on delete set null` |
| display_name | text | no | |
| metadata | jsonb | no | default `'{}'` |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

**Indexes:** `(tenant_id)`, `(tenant_id, organisation_id)` where `organisation_id` is not null.

---

### 2.2a `fi_clinic_source_ids` (supporting — source resolution)

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| clinic_id | uuid | no | FK `fi_clinics(id) on delete cascade` |
| source_system | text | no | Align with ingest vocabulary: `hli`, `hairaudit`, `clinic`, future `iiohr`, … |
| source_clinic_id | text | no | Producer’s stable id |
| created_at | timestamptz | no | |

**Constraints:** `UNIQUE (tenant_id, source_system, source_clinic_id)`.

**Indexes:** `(clinic_id)`, `(tenant_id, source_system, source_clinic_id)`.

---

### 2.3 `fi_persons`

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| metadata | jsonb | no | default `'{}'` — **no** raw PII in v1 unless compliance approves; PII stays on `fi_intakes` / envelope payload until a vault strategy exists |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

**Indexes:** `(tenant_id)`.

---

### 2.3a `fi_person_source_ids` (supporting)

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| person_id | uuid | no | FK `fi_persons(id) on delete cascade` |
| source_system | text | no | |
| source_person_id | text | no | Producer id for **non-patient** persons (e.g. staff, doctor) when distinct from `source_doctor_id` naming in events |
| created_at | timestamptz | no | |

**Constraints:** `UNIQUE (tenant_id, source_system, source_person_id)`.

**Note:** HairAudit/HLI envelopes today expose `source_doctor_id`; first implementation may store doctor resolution as `(source_system, source_doctor_id)` in this table or a dedicated column — **open** (Section 10).

---

### 2.4 `fi_patients`

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| person_id | uuid | no | FK `fi_persons(id) on delete restrict` (or `on delete cascade` if product mandates orphan cleanup — default **restrict** to avoid accidental PII loss) |
| primary_clinic_id | uuid | yes | FK `fi_clinics(id) on delete set null` |
| metadata | jsonb | no | default `'{}'` — can hold non-authoritative copies of source flags; not SoR |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

**Indexes:** `(tenant_id)`, `(person_id)`, `(tenant_id, person_id)` unique if **at most one patient row per person per tenant** (recommended): `UNIQUE (tenant_id, person_id)`.

---

### 2.4a `fi_patient_source_ids` (supporting)

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| patient_id | uuid | no | FK `fi_patients(id) on delete cascade` |
| source_system | text | no | |
| source_patient_id | text | no | Matches envelope `identifiers.source_patient_id` |
| created_at | timestamptz | no | |

**Constraints:** `UNIQUE (tenant_id, source_system, source_patient_id)`.

---

### 2.5 `fi_person_roles`

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| person_id | uuid | no | FK `fi_persons(id) on delete cascade` |
| organisation_id | uuid | yes | FK `fi_organisations(id) on delete cascade` |
| clinic_id | uuid | yes | FK `fi_clinics(id) on delete cascade` |
| role | text | no | e.g. `surgeon`, `reviewer`, `staff`, `trainee`, `patient_portal_user`, `tenant_admin` |
| source_system | text | yes | |
| source_person_role_id | text | yes | |
| starts_at | timestamptz | yes | |
| ends_at | timestamptz | yes | |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

**CHECK:** `(organisation_id IS NOT NULL OR clinic_id IS NOT NULL OR role IN ('tenant_admin'))` — exact exception list for tenant-global roles is an **owner decision** (Section 10).

**Indexes:** `(tenant_id, person_id)`, `(tenant_id, clinic_id)` where clinic not null, `(tenant_id, organisation_id)` where organisation not null.

---

### 2.6 `fi_cases` (canonical **cases** entity — existing table, extended)

**Existing columns (must remain):** `id`, `tenant_id`, `patient_id` (uuid, currently **dangling** without `fi_patients` — see Section 4), `created_by`, `external_id`, `status`, `metadata`, `created_at`, `updated_at`, `partner_id` (from partners migration).

**New columns (Stage 1B):**

| Column | Type | Nullable | FK |
|--------|------|----------|-----|
| clinic_id | uuid | yes | `fi_clinics(id) on delete set null` |
| organisation_id | uuid | yes | `fi_organisations(id) on delete set null` |
| foundation_patient_id | uuid | yes | `fi_patients(id) on delete set null` |

**Semantics:**

- **`foundation_patient_id`:** Canonical link to `fi_patients` once ingest creates or resolves a patient row.
- **Legacy `patient_id`:** Retained for backward compatibility until application cutover (Section 4); backfill rule: when safe, set `foundation_patient_id` from migration and later align or null legacy column.

**Indexes (new):** `(tenant_id, clinic_id)` where `clinic_id` is not null; `(tenant_id, organisation_id)` where not null; `(tenant_id, foundation_patient_id)` where not null.

**Constraints:** Existing `UNIQUE (tenant_id, external_id)` preserved.

---

### 2.7 `fi_timeline_events`

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| case_id | uuid | no | FK `fi_cases(id) on delete cascade` |
| patient_id | uuid | yes | FK `fi_patients(id) on delete set null` — denormalized convenience |
| organisation_id | uuid | yes | FK `fi_organisations(id) on delete set null` |
| event_kind | text | no | Domain vocabulary, e.g. `ingest`, `case_status`, `review`, `document` |
| title | text | yes | |
| detail | jsonb | yes | |
| occurred_at | timestamptz | no | |
| fi_event_id | uuid | yes | FK `fi_events(id) on delete set null` — provenance for ingest-driven rows |
| created_at | timestamptz | no | |

**Indexes:** `(tenant_id, case_id, occurred_at desc)`, `(fi_event_id)` where not null.

**Mutation policy:** Insert-only for application roles; updates/deletes restricted to service role or admin (product decision).

---

### 2.8 `fi_media_assets`

| Column | Type | Nullable | Constraints / notes |
|--------|------|----------|---------------------|
| id | uuid | no | PK |
| tenant_id | uuid | no | FK `fi_tenants(id)` |
| case_id | uuid | yes | FK `fi_cases(id) on delete cascade` — nullable only if org-level assets are in scope |
| patient_id | uuid | yes | FK `fi_patients(id) on delete set null` |
| asset_type | text | no | **Single** canonical vocabulary superset of legacy `fi_uploads.type` / `kind` |
| filename | text | no | |
| storage_path | text | no | |
| mime_type | text | yes | |
| size_bytes | bigint | yes | |
| source_system | text | yes | |
| source_asset_id | text | yes | Idempotent key from producer when present |
| metadata | jsonb | no | default `'{}'` |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

**Constraints:** Optional `UNIQUE (tenant_id, source_system, source_asset_id)` where `source_asset_id` is not null; else rely on `(tenant_id, case_id, storage_path)` for deduplication parity with current `ensureUploadRecord`.

**Indexes:** `(tenant_id, case_id)`, `(tenant_id, storage_path)`, `(tenant_id, source_system, source_asset_id)` partial where `source_asset_id` is not null.

---

## 3. Compatibility strategy for existing tables

| Table | Stage 1B behavior |
|-------|-------------------|
| **`fi_global_patients`** | Remains a **physical table** (Section 4). Ingest continues to insert/update here as today. Add **dual-write** to `fi_patients` + `fi_patient_source_ids` + `fi_persons` when mapping rules exist. No DROP, no rename to VIEW in Stage 1B. |
| **`fi_global_cases`** | Unchanged uniqueness `(tenant_id, source_system, source_case_id)`. Add **`foundation_patient_id`** nullable FK to `fi_patients`; keep **`global_patient_id`** → `fi_global_patients`. Application may populate both during transition. |
| **`fi_cases`** | Add **`clinic_id`**, **`organisation_id`**, **`foundation_patient_id`**. Keep **`patient_id`** column as-is until owners approve semantic switch or backfill to `fi_patients.id`. |
| **`fi_intakes`** | No removal of demographic columns. Optionally add **`person_id`**, **`patient_id`** nullable FKs for future joins; ingestion can remain unchanged initially. |
| **`fi_events`** | **No schema change required** for Stage 1B. Optional future: add denormalized UUID columns — **out of scope**; resolution stays in `fi_event_links` + new FK columns. |
| **`fi_event_links`** | Add nullable **`patient_id`** → `fi_patients`, **`clinic_id`** → `fi_clinics`. Retain **`global_patient_id`**, **`global_case_id`**, **`fi_case_id`**. |
| **`fi_uploads`** | **No DROP**. Remains the table current code writes to. **`fi_media_assets`** receives **dual-write** (Section 8). Normalize `asset_type` from legacy `type`/`kind` in writer or batch job. |
| **`fi_partners`** | **No DROP**. Add nullable **`organisation_id`** → `fi_organisations` where `organisation_type = 'commercial_partner'` for rows that represent the same legal entity; optional one-off seed migration creates organisations from partners. |

---

## 4. Decision section (Stage 1B recommendations — owner may override)

### 4.1 `fi_global_patients` vs `fi_patients`

| Option | Description |
|--------|-------------|
| A | **`fi_global_patients` remains compatibility-only**: keep as ingest-first staging; **`fi_patients`** becomes the canonical care-subject row linked to **`fi_persons`**. |
| B | Replace `fi_global_patients` with a VIEW over `fi_patients` + mapping — **breaks** current `INSERT`/`UPDATE` from application without code change. **Not recommended for Stage 1B.** |

**Recommendation:** **Option A** for Stage 1B and until all writers/readers are switched.

---

### 4.2 `global_patient_id` column naming vs `patient_id`

| Option | Description |
|--------|-------------|
| A | **Retain** `global_patient_id` on `fi_global_cases` / `fi_event_links` (always references **`fi_global_patients.id`**). Add **`foundation_patient_id`** (and optional **`patient_id`** on links) referencing **`fi_patients.id`**. |
| B | Rename `global_patient_id` → breaks existing TypeScript and SQL — **reject** without coordinated code release. |

**Recommendation:** **Option A** — retain `global_patient_id` semantics; introduce **`foundation_patient_id`** on `fi_cases` and **`fi_global_cases`** for the new model; add **`patient_id`** on `fi_event_links` only if query patterns need direct patient join without traversing global patient.

---

### 4.3 `fi_partners` vs `fi_organisations`

| Option | Description |
|--------|-------------|
| A | **`fi_partners` remains separate** for commercial referrals; **`fi_organisations`** holds typed org graph; link via **`fi_partners.organisation_id`**. |
| B | Merge partners into organisations only — requires data migration and referral FK updates. |

**Recommendation:** **Option A** for Stage 1B — lowest risk to existing `fi_referrals` and partner attribution.

---

### 4.4 `fi_uploads` vs `fi_media_assets`

| Option | Description |
|--------|-------------|
| A | **`fi_uploads`** remains **ingest-only / legacy** canonical for existing pipelines; **`fi_media_assets`** is **dual-written** and becomes read path for new UI/API. |
| B | Single table only — would require collapsing enum drift (`kind` vs `type`) in one migration. |

**Recommendation:** **Option A** for Stage 1B.

---

## 5. Canonical ID strategy

| Identifier | Meaning | Storage |
|------------|---------|---------|
| **person_id** | UUID PK of **`fi_persons`** | Primary key column `fi_persons.id` |
| **patient_id** | UUID PK of **`fi_patients`** | `fi_patients.id`; optional FKs on `fi_cases`, `fi_intakes`, `fi_event_links`, `fi_timeline_events`, `fi_media_assets` |
| **case_id** | UUID PK of **`fi_cases`** (operational pipeline case) | `fi_cases.id`; `fi_global_cases.fi_case_id` links source case to this |
| **clinic_id** | UUID PK of **`fi_clinics`** | `fi_clinics.id`; resolved via **`fi_clinic_source_ids`** |
| **organisation_id** | UUID PK of **`fi_organisations`** | `fi_organisations.id` |
| **source_system** | Text slug for producer (`hli`, `hairaudit`, `clinic`, future `iiohr`, …) | Column on mapping tables and on `fi_events`; must align with `FiSourceSystem` / extended enum when code is updated (later phase) |
| **source_record_id** | **Logical** term: producer’s stable string for an entity in that system | **Physical columns** remain specific for idempotency and clarity: `source_patient_id`, `source_case_id`, `source_clinic_id`, `source_asset_id`, `source_person_id` / `source_doctor_id` (latter mapping TBD). Do **not** collapse all into one generic column in Stage 1B — preserves unique constraints and query clarity. |

**Global bridge IDs (existing):**

- **`fi_global_patients.id`** — still the “global patient stub” id used by `global_patient_id` FKs until deprecated.
- **`fi_global_cases.id`** — cross-reference id for source case mapping; distinct from `fi_cases.id`.

---

## 6. RLS model (policy intent — not SQL)

**Default:** RLS **enabled** on all new tables from migration `..._fi_foundation_rls.sql`. **`fi_events` / `fi_event_links`:** policy changes only if new columns require clinic-scoped reads; default leave existing behavior until security review.

### 6.1 Tenant isolation

- **Policy shape:** For role `authenticated`, allow `SELECT`/`INSERT`/`UPDATE`/`DELETE` only where `row.tenant_id = jwt_tenant_id()` (or equivalent from `fi_users` join to `auth.uid()`).
- **Service role:** Bypasses RLS; used only by trusted ingest workers.

### 6.2 Clinic-level access

- **Prerequisite:** Membership table **not** in Stage 1B file list — add `fi_user_clinic_memberships (user_id, clinic_id, tenant_id)` in same migration batch **or** defer clinic-scoped policies until that table exists.
- **Policy intent:** Users with clinic scope may `SELECT` rows where `clinic_id` is in their membership set (`fi_cases`, `fi_media_assets`, `fi_person_roles` as applicable).

### 6.3 Organisation-level access

- Same pattern: `fi_user_organisation_memberships` or role claim `organisation_ids[]` in JWT; `SELECT` on `fi_organisations`, `fi_clinics`, `fi_cases.organisation_id`, partner-linked orgs.

### 6.4 Service-role ingest permissions

- Ingest uses **service role** with server-side validation of tenant and API key.
- **No** broad `GRANT` to anon/authenticated on foundation tables except where read-only APIs require tightly scoped `SELECT` via **views** (Section 7).

### 6.5 Patient PII restrictions

- **`fi_persons`:** default **no** PII columns in RLS-visible projections; use **`SECURITY INVOKER`** views if metadata must be visible.
- **`fi_patients`:** expose `id`, `tenant_id`, `person_id`, `primary_clinic_id`, `metadata` under RLS; joins to `fi_intakes` for PII only for roles with `clinical_read` (claim TBD).
- **`fi_intakes`:** existing PII columns — tighten policies when foundation goes live so tenant-scoped clinical roles do not leak across clinics within a tenant unless allowed.

---

## 7. Backward compatibility views (required)

Views are created in `20260606120012_fi_foundation_compat_views.sql`. **No changes** to application code in Stage 1B spec — views prepare **read** paths and reporting.

| View name | Purpose |
|-----------|---------|
| `v_fi_case_foundation` | `fi_cases` left join `fi_patients`, `fi_clinics`, `fi_organisations`, `fi_partners` — stable column list for dashboards without ORM changes initially. |
| `v_fi_patient_resolution` | Maps `fi_global_patients` to `fi_patients` / `fi_persons` via `fi_patient_source_ids` when both exist; exposes `global_patient_id`, `foundation_patient_id`, `person_id`. |
| `v_fi_media_unified` | `UNION ALL` of `fi_uploads` and `fi_media_assets` with normalized `asset_type` column for transitional reporting (column list fixed in implementation). |

**Optional (if `SECURITY DEFINER` approved):** `v_fi_event_with_foundation` joining `fi_events`, `fi_event_links`, `fi_cases`, `fi_patients` for support tooling only — document security review requirement before use.

---

## 8. Dual-write plan

### 8.1 Where **new** rows are written (after ingest code is updated in a **later** implementation phase)

| Flow | New writes | Old writes maintained |
|------|------------|----------------------|
| Patient resolution | `fi_persons` + `fi_patients` + `fi_patient_source_ids` when `source_patient_id` present | **`fi_global_patients`** as today |
| Case resolution | `fi_global_cases` + **`foundation_patient_id`** when patient resolved | `global_patient_id` unchanged |
| Case row | `fi_cases` + new FK columns when clinic/org known | `external_id`, `metadata`, `partner_id` unchanged |
| Event links | `fi_event_links` + optional `patient_id` / `clinic_id` | `global_patient_id`, `global_case_id`, `fi_case_id` unchanged |
| Uploads | **`fi_media_assets`** on each successful `fi_uploads` insert | **`fi_uploads`** unchanged |
| Timeline | Optional insert into **`fi_timeline_events`** on each processed `fi_events` row | **`fi_events`** unchanged |

### 8.2 Where **old** rows are still maintained

All existing tables remain authoritative for current application binaries until a **cutover release** ships.

### 8.3 When dual-write can stop

**Gates (all required):**

1. All ingest paths deployed with dual-write in production for **N** days (suggest **30**) without reconciliation errors above threshold.
2. Reconciliation job shows **≥ 99.9%** (threshold TBD) mapping coverage for `fi_patient_source_ids` vs `fi_global_patients` where `source_patient_id` exists.
3. Read paths for media switched to **`fi_media_assets`** with feature flag **100%** for **14** days.
4. Stakeholder sign-off to **stop writing** `fi_global_patients` / `fi_uploads` — then migrate to single-write in a **new** migration stage (not Stage 1B).

Until then, **do not** drop dual-write.

---

## 9. Rollback plan (per migration file)

Rollback assumes migrations are **reversible** via companion `DOWN` scripts or manual SQL in deployment runbooks (Supabase does not auto-generate down migrations).

| File | Rollback intent |
|------|-----------------|
| `..._fi_foundation_compat_views.sql` | `DROP VIEW` for each view (order: dependent views first). |
| `..._fi_foundation_rls.sql` | `DROP POLICY` / `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` on new tables only. |
| `..._fi_intakes_foundation_fks.sql` | `ALTER TABLE fi_intakes DROP COLUMN` for added FKs (only if no data depends on them). |
| `..._fi_media_assets.sql` | `DROP TABLE fi_media_assets` if empty or after backup truncate — **data loss** if dual-written data only lives here; prefer soft-disable. |
| `..._fi_timeline_events.sql` | `DROP TABLE fi_timeline_events`. |
| `..._fi_event_links_foundation_fks.sql` | `DROP COLUMN patient_id`, `DROP COLUMN clinic_id` on `fi_event_links`. |
| `..._fi_global_cases_patient_fk.sql` | `DROP COLUMN foundation_patient_id` on `fi_global_cases`. |
| `..._fi_cases_foundation_fks.sql` | `DROP COLUMN clinic_id`, `organisation_id`, `foundation_patient_id` from `fi_cases`. |
| `..._fi_patients_and_sources.sql` | `DROP TABLE fi_patient_source_ids`, `DROP TABLE fi_patients` — **only** if no FKs from `fi_cases` / `fi_global_cases` / links reference them; rollback order **after** dropping dependent FK columns from earlier migrations (reverse order of apply). |
| `..._fi_persons_and_roles.sql` | `DROP TABLE fi_person_roles`, `fi_person_source_ids`, `fi_persons` — after removing FKs from `fi_patients`. |
| `..._fi_clinics_and_sources.sql` | `DROP TABLE fi_clinic_source_ids`, `fi_clinics` — after `fi_cases.clinic_id` / link columns dropped. |
| `..._fi_organisations.sql` | `DROP COLUMN organisation_id` from `fi_partners` first, then `DROP TABLE fi_organisations`. |

**Practice:** Take a DB snapshot before the batch; for partial failure, apply rollback in **strict reverse order** of Section 1.

---

## 10. Open questions requiring owner decision before implementation

1. **Legacy `fi_cases.patient_id`:** Repurpose column to mean **`fi_patients.id`**, or keep unused and rely only on **`foundation_patient_id`**? (Renaming avoids confusion but is a breaking DDL+code change.)
2. **CHECK on `fi_person_roles`:** Final list of roles allowed with both `organisation_id` and `clinic_id` null.
3. **`fi_person_source_ids` vs doctor ids:** Store `source_doctor_id` in this table as `source_person_id` with a synthetic prefix, add **`source_doctor_id`** column, or create **`fi_practitioner_source_ids`**?
4. **One patient row per person per tenant:** Enforce `UNIQUE (tenant_id, person_id)` on `fi_patients` or allow multiples (e.g. anonymized splits)?
5. **RLS membership tables:** Ship `fi_user_clinic_memberships` / `fi_user_organisation_memberships` in Stage 1B migrations or defer RLS for clinic/org scope to Stage 1C?
6. **Canonical `asset_type` vocabulary:** Single enum list owned by product + HairAudit + HLI; blocking for `fi_media_assets.asset_type` CHECK constraint vs free text + validation in app.
7. **`fi_timeline_events` writer:** Synchronous insert on every `fi_events` processed row vs async worker vs **manual** backfill only for Stage 1B.
8. **PII on `fi_persons`:** Whether to add optional encrypted columns in Stage 1B or keep persons pseudonymous until a vault design is approved.
9. **IIOHR `source_system` slug:** Final string and whether it appears in CHECK constraints or only in app validation.

---

## Document map

| Related doc | Role |
|-------------|------|
| [06-foundation-layer-architecture](./06-foundation-layer-architecture.md) | Entity model, ERD, phased strategy |
| [03-event-ingestion-design](./03-event-ingestion-design.md) | Event envelope and ingest lifecycle (align identifiers in a separate doc task) |

---

## Deliverables checklist (this document)

| User requirement | Section |
|------------------|---------|
| Exact proposed migration filenames in order | 1 |
| Exact table definitions (8 entities + supporting mapping tables) | 2 |
| Compatibility for listed existing tables | 3 |
| Decision section | 4 |
| Canonical ID strategy | 5 |
| RLS model | 6 |
| Backward compatibility views | 7 |
| Dual-write plan | 8 |
| Rollback per stage | 9 |
| Open questions | 10 |
