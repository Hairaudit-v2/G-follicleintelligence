# Stage 1G — Foundation integrity dashboard & optional backfill

**Status:** Implemented (read-only dashboard + admin-triggered backfill).  
**Related:** [09-foundation-dual-write-event-ingest](./09-foundation-dual-write-event-ingest.md), [08-foundation-resolution-helpers](./08-foundation-resolution-helpers.md), compat views in migration `20260605140014_fi_foundation_compat_views.sql`.

---

## 1. Why this exists

Dual-write (Stage 1F) runs **after** `fi_events` and `fi_event_links` are stable. Operators need a **safe, read-heavy** view of:

- How many events and cases have foundation rows.
- Where global patients or cases still lack `fi_patients` / `foundation_patient_id` resolution.
- Duplicate-risk signals before running merges or policy changes.
- Optional **manual** replay of dual-write for historical processed events that never received foundation timeline rows.

This does **not** change ingest behaviour and does **not** auto-run backfill.

---

## 2. Where to use it

| Surface | Path |
|--------|------|
| FI Admin (per tenant) | `/fi-admin/[tenantId]/foundation-integrity` |
| Metrics API | `GET /api/tenants/[tenantId]/foundation-integrity` |

Same practical trust model as other FI Admin pages and `/api/tenants/*` routes (service role on the server, not exposed as a public product surface for clinic end users).

**Backfill:** Server action `backfillFoundationFromProcessedEventsAction(tenantId, adminKey)` in `lib/actions/fi-actions.ts`. Requires env **`FI_ADMIN_API_KEY`**; the admin UI collects the key once per action (internal ops only).

---

## 3. Metrics shown

| Group | Meaning |
|-------|--------|
| **Totals** | Counts: `fi_events`, processed `fi_events`, `fi_persons`, `fi_patients`, `fi_cases`, `fi_cases` with `foundation_patient_id`, `fi_timeline_events`, `fi_media_assets`. |
| **Coverage** | Among tenant `fi_events` scanned (up to 200k ids): events whose **latest** `fi_event_links` row has `fi_case_id`; of those, cases with `foundation_patient_id`; of those, patients with `person_id`. |
| **Unresolved global patients** | Rows from `v_fi_patient_resolution` with `global_patient_id` set and `foundation_patient_id` null (count + preview). |
| **Unresolved cases** | Rows from `v_fi_case_foundation` with `foundation_patient_id` null (count + preview). |
| **Media without case** | `fi_media_assets` with `case_id` null; plus unified view count `v_fi_media_unified` where `case_id` null (legacy + foundation). |
| **Timeline sparse detail** | Sample (first 50k timeline rows): `detail` is null or empty JSON object — **not** always an error (minimal ingest milestones are allowed). |
| **Duplicate-risk persons** | In-memory scan of `fi_persons.metadata.email_normalized`: groups with **>1** person id (heuristic only; no auto-merge). |
| **Duplicate-risk patients** | Count of `person_id` values appearing on **>1** `fi_patients` row for the tenant (schema normally prevents this; non-zero suggests data issues). |

Notes may appear when scans are capped (large tenants) or a view count fails.

---

## 4. Duplicate-risk rules

- **Email:** Uses **exact** equality on `metadata.email_normalized` only. Does not inspect raw intake email; does not merge.
- **Patients per person:** Simple row count; expected steady state is **≤1** patient per person per tenant under current uniqueness rules.

---

## 5. Backfill safely

1. Set **`FI_ADMIN_API_KEY`** in the deployment environment (never commit the value).
2. Open **Foundation integrity** for the target tenant.
3. Enter the key and run **Run batch backfill (max 50)**.

Behaviour:

- Considers up to **500** most recent **processed** `fi_events`; selects up to **50** that have **no** `fi_timeline_events` row with `fi_event_id` equal to that event (heuristic for “dual-write timeline not yet written”).
- Rebuilds a minimal `FiEventEnvelope` from `fi_events.payload_json`, `fi_event_links`, `fi_global_cases` / `fi_global_patients`, and `fi_cases` metadata / `external_id`.
- Calls existing `dualWriteFoundationFromFiEvent` (idempotent; does not alter ingest).

**What not to treat as an error**

- **Skipped** rows: non-processed status, missing `fi_case_id` on link, or failed envelope reconstruction.
- **Sparse timeline `detail`:** Curated rows may legitimately carry only `title` / `event_kind`; empty `detail` is informational.
- **High unresolved counts** before Stage 1F rollout: expected until dual-write has run on historical traffic (use backfill in batches, then re-check).

---

## 6. What is out of scope

- No automatic scheduled backfill.
- No writes to `fi_events` / `fi_global_*` beyond what dual-write already does.
- No end-user clinic RBAC layer (follow-up if product adds authenticated FI Admin).

---

## 7. Document map

| Doc | Role |
|-----|------|
| [09-foundation-dual-write-event-ingest](./09-foundation-dual-write-event-ingest.md) | Dual-write semantics and idempotency |
