# FI-ROLE-JOURNEY-BAKE-1 — Audit plan

**Milestone:** `FI-ROLE-JOURNEY-BAKE-1`  
**Validates:** `FI-TRUST-LANDING-AND-SPINE-1`  
**Date:** 2026-07-13  
**Mode:** Audit-first, then evidence-backed validation  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)

---

## 1. Role accounts and fixtures available

| Role | Evolved operator (redacted) | Auth path | E2E / fixture support | Full bake possible? |
| ---- | --------------------------- | --------- | --------------------- | ------------------- |
| Receptionist | `j***@hotmail.com`, `r***@outlook.com` | Password (staff) | No dedicated storage state; unit nav scenario `reception` | **Partial** — landing via `resolveFiOsPostLoginPathSuffix`; live login needs staff password or magic-link bootstrap |
| Consultant | `c***@icloud.com` (`tenant_backend` + `consultant`) | Password | Demo admin may differ; no consultant storage state | **Partial** |
| Nurse | `d***@gmail.com`, `e***@gmail.com` | Password | `e2e/journeys/treatment-imaging-protocol.spec.ts` (fixture-gated) | **Partial** |
| Doctor / surgeon | `s***@gmail.com` (Contractor Doctor / Hair Transplant Surgeon) | Password | OS role `fi_doctor` if provisioned; unit landing `/doctor` | **Partial** |
| Finance admin | `fi_tenant_admin_users` count = 1 (role TBD in live row) | Password | Unit landing `/financial-os` for `finance_admin` | **Partial** — need finance-admin login session |
| Clinic admin / manager | `m***@evolvedhair.com.au`, `s***@follicleintelligence.ai` | Password | `FI_E2E_DEMO_ADMIN_*` (likely clinic admin → Today) | **Yes** for manager/admin subset |
| Owner | `p***@evolvedhair.com.au` | Magic link | `e2e/fixtures/rosterAuth.ts` (`paul@evolvedhair.com.au` default) | **Partial** — roster/team journeys; not full owner Reports bake |
| Platform admin | `s***@follicleintelligence.ai` (internal) | Password | Cross-tenant patterns in `e2e/journeys/tenant-admin-access.spec.ts` | **Partial** |

**Synthetic role fixtures (permission resolution, not UI hiding):**

- `src/lib/fiOs/fiOsRoleLandingCore.test.ts` — OS role, staff role key, workspace profile, tenant admin role
- `src/lib/fiOs/navigation/fiOsNavigationGoLiveAudit.ts` — `GO_LIVE_NAV_ROLE_SCENARIOS` (receptionist, clinical_staff/nurse, surgeon, manager, platform_admin)
- `e2e/fixtures/auth.ts` — tenant-admin authenticated storage state
- `e2e/fixtures/rosterAuth.ts` — manager magic-link bootstrap (`paul@evolvedhair.com.au`)
- `e2e/helpers/credentials.ts` — env-gated demo admin, roster manager, staff PIN

**Golden-patient fixture IDs (when set in `.env.local`):**

- `FI_E2E_PATIENT_ID`, `FI_E2E_LEAD_ID` — used by `e2e/fi-ux-workspace-shell-validation.spec.ts`

---

## 2. Required tenant configuration

