# Digital Twin Foundation — Architecture Design (Network Identity & Longitudinal Intelligence)

**Status:** Design only — no implementation commitment in this document.  
**Audience:** Platform, data, clinical product, security, and ML owners.  
**Scale target:** 500,000+ patients across many tenants, clinics, products, and external producers.

## Why this design exists

Current-state FI OS is **strong as a tenant operating system**: RLS, clinics, cases, and operational workflows are coherent **within** a tenant. It is **not yet a network-wide Digital Twin substrate**. Audits of the patient and timeline surfaces show three structural gaps: **identity remains tenant-local** (there is no durable, policy-governed network anchor above `fi_patients` / person rows), **patient representations are parallel** (tenant patient, legacy global stub, foundation ids on cases, and source-id graphs do not form a single safe correlation layer), and the **longitudinal narrative is still case-centric** (episodes and `fi_cases` drive much of the chronology) **rather than patient-native** (a single subject-scoped append-only spine with explicit provenance for every modality). This design names that target substrate without rewriting the tenant OS overnight.

This document defines a **network-wide patient identity** and a **patient-native event spine** so longitudinal “digital twin” completeness, provenance, and AI consumption can evolve without a big-bang rewrite of `fi_cases`, `fi_patients`, or producer ingest.

---

## 1. Network-wide patient identity

### 1.1 Problem

Today, patient truth is **tenant-local** (`fi_patients` bound to `fi_persons` and tenant RLS) with **legacy global stubs** (`fi_global_patients`) and **foundation** identifiers on cases (`fi_cases.foundation_patient_id`). That model works for single-tenant operations but does not yet express a **single network subject** that can accumulate evidence across clinics and products while preserving **tenant ownership of clinical relationships** and **clinic ownership of operations**.

### 1.2 Proposed core entity: `fi_network_subjects` (or equivalent name)

A **network subject** is an abstract person-level anchor **above** tenant-local patients. It is *not* a clinical record; it is the **deduplication and longitudinal correlation key** for the network.

| Concept | Role |
|--------|------|
| **`fi_network_subjects`** | Stable UUID; **intentionally minimal** anchor content (no clinical narrative); optional non-identifying operator label (not clinical identity). `metadata` and `display_label` **must not** store PII or tenant-specific clinical notes — those remain on tenant-scoped entities (`fi_persons`, `fi_patients`, cases, notes). |
| **`fi_persons`** | Human identity attributes and demographics **within tenant context**; may link to subject via mapping, not replacement. |
| **`fi_patients`** | **Tenant-local clinical relationship** (portal, consent flags, care team context); always remains valid for RLS and product UX. |
| **`fi_global_patients`** (legacy) | **Deprecated path** over time: stub/global row used historically for resolution; new work should attach to network subject + tenant patient, not grow new semantics on legacy global ids. |

### 1.3 Mapping upward (tenant → network)

Introduce an explicit bridge (names illustrative):

- **`fi_network_subject_members`** (or `fi_patient_network_links`)
  - `network_subject_id` → `fi_network_subjects.id`
  - `tenant_id`, `fi_patients.id` (tenant patient)
  - `membership_status`: `active` | `superseded` | `revoked`
  - `linked_at`, `linked_by`, `unlink_reason`
  - Optional: `confidence`, `link_kind` (`asserted` | `resolved` | `imported`)

**Rule:** Every `fi_patients` row **may** map to at most one **active** network subject per policy window; superseded links remain for audit graphs.

**DB invariant (implemented):** On `fi_network_subject_members`, `tenant_id` must equal `fi_patients.tenant_id` for the referenced `patient_id`. A `BEFORE INSERT OR UPDATE` trigger raises a clear exception on mismatch; this applies to **all** writers including `service_role`, so the bridge cannot accidentally attach a patient row to the wrong tenant context.

**Anchor content policy:** `fi_network_subjects` is an intentionally **minimal** correlation anchor — not a clinical chart. **`metadata` and `display_label` must not** carry PII or tenant-specific clinical notes; keep those on tenant-scoped records (`fi_persons`, `fi_patients`, cases, clinical notes).

### 1.4 Relationship to `fi_persons`

- **`fi_persons`** remains the **tenant-scoped person** entity (PII, documents, roles).
- **Do not** move PII wholesale onto `fi_network_subjects`.
- Optional: **`fi_network_subject_person_links`** if the same natural person has multiple `fi_persons` rows across tenants and policy allows a **person-level** assertion under human review (stricter than patient-level merge).

