# FI OS Role Permission Preflight Matrix (D6G-G0 / D6G-G0B)

Internal preflight gate before **FI-UX-REBUILD D6G-G** staff go-live navigation smoke/audit.

**Generated from:** `runFiOsRolePermissionPreflightAudit()` in `src/lib/fiOs/navigation/fiOsRolePermissionPreflightAudit.ts`

**Verification:**

```bash
FI_TEST_ROOTS=src/lib/fiOs,src/lib/staffAccess npm run test:unit
pnpm typecheck
```

## Permission layers audited

1. **Stage 3.5 feature templates** — per-position-type UI visibility (`reception_default`, `nurse_default`, etc.)
2. **SA-1 staff access modules** — route/mutation guards (`workforce_os`, `surgery_os`, `analytics_os`, etc.)
3. **D6G-G0B staff capability overrides** — explicit SA-1 tab grants → capability keys (never role inflation)
4. **Primary rail (six slots)** — Today · Calendar · Patients · Team · Reports · More
5. **More drawer** — staff-safe vs admin surfaces
6. **Route feature gates** — `resolveFiFeatureRouteDecision` + SA-1 `moduleSatisfies`

## Matrix (all scenarios PASS)

| Role | Primary rail | Front Desk | Surgery | Team | Reports | Admin/intelligence | Mutations | Risk notes | Pass/fail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| receptionist | Today · Calendar · Patients · Team(off) · Reports(off) | yes | no | no | no | none | read-only | — | PASS |
| receptionist + roster.manage | Today · Calendar · Patients · Team(on) · Reports(off) | yes | no | roster only | no | none | roster manage | no identity/admin | PASS |
| clinical_staff | Today · Calendar · Patients · Team(off) · Reports(off) | yes | workflow | no | no | none | read-only | — | PASS |
| surgical_assistant | Today · Calendar · Patients · Team(off) · Reports(off) | yes | workflow | no | no | none | read-only | — | PASS |
| surgeon | Today · Calendar · Patients · Team(off) · Reports(off) | yes | workflow | no | no | none | surgery | — | PASS |
| manager | Today · Calendar · Patients · Team · Reports(off) | yes | workflow | manage | analytics | admin surfaces | roster/staff, reports | — | PASS |
| finance_admin | Today · Calendar(off) · Patients(off) · Team · Reports | yes | workflow | manage | analytics | none | roster/staff, reports | — | PASS |
| platform_admin | Today · Calendar · Patients · Team · Reports | yes | workflow | manage | analytics | admin surfaces | roster/staff, surgery, reports | — | PASS |

## Safe fix applied (D6G-G0)

**Primary rail alignment:** When Team or Reports sidebar targets are filtered out by feature/SA-1 permissions, the corresponding rail slots are now **disabled** (with hint) instead of remaining clickable with fallback hrefs. Route gates were already correct; this narrows nav/route mismatch.

---

## D6G-G0B — Staff capability overrides (role exceptions)

### Principle

Base role templates stay **conservative**. Real-world exceptions use:

**Role + explicit approved SA-1 grant (capability override)** — never role inflation, never temporary full access.

### Example: roster-responsible receptionist

| Field | Value |
| --- | --- |
| Base role | Receptionist (`reception`) |
| Override grant | `workforce_os` / `tab_key: roster` / `access_level: edit` |
| Derived capabilities | `roster.view`, `roster.manage`, `roster.standard_hours.manage` (policy inheritance) |
| Still blocked | Identity & access, Reports admin, D6 intelligence, surgery admin, graft tray admin |

#### What becomes allowed

| Surface | Behaviour |
| --- | --- |
| Team rail | Enabled (staff nav feature unblocked) |
| Team → Roster | Visible + route accessible |
| Roster mutations | Allowed (`assertHrOsRosterManageAllowed` via `roster.manage`) |
| Standard hours | Allowed under current policy (inherits from `roster.manage`) |

#### What stays blocked

