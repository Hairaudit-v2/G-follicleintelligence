# CRITICAL rows from `audit-supabase-admin-from.result.csv` — human review

## Fix status (2026-06-13)

All **eight** confirmed items from this document were implemented in code:

| # | Item | Status |
|---|------|--------|
| 1 | `attachFiCaseIdToGlobalCase` — verify `fi_cases.tenant_id` matches global case; defensive `.eq('tenant_id', row.tenant_id)` on update | **Fixed** |
| 2 | `markFiEventStatus` + `attachFiEventError` — `tenantId` on params; update `fi_events` by `id` + `tenant_id`; all event handlers updated | **Fixed** |
| 3 | `markSessionSlotStatus` — final update includes `.eq('session_id', …)` | **Fixed** |
| 4 | Stripe webhook — optional `tenant_id` on updates when non-null (`nonEmptyTenantIdForWebhookRow`); omitted when row may have null tenant | **Fixed** |
| 5 | Foundation `resolveClinic` / `resolveOrganisation` / `resolvePatient` / `resolvePerson` — reload-by-id selects add `.eq('tenant_id', tenantId)` | **Fixed** |
| 6 | `resolveCaseFoundation` — case patch update adds `.eq('tenant_id', tenantId)` | **Fixed** |
| 7 | `markEventProcessed` / `markEventFailed` — `tenantId` argument + `.eq('tenant_id', …)` (no external callers yet) | **Fixed** |
| 8 | `attachPatientImageToSessionSlot` — single `fi_patient_images` select with AI columns + tenant | **Fixed** |

**Remaining CRITICAL (18):** After regenerating `tools/audit-supabase-admin-from.result.csv`, eighteen rows still rate CRITICAL for static heuristics only. See **Remaining CRITICAL disposition** below — none are class **4** (no further application code required from that list).

**Tests:** `lib/fi/events/assertFiCaseTenantMatchesGlobalTenant.test.ts` (assert helper behaviour).

**Audit summary (`tools/audit-supabase-admin-from.result.json`):** `CRITICAL` count **34 → 18** after regeneration. Remaining CRITICAL rows are mostly **static-audit false positives** (heuristic does not see conditional `.eq('tenant_id')` built across `let q = …; if (tid) q = q.eq(…)`), or **id + extra non-tenant filter** (e.g. `.eq('status','processing')` on `fi_reminder_jobs`) without `tenant_id` in the same text chain — code paths are still safe where ownership was established earlier (see original classifications §2).

---

## Remaining CRITICAL disposition (18 rows, post-fix review 2026-06-13)

Legend: **1** = scanner false positive (conditional tenant or snippet truncation); **2** = safe, row id from tenant-scoped (or equivalent) load/claim in the same flow; **3** = safe operationally, optional `tenant_id` (or caller `tenantId` on read) for defense-in-depth; **4** = still needs fix. **None** of the 18 rows are class **4** after the latest fixes.

