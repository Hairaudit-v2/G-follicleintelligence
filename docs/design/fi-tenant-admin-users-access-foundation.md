# Admin Users & Backend Access Foundation

**Stage:** Foundation (tenant-scoped, non-clinical platform access)  
**Status:** Implemented — see migrations, server actions, and `/fi-admin/[tenantId]/settings/admin-users`.

## Problem statement

The platform historically assumed most tenant users map to **clinical / operational staff** (`fi_staff`, rosters, calendars). Many real users need **dashboards and settings** without being on surgery teams or HR rosters — e.g. CFO, accountants, operations managers, compliance officers, owners, investors.

## Architecture: two independent concepts

| Concept | Represents | Typical examples | Consumed by |
| --- | --- | --- | --- |
| **Staff profile** | Employment and clinical participation | Doctor, nurse, technician, receptionist, consultant | Rostering, calendar columns, surgical teams, HR import, training |
| **Access user** (tenant admin) | Platform permissions for trusted backend personas | CFO, operations manager, owner, auditor, investor (read-only), compliance | FI Admin shell, settings, reporting, analytics, security-oriented surfaces |

**Independence (non-negotiable):**

- A person may be **staff only**, **admin only**, or **both** — the data model does not merge these into one row.
- **Removing** or archiving a **staff** record **must not** remove `fi_tenant_admin_users` access (and vice versa: revoking admin access does not touch `fi_staff`).
- Admin invites use the existing **Supabase Auth** + **`fi_users`** tenant membership model — **no second authentication system**.

## Data model (Supabase)

| Table | Role |
| --- | --- |
| `fi_users` | One row per person per tenant; `auth_user_id` links to Supabase Auth. Invited admins are created or updated with `role = tenant_backend` when they are backend-only personas (see invite action). |
| `fi_tenant_admin_users` | One row per tenant per `fi_user_id`: `admin_role`, `status` (`invited` \| `active` \| `suspended`), optional `display_name`, `access_notes`, `invited_by_fi_user_id`. **Unique** `(tenant_id, fi_user_id)`. |
| `fi_tenant_admin_audit_events` | Append-only audit; `event_kind` values below. |

Migrations:

- `supabase/migrations/20260704120001_fi_tenant_admin_users.sql` — core tables + `fi_admin_lookup_auth_user_id_by_email` (service role only).
- `supabase/migrations/20260708120001_fi_tenant_admin_audit_admin_user_removed.sql` — extends audit `event_kind` with `admin_user.removed`.

RLS: enabled on these tables; **no** broad `authenticated` DML — server uses **service role** in Next.js after gate checks (service role is never exposed to the browser).

## Roles and capabilities

Roles are enforced in application code (`src/lib/tenantAdmin/tenantAdminRoles.ts`, CRM shell helpers, FI OS sidebar). Human-readable blurbs: `FI_TENANT_ADMIN_ROLE_CAPABILITIES`.

| Role | Intent |
| --- | --- |
| `clinic_admin` | Full clinic settings, user management (this screen), reporting, dashboards |
| `finance_admin` | Revenue, invoices, payments, finance reporting |
| `operations_admin` | Tasks, workflow, reminders, scheduling operations |
| `dashboard_viewer` | Read-only analytics (e.g. investor-style visibility) |
| `data_safety_admin` | Audit logs, security review, compliance monitoring |

**Who can manage Admin Users:** legacy tenant roles `admin` / `fi_admin`, active `clinic_admin` on `fi_tenant_admin_users`, or FI platform admin full session (`getTenantAdminUsersManageAllowed`).

## Portal gate (`tenant_backend`)

Users with `fi_users.role = tenant_backend` must have a matching **`fi_tenant_admin_users`** row that is not `suspended`. Invited users may enter the tenant shell after email confirmation or first sign-in; the gate can promote `invited` → `active` (`assertFiTenantPortalAccess` + `assertTenantBackendPortalAllowed` in `src/lib/fiOs/fiOsPortalGate.server.ts`).

## UI

- **Route:** `/fi-admin/[tenantId]/settings/admin-users`
- **Nav label:** Admin Users (secondary strip + shell Settings module)
- **Table columns:** Name, Email, Role, Status, Last login, Created, Actions
- **Actions:** Invite user, change role (inline select), Suspend / Reactivate, Revoke access (deletes `fi_tenant_admin_users` row only)

Components: `src/components/fi-admin/settings/TenantAdminUsersSection.tsx`  
Server actions: `lib/actions/fi-tenant-admin-actions.ts`

## Audit events

| `event_kind` | When |
| --- | --- |
| `admin_user.invited` | After successful insert of `fi_tenant_admin_users` |
| `admin_user.role_changed` | Role updated |
| `admin_user.suspended` | Status set to suspended |
| `admin_user.reactivated` | Status restored to invited/active |
| `admin_user.removed` | Row deleted (revoke); `fi_users` and `fi_staff` unchanged |

Insert helper: `src/lib/tenantAdmin/tenantAdminAudit.server.ts`

## Related code (bookmark)

- `src/lib/tenantAdmin/tenantAdminProfile.server.ts` — load rows, session admin profile, last login
- `src/lib/crm/crmShellAccess.ts` — combines legacy `fi_users.role` with tenant admin role for CRM / bookings / analytics nav
- `src/lib/fiAdmin/fiOsShellPrimaryNav.ts` — sidebar clinical blocks per backend admin persona
