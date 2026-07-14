# BLK-SEC-01 — Recovery marker (E4 prep)

**Drill:** Restore drill E4–E6  
**Date registered (UTC):** 2026-07-14T06:21:38.292Z  
**Verified (UTC):** `2026-07-14T06:21:47.809Z` — **PASS**  
**Environment:** Production Evolved (synthetic SMOKETEST insert + read-only verify — no restore, no PHI)  
**Operator:** Platform / infra (FI agent)

---

## PITR constraint (critical)

Production PITR retention is currently **7 days** (cost / no active users — window not extended).

The prior registered marker `SMOKETEST-JOURNEY-001-20260630` (`created_at` `2026-06-30T12:26:30Z`) is **outside** that window on 2026-07-14 and **cannot** be recovered by a 7-day PITR restore. It remains on production for history only.

**Canonical marker for this E4 drill** is the new lead below. Choose a restore timestamp **after** its `created_at` and **within the 7-day retention window**.

---

## Marker chosen (canonical synthetic probe)

| Field | Value |
|-------|-------|
| **Marker ID** | `SMOKETEST-RECOVERY-MARKER-20260714` |
| **Primary table** | `public.fi_crm_leads` |
| **Primary row id** | `70f2e1b0-e8b7-472e-8f3e-bb59c4b92511` |
| **Created at (UTC)** | `2026-07-14T06:21:38.292185+00:00` |
| **Earliest PITR timestamp (UTC)** | `2026-07-14T06:21:39.292Z` (any time strictly after marker; must remain inside 7d retention) |
| **Tenant** | Evolved Perth `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| **Summary (non-PHI)** | `SMOKETEST-RECOVERY-MARKER-20260714 SMOKETEST-LEAD recovery probe (non-PHI)` |
| **Seed script** | `scripts/seed-blk-sec-01-recovery-marker.ts` (`--commit`) |

### Legacy (superseded for 7-day PITR)

| Field | Value |
|-------|-------|
| Marker ID | `SMOKETEST-JOURNEY-001-20260630` |
| Lead id | `66b47348-bf0e-48b7-a188-accbee0db4a3` |
| Created at (UTC) | `2026-06-30T12:26:30.431814+00:00` |
| Status | Outside 7-day PITR as of 2026-07-14 — not used for this drill |

**Pre-restore verify artifact:**  
`docs/production/evidence/attachments/blk-sec-01-recovery-marker-verify.json`  
**Seed artifact:**  
`docs/production/evidence/attachments/blk-sec-01-recovery-marker-seed.json`  
**Staging SQL:**  
`docs/production/evidence/attachments/blk-sec-01-recovery-marker-verify.sql`

---

## Command used (production)

Insert (once):

```text
node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/seed-blk-sec-01-recovery-marker.ts --commit
```

Verify (read-only):

```text
node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/verify-blk-sec-01-recovery-marker.ts
```

Result: **PASS** (primary marker) against host `iqqvzgxoimxchhcnbzxl.supabase.co`.

---

## Post-restore check (staging SQL editor only)

After DB restore into isolated staging, run:

```sql
-- BLK-SEC-01 primary recovery marker (non-PHI)
SELECT id, tenant_id, left(summary, 100) AS summary_prefix, created_at
FROM public.fi_crm_leads
WHERE id = '70f2e1b0-e8b7-472e-8f3e-bb59c4b92511'
   OR summary ILIKE 'SMOKETEST-RECOVERY-MARKER-20260714%';
```

Or point staging env at the verify script and re-run it.

Also paste walkthrough § B2 row-count sample into the drill log.

---

## Next operator step (E4)

1. Note a **source PITR timestamp (UTC) after `2026-07-14T06:21:38.292Z`** and **still inside the 7-day retention window** (do not extend retention for this drill).
2. Restore / clone **production DB into a new isolated staging project only** (never restore onto production).
3. In **staging**, confirm the marker SQL / verify script returns Pass; capture screenshot + rowcounts per walkthrough Phase B.
4. Continue E5 storage restore at an aligned timestamp.
