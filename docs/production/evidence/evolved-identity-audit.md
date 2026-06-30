# Evolved Production Evidence — Identity & Provisioning Audit

**Sprint:** FI-PH1 Task 4  
**Blocker:** BLK-SEC-05  
**Audit date:** 2026-06-27  
**Scope:** Evolved tenant provisioning, `fi_users`, `fi_os_identities`, staff PIN, role assignment

---

## Executive summary

| Check | Status |
|-------|--------|
| Tenant provisioning script exists and is idempotent | **Yes** |
| Real Evolved staff provisioning path documented | **Yes** (multiple scripts) |
| Production `fi_users` + `auth.users` linkage verified | **Not verified** (no prod DB access) |
| `assertFiAdminShellAccess` tested with real identities | **Not verified** |
| Staff PIN access model implemented | **Yes** (with mutation guards) |

**Verdict:** BLK-SEC-05 **validated** — tooling exists; **production proof with real staff still missing**.

---

## Provisioning scripts reviewed

### `scripts/provision-evolved-tenant.ts`

**Command:** `pnpm run dev:provision:evolved`

Creates/updates:

- `fi_tenants` (slug default `evolved`)
- `fi_tenant_settings` (timezone `Australia/Perth`, branding)
- CRM pipeline stages, reminder templates
- **Seed** `fi_users` (3× `crm_operator` @ `*.follicleintelligence.local`) — **not real staff**
- **Seed** `fi_staff` (4 fictional roles) with `fi_user_id: null`
- Service catalog (`consultation`, `prp`, `surgery`, `follow_up`)

**Gap:** Does **not** create `auth.users` or link real emails. Console output explicitly says: *"link auth.users to fi_users for sign-in."*

### `scripts/import-evolved-payroll-staff.ts`

Imports Evolved payroll XLSX → `fi_staff` via `runEvolvedPayrollStaffImport`.

Requires: `--tenant-id` or `EVOLVED_PERTH_TENANT_ID`, `--file`, optional `--commit`.

Uses `FI_ADMIN_API_KEY` for API path in runner.

### IIOHR HR sync (production path)

- Cron: `/api/cron/iiohr-hr-perth-staff-sync` (hourly in `vercel.json`)
- Upserts `fi_staff` + source IDs; links via email plan (`iiohrHrStaffImportPlan.ts`)
- Does **not** auto-create Supabase Auth users

### Staff ↔ FI user linking

- `src/lib/staff/staffFiUserLink.server.ts` — bulk link by email match; can create `fi_users` rows
- Matching: source ID → staff email → fi_users email

---

## Identity model (production rules)

From `docs/fi-os-access-production.md`:

| Layer | Table | Purpose |
|-------|-------|---------|
| Platform OS | `fi_os_identities` | Cross-tenant `fi_platform_admin`, `fi_admin`, `fi_auditor`, clinical OS roles |
| Tenant membership | `fi_users` | Tenant-scoped role (`crm_operator`, `fi_admin`, etc.) |
| Auth | Supabase `auth.users` | Login; linked via `fi_users.auth_user_id` |

**FI portal staff** = row in `fi_os_identities` **OR** `fi_users`.

### Production gates

- `/fi-admin` shell: `assertFiAdminShellAccess` (`src/lib/fiOs/fiOsPortalGate.server.ts`)
- Tenant routes: `assertFiTenantPortalAccess`
- Non-production: gates **no-op** for local dev — production behaviour **must** be verified on deployed env

---

## Role assignment logic

| Source | Roles created |
|--------|---------------|
| Provision script | `crm_operator` seeds only |
| Payroll import | Staff roles from export mapping |
| IIOHR sync | `fi_staff.staff_role` from HR feed |
| Manual admin | FI Admin user management UI |
| Platform | `fi_os_identities.os_role` for internal operators |

**Evolved clinic staff** typically need:

1. Supabase Auth invite / signup
2. `fi_users` row with tenant_id + role
3. Optional `fi_staff` link for calendar/PIN
4. Optional `fi_os_identities` only for platform operators — **not** every clinic user

---

## Staff PIN access

| Component | Path |
|-----------|------|
| Session | `src/lib/staffPin/staffPinSession.server.ts` |
| Clinic floor pages | `getClinicFloorPageSession` |
| Mutation guard | `staffPinMutationGuard` — blocks pricing, staff mgmt, tax under PIN |
| Audit | `fi_staff_pin_audit_events` |

**Production checklist gap (BLK-SEC-04 related):** PIN rate limiting documented as should-fix; not verified in Task 4.

PIN session uses `authMode: "staff_pin"` — separate from Supabase session; suitable for reception floor, not full admin.

