# FI-TRUST-LANDING-AND-SPINE-1

**Status:** Implemented  
**Date:** 2026-07-13  
**Parent:** FI-PLATFORM-READINESS-AUDIT-1 Phase 1  

## Goal

Final structural closeout of the UX rebuild and first **Operational Trust and Cohesion** milestone. No new modules.

## Delivered

| Item | Change |
| ---- | ------ |
| Role landing | Post-login defaults to role homes (Front desk / Pipeline / Doctor / Money / Today) — **not** `/cases` |
| Frontline nav | Primary rail: **Today · Calendar · Patients · Front desk · Team · More** |
| Pipeline | `/leadflow` soft-redirects to `/crm`; board H-scroll contained (`pipeline-board-h-scroll`) |
| Money | Finances → **Money**; payments inbox only as **Take payment** sub-link when `FI_PAYMENTS_ENABLED`; honest disabled page |
| Staff mapping | `npm run audit:staff-mapping`; enforced in `smoke:operational-day` and `smoke:prod` when Supabase env is set |
| Golden patient | Spine contract + unit tests (`goldenPatientSpineCore`) |

## Key files

- `src/lib/fiOs/fiOsRoleLandingCore.ts`
- `src/lib/fiOs/fiOsRedirect.server.ts`
- `src/lib/workforce/staffTenantLinkRepairCore.ts` (`defaultTenantHomeSuffix`)
- `src/lib/fiAdmin/fiOsMinimalNav.ts`
- `src/lib/fiOs/navigation/fiOsNavigationRegroupingCore.ts`
- `src/lib/fiAdmin/fiOsShellPrimaryNav.ts`
- `app/(fi-admin)/fi-admin/[tenantId]/leadflow/page.tsx`
- `app/(fi-admin)/fi-admin/[tenantId]/payments/page.tsx`
- `src/lib/patients/goldenPatientSpineCore.ts`
- `scripts/audit-staff-mapping-completeness.ts`
- `docs/fi-os-access-production.md` (redirect table)

## Verification

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/fiOs/fiOsRoleLandingCore.test.ts \
  src/lib/patients/goldenPatientSpineCore.test.ts \
  src/lib/fiAdmin/fiOsMinimalNav.test.ts \
  src/lib/fiOs/navigation/fiOsNavigationGoLiveAudit.test.ts \
  src/lib/crm/pipelineCutover.s45d.test.ts
# npm run audit:staff-mapping
# npm run smoke:operational-day   # includes staff mapping tier when Supabase env is set
```

## Explicit non-goals (still later)

- Procedure day product enablement  
- Full Money tree rewrite  
- Pipeline V1 global cutover (allowlist remains)  
- New OS modules  
