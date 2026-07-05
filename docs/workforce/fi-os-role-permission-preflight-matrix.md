# FI OS Role Permission Preflight Matrix (D6G-G0)

Internal preflight gate before **FI-UX-REBUILD D6G-G** staff go-live navigation smoke/audit.

**Generated from:** `runFiOsRolePermissionPreflightAudit()` in `src/lib/fiOs/navigation/fiOsRolePermissionPreflightAudit.ts`

**Verification:** `FI_TEST_ROOTS=src/lib/fiOs npm run test:unit`

## Permission layers audited

1. **Stage 3.5 feature templates** — per-position-type UI visibility (`reception_default`, `nurse_default`, etc.)
2. **SA-1 staff access modules** — route/mutation guards (`workforce_os`, `surgery_os`, `analytics_os`, etc.)
3. **Primary rail (six slots)** — Today · Calendar · Patients · Team · Reports · More
4. **More drawer** — staff-safe vs admin surfaces
5. **Route feature gates** — `resolveFiFeatureRouteDecision` + SA-1 `moduleSatisfies`

## Matrix (all scenarios PASS)

| Role | Primary rail | Front Desk | Surgery | Team | Reports | Admin/intelligence | Mutations | Risk notes | Pass/fail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| receptionist | Today · Calendar · Patients · Team(off) · Reports(off) | yes | no | no | no | none | read-only | — | PASS |
| clinical_staff | Today · Calendar · Patients · Team(off) · Reports(off) | yes | workflow | no | no | none | read-only | — | PASS |
| surgical_assistant | Today · Calendar · Patients · Team(off) · Reports(off) | yes | workflow | no | no | none | read-only | — | PASS |
| surgeon | Today · Calendar · Patients · Team(off) · Reports(off) | yes | workflow | no | no | none | surgery | — | PASS |
| manager | Today · Calendar · Patients · Team · Reports(off) | yes | workflow | manage | analytics | admin surfaces | roster/staff, reports | — | PASS |
| finance_admin | Today · Calendar(off) · Patients(off) · Team · Reports | yes | workflow | manage | analytics | none | roster/staff, reports | — | PASS |
| platform_admin | Today · Calendar · Patients · Team · Reports | yes | workflow | manage | analytics | admin surfaces | roster/staff, surgery, reports | — | PASS |

## Safe fix applied (D6G-G0)

**Primary rail alignment:** When Team or Reports sidebar targets are filtered out by feature/SA-1 permissions, the corresponding rail slots are now **disabled** (with hint) instead of remaining clickable with fallback hrefs. Route gates were already correct; this narrows nav/route mismatch.

## D6G-G0B — Staff capability overrides (G0B)

**Principle:** Role + explicit SA-1 tab grants — never role inflation.

Example: receptionist + `workforce_os` / `tab_key: roster` / `access_level: edit` grants `roster.manage` without manager role or identity admin.

| Capability | SA-1 grant | Nav / route / mutation |
| --- | --- | --- |
| `roster.manage` | `workforce_os` + tab `roster` edit | Team rail enabled, roster tab, roster mutations |
| `roster.standard_hours.manage` | tab `standard_hours` edit OR inherits from `roster.manage` | Standard hours mutations |
| `team.identity.manage` | tab `identity` edit OR module edit | Identity tab + HR manage actions |

**Audit:** `upsertStaffAccessGrantAction` writes `fi_staff_access_audit_log` with reason, approver (`granted_by`), timestamp.

**Resolver chain (single source):** `staffCapabilityCore` → `staffTeamAccessCore` → nav overrides, team layout, page gates, `resolveStaffStandardHoursManageCapability`.

**Override scenario:** `receptionist_roster_override` in preflight audit — PASS.

## Known architectural notes (no change in this ticket)

- **Three role vocabularies:** OS roles (`fi_doctor`), workspace profiles (`surgeon`), SA-1 keys (`doctor`/`reception`). `normalizeStaffRoleKey("surgeon")` → `doctor`.
- **Dual enforcement:** Stage 2 feature keys + SA-1 modules both affect nav; layout merges SA-1 onto Stage 2 via `computeStaffAccessNavFeatureOverrides`.
- **SA-1 nav overlay gap:** `financial_os`, `platform_progress`, `investor_dashboard` not mapped to feature keys — finance routes rely on template + tenant admin blocks.
- **Admin intelligence routes** (`/intelligence/*`, `/reports/admin`): page-level `canViewFiOsNavigationAudit` gate in addition to feature map.
- **SA-1 route guards:** production-only (`NODE_ENV !== "production"` → noop in dev).

## Out of scope (unchanged)

Calendar internals, workspace route implementations, roster mutation behaviour (except permission alignment), staff invite flow, HairAudit, ImagingOS, Surgery Intelligence data contracts, analytics event publishing.