| # | File | Line | Function | Class | Why still flagged | Code change recommended | Note for this doc (no mandatory code change) |
|---|------|------|----------|-------|-------------------|-------------------------|-----------------------------------------------|
| 1 | `app/api/fi-payments/stripe/webhook/route.ts` | 81 | `POST` | **1** | Heuristic matches `.from('fi_payment_webhook_events').update(…).eq('id', webhookRowId)` and does not resolve the following `if (completedTenantFilter) completedQ = completedQ.eq('tenant_id', …)`. | No | **CRITICAL disposition:** Conditional tenant filter when `mapped.tenantId` is non-empty; when null, `webhookRowId` is still the row inserted in this request — acceptable residual risk. |
| 2 | `app/api/fi-payments/stripe/webhook/route.ts` | 118 | `POST` | **1** | Same pattern on checkout_failed branch when marking the webhook row processed (`failedQ` + `failedTenantFilter`). | No | **CRITICAL disposition:** Same as row 1 — conditional `tenant_id` on the update chain; id from same-request insert. |
| 3 | `app/api/fi-payments/stripe/webhook/route.ts` | 126 | `POST` | **1** | Same for ignored branch (`ignoredQ` + `ignoredTenantFilter` from `tenantHint`). | No | **CRITICAL disposition:** Same as row 1 — conditional tenant filter; ignored path. |
| 4 | `app/api/fi-payments/stripe/webhook/route.ts` | 140 | `POST` | **1** | Same for catch-path error update (`errQ` + `errTenantFilter`). | No | **CRITICAL disposition:** Same as row 1 — conditional tenant filter; error path. |
| 5 | `lib/fi/events/mapping.ts` | 149 | `resolveOrCreateGlobalPatient` | **2** | Update uses `.eq('id', existingRow.id)` only; scanner does not link `existingRow` to the prior `maybeSingle` on `fi_global_patients` with `.eq('tenant_id', params.tenantId)`. | No | **CRITICAL disposition:** `existingRow` was loaded under `tenant_id` + natural keys; update targets that same row. |
| 6 | `lib/fi/events/mapping.ts` | 245 | `resolveOrCreateGlobalCase` | **2** | Update uses `.eq('id', existingRow.id)` only. | No | **CRITICAL disposition:** `existingRow` from tenant-scoped `maybeSingle`; id is not an external guess. |
| 7 | `lib/fi/events/mapping.ts` | 307 | `resolveOrCreateGlobalCase` | **2** | Update uses `.eq('id', racedRow.id)` only. | No | **CRITICAL disposition:** `racedRow` from tenant-scoped `single()` after unique race; same as row 6. |
| 8 | `lib/fi/events/mapping.ts` | 329 | `attachFiCaseIdToGlobalCase` | **3** | Initial `select` on `fi_global_cases` filters by `id` only; scanner flags id-only service-role read. Update path now asserts `fi_cases.tenant_id` vs global row and updates with `.eq('tenant_id', row.tenant_id)`. | Optional | **CRITICAL disposition:** Acceptable after assert + tenant-guarded update; optional hardening — add `tenantId` to params and `.eq('tenant_id', …)` on the initial select if callers always know tenant. |
| 9 | `scripts/provision-evolved-tenant.ts` | 371 | script body | **2** | Update `.eq('id', existingSvc.id)` only; scanner ignores prior `select` with `.eq('tenant_id', tenantId)`. | No | **CRITICAL disposition:** Provisioning script; service id came from tenant-scoped lookup on `fi_services`. |
| 10 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 274 | `attachPatientImageToSessionSlot` | **1** | CSV/codegen snippet truncates at `.eq('sessi…` so the static rule does not see `.eq('session_id', params.sessionId.trim())` on the same chain. | No | **CRITICAL disposition:** Full chain includes `session_id`; session row was checked for `tenant_id` match above. |
| 11 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 323 | `markSessionSlotStatus` | **2** | Heuristic treats `id` + `session_id` as insufficient “tenant signal” though `session_id` was validated via `hli_photo_protocol_sessions` with `.eq('tenant_id', …)`. | No | **CRITICAL disposition:** Slot update is session-scoped; session load enforced tenant. |
| 12 | `src/lib/reminders/reminderProcessor.server.ts` | 91 | `finalizeJobSent` | **2** | `jobId` is the claimed job’s id after `claimReminderJob`; update adds `.eq('status','processing')` but scanner still classifies as id-only tenant risk. | No | **CRITICAL disposition:** Only the worker that atomically claimed `pending` → `processing` should finalize this id. |
| 13 | `src/lib/reminders/reminderProcessor.server.ts` | 110 | `finalizeJobCancelled` | **2** | Same as row 12 for `jobId` / processing guard. | No | **CRITICAL disposition:** Same as row 12. |
| 14 | `src/lib/reminders/reminderProcessor.server.ts` | 370 | `processReminderJobsOnce` | **2** | `row.id` from `claimReminderJob` in the same iteration; `.eq('status','processing')` not treated as ownership by scanner. | No | **CRITICAL disposition:** Same as row 12. |
| 15 | `src/lib/reminders/reminderProcessor.server.ts` | 383 | `processReminderJobsOnce` | **2** | Same as row 14 (retry branch). | No | **CRITICAL disposition:** Same as row 12. |
| 16 | `src/lib/staffPin/staffPin.server.ts` | 242 | `verifyStaffPinLogin` | **2** | `row.id` from `loadPinRow(tenantId, staffId)` which selects with `.eq('tenant_id', …).eq('staff_id', …)`; updates omit redundant `tenant_id`. | No | **CRITICAL disposition:** Pin row identity is tenant-scoped at load; optional `.eq('tenant_id', opts.tenantId)` on updates for defense-in-depth only. |
| 17 | `src/lib/staffPin/staffPin.server.ts` | 253 | `verifyStaffPinLogin` | **2** | Same as row 16 (success path). | No | **CRITICAL disposition:** Same as row 16. |
| 18 | `src/lib/taxLocalisation/taxLocalisationSettings.server.ts` | 142 | `upsertTaxLocalisationDocument` | **2** | `row.id` from `maybeSingle` after builder with `.eq('tenant_id', tid)` (and clinic scope). | No | **CRITICAL disposition:** Update targets the row just found under tenant (and clinic) scope; optional `.eq('tenant_id', tid)` on update for redundancy. |

