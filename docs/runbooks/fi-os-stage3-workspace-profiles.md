# FI OS Stage 3 — Adaptive workspace profiles

Concise reference for developers operating or extending the tenant home (“clinic operating centre”) layout.

## What Stage 3 adds

- **Workspace profiles** — personas (director, surgeon, reception, etc.) that suggest **home widget order** and **quick-action order**.
- **`fi_staff.staff_metadata`** — optional JSON; **`workspace_profile`** stores a manual override (see migration below).
- **Pure composers** — `workspaceDashboardComposer` and `workspaceQuickActionsComposer` merge profile defaults with existing **Stage 2** feature visibility; **no new RBAC** and **no route-guard changes**.
- **Placeholders** — extra dashboard tiles (e.g. analytics summary) are thin shells until dedicated loaders exist (Stage 4+).

Source of truth in code: `src/config/fiWorkspaceProfiles.ts`, `src/lib/fi-os/workspaceProfileDerivation.ts`, `src/lib/fi-os/workspaceProfile.server.ts`, `src/lib/fi-os/workspaceDashboardComposer.ts`, `src/lib/fi-os/workspaceQuickActionsComposer.ts`.

## Workspace profile list

Registry keys: `director`, `clinic_manager`, `surgeon`, `doctor`, `nurse`, `consultant`, `reception`, `academy_trainer`, `auditor`, `platform_admin`, **`default`**.

- **`default`** — same home stack order as Stage 1/2 (`FI_DASHBOARD_HOME_WIDGET_ORDER`); no badge on home.
- **`platform_admin`** — derived from OS identity only; **not** assignable on staff rows (ignored if present in JSON).

Staff admin UI dropdown uses `FI_WORKSPACE_PROFILE_ADMIN_DROPDOWN_KEYS` (excludes implicit `platform_admin`).

## Automatic derivation order

For the signed-in viewer on a tenant, **`resolveWorkspaceProfileKeyFromSignals`** applies, in order:

1. **Explicit** — `staff_metadata.workspace_profile` if set and valid (not `default`, not stored `platform_admin`).
2. **`fi_staff.staff_role`** — substring heuristics (e.g. “surgeon”, “nurse”, “reception”, “manager” → `clinic_manager`). **Best-effort** until structured job codes exist.
3. **Tenant backend admin** — `fi_tenant_admin_users.admin_role` when active for this tenant + user, e.g. `clinic_admin` / `finance_admin` → `director`, `operations_admin` → `clinic_manager`, `data_safety_admin` → `auditor`.
4. **FI OS role** — `fi_platform_admin` → `platform_admin`; `fi_auditor` → `auditor`.
5. **`default`** — if nothing above applies.

Missing `fi_staff` row does not throw; derivation continues with later steps.

## Manual override behaviour

- **Where:** Staff directory → edit staff → **Workspace profile (FI OS)** (same area as Stage 2 feature access for users who can manage it).
- **“Default (automatic)”** — clears `workspace_profile` from `staff_metadata` so derivation uses roles/heuristics again.
- **Persistence:** Server action updates **`fi_staff.staff_metadata`** (merge, not full-row replace of unrelated keys). Same **mutation gate** as staff feature access patches (`assertStaffFeatureAccessMutationAllowed`).

## How Stage 2 feature visibility still wins

- **Widgets:** Each tile is still gated by `fiDashboardWidgetVisibleByFeatureAccess` in `workspaceDashboardComposer` after profile ordering. If a feature is off for that staff member, the tile is dropped even if the profile lists it.
- **Quick actions:** After profile reorder, `filterResolvedQuickActionsByFeatureAccess` runs as before; CRM/bookings **disabled** rows (shell flags) remain in the list but disabled.

Profile = **layout suggestion**; **`fi_staff_feature_access`** overrides = **visibility**.

## UI-only vs server-enforced

| Concern | Stage 3 behaviour |
|--------|-------------------|
| Workspace profile / widget order / quick-action order | **UI / UX only** — discoverability and layout. |
| Route access, API auth, CRM gates | **Unchanged** — existing server enforcement and RBAC stay authoritative. |
| Stage 2 feature toggles | **UI visibility** for nav, home modules, quick actions; **not** a new security boundary. |

Do not rely on workspace profile or feature visibility alone for sensitive operations.

## How to test as different staff profiles

1. **Automatic:** Use a test tenant with `fi_staff` rows whose `staff_role` strings match heuristics, or link a user to an active `fi_tenant_admin_users` row, or use an OS test account (`fi_platform_admin` / `fi_auditor`) as applicable.
2. **Manual:** In staff UI, set **Workspace profile** to the persona you want, save, open **`/fi-admin/[tenantId]`** (home) and confirm widget order, quick-action order, optional **Workspace:** badge, and empty-state hints on **My workspace**.
3. **Stage 2 interaction:** Toggle a feature off for that staff (e.g. analytics) and confirm related tiles disappear even if the profile would show them.

## Migration requirement (production)

Apply migration **`20260612120002_fi_staff_staff_metadata.sql`** before relying on workspace overrides or any code path that reads/writes **`fi_staff.staff_metadata`**. Without it, staff updates selecting `staff_metadata` will fail at the database.

## Known TODOs (Stage 4+)

- **Route-level feature enforcement** — align deep links with the same rules as nav/home.
- **Audit trail** — who changed feature visibility / workspace profile and when.
- **Tenant defaults** — default workspace for new staff or tenant-wide presets.
- **Real widgets** — replace Stage 3 placeholder tiles with loaders and data.
- **Structured HR job codes** — replace `staff_role` substring heuristics with normalized job type / HR sync fields when the schema supports it.