| Setting | Expected for bake | Current evidence |
| ------- | ----------------- | ---------------- |
| `EVOLVED_PERTH_TENANT_ID` / `FI_SMOKE_TENANT_ID` | `c2615b95-b707-4485-aa5f-be8f78ec868a` | Set in `.env.local` |
| `FI_E2E_TENANT_ID` | Same Evolved Perth UUID | Set |
| `FI_E2E_BASE_URL` | `http://localhost:3000` (production build) or staging | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Required for staff audit + magic-link E2E | Set |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` | Should include Evolved UUID for V1-only Pipeline | **Set locally + Vercel production/preview (2026-07-13)** |
| `FI_WORKSPACE_SHELL_TENANT_IDS` | Include tenant for workspace shell validation | Check server env at runtime |
| `FI_TODAY_SURFACE_TENANT_IDS` | Include tenant for Today surface / tablet tests | Check server env at runtime |
| Timezone | `Australia/Perth` | **To verify** in tenant settings |

---

## 3. Feature flags affecting the bake

| Flag | Default | Bake impact |
| ---- | ------- | ----------- |
| `FI_PAYMENTS_ENABLED` | `false` | Money is canonical; `/payments` shows honest disabled state; no Take payment nav row |
| `FI_PROCEDURE_DAY_ENABLED` | `false` | Procedure Day surfaces hidden — doctor journey must not claim OR-day readiness |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` | empty | Pipeline may dual-run until allowlist set for Evolved |
| `FI_STAFF_UAT_MODE_ENABLED` | `false` | No in-app screen guides during bake |
| `RECEPTION_OS_COMMUNICATION_DRY_RUN` | on (unset) | Safe for reception comms mutations |
| `NODE_ENV` | `production` for E2E | Auth middleware fail-closed; use `npm run build && npm run start` |

---

## 4. Staff mapping status (Section A gate)

**Command:**

```bash
node scripts/run-with-system-ca.mjs tsx scripts/audit-staff-mapping-completeness.ts
```

**Note:** Plain `npm run audit:staff-mapping` fails on this Windows host with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; use the system-CA wrapper (documented in `e2e/README.md`).

**2026-07-13 result (Evolved Perth):**

| Metric | Value |
| ------ | ----- |
| `operators_with_login` | 9 |
| `missing_fi_staff` | 0 |
| `missing_access_signal` | 0 |
| `tenant_or_global_templates` | 0 |
| Verdict | **PASS** |

**Per-operator summary (audit script output):**

| Login (redacted) | `fi_staff` | `staff_role` | Grants |
| ---------------- | ---------- | ------------ | ------ |
| s***@follicleintelligence.ai | OK | Manager | 0 |
| c***@icloud.com | OK | consultant | 0 |
| j***@hotmail.com | OK | Receptionist | 0 |
| p***@evolvedhair.com.au | OK | owner | 0 |
| d***@gmail.com | OK | Nurse | 0 |
| r***@outlook.com | OK | Receptionist | 0 |
| m***@evolvedhair.com.au | OK | Manager | 0 |
| e***@gmail.com | OK | Nurse | 0 |
| s***@gmail.com | OK | Contractor Doctor / Hair Transplant Surgeon | 0 |

**Gaps vs full bake table spec:**

- SA-1 enforcement / deferred status — **not emitted** by current audit script; infer from `grants=0` + `templates=0` (role templates rely on `staff_role` text + SA-1 engine at runtime)
- Duplicate identity — separate check in `scripts/fi-workforce-live-data-cleanup-1.ts` (executed 2026-07-06; Dr Seetal duplicate resolved)
- Staff-member (`fi_staff_members`) linkage — covered by workforce cleanup doc, not staff-mapping script

**Target state:** Active mapped users 100% — **met for login-capable operators (9/9)**.

---

## 5. Production-backed workflows available

| Workflow | Route / tool | Evidence type |
| -------- | ------------ | ------------- |
| Post-login landing | `fiOsRedirect.server.ts` | Unit + E2E (demo admin) |
| Primary rail / More | `fiOsMinimalNav`, go-live audit | Unit (all role scenarios) |
| Pipeline canonical door | `/crm`, `/leadflow` redirect | Unit + E2E |
| Pipeline board H-scroll | `pipeline-board-h-scroll` test id | E2E |
| Money / disabled Payments | `/financial-os`, `/payments` | Unit nav + manual/E2E |
| Front desk day board | `/front-desk` | E2E labels (unauthenticated shell) |
| Golden-patient spine contract | `goldenPatientSpineCore` | Unit; UI E2E **missing** |
| Team / roster (manager) | `/team`, magic-link paul | Roster E2E fixture |
| Staff mapping gate | `audit-staff-mapping` | Script (read-only) |

