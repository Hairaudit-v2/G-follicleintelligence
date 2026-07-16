# FI-HUBSPOT-IMPORT-1A — Architecture, identity resolution and production dry-run

**Verdict: AMBER** — proceed to a bounded owner-mapping pilot after explicit approval; do not claim programme complete.

| Field | Value |
|-------|-------|
| Closed | 2026-07-16 |
| Mapping version | v1 |
| Production FI entity writes | **None** |
| Backup watermark changed | **No** (`notes` still `2026-07-16T03:45:02.366Z`) |
| Prerequisite | FI-HUBSPOT-BACKUP-1 GREEN (`c359392ce60b349d0bfeb5aec7455136d3d8e091`) |

Companion JSON: `evidence-fi-hubspot-import-1a-architecture-and-dry-run.json`

---

## 1. Source datasets inventoried

Authoritative source = verified HubSpot backup staging (not ad-hoc live API).

| Dataset | Source | Canonical ID | Count | Dry-run safe |
|---------|--------|--------------|------:|--------------|
| Contacts | `fi_external_hubspot_contact_staging` | `hubspot_contact_id` | 4,750 | Yes |
| Owners | `fi_external_hubspot_owner_inventory` | `hubspot_owner_id` | 31 | Yes |
| Forms | `fi_external_hubspot_form_definition_staging` | `hubspot_form_id` | 46 | Yes |
| Form submissions | `fi_external_hubspot_form_submission_staging` | `hubspot_submission_id` | 5,311 | Yes (PII in payload) |
| Messages | `fi_external_hubspot_conversation_message_staging` | thread+message | 5,821 | Yes (bodies sensitive) |
| Conversations | `fi_external_hubspot_conversation_thread_staging` | `hubspot_thread_id` | 1,918 | Yes |
| Notes | `fi_external_hubspot_note_staging` | `hubspot_record_id` | 244+ | Yes |
| Calls / meetings / tasks | secondary staging | `hubspot_record_id` | 2,093 / 17 / 1,680 | Yes |
| Deals / pipelines | deal staging + manifest | deal/stage labels | 4,958 / 11 | Yes |
| Files | `fi_external_hubspot_file_inventory` | `hubspot_file_id` | 903 meta / 0 bodies | Metadata only |
| Verification / watermarks | sync runs + watermarks | run/dataset | notes v1 | Observability |

Accepted limitations carry forward: contact associations for submissions (CSV enrichment 3,107), file bodies out of scope, archived notes outside Search, incremental v1 = notes only.

---

## 2. FI OS target entities

| Target | PK | Tenant | Direct import? | Notes |
|--------|----|--------|----------------|-------|
| `fi_persons` + `fi_person_source_ids` | uuid | `tenant_id` | Yes (identity) | HubSpot contact → person |
| `fi_crm_leads` | uuid | `tenant_id` | Yes | Primary CRM target for contacts |
| `fi_patients` + `fi_patient_source_ids` | uuid | `tenant_id` | **Link only** | No create-from-contact in v1 |
| `fi_staff` + `fi_staff_source_ids` | uuid | `tenant_id` | **Link only** | No auto-create staff |
| `fi_crm_pipeline_stages` / stage history | uuid | `tenant_id` | Map / append history | No silent multi-stage collapse |
| `fi_crm_activity_events` / notes / messages / timeline | uuid | `tenant_id` | Later gates | Source-id dedupe |
| `fi_external_record_mappings` | uuid | `tenant_id`+integration | Yes | Connector identity |
| `fi_import_batches` / staging | uuid | `tenant_id` | Batch control | Existing CSV path; IMPORT-1 uses dry-run reports |

---

## 3. Canonical external identity

Reuse existing source-id + `fi_external_record_mappings`. HubSpot IDs never become FI PKs.

Logical unique key:

`tenant_id · source_system · integration_id · source_object_type · source_record_id`

Additive richer identity table **proposed, not applied**.

---

## 4. Lead-versus-patient policy

- Create/link **leads** for enquiry/prospect contacts with safe identity.
- **Never** create a patient solely because HubSpot has a contact.
- Email alone may link a lead; must **not** merge into a clinical patient.
- Patient link requires Tier 1–3 external evidence.
- No overwrite of demographics, clinical notes, consent, surgery, or consultation records.

---