**Counts:** **1** → 5 rows · **2** → 12 rows · **3** → 1 row · **4** → 0 rows.

---

Source: the original audit listed **34** rows with `rating=CRITICAL` in `tools/audit-supabase-admin-from.result.csv`. After code fixes and CSV regeneration, **18** rows remain `CRITICAL`; their disposition is in **Remaining CRITICAL disposition** above. The sections below (legend, 34-row summary, confirmed list) retain the original review narrative for context.

Legend:

1. **True critical** — cross-tenant read/write plausible if IDs or parameters are wrong, guessed, or attacker-controlled.
2. **Safe — ownership earlier (script miss)** — tenant or resource scope was established in the same function before the flagged line; the audit only matches `.eq('id', …)`.
3. **Safe — tenant-global / non-sensitive / tooling** — table or workflow is global, provisioning-only, or ID is already scoped by construction.
4. **Needs `tenant_id` (or equivalent) filter** — add `.eq('tenant_id', …)` / `.eq('session_id', …)` on the same chain for defense-in-depth or correctness.
5. **Needs prior ownership assertion** — add `assertCrmTenant*` / `assertPatientInTenant` / etc. at API boundary (usually overkill if already 2+4).
6. **Needs user-scoped client + RLS** — only where request context is a real user JWT and RLS models the policy; not appropriate for webhooks, job workers, or ingest.
7. **Needs service-role wrapper/helper** — centralize “update by id after verified read” in one audited helper rather than sprinkling `.eq('id', …)` only.

---

## Summary by classification (all 34 rows)

| Class | Count | Notes |
|------|-------|--------|
| 2 — Safe, ownership earlier (script miss) | **22** | Foundation resolvers, global mapping updates after tenant-scoped selects, reminder finalizers after `claimReminderJob`, staff PIN after `loadPinRow`, tax upsert after tenant-scoped lookup, provision `fi_services` after tenant-scoped select, protocol attach after tenant+patient checks (extra `fi_patient_images` read is redundant), most Stripe webhook updates (`webhookRowId` from insert in same request). |
| 3 — Safe, global/tooling/low sensitivity | **0** | None purely “global non-tenant table” among CRITICAL rows; `fi_global_*` still carries `tenant_id` but updates target rows **just loaded** under tenant filters. |
| 4 — Needs extra filter on chain | **10** | Defense-in-depth: add `tenant_id` / `session_id` where only `id` remains on the write path, or tighten public APIs (see confirmed list). |
| 1 — True critical | **2** | `attachFiCaseIdToGlobalCase` (no tenant pairing on `fi_case_id`); `markFiEventStatus` via `supabaseAdmin()` (updates `fi_events` by `eventId` only — no `tenant_id`). |
| 5 / 6 / 7 | **0 / 0 / optional** | Use 4+7 instead of 5/6 for most rows below. |

---

## Confirmed list (actionable: **1 — True critical** or **4 — Needs filter / small correctness fix**)

**Post-fix note:** The eight items below describe the issues **before** patches; all are marked **Fixed** in **Fix status (2026-06-13)** above. The remaining **18** CRITICAL CSV hits are dispositioned in **Remaining CRITICAL disposition** above; none are class **4** (mandatory fix).

Only these eight **distinct code issues** were carried forward with patches and tests. Other CRITICAL CSV lines matched patterns documented under **2** (document only).

---

### 1. True critical — `attachFiCaseIdToGlobalCase`

| Field | Value |
|--------|--------|
| **File** | `lib/fi/events/mapping.ts` |
| **Line (CSV)** | 322, 338 (same function: select then update) |
| **Function** | `attachFiCaseIdToGlobalCase` |
| **Table** | `fi_global_cases` |
| **Exact issue** | Loads and updates a global case by `params.globalCaseId` only. **No check** that `params.fiCaseId` belongs to the **same `tenant_id`** as the loaded global case row. A caller that mixes UUIDs from two tenants could link a foreign tenant’s `fi_cases` row into another tenant’s global case metadata. |
| **Safest minimal patch** | After loading `row`, load `fi_cases` with `.select('id, tenant_id').eq('id', params.fiCaseId).single()` and `throw` unless `fi_case.tenant_id === row.tenant_id`. Optionally add `.eq('tenant_id', row.tenant_id)` to both `fi_global_cases` queries as defense-in-depth. |
| **Regression test** | Unit test: mock global case tenant `A`, fi_case tenant `B` → expect `throw` (no update). Happy path: same tenant → update succeeds. |