---

## 6. Workflows blocked by environment or missing fixtures

| Blocker | Affected sections | Mitigation |
| ------- | ----------------- | ---------- |
| No per-role password / storage states for 8 clinic roles | B landing matrix, C nav, D journeys | Unit + go-live audit; manual sign-off per role; magic-link bootstrap for manager |
| `FI_E2E_PATIENT_ID` / `FI_E2E_LEAD_ID` unset | E golden-patient UI spine | Skip or set safe fixture IDs |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` unset | D2 consultant Pipeline V1 cutover | Document dual-run risk |
| Local server not running | All live E2E | `npm run build && npm run start` before Playwright |
| TLS without system-CA wrapper | Staff audit, Supabase scripts | `node scripts/run-with-system-ca.mjs tsx …` |
| Treatment imaging E2E fixtures | D3 nurse imaging protocols | `e2e/journeys/treatment-imaging-protocol.spec.ts` skips without appointment fixture |
| Finance-admin dedicated login | D5 finance journey | Blocked without finance_admin credentials |
| Platform admin impersonation | D8 | Existing tenant-admin-access patterns only |

---

## 7. Automated checks already present

| Suite | Command | Covers |
| ----- | ------- | ------ |
| Role landing core | `node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test src/lib/fiOs/fiOsRoleLandingCore.test.ts` | Landing matrix (pure) |
| Golden patient spine | `… goldenPatientSpineCore.test.ts` | Persistence contract |
| Minimal nav + go-live | `… fiOsMinimalNav.test.ts fiOsNavigationGoLiveAudit.test.ts` | Six-slot rail, role scenarios |
| Pipeline cutover | `… pipelineCutover.s45d.test.ts` | One Pipeline door, `/leadflow` |
| Shell primary nav | `… fiOsShellPrimaryNav.test.ts` | Money, Payments flag behaviour |
| Trust role landing E2E | `npx playwright test e2e/fi-trust-role-landing.spec.ts` | No `/cases` default; `/leadflow` → `/crm` |
| Trust pipeline layout E2E | `npx playwright test e2e/fi-trust-pipeline-layout.spec.ts` | Document H-scroll containment |
| Tablet layout | `e2e/fi-ux-tablet-layout.spec.ts` | Viewport scroll contract |
| Front desk labels | `e2e/fi-ux-audit-labels.spec.ts` | Legacy redirects, Front desk copy |
| Staff mapping | `npm run audit:staff-mapping` (with system CA) | Operator `fi_staff` completeness |
| Lint / typecheck | `npm run lint`, `npm run typecheck` | Repo health |

**Combined trust unit command (from FI-TRUST-LANDING-AND-SPINE-1):**

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/fiOs/fiOsRoleLandingCore.test.ts \
  src/lib/patients/goldenPatientSpineCore.test.ts \
  src/lib/fiAdmin/fiOsMinimalNav.test.ts \
  src/lib/fiOs/navigation/fiOsNavigationGoLiveAudit.test.ts \
  src/lib/crm/pipelineCutover.s45d.test.ts
```

---

## 8. Manual checks still required

1. **Per-role live login** — each of 8 roles: default landing, safe `next`, bad `next`, logout/re-login (password or approved magic link).
2. **Receptionist day journey (D1)** — enquiry → Pipeline → patient link → calendar → Money path.
3. **Consultant stage progression (D2)** — reload persistence on a real lead.
4. **Nurse treatment imaging (D3)** — PRP/PRF/meso/exosome protocol activation from Front desk or Calendar.
5. **Doctor case review (D4)** — patient → pathology → imaging → surgery case (Procedure Day honestly hidden).
6. **Finance Money truth (D5)** — manual vs provider payment labelling (document for FI-TRUST-MONEY-AND-READINESS-1).
7. **Manager Team / roster (D6)** — staff access visibility, unmapped staff surfacing.
8. **Owner Reports via More (D7)** — discoverability without primary-rail Reports.
9. **Golden-patient UI walkthrough (E)** — Pipeline → lead → patient → reload → re-login.
10. **Responsive viewports (F)** — 1440×900, 1366×768, 12″ tablet landscape/portrait on changed surfaces.

