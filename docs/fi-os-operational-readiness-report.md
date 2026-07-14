# FI OS Operational Readiness Report

Generated: 2026-07-14T09:37:18.046Z

## Summary

- **Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`
- **Base URL:** `http://localhost:3000`
- **Procedure Day flag:** `false`
- **Checks run:** 8
- **Failures:** 0

## Check matrix

| Check | Result | Detail |
|-------|--------|--------|
| http_reception_board_unauth | PASS | status 307 |
| http_procedure_day_hidden | PASS | status 307 (flag off) |
| http_reception_board_api_unauth | PASS | status 401 |
| http_cross_tenant_api | PASS | SKIPPED: FI_SMOKE_OTHER_TENANT_ID not set |
| http_reception_board_api_auth | PASS | payload ok (2 appointments) |
| loader_tier | PASS | loaders completed |
| staff_mapping_audit | PASS | all linked operators have fi_staff + access signal |
| journey_tier | PASS | SKIPPED: pass --execute to run mutations |

## Validation coverage

- Cross-tenant writes: admin key scope + journey probe
- Platform admin writes: CRM gate requires impersonation (unit tests + production rules)
- Reception Board: HTTP API + loader orchestration
- Calendar feed: forbidden-key guard on operational feed items
- Procedure Day: hidden when `FI_PROCEDURE_DAY_ENABLED` is off
- Staff mapping: `audit-staff-mapping-completeness` when Supabase env is set
- Patient Journey: `procedure_completed` after live workflow completion

## Run command

```bash
node scripts/run-fi-operational-day-smoke.mjs
FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1 node scripts/run-fi-operational-day-smoke.mjs --execute
```