---

### 2. True critical — `markFiEventStatus` (service role, id-only)

| Field | Value |
|--------|--------|
| **File** | `lib/fi/events/idempotency.ts` |
| **Line (CSV)** | 186 |
| **Function** | `markFiEventStatus` |
| **Table** | `fi_events` |
| **Exact issue** | `supabaseAdmin().from('fi_events').update(…).eq('id', params.eventId)` — **no `tenant_id`**. Any code that obtains another tenant’s `eventId` could flip status. `MarkFiEventStatusParams` does not include `tenantId`. |
| **Safest minimal patch** | Extend `MarkFiEventStatusParams` with `tenantId: string` and add `.eq('tenant_id', params.tenantId.trim())` to the update (and validate row count / error). Update all `markFiEventStatus` call sites in `lib/fi/events/handlers/*.ts` to pass `tenantId` from the envelope. |
| **Regression test** | Handler test: wrong `tenantId` for same `eventId` → update returns no row / throws. Correct pair → succeeds. |

---

### 3. Needs filter / correctness — `markSessionSlotStatus` update

| Field | Value |
|--------|--------|
| **File** | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` |
| **Line (CSV)** | 325 |
| **Function** | `markSessionSlotStatus` |
| **Table** | `hli_photo_protocol_session_slots` |
| **Exact issue** | Earlier block verifies slot exists with `.eq('id', …).eq('session_id', …)` and session with `.eq('tenant_id', …)`, but the **final `update` uses only** `.eq('id', params.sessionSlotRowId.trim())`. If slot IDs were ever not globally unique, or for defense-in-depth, this is weaker than the read path. |
| **Safest minimal patch** | Add `.eq('session_id', params.sessionId.trim())` to the update (mirrors the verified read). Optionally add `tenant_id` join via session subquery or second `.filter` if the table has no `tenant_id` column. |
| **Regression test** | Integration or unit with mocked client: assert update query includes `session_id` equality. |

---

### 4. Needs filter (defense-in-depth) — Stripe webhook `fi_payment_webhook_events` updates

| Field | Value |
|--------|--------|
| **File** | `app/api/fi-payments/stripe/webhook/route.ts` |
| **Lines (CSV)** | 75, 110, 115, 126 |
| **Function** | `POST` handler |
| **Table** | `fi_payment_webhook_events` |
| **Exact issue** | Updates use `.eq('id', webhookRowId)` only. **`webhookRowId` is from the insert in the same request**, so practical cross-tenant risk is **low**, but a leaked/guessed UUID could mutate another row without `tenant_id` guard. |
| **Safest minimal patch** | Where `mapped.tenantId` / `tid` is known, add `.eq('tenant_id', tid)` to each update (for rows with null `tenant_id` on insert, use a branch or skip tenant filter only when consistent with schema). |
| **Regression test** | Route test: mock insert returning id `X`; second call with different tenant row `X` should not update (if tenant column enforced), or assert query builder receives `tenant_id` when non-null. |

---

### 5. Needs filter (defense-in-depth) — Foundation “reload by PK after mapping”

| Field | Value |
|--------|--------|
| **Files** | `src/lib/fi/foundation/resolveClinic.ts`, `resolveOrganisation.ts`, `resolvePatient.ts`, `resolvePerson.ts` |
| **Lines (CSV)** | 70, 132 (clinic); 74, 155 (org); 76, 106 (patient); 68, 171, 88, 94 (person) |
| **Functions** | `resolveOrCreateClinic`, `resolveOrCreateOrganisation`, `resolveOrCreatePatient`, `resolveOrCreatePerson` (+ retry branches) |
| **Tables** | `fi_clinics`, `fi_organisations`, `fi_patients`, `fi_persons` |
| **Exact issue** | After **tenant-scoped** `fi_*_source_ids` (or equivalent) lookup, follow-up `select … .eq('id', mappedId)` omits `.eq('tenant_id', tenantId)`. Trusts mapping table integrity; if mapping were corrupted, wrong tenant’s row could be returned. |
| **Safest minimal patch** | Add `.eq('tenant_id', tenantId)` to every “load by `*_id` from mapping” query. |
| **Regression test** | One foundation test per resolver: mapping returns id belonging to another tenant (fixture) → expect throw or empty, not wrong row. |

---

### 6. Needs filter (defense-in-depth) — `resolveCaseFoundation` patch update

| Field | Value |
|--------|--------|
| **File** | `src/lib/fi/foundation/resolveCaseFoundation.ts` |
| **Line (CSV)** | 78 |
| **Function** | `resolveOrCreateCaseFoundation` |
| **Table** | `fi_cases` |
| **Exact issue** | Branch `existing_case_id`: prior read uses `.eq('id', id).eq('tenant_id', tenantId)`, but **`update(patch).eq('id', id)` omits `tenant_id`**. Same integrity argument as (5). |
| **Safest minimal patch** | Add `.eq('tenant_id', tenantId)` to the update chain. |
| **Regression test** | Same pattern as (5) for `fi_cases`. |

---

### 7. Needs filter (defense-in-depth) — `fi_events` worker updates

| Field | Value |
|--------|--------|
| **File** | `lib/fi/events/idempotency.ts` |
| **Lines (CSV)** | 273, 297 |
| **Functions** | `markEventProcessed`, `markEventFailed` |
| **Table** | `fi_events` |
| **Exact issue** | Updates by `eventId` only. Callers are currently **only** in this module; when wired from ingest, **must** pass `tenant_id` to avoid the same class as (2). |
| **Safest minimal patch** | Add `tenantId: string` argument; `.eq('tenant_id', tenantId)` on both updates. |
| **Regression test** | Same as (2) once callers exist; until then, contract test on function signature / query shape. |

---

### 8. Needs filter (defense-in-depth) — `protocolSession` redundant image read

| Field | Value |
|--------|--------|
| **File** | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` |
| **Line (CSV)** | 260 |
| **Function** | `attachPatientImageToSessionSlot` |
| **Table** | `fi_patient_images` |
| **Exact issue** | Second `select` on `fi_patient_images` uses **only** `.eq('id', patientImageId)` after a **correct** tenant-scoped read at 244–250. Redundant for logic; CRITICAL is a **false positive** for cross-tenant but **4** still improves clarity. |
| **Safest minimal patch** | Remove duplicate select and reuse first result, **or** add `.eq('tenant_id', params.tenantId.trim())` to the second select. |
| **Regression test** | Assert only one select on `fi_patient_images`, or assert second query includes `tenant_id`. |

