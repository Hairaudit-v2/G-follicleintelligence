# FI-WORKFORCE-LIVE-DATA-CLEANUP-1 — Evolved tenant Workforce/Roster live data hygiene

**Status:** Executed 2026-07-06 (approved). All post-execute payload checks passed (18/18).
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a`
**Follows:** FI workforce lifecycle stabilisation (commit `8666974f`).

## Tooling

`scripts/fi-workforce-live-data-cleanup-1.ts` — dry-run by default, writes only with `--execute`.
No hard deletes anywhere; every write is precondition-guarded on current row state and emits a
`fi_staff_member_audit_events` row (`source: fi_workforce_live_data_cleanup_1`) with before/after
metadata. Prints BEFORE report always and AFTER report post-execute.

Run:

```
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs \
  scripts/fi-workforce-live-data-cleanup-1.ts            # dry-run
  ... --execute                                          # apply (after approval)
```

(On this network Node needs `NODE_EXTRA_CA_CERTS` pointing at an exported system-root PEM.)

## Dry-run findings (2026-07-06)

- **A. Lifecycle drift** (`is_active=true` but HR terminated/archived): Anita Cottee (on_leave+archived),
  Clara Quinn, Daniel Bullen, Hannah Anne Geneve, Stacey Roberts (all terminated+archived).
- **B. Duplicate groups:** Dr Seetal (canonical `235062fc`, duplicate `ba6839c8`);
  Paul Green (canonical `a039ad7d`, duplicate `ff93d9e3` PAUL GREEN).
- **C. Archived HR rows with stale `employment_status='active'`:** Dr Seetal `fcaf4cd7`,
  PAUL GREEN `a7b17dbf`.
- **D. Leadership stuck pending onboarding:** Paul Green (owner) `b5edae32`.
- **E. Contradictions:** Anita Cottee `e13edbee` — on_leave AND archived.

## Writes applied (2026-07-06, all audited under `source=fi_workforce_live_data_cleanup_1`)

1. `fi_staff.is_active=false` — Clara Quinn `88daa5be`, Daniel Bullen `0b6b9ff2`,
   Hannah Geneve `631ca59d`, Stacey Roberts `beeb8b74` (each guarded: name match, still
   `is_active=true`, HR still terminated/archived) + audit event per member.
2. Old Dr Seetal duplicate merged via the **archived-source targeted path** (the
   `workforce_merge_staff_members` RPC requires live rows and would have re-pointed the
   duplicate's shifts onto the canonical record, double-booking Jul 6–10 — the canonical
   record already held identical standard-hours shifts):
   - 5 duplicate scheduled shifts on fi_staff `ba6839c8` soft-cancelled (`status='cancelled'`,
     ids in audit metadata; reversible).
   - identity link `iiohr_hr/995c370c…` moved to canonical member `9087c9c3` (prevents the
     sync feed re-creating the duplicate).
   - member `fcaf4cd7` → `employment_status='merged'`, `merged_into=9087c9c3`, `merged_at` set.
3. PAUL GREEN member `a7b17dbf` → `employment_status='inactive'` + reason (already archived;
   stale `active` cleared). True merge deliberately **not** automated — two candidate canonical
   Paul records exist ("Paul"/Manager `f9e0bfdf`, "Paul Green"/owner `a039ad7d`); resolve the
   target in HR OS Duplicate Review.

7 audit rows written to `fi_staff_member_audit_events`. No deletes.

Review-only (no automation): Anita Cottee on_leave+archived (restore if on leave, offboard if
departed); Paul Green owner `pending_onboarding` (complete via Onboarding Centre / Manage Employment).

## Roster manage access (verified per staff via capability engine)

| Login | Path | Result |
| --- | --- | --- |
| connorgreen0310@icloud.com | tenant_admin `clinic_admin` | **manage** |
| manager@evolvedhair.com.au | staff_role `Manager` → `manager` role template (workforce_os edit) | **manage** (corrects earlier "denied" assessment) |
| paul@evolvedhair.com.au | staff_role `owner` → `owner` role template (workforce_os admin) | **manage** (corrects earlier "denied" assessment) |
| all other staff | — | view-only (see banner) |

Targeted non-admin grant for anyone else who needs roster editing (no full admin):

```sql
INSERT INTO fi_staff_access_grants
  (tenant_id, staff_member_id, module_key, tab_key, access_level, scope)
VALUES
  ('c2615b95-b707-4485-aa5f-be8f78ec868a', '<fi_staff.id>', 'workforce_os', 'roster', 'edit', 'tenant');
```

This grants exactly `roster.manage` + `roster.standard_hours.manage` (behaviour locked by
`staffCapabilityCore.test.ts`) and Team workspace entry — nothing else. No broad admin roles granted.

## Post-execute verification (2026-07-06 — 18/18 checks passed via real loaders)

- [x] Section C (stale active on archived rows) empty; section A reduced to Anita (review-only).
- [x] Roster grid + eligibility exclude all four terminated staff.
- [x] Exactly one Dr Seetal in the roster grid (canonical `235062fc`); old duplicate excluded;
      all live Dr Seetal shifts belong to the canonical record.
- [x] Directory lifecycle labels: Clara/Daniel/Hannah/Stacey → Terminated (not Active);
      old Dr Seetal row flagged duplicate of canonical.
- [x] Active count (8) matches the active-filtered list (8): Connor Green, Danica Miloseski,
      Dr Seetal, Evie Shackleton, Jesica Watt, Paul, Roslyn Richards, Sandra Popadinoski.
- [x] Roster manage: connorgreen0310 (clinic_admin), manager@ (manager template),
      paul@ (owner template); all other staff view-only → see the view-only banner in the UI.

## Outstanding (human decisions)

- Anita Cottee `e13edbee`: on_leave + archived — restore if on maternity leave, offboard if departed.
- Paul Green (owner) `b5edae32`: still `pending_onboarding` — complete via Onboarding Centre.
- PAUL GREEN `ff93d9e3`/`a7b17dbf`: pick merge target in Duplicate Review ("Paul" vs "Paul Green").

## Final status (2026-07-06)

FI-WORKFORCE-ROSTER-STABILISE-P0 (`8666974f`) + FI-WORKFORCE-LIVE-DATA-CLEANUP-1 (`599be182`) are complete.

Staff go-live status:

- Workforce lifecycle/status: **green**
- Directory active counts: **green**
- Duplicate staff protection: **green**
- Roster eligibility: **green**
- Roster manage permissions: **green**
- Remaining manual HR decisions: Anita Cottee, Paul Green onboarding, PAUL GREEN duplicate review