---

## 9. Exact commands to run

```bash
# Compare local vs Vercel production snapshot
npm run compare:bake-env
# or: node scripts/compare-bake-env.mjs .env.vercel.check-prod-live

# Apply bake env gaps to .env.local (Pipeline allowlist, E2E fixtures, demo admin email)
npm run sync:bake-env

# Push missing vars to Vercel (add-if-missing)
node scripts/sync-bake-env-gaps.mjs --vercel

# Update existing Vercel production/preview vars (after allowlist decision)
node scripts/sync-bake-env-gaps.mjs --vercel-update

# Pull fresh Vercel production snapshot (encrypted values redacted in file)
npx vercel env pull .env.vercel.check-prod-live --environment=production --yes

# Inspect live Vercel production values (PowerShell — escape `--`)
npx vercel env run -e production `-- node -e "console.log(process.env.FI_PIPELINE_V1_TENANT_ALLOWLIST)"
```

```bash
# Static analysis
npm run lint
npm run typecheck

# Staff mapping gate (Windows TLS-safe)
node scripts/run-with-system-ca.mjs tsx scripts/audit-staff-mapping-completeness.ts

# Trust unit bundle
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/fiOs/fiOsRoleLandingCore.test.ts \
  src/lib/patients/goldenPatientSpineCore.test.ts \
  src/lib/fiAdmin/fiOsMinimalNav.test.ts \
  src/lib/fiOs/navigation/fiOsNavigationGoLiveAudit.test.ts \
  src/lib/crm/pipelineCutover.s45d.test.ts \
  src/lib/fiAdmin/fiOsShellPrimaryNav.test.ts

# Production-mode host for E2E
npm run build
$env:NODE_ENV="production"; npm run start

# Trust + layout E2E (separate terminal)
$env:FI_E2E_BROWSERS="chromium"
npx playwright test e2e/fi-trust-role-landing.spec.ts e2e/fi-trust-pipeline-layout.spec.ts --project=chromium-authenticated

# Optional: workspace shell + golden fixtures
$env:FI_E2E_WORKSPACE_SHELL_VALIDATION="true"
npx playwright test e2e/fi-ux-workspace-shell-validation.spec.ts --project=chromium-authenticated

# Optional: per-role landing assertion
$env:FI_E2E_EXPECTED_LANDING_PATH_SUFFIX="/front-desk"
npx playwright test e2e/fi-trust-role-landing.spec.ts -g "EXPECTED_LANDING"

# Tablet / labels
npx playwright test e2e/fi-ux-tablet-layout.spec.ts e2e/fi-ux-audit-labels.spec.ts --project=chromium-authenticated
```

---

## 10. Evidence collection format

Each finding or pass record should include:

```text
BAKE-1-<section>-<seq>
Date: 2026-07-13
Operator: <agent or staff name>
Environment: <localhost:3000 | staging URL>
Role: <receptionist | consultant | … | platform_admin>
Check: <landing | nav | journey step | reload | tablet>
Result: PASS | FAIL | SKIP | BLOCKED
Automated: yes | no
Evidence: <test log path | screenshot | SQL read-only | unit test name>
Notes: <failure point or limitation>
```

**Defect classification:** P0 trust/safety · P1 workflow blocker · P2 friction · P3 polish.

**Results artifact:** `docs/audits/fi-role-journey-bake-1.md` (executive verdict, matrices, defects, release decision).

---

## Execution order

1. Run Section A staff mapping gate.  
2. Run Section H automated suites.  
3. Start production-mode host; run trust E2E + tablet/layout.  
4. Perform manual role journeys where credentials exist; mark others BLOCKED.  
5. Fix evidence-backed P0/P1 only.  
6. Publish bake report with GREEN / AMBER / RED decision.
