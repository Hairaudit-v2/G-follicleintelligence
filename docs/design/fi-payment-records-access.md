# Manual payment records (`fi_payment_records`) — access model

## Server actions and service role

Create/update flows run through Next.js server actions that call `supabaseAdmin()` (service role). **RLS is not the enforcement layer for these writes**; the service role bypasses RLS. Authorisation is enforced in application code via `assertPaymentRecordWriteAllowed` in `paymentRecordAccess.server.ts`:

- Optional `FI_ADMIN_API_KEY` body/header pattern (same as other FI admin actions).
- Otherwise: signed-in user must map to an `fi_users` row for the tenant with `role` in `PAYMENT_MUTATION_ROLES_LOWER` (`fi_admin`, `admin`, `manager`, `finance`, `owner`).
- **`crm_operator` is not** in that set — CRM operators cannot mutate payment rows through these actions even though they may mutate CRM entities under `assertCrmTenantWriteAllowed`.
- **Staff PIN clinic sessions** are rejected for all payment mutations (`rejectStaffPinSessionForRestrictedMutation`), regardless of underlying `fi_users.role`. This matches other “restricted while PIN is active” mutations (see `staffPinMutationGuard.test.ts`).

## Postgres RLS (direct Supabase client / future paths)

Policies on `fi_payment_records` mirror the same **finance-capable `fi_users.role` list** for `insert` and `update`. They do **not** consult `fi_tenant_admin_users` or other capability tables. If product later grants finance-style capabilities without changing `fi_users.role`, **RLS would still block** direct authenticated writes until roles or policies are aligned.

## Audit fields

`recorded_by` and `recorded_at` are set on **insert only** and are intentionally **not** updated on status or amount patches (see `paymentRecordMutations.server.ts`).