```text
fi_network_subjects (network anchor, minimal PII)
        ↑
        │ 0..1 active membership per (tenant, patient) under policy
        │
fi_network_subject_members ──► fi_patients (tenant clinical relationship)
        │                              │
        │                              └──► fi_persons (tenant person / PII)
        │
        └── (optional) fi_network_subject_person_links ──► fi_persons
```

### 1.5 Local smoke verification (network subject foundation)

With **Docker Desktop** running and Supabase local up (`npx supabase start` if needed), run:

```bash
npm run smoke:network-subjects
```

That runs `npx supabase db reset --yes` (migrations in filename order) and then pipes [`supabase/smoke/fi_network_subjects_foundation_smoke.sql`](../../supabase/smoke/fi_network_subjects_foundation_smoke.sql) into `psql` inside the `supabase_db_*` container via [`scripts/run-supabase-sql-docker.mjs`](../../scripts/run-supabase-sql-docker.mjs) (multi-statement safe; `supabase db query -f` is single-statement only). Fixture rows are **deleted** at the end of the script.

To run the SQL file only (after you have already reset or migrated):

```bash
npm run smoke:network-subjects:only
```

The smoke script asserts:

1. **Migrations** — a successful `db reset` implies the full chain (including `20260821120001` then `20260821120002`) applied cleanly in order.
2. **Matching bridge** — `tenant_id` aligned with `fi_patients.tenant_id` persists.
3. **Tenant/patient invariant** — mismatched `tenant_id` + `patient_id` raises (trigger / SQLSTATE `23514`).
4. **Single active link** — a second `membership_status = 'active'` row for the same `(tenant_id, patient_id)` hits **unique violation** (`23505`).
5. **History rows** — `superseded` and `revoked` rows can coexist with one `active` row for the same patient.
6. **`confidence` CHECK** — values outside `[0, 1]` are rejected when non-null.
7. **Subject visibility (same predicate as `fi_network_subjects_select_tenant_member`)** — evaluated as superuser with a fixed `fi_users.auth_user_id` matching the fixture “JWT user”: tenant‑A subject visible; tenant‑B‑only and orphan subjects not visible. (`SET ROLE authenticated` is not used here because `authenticated` does not have `SELECT` on `fi_users`, so the live policy subquery would fail under that role in this stack.)
8. **`updated_at`** — `BEFORE UPDATE` trigger bumps `updated_at` on `fi_network_subjects` when a column changes.

**Repo note:** `fi_staff` DDL was ordered after two migrations that referenced it; those files were re-timestamped to `20260624120002` / `20260704120002` so `supabase db reset` can complete. If a remote project already applied the old migration names, coordinate a one-off repair before renaming in production.

---

## 2. Identity resolution model

### 2.1 Source identifiers

Extend the **source-id pattern** already used for foundation (`fi_patient_source_ids` conceptually) into **network resolution**:

| Artifact | Purpose |
|----------|---------|
| **`fi_network_subject_source_ids`** | Maps `(producer, source_system, source_patient_id)` → `network_subject_id` with metadata. |
| **Reuse / bridge** | Existing `fi_patient_source_ids` continues to anchor **tenant patient**; resolution jobs propose **subject** links from patient source ids. |

Each mapping row should carry:

- `source_system`, `source_kind`, `external_id`
- `first_seen_at`, `last_seen_at`
- `asserted_by` (`ingest` | `operator` | `rule_engine` | `patient_claim`)

### 2.2 Confidence scores

Store **structured** confidence, not a single opaque float where possible:

- **`match_signals`** (jsonb **staging only** — see §8): normalized token overlap, DOB match, phone hash match, MRN match, address geo, device graph, etc.
- **`confidence_tier`**: `low` | `medium` | `high` (policy-defined thresholds)
- **`confidence_score`**: optional numeric for ranking queues only

### 2.3 Merge / split strategy

| Operation | Allowed automation | Human review |
|-----------|-------------------|--------------|
| **Propose link** patient → subject | Yes — background job creates **candidate** rows | N/A |
| **Activate link** | Only for **high** tier AND policy allows (e.g. same tenant + same national id hash) | Default for cross-tenant |
| **Merge subjects** | **Never** automatic across tenants | Always — produces new graph + audit |
| **Split subject** | **Never** automatic | Always — forensic operation with legal review |

**Implementation posture:** treat “merge” as **graph consolidation** (redirect memberships + freeze old subject), not destructive row deletion of clinical facts.

### 2.4 Human review workflow