---

## Can real Evolved staff be provisioned safely?

| Step | Safe? | Notes |
|------|-------|-------|
| Run provision script on prod DB | **Yes** (idempotent) | Use service role locally/Vercel script runner; seeds are fake emails |
| Import payroll staff (dry-run) | **Yes** | Preview before `--commit` |
| HR cron commit sync | **Caution** | Requires IIOHR secrets + `EVOLVED_PERTH_TENANT_ID`; test dry-run first |
| Create Auth user + fi_users | **Manual** | Supabase invite + SQL/admin UI link |
| Link staff to fi_users | **Yes** | Via staff link admin page or import runner |

**Blocker:** Without at least one **real** `auth.users` ↔ `fi_users` row, production login smoke cannot pass.

---

## Recommended provisioning sequence (Evolved go-live)

1. Confirm `EVOLVED_PERTH_TENANT_ID` = production `fi_tenants.id` for slug `evolved`.
2. Run `dev:provision:evolved` if tenant not seeded (or skip if exists).
3. Import real staff: payroll XLSX dry-run → commit **OR** wait for IIOHR cron with verified secrets.
4. For each admin/consultant:
   - Supabase Auth invite (production redirect URLs per access doc)
   - Insert/update `fi_users` with `auth_user_id`
   - Run staff↔user link for calendar operators
5. Platform operators only: add `fi_os_identities` row.
6. Verify: login → `/fi-admin/[tenantId]/cases` → `pnpm run smoke:prod` authenticated checks.

---

## Safe commands executed

```text
pnpm run check:env     → PASS (Supabase connectivity)
pnpm run typecheck     → PASS
```

No provisioning scripts executed against production (no deploy / no destructive DB).

---

## Remediation required (BLK-SEC-05)

1. **Provision** minimum 2 real Evolved operators (admin + consultant) with Auth + `fi_users`.
2. **Record** UUIDs in sprint change log (redacted emails ok).
3. **Run** production smoke / E2E authenticated journey (`evolved-smoketest-journey.md`).
4. **Verify** cross-tenant denial for non-member auth user.
5. **Optional:** Remove or disable seed `@follicleintelligence.local` users in production if present.

---

## BLK-SEC-05 disposition

| Field | Value |
|-------|-------|
| Validated | Yes — paths exist; prod proof absent |
| Resolved automatically | **No** |
| Still blocking production | **Yes** until real identity smoke passes |
| Task 5 disposition | **Still blocking** — operator checklist §7–8; prod Auth + fi_users pending |

---

## Evidence Closure Checklist

| # | Evidence item | Artifact placeholder | Owner | Target date | Status |
|---|---------------|----------------------|-------|-------------|--------|
| E1 | `EVOLVED_PERTH_TENANT_ID` matches production `fi_tenants.id` | Redacted env + SQL read-only UUID | Platform | 2026-06-30 | ☑ |
| E2 | ≥2 real operators: Auth + `fi_users.auth_user_id` | Redacted UUID table below | Evolved clinic lead | 2026-06-30 | ☑ |
| E3 | Payroll import commit or IIOHR cron verified | Import/cron log | Clinical ops | | ☐ |
| E4 | Staff ↔ fi_users link for calendar operators | 10/12 fi_staff linked (audit 2026-06-30) | Clinical ops | 2026-06-30 | ☑ |
| E5 | Authenticated smoketest journey complete | [smoketest journey](../evolved-smoketest-journey.md) | Sprint lead | | ☐ |
| E6 | Cross-tenant denial verified | `smoke-prod-2026-06-30.txt` check J PASS | Security | 2026-06-30 | ☑ |
| E7 | Seed `@follicleintelligence.local` users disabled in prod (if present) | N/A on evolved-hair tenant | Platform | 2026-06-30 | ☑ |

**Tenant resolution (2026-06-30):** Production uses slug `evolved-hair` (`Evolved Hair Restoration`), id `c2615b95-b707-4485-aa5f-be8f78ec868a`. Separate slug `evolved` (`Evolved Hair Clinics`) exists for provision-script seeding only.

### Provisioned identities (redacted template)

| Role | fi_users.id | auth.users linked (Y/N) | Date provisioned | Verifier |
|------|-------------|-------------------------|------------------|----------|
| tenant_backend | 09f64918… | Y (pre-existing) | 2026-06-30 | Platform audit |
| crm_operator (reception) | 94934c4c-c28f-4881-a6ac-91929db1a588 | Y (invite sent) | 2026-06-30 | `provision-evolved-operator.ts --commit` |

**Closure rule:** BLK-SEC-05 → **Complete** when E2 + E5 + E6 Complete.