## 5. Owner-to-staff mapping result

| Class | Count |
|-------|------:|
| linked_active_staff | 2 |
| linked_inactive_staff | 0 |
| unknown_owner | 29 |
| ambiguous / system / test | 0 |

`fi_staff_source_ids` where `source_system = hubspot`: **0** rows.  
The two active matches are email-deterministic within tenant and are the natural pilot cohort.

---

## 6. Pipeline mapping result

Sales Pipeline (11 stages) mapped in `hubspotImportMappingV1.ts`.

- Exact/closest: 10  
- History-only: **Surgery Unqualified** (business decision required)  
- Existing FI stage authoritative; regression forbidden  
- High-risk commercial stages (Booked*, Deposit Paid) → CRM evidence only in first write gates

---

## 7. Production dry-run cohort

- Tenant / integration: Evolved recovery + HubSpot connector  
- Dataset: contacts (stratified ≤100) + full owners inventory (31)  
- Staging pool sampled: 1,000 of 4,750 (earliest+latest IDs)  
- Mutation guard: 0 inserts / updates / deletes / upserts  
- Watermark after run: unchanged

### Decision counts (n=100 contacts)

| Decision | Count |
|----------|------:|
| link_existing_lead | 96 |
| quarantine_test_or_smoke | 4 |
| create_new_lead | 0 |
| ambiguous / conflict / missing | 0 |
| link_existing_patient | 0 |

Context: **4,690 / 4,750** staging contacts already have `fi_person_source_ids` (prior Stage-1). Cohort correctly links rather than proposing mass creates. Remaining net-new contact import is a later bounded gate after owners.

### Integrity

| Check | Result |
|-------|--------|
| Wrong-tenant candidates | **0** |
| One-source → multiple same-type targets | **0** |
| Fuzzy matching used | **No** |
| HubSpot id as FI PK | **No** |

---

## 8. Quarantine categories (v1)

`quarantine_missing_identity`, `quarantine_ambiguous_identity`, `quarantine_owner_unmapped`, `quarantine_stage_unmapped`, `quarantine_patient_link_requires_stronger_evidence`, `quarantine_test_or_smoke`, `conflict_multiple_targets`.

---

## 9. Side-effect analysis

Dry-run emitted no notifications, automations, appointments, messages, or pipeline writes.  
Import apply must continue to forbid patient communications and appointment/surgery creation. Analytics-only risk flagged on link decisions.

---

## 10. Rollback model

Batch-scoped, previewable, archive/suppress imported rows; never hard-delete native entities with post-import activity; unlink imported external ids only for pre-existing entities.

---

## 11. Recommended first pilot

**Option A — Owner-to-staff mapping**  
Size: **≤ 25** source owners (start with the 2 deterministic active matches, expand only with exact email/source evidence).  
Next gate: **FI-HUBSPOT-IMPORT-1B — Owner-to-staff mapping pilot**  
Do not execute that pilot in 1A.

---

## 12. Layers implemented

| Layer | Status |
|-------|--------|
| A Immutable backup evidence | Unchanged |
| B Normalised import staging (decision records) | Dry-run |
| C Identity resolution | Implemented (pure) |
| D Import decision | Implemented (dry-run) |
| E Controlled application | **Blocked** |
| F Verification / rollback evidence | Designed |

---

## 13. Code & tests

```
src/lib/integrations/hubspot/import/
  hubspotImportTypes.ts
  hubspotImportMappingV1.ts
  hubspotImportIdentity.ts
  hubspotImportDryRunCore.ts
  hubspotImportDryRun.server.ts
  hubspotImportReconciliation.ts
  hubspotImportDryRun.test.ts
scripts/hubspot-import-dry-run.ts
```

`npm run test:hubspot-import` — 30/30 passed (identity, write guards, tenant fail-closed, no patient auto-create, determinism, privacy hashes).

---

## 14. AMBER rationale (not RED)

- Owner coverage incomplete (expected; motivates pilot A).  
- One pipeline stage history-only pending business input.  
- Additive external-identity migration proposed only.  

No RED control: tenant isolation holds, no multi-target conflicts, dry-run write-free, no fuzzy matching, no HubSpot-as-PK, rollback isolatable by design.

---

## 15. Exact next gate

**FI-HUBSPOT-IMPORT-1B — Owner-to-staff mapping pilot**