- **`fi_identity_resolution_tasks`**: queue of candidates with payload snapshot, SLA, assignee.
- States: `new` → `in_review` → `approved` | `rejected` | `needs_more_data`
- **Dual control** optional for cross-tenant approvals.
- **Immutable audit log** (`fi_identity_resolution_decisions`) storing who, when, rationale, prior graph ids.

### 2.5 No unsafe automatic merging

Hard requirements:

1. No cross-tenant **subject merge** without explicit human approval (configurable exception: *same legal entity* tenant group if ever introduced — still design as explicit policy object).
2. No deletion of clinical rows as part of “merge”; only **repoint** and **annotate**.
3. Any automated link above tenant boundary defaults to **candidate**, not **active**.

---

## 3. Patient-native event spine

### 3.1 Rationale

**Cases** (`fi_cases`) remain essential for **episodes, billing, surgery workflows**, and permissions — but the **primary chronological spine** for digital twin completeness should be **subject-centric** (then filtered by tenant/clinic policy), not case-centric only.

Today, **`fi_timeline_events`** is an important clinical stream but is not yet a complete patient-native bus; universal record docs note gaps vs synthetic timelines. The spine below is the **target architecture**, optionally fed from or migrating off `fi_timeline_events` over time.

### 3.2 Proposed table: `fi_patient_intelligence_events`

Append-only (logical; physical partitioning later), **one row per fact or notification** at the right granularity.

**Core columns (illustrative):**

| Column | Notes |
|--------|------|
| `id` | UUID PK |
| `network_subject_id` | **Primary** correlation key |
| `tenant_id` | Owning tenant for the *event record* (ingest scope) |
| `clinic_id` | Nullable; operational slice |
| `event_type` | Typed code from versioned taxonomy (see §8) |
| `occurred_at` | Clinical or wall time as defined per type |
| `recorded_at` | Ingestion time |
| `case_id` | Nullable FK to `fi_cases` — **important context**, not sole spine |
| `fi_patients.id` | Nullable — tenant patient when known |
| `producer` | External system / pipeline id |
| `correlation_id` | Idempotency / trace |
| `payload_ref` | FK to **`fi_intelligence_event_payloads`** (typed + versioned) **or** blob storage pointer |
| `payload_schema_version` | Integer or semver |
| `sensitivity` | `standard` | `restricted` | `research_only` |
| `legal_hold` | boolean |
| `supersedes_event_id` | For corrections (immutable chain) |

**Supporting:**

- **`fi_intelligence_event_payloads`**: normalized storage for large or binary-adjacent metadata; keeps hot index rows narrow.
- **`fi_event_links` evolution**: continue as **many-to-many** from events to media, documents, CRM activities, etc., with **nullable `network_subject_id`** added when members exist (additive compatibility with existing `patient_id` / case links).

### 3.3 Coverage intent

Every **clinical, surgical, imaging, communication, outcome, and training-linked** event should be **attachable** to exactly one `network_subject_id` at write time, or be written as **tenant-only pending resolution** until a subject is bound (never silently attach to wrong subject).

---

## 4. Migration from current model

### 4.1 Anchors in the codebase today (reference)

| Current artifact | Role in migration |
|------------------|-------------------|
| **`fi_global_patients`** | Legacy stub / resolution; **stop new semantic coupling**; backfill `network_subject_id` where 1:1 mapping is obvious; long-tail via review queue. |
| **`fi_patients`** | Remains operational patient; gains optional `network_subject_id` FK *or* only via bridge table — **bridge preferred** first for looser coupling. |
| **`fi_cases.patient_id` / `foundation_patient_id`** | Cases keep both; new events write `network_subject_id` when resolvable from case + patient graph. |
| **`fi_patient_source_ids`** | Primary input to resolution jobs for tenant patients. |
| **`fi_event_links`** | Enriched to include subject + foundation ids for cross-navigation. |
| **`fi_timeline_events`** | **Dual-write or ETL** into `fi_patient_intelligence_events` per phase; kinds mapped into typed taxonomy. |

### 4.2 Backfill order (conceptual)

1. Create `fi_network_subjects` + bridge for **new** patients only (no retroactive merge).
2. One-time **subject mint** per existing `fi_global_patients` / isolated foundation id where safe = 1:1.
3. Queue all ambiguous rows for **`fi_identity_resolution_tasks`**.
4. Incrementally attach historical `fi_timeline_events` → new spine with `supersedes_event_id` only when transforming content (prefer new row + link).

---

## 5. Cross-tenant / cross-clinic rules