---

## Rows intentionally **not** on the confirmed list (brief)

- **`lib/fi/events/mapping.ts`** — `resolveOrCreateGlobalPatient` / `resolveOrCreateGlobalCase` updates at 142, 238, 300: `id` is **`existingRow.id` / `racedRow.id` from rows loaded with `.eq('tenant_id', params.tenantId)`** → **2**.
- **`lib/fi/reminders/reminderProcessor.server.ts`** — 91, 110, 370, 383: `jobId` / `row.id` from **`claimReminderJob`** atomic claim → **2**; optional **4** `.eq('tenant_id', …)` if column exists.
- **`src/lib/staffPin/staffPin.server.ts`** — 242, 253: `row.id` from **`loadPinRow(tenantId, staffId)`** → **2**; optional **4** `.eq('tenant_id', opts.tenantId)`.
- **`src/lib/taxLocalisation/taxLocalisationSettings.server.ts`** — 142: `row.id` from **tenant-scoped** `maybeSingle` → **2**; optional **4** on update.
- **`scripts/provision-evolved-tenant.ts`** — 371: id from **tenant-scoped** `fi_services` select → **2** (tooling).
- **`protocolSession` line 277** (`hli_photo_protocol_session_slots` update): source already has `.eq('session_id', params.sessionId.trim())` after `.eq('id', …)`; the CSV **snippet was truncated** so the static audit missed `session_id` → **2** (script false positive).

---

## Counts recap

| Bucket | Rows |
|--------|------|
| All CRITICAL in CSV (original) | **34** |
| CRITICAL after fixes (regenerated CSV) | **18** |
| Distinct actionable issues in this doc (patched) | **8** |
| True critical (must fix semantics), pre-fix | **2** |
| Needs filter / correctness, pre-fix | **6** (includes Stripe + foundation bundle + protocol + fi_events worker) |
| Remaining CRITICAL disposition (2026-06-13) | **1** → 5 · **2** → 12 · **3** → 1 · **4** → 0 |

---

*Review method: read each flagged file around the reported line and traced `tenant_id` / id provenance. The 2026-06-13 disposition pass updated this markdown only (no application code changes for the remaining 18 rows).*