| Surface | Behaviour |
| --- | --- |
| Team → Identity & access | Hidden / denied |
| Identity audit | Denied |
| Staff access admin | Denied |
| Reports admin | Denied |
| `/intelligence/*` | Denied |
| Surgery intelligence / graft tray admin | Denied |
| Becoming clinic manager/admin | **No** |

#### View-only variant (`roster.view`)

| Grant | Capabilities | Can view roster | Can mutate roster | Standard hours |
| --- | --- | --- | --- | --- |
| `tab_key: roster`, `access_level: read` | `roster.view` only | yes | no | no |

### Capability map

| Capability | SA-1 grant | Nav / route / mutation |
| --- | --- | --- |
| `roster.view` | `workforce_os` + tab `roster` **read** | Team rail, roster tab (read) |
| `roster.manage` | `workforce_os` + tab `roster` **edit** | Roster mutations; implies view + standard hours (policy) |
| `roster.standard_hours.manage` | tab `standard_hours` edit **or** inherits from `roster.manage` | Standard hours mutations |
| `team.identity.manage` | tab `identity` edit OR module edit | Identity tab + HR manage actions |

### Precedence

1. **Admin override** (clinic/platform admin principal) → full module admin  
2. **Explicit grant** (including `access_level: none` as suppress)  
3. **Role template**  
4. **Revoked** (`revoked_at`) and **expired** (`expires_at` ≤ now) grants are ignored  
5. No separate deny-effect enum — use `access_level: none` or revoke  

### Audit trail

`upsertStaffAccessGrantAction` / `revokeStaffAccessGrantAction` write `fi_staff_access_audit_log` with:

- tenant_id, staff_member_id  
- module_key, tab_key  
- action: grant_created / grant_updated / grant_revoked  
- reason, approver (`changed_by` / `granted_by`)  
- previous_access / new_access  
- **metadata.capability_keys** — derived capability keys for the grant  
- **metadata.action_kind** — `capability_override_granted` on create/update  

### Resolver chain (single source)

```
fi_staff_access_grants (tenant-scoped)
  → computeEffectiveAccess (revoked/expired filtered)
  → staffCapabilitySatisfies / resolveEffectiveStaffPermissions
  → nav (Team rail, More drawer, TeamSubNav)
  → route gates (assertTeamTabAccessOrNotFound, team layout)
  → server actions (assertHrOsRosterManageAllowed, standard hours gate)
```

**Facade:** `resolveEffectiveStaffPermissions` / `resolveEffectiveStaffPermissionsFromInput` in  
`src/lib/staffAccess/staffEffectivePermissionsCore.ts`

### Data model (existing + G0B additive)

| Store | Role |
| --- | --- |
| `fi_staff_access_grants` | Per-staff module/tab grants (capability overrides) |
| `expires_at` column (G0B) | Optional grant expiry |
| `fi_staff_access_audit_log` | Grant/revoke audit |

No separate `capability_override` table — capabilities are **derived** from grants.

### Override scenario in automated audit

Persona `receptionist_roster_override` in `PREFLIGHT_ROLE_SCENARIOS` — PASS.

---

## Known architectural notes (no change in this ticket)

- **Three role vocabularies:** OS roles (`fi_doctor`), workspace profiles (`surgeon`), SA-1 keys (`doctor`/`reception`). `normalizeStaffRoleKey("surgeon")` → `doctor`.
- **Dual enforcement:** Stage 2 feature keys + SA-1 modules both affect nav; layout merges SA-1 onto Stage 2 via `computeStaffAccessNavFeatureOverrides`.
- **SA-1 nav overlay gap:** `financial_os`, `platform_progress`, `investor_dashboard` not mapped to feature keys — finance routes rely on template + tenant admin blocks.
- **Admin intelligence routes** (`/intelligence/*`, `/reports/admin`): page-level `canViewFiOsNavigationAudit` gate in addition to feature map.
- **SA-1 route guards:** production-only (`NODE_ENV !== "production"` → noop in dev).

## Out of scope (unchanged)

Calendar internals, workspace route implementations, roster mutation behaviour (except permission alignment), staff invite flow, HairAudit, ImagingOS, Surgery Intelligence data contracts, analytics event publishing, large new permissions admin UI.