| Layer | Owns |
|-------|------|
| **Network** | Subject id, global dedup graph, **policy objects** for what may be correlated. |
| **Tenant** | Clinical relationship, consent, RLS, billing context, which events exist for care. |
| **Clinic** | Operational slice (scheduling, staff, local identifiers), subset of events. |
| **Data sharing** | **Explicit** — no implicit cross-tenant read. Represent as **`fi_data_sharing_policies`** + **`fi_network_subject_sharing_grants`** (subject × counterparty × purpose × expiry). |

**Patient “belongs to” network identity** for **correlation**; **tenant owns** care and permissions; **clinic owns** local ops. **Twin views** are always **policy-filtered projections**, not raw table scans across tenants.

---

## 6. Digital Twin completeness

### 6.1 First-class completeness artifact

Prefer a **materialized view** (or nightly batch table) per tenant **and** optionally a network-level research projection:

- **`mv_fi_digital_twin_completeness`** (tenant-scoped) keyed by `network_subject_id` or `fi_patients.id` + `tenant_id`.

**Dimensions (columns or JSON sub-document per dimension):**

| Dimension | Metrics |
|-----------|---------|
| **Modality coverage** | % of expected modalities present (labs, imaging, trichoscopy, pathology, meds, surgery, comms, training). |
| **Time coverage** | earliest → latest known `occurred_at`; gaps > N months flagged. |
| **Provenance quality** | % events with verified producer, signed ingest, or manual attestation tier. |
| **Outcome completeness** | PROMs, follow-up visits, photo protocol stages — driven by product-specific checklists. |

### 6.2 Twin vs raw data

The **twin** is the **interpreted longitudinal model**; underlying tables remain source-aligned. Completeness MV reads from **`fi_patient_intelligence_events`** + linked clinical tables.

---

## 7. AI-readiness

| Requirement | Approach |
|-------------|----------|
| **Typed event taxonomy** | Registry table **`fi_intelligence_event_types`** (`code`, `domain`, `schema_version`, `pii_class`, `retention_class`). |
| **Provenance** | `producer`, `ingest_pipeline_version`, optional `model_id` / `prompt_hash` for AI-generated summaries stored as **derived** events referencing source event ids. |
| **Versioned schemas** | Payloads validated against JSON Schema / protobuf-like contracts stored in repo or **`fi_intelligence_payload_schemas`** table; reject unknown versions at write. |
| **Avoid jsonb as long-term SoT** | jsonb allowed for **envelope extensions** only; core fields promoted to columns or side tables as cardinality proves out. |

---

## 8. Retention / deletion

| Scenario | Behavior |
|----------|----------|
| **Tenant departure** | Disable tenant login; **retain** events per contract; strip cross-tenant sharing grants; optionally **export** then **purge** tenant-scoped PII per DPA. |
| **Clinic closure** | Mark clinic inactive; reassign operational queues; **do not** delete clinical history without policy. |
| **Patient deletion** | Tenant executes **right to erasure**: pseudonymize or delete `fi_persons` PII fields; **retain** minimal network tombstone if legally required; break reversible links; keep **hashed** audit of deletion request. |
| **Legal hold** | `legal_hold` on subject, tenant, or event subset; blocks purge pipelines; surfaced on admin APIs. |
| **Anonymized research retention** | Separate **`fi_research_cohorts`** + tokenized exports; **no** reversible keys to production PII without new consent. |

---

## 9. Compatibility strategy

1. **Additive network identity layer first** — new tables + optional APIs; zero change to default RLS paths.
2. **Dual-write** (`fi_timeline_events` + `fi_patient_intelligence_events`) only after **backfill confidence** metrics hit thresholds per tenant.
3. **Dual-read** behind feature flags for twin dashboards and ML features.
4. **Retire legacy global ids** only when: resolution queue near-zero, monitoring shows no regressions, and rollback window elapsed.

**No big-bang rewrite** of `fi_cases` or moving all history in one migration.

---

## 10. Proposed tables (summary)

| Table | Purpose |
|-------|---------|
| `fi_network_subjects` | Network anchor for longitudinal correlation. |
| `fi_network_subject_members` | Tenant patient ↔ subject membership graph. |
| `fi_network_subject_source_ids` | External ids → subject. |
| `fi_identity_resolution_tasks` | Human queue. |
| `fi_identity_resolution_decisions` | Immutable audit trail. |
| `fi_patient_intelligence_events` | Patient-native append-only spine. |
| `fi_intelligence_event_types` | Typed taxonomy registry. |
| `fi_intelligence_payload_schemas` | Versioned contract metadata. |
| `fi_intelligence_event_payloads` | Large / versioned payload bodies. |
| `fi_data_sharing_policies` | Reusable policy definitions. |
| `fi_network_subject_sharing_grants` | Explicit cross-tenant / counterparty grants. |
| `mv_fi_digital_twin_completeness` | Completeness projection (tenant or network variants). |

