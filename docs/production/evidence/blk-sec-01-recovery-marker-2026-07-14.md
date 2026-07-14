# BLK-SEC-01 — Recovery marker (E4 prep)

**Drill:** Restore drill E4–E6  
**Date registered (UTC):** 2026-07-14T06:12:54.325Z  
**Environment:** Production (read-only verify only — no restore, no new PHI writes)  
**Operator:** Platform / infra (FI agent)

---

## Finding (runbook search)

There is **no** separate `recovery_marker` / `fi_drill_*` table or insert script in:

- `docs/runbooks/fi-os-supabase-backup-setup.md`
- `docs/runbooks/fi-os-storage-backup-restore-drill.md`
- `docs/production/evidence/backup-disaster-recovery-audit.md`
- `docs/audits/fi-blk-sec-01-restore-drill-walkthrough.md`

Runbooks prescribe: restore production backup/PITR into **isolated staging**, then verify with **non-PHI / synthetic** row samples (`SMOKETEST-` convention). They do **not** authorize a new production insert-before-restore procedure.

---

## Marker chosen (canonical synthetic probe)

Use the existing Evolved **SMOKETEST journey** rows already seated on production (2026-06-30), which will appear in any PITR/backup restore taken **after** that write time.

| Field | Value |
|-------|-------|
| **Marker ID** | `SMOKETEST-JOURNEY-001-20260630` |
| **Primary table** | `public.fi_crm_leads` |
| **Primary row id** | `66b47348-bf0e-48b7-a188-accbee0db4a3` |
| **Created at (UTC)** | `2026-06-30T12:26:30.431814+00:00` |
| **Tenant** | Evolved Perth `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| **Summary (non-PHI)** | `SMOKETEST-JOURNEY-001-20260630 SMOKETEST-LEAD-001` |

### Cross-check rows (same journey)

| Table | id | created_at (UTC) |
|-------|----|------------------|
| `fi_patients` | `51a44cf6-e4de-4282-960c-be220909f9a0` | `2026-06-30T12:26:41.461381+00:00` |
| `fi_cases` | `efa25110-9dbc-4599-8fbd-3670e8921efd` | `2026-06-30T12:26:42.237155+00:00` |
| `fi_bookings` | `f53f63aa-3d8a-4e36-9646-f26dd5e16af9` | `2026-06-30T12:26:45.267003+00:00` |

**Pre-restore verify artifact:**  
`docs/production/evidence/attachments/blk-sec-01-recovery-marker-verify.json`  
**Source manifest:**  
`docs/production/evidence/attachments/smoketest-journey-manifest-2026-06-30.json`

---

## Command used (production, read-only)

```text
node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/verify-blk-sec-01-recovery-marker.ts
```

Result: **PASS** against host `iqqvzgxoimxchhcnbzxl.supabase.co`.

---

## Post-restore check (staging SQL editor only)

After DB restore into isolated staging, run:

```sql
-- BLK-SEC-01 recovery marker (non-PHI)
SELECT id, tenant_id, left(summary, 80) AS summary_prefix, created_at
FROM public.fi_crm_leads
WHERE id = '66b47348-bf0e-48b7-a188-accbee0db4a3';

SELECT 'fi_patients' AS t, id, created_at FROM public.fi_patients
WHERE id = '51a44cf6-e4de-4282-960c-be220909f9a0'
UNION ALL
SELECT 'fi_cases', id, created_at FROM public.fi_cases
WHERE id = 'efa25110-9dbc-4599-8fbd-3670e8921efd'
UNION ALL
SELECT 'fi_bookings', id, created_at FROM public.fi_bookings
WHERE id = 'f53f63aa-3d8a-4e36-9646-f26dd5e16af9';
```

Or point staging env at the verify script and re-run it.

Also paste walkthrough § B2 row-count sample into the drill log.

---

## Next operator step (E4)

1. Note a **source backup / PITR timestamp (UTC) ≥ marker created_at** (after `2026-06-30T12:26:45Z`).
2. Restore / clone **production DB into a new isolated staging project only** (never restore onto production).
3. In **staging**, confirm the marker SQL / verify script returns Pass; capture screenshot + rowcounts per walkthrough Phase B.
4. Continue E5 storage restore at an aligned timestamp.