*Optional later:* `fi_network_subject_person_links`, research cohort tables, partitioned child tables by month for events.

---

## 11. Relationship diagram (text)

```text
                    ┌─────────────────────────┐
                    │   fi_network_subjects   │
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌──────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐
│ subject_source_ids│  │ subject_members     │  │ sharing_grants          │
│ (external refs)   │  │ → fi_patients       │  │ → policies / tenants    │
└──────────────────┘  └──────────┬──────────┘  └─────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌───────────────┐         ┌───────────────┐
           │  fi_persons   │         │   fi_cases    │
           │ (tenant PII)  │         │ (episodes)    │
           └───────────────┘         └───────┬───────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │ fi_patient_intelligence_events│
                              │  (subject-primary spine)      │
                              └──────────────┬───────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │ fi_event_links + payloads     │
                              └──────────────────────────────┘

Legacy (phased out):  fi_global_patients ──► backfill/migrate ──► fi_network_subjects
Parallel (phase):    fi_timeline_events ──dual-write/ETL──► fi_patient_intelligence_events
```

---

## 12. Migration phases

| Phase | Scope | Exit criteria |
|-------|--------|---------------|
| **P0** | Schema stubs + write path for **new** events only; no UI dependency | New ingest writes subject id when resolvable |
| **P1** | Backfill 1:1 subject mint from global/foundation; bridge `fi_patients` | >95% active patients have subject **or** explicit task |
| **P2** | Resolution UI + audit; cross-tenant grants | Queue SLA met; zero unapproved cross-tenant links in prod |
| **P3** | Dual-write timeline | Drift monitors < defined threshold |
| **P4** | Dual-read twin + completeness MV | Feature parity on pilot tenants |
| **P5** | Deprecate `fi_global_patients` for new features; read fallback only | No new FKs to legacy table; docs updated |

---

## 13. Non-goals

- Replacing **`fi_cases`** as the workflow hub for surgery or billing.
- **Automatic** cross-tenant clinical data merge or visible unified chart without consent artifacts.
- **Real-time** federated query across all tenants for operational OLTP (use per-tenant queries + explicit shared views).
- Storing **raw** producer blobs as the only twin state without typed event rows.
- Solving **national health identifier** politics — only technical hooks and policy tables.

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Wrong subject attachment | Conservative automation; human review; immutable correction chain |
| Performance at 500k+ × high event rate | Partition by time; hot/cold storage; MV refresh strategy |
| Compliance drift | Tenant-configurable retention; legal hold as first-class |
| Taxonomy sprawl | Governance board for `fi_intelligence_event_types`; deprecation workflow |
| Dual-write inconsistency | Idempotency keys; reconciliation job; drift dashboards |
| Operator fatigue on review queue | ML-assisted **ranking** only; never auto-merge across tenants |

---

## 15. Acceptance criteria

1. **Identity:** Every new `fi_patients` row created through supported flows can be assigned an **`fi_network_subjects`** link without manual intervention in ≥99% of single-tenant scenarios (measured monthly).
2. **Safety:** Zero production **active** cross-tenant subject links created without a corresponding **`fi_identity_resolution_decisions`** approval row.
3. **Spine:** At least **one** pilot domain (e.g. imaging + consultation) emits **`fi_patient_intelligence_events`** with typed `event_type` and `payload_schema_version`, queryable by `network_subject_id` under tenant RLS.
4. **Completeness:** **`mv_fi_digital_twin_completeness`** (or equivalent) returns stable results for pilot cohort and matches manual chart audit on modality coverage ≥90% of spot checks.
5. **Deletion:** Patient erasure request completes with **audit trail**, correct **grant revocation**, and **no** orphan cross-tenant readable PII in pilot tests.
6. **Compatibility:** Production runs **unchanged** default code paths when feature flags off; rollout reversible within one release.

---

## 16. Document control

- **Authoring:** Architecture design — implementation tracked separately in migrations and ADRs.
- **Related docs:** `docs/design/02-canonical-entity-model.md`, `docs/design/06-foundation-layer-architecture.md`, `docs/design/07-foundation-migration-specification.md`, `docs/design/08-foundation-resolution-helpers.md`, `docs/design/11-universal-patient-record.md`, `docs/governance/data-retention-policy.md`.
