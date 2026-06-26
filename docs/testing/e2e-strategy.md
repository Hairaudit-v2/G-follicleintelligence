# Follicle Intelligence — E2E Testing Strategy

**Application:** Next.js 14 web app (FI OS — hair restoration clinic operating system)  
**Stack:** React 18, Tailwind, Supabase (Auth + Postgres + RLS), Stripe, Vercel  
**UI:** Web browser (desktop + responsive mobile viewports)  
**Framework:** Playwright 1.58 (`@playwright/test`)  
**Unit layer:** ~387 `*.test.ts` files via `tsx --test` (business logic, RLS, loaders)

This document is the authoritative E2E strategy. Runnable tests live in [`e2e/`](../../e2e/). Quick start: [`e2e/README.md`](../../e2e/README.md).

---

## 1. Testing Strategy Overview

### Scope and objectives

| Layer | Purpose | Tooling |
|-------|---------|---------|
| **Unit** | Pure logic, RLS rules, loaders, mutations | `npm run test:unit` |
| **HTTP smoke** | Unauthenticated API/route probes | `npm run smoke:prod` |
| **E2E (browser)** | Complete user journeys, auth, UI integration | `npm run test:e2e` |

E2E objectives:

1. Verify **business-critical paths** work end-to-end in a real browser against production-mode auth.
2. Catch **auth/tenancy regressions** before staging clinics are affected.
3. Validate **public revenue entry points** (marketing, login, payment links).
4. Provide a **foundation for mutation journeys** on throwaway demo tenants.

### Test pyramid balance

```
        ┌─────────────┐
        │  E2E (~50)  │  Critical journeys only — slow, high confidence
        ├─────────────┤
        │ Integration │  HTTP smoke scripts, API auth probes
        ├─────────────┤
        │ Unit (~387) │  Domain logic, RLS, board models, form validation
        └─────────────┘
```

**Rule:** If logic can be tested without a browser, keep it in unit tests. E2E covers wiring, auth cookies, redirects, and multi-step UI flows.

### Environment requirements

| Requirement | Why |
|-------------|-----|
| `NODE_ENV=production` host | Auth middleware fail-closed only in production (`middleware.ts`) |
| `npm run build && npm run start` | Not `next dev` — dev mode skips auth guard |
| `FI_E2E_BASE_URL` | Target host (local or staging) |
| Demo credentials (optional) | `@authenticated` / `@mutation` tiers |

### Browser and device coverage

| Project | Device | CI usage |
|---------|--------|----------|
| `chromium` | Desktop Chrome | Security workflow (fast) |
| `firefox` | Desktop Firefox | Smoke workflow |
| `webkit` | Desktop Safari | Smoke workflow |
| `mobile-chrome` | Pixel 5 | Smoke workflow |
| `mobile-safari` | iPhone 13 | Smoke workflow |

Limit locally: `FI_E2E_BROWSERS=chromium,firefox`

### CI/CD integration

| Workflow | Trigger | Scope |
|----------|---------|-------|
| [`e2e-security.yml`](../../.github/workflows/e2e-security.yml) | PR/push | `@security`, Chromium only |
| [`e2e-smoke.yml`](../../.github/workflows/e2e-smoke.yml) | PR/push | `@smoke` + `@security`, cross-browser |
| Authenticated job (optional) | When secrets set | `@authenticated`, `@mutation` against staging |

Artifacts on failure: screenshot, trace (first retry), video (CI).

---

## 2. User Journey Mapping

### Critical user paths (priority order)

| Priority | Journey | Tag | Status |
|----------|---------|-----|--------|
| P0 | Unauthenticated access blocked | `@security` | ✅ Automated |
| P0 | Public login + marketing surfaces | `@smoke` | ✅ Automated |
| P0 | Tenant admin → financial dashboard | `@authenticated` | ✅ Automated |
| P0 | Cross-tenant isolation (UI + API) | `@authenticated` | ✅ Automated |
| P1 | Staff PIN → calendar (scoped) | `@authenticated` | ✅ Automated (needs PIN env) |
| P1 | Patient create | `@mutation` | ✅ Automated (opt-in) |
| P1 | Invalid payment link handling | `@smoke` | ✅ Automated |
| P2 | Lead → case → consultation → payment | `@mutation` | 📋 Planned (Phase 2) |
| P2 | Surgery boards (readiness, tomorrow, procedure day) | `@authenticated` | 📋 Planned |
| P3 | Platform admin onboarding | `@authenticated` | 📋 Manual + future |

### Happy path scenarios

1. **Prospect** lands on homepage → views pricing → contacts clinic (marketing `@smoke`).
2. **Staff** opens `/fi-login` → signs in → lands on tenant financial dashboard (`@authenticated`).
3. **Floor staff** selects name + PIN → calendar (`staff-pin-access.spec.ts`).
4. **Admin** creates `SMOKETEST-` patient → patient record page (`clinic-workflow.spec.ts`).
5. **Patient** opens payment link → sees invoice summary or unavailable state (`@smoke`).

### Edge cases

| Scenario | Test |
|----------|------|
| Wrong admin password | `tenant-admin-access.spec.ts` — alert, no session |
| Wrong staff PIN | `staff-pin-access.spec.ts` — error, no calendar redirect |
| Invalid payment token | `public-surfaces.spec.ts` — "Link unavailable" |
| Unknown tenant in URL | `navigation-routing.spec.ts` — redirect/block |

### Error recovery

- Login errors surface `role="alert"` with actionable copy — asserted in auth specs.
- Payment errors show clinic contact guidance — asserted in public pay spec.
- API errors return non-200 for unauthenticated — asserted in security spec.

---

## 3. Test Scenarios Design

### Scenario: Tenant admin login → dashboard

| Step | Action | Validation |
|------|--------|------------|
| 1 | Navigate to `/fi-admin/{tenantId}/financial/dashboard` | Redirect to login if no session |
| 2 | Fill work email + password | Fields accept input |
| 3 | Click "Sign in to OS" | Redirect to tenant-scoped URL |
| 4 | — | "Payment metrics" or financial content visible |

**Data:** `FI_E2E_DEMO_ADMIN_EMAIL`, `FI_E2E_DEMO_ADMIN_PASSWORD`, `FI_E2E_TENANT_ID`  
**File:** `e2e/journeys/tenant-admin-access.spec.ts`

### Scenario: Patient creation (mutation)

| Step | Action | Validation |
|------|--------|------------|
| 1 | Authenticated session (worker fixture) | — |
| 2 | Go to `/fi-admin/{tenantId}/patients/new` | "Add new patient" heading |
| 3 | Fill SMOKETEST- prefixed data | Form accepts input |
| 4 | Click "Create patient" | URL → `/patients/{id}`, name visible |

**Data:** `FI_E2E_ALLOW_MUTATIONS=1` + demo credentials; `e2e/helpers/test-data.ts`  
**File:** `e2e/journeys/clinic-workflow.spec.ts`

### Scenario: Public payment link (invalid)

| Step | Action | Validation |
|------|--------|------------|
| 1 | Open `/pay/invalid-token` | HTTP < 400 |
| 2 | — | "Link unavailable" heading |
| 3 | — | Staff sign-in link present |

**File:** `e2e/journeys/public-surfaces.spec.ts`

### Phase 2 scenarios (documented, not yet coded)

Full revenue pipeline from [clinic readiness runbook](../smoke/fi-os-clinic-readiness-runbook.md):

- CRM lead create → convert to case
- Consultation booking + form draft/submit
- Quote/payment request → Payments Inbox
- Surgery booking → operational boards

---

## 4. Authentication and Authorization Testing

| Area | Coverage | Location |
|------|----------|----------|
| Login (password) | Happy + invalid credentials | `tenant-admin-access.spec.ts` |
| Logout | 📋 Phase 2 | — |
| Password reset | 📋 Phase 2 (magic link handler exists) | — |
| Staff PIN | Happy + wrong PIN | `staff-pin-access.spec.ts` |
| Role-based access | Financial dashboard (tenant admin) | `tenant-admin-access.spec.ts` |
| Cross-tenant | UI + API | `cross-tenant-isolation.spec.ts` |
| Session / fail-closed | Unauthenticated routes | `unauthenticated-access.spec.ts` |

**Session fixture:** Worker-scoped storage state in `e2e/fixtures/auth.ts` — one login per browser worker.

---

## 5. Core Functionality Testing

| Area | E2E coverage | Notes |
|------|--------------|-------|
| CRUD — patient create | `@mutation` | Create only; delete via manual soft-delete |
| Form validation | Invalid login/PIN | Error alerts asserted |
| File upload | 📋 Phase 2 | Runbook §4.1 |
| Search | 📋 Phase 2 | After patient create + search spec |
| Navigation | Marketing routes | `navigation-routing.spec.ts` |
| FI OS sidebar | 📋 Phase 2 | Use role-based nav labels |

---

## 6. Payment and Transaction Testing

| Area | Coverage | Approach |
|------|----------|----------|
| Public pay page (invalid token) | ✅ | Read-only, no Stripe |
| Public pay page (valid token) | 📋 Phase 2 | Needs `FI_E2E_PAYMENT_TOKEN` env |
| Stripe checkout redirect | 📋 Phase 2 | Assert "Pay now" link href, do not complete payment in CI |
| Refunds / subscriptions | N/A | Not in current product scope |

**Safety:** Never complete real Stripe charges in automated E2E. Use Stripe test mode + assert UI state only.

---

## 7. Mobile and Responsive Testing

Mobile coverage via Playwright device profiles:

- `mobile-chrome` (Pixel 5) — touch viewport, mobile Chrome UA
- `mobile-safari` (iPhone 13) — WebKit mobile

All `@smoke` and `@security` tests run on both mobile projects in the smoke CI workflow.

**Not covered in E2E:** Native apps (web-only product), offline/PWA, orientation toggling (add if PWA ships).

---

## 8. API Integration Testing

| Check | Method | File |
|-------|--------|------|
| Cases API fails closed (no session) | `request.get()` | `unauthenticated-access.spec.ts` |
| Cross-tenant API denial | Authenticated `page.request` | `cross-tenant-isolation.spec.ts` |
| Staff PIN login API | Browser fetch via UI | `staff-pin-access.spec.ts` |

**HTTP smoke complement:** `scripts/fi-production-smoke-test.ts` covers cron auth, legacy API, search gate — run post-deploy.

**Real-time (WebSocket/SSE):** Not in current E2E scope; cover with integration tests when features ship.

---

## 9. Performance and Load Testing

| Check | Budget | File |
|-------|--------|------|
| Homepage domcontentloaded | 8s (override: `FI_E2E_PERF_BUDGET_MS`) | `performance-smoke.spec.ts` |
| Login page | 8s | same |
| Pricing page | 8s | same |

**Not E2E scope:** Concurrent users, load testing, memory profiling — use dedicated tools (k6, Lighthouse CI) if needed.

---

## 10. Accessibility Testing

| Check | File |
|-------|------|
| Login keyboard tab order | `accessibility-smoke.spec.ts` |
| Primary heading present | same |
| Payment page link accessible name | same |

**Phase 2:** Add `@axe-core/playwright` for automated WCAG scans on login + dashboard.

---

## Test Implementation Reference

### Page Object Model

```
e2e/pages/
  login.page.ts           — OS sign-in
  marketing.page.ts       — Homepage, pricing, platform
  financial-dashboard.page.ts
  staff-pin-login.page.ts
  patient-create.page.ts
  public-pay.page.ts
```

### Helpers

```
e2e/helpers/
  access-denied.ts   — Fail-closed assertion
  credentials.ts     — Env-gated credential checks
  test-data.ts       — SMOKETEST- data factories
  performance.ts     — Soft load-time budgets
```

### Tags (grep)

| Tag | Command |
|-----|---------|
| `@security` | `npm run test:e2e:security` |
| `@smoke` | `npm run test:e2e:smoke` |
| `@a11y` | `npm run test:e2e:a11y` |
| `@authenticated` | `npm run test:e2e:authenticated` |
| `@mutation` | `npm run test:e2e:mutation` |

---

## Test Environment Management

### Environment variables

| Variable | Required for | Notes |
|----------|--------------|-------|
| `FI_E2E_BASE_URL` | All | `http://localhost:3000` or staging |
| `FI_E2E_TENANT_ID` | Authenticated | Demo tenant UUID |
| `FI_E2E_DEMO_ADMIN_EMAIL` | Authenticated | Throwaway admin |
| `FI_E2E_DEMO_ADMIN_PASSWORD` | Authenticated | Never commit |
| `FI_E2E_OTHER_TENANT_ID` | Cross-tenant | Second demo tenant |
| `FI_E2E_STAFF_ID` | Staff PIN | Staff record UUID |
| `FI_E2E_STAFF_PIN` | Staff PIN | 4-digit PIN |
| `FI_E2E_ALLOW_MUTATIONS` | Mutation | Must be `1` explicitly |
| `FI_E2E_BROWSERS` | Optional | Limit browser matrix |
| `FI_E2E_PERF_BUDGET_MS` | Optional | Performance budget |

### Test data conventions

From clinic readiness runbook:

- Prefix: `SMOKETEST-`
- Email: `tester+e2e-{id}@example.test`
- Phone: `0000000000`
- Soft-delete records after manual/automated mutation runs

### Parallel execution

- `fullyParallel: true` in Playwright config
- Worker-scoped auth (one login per worker, not per test)
- Mutation tests: run serially on demo tenant if flakiness appears (`test.describe.configure({ mode: 'serial' })`)

### External dependencies

- **Supabase:** Real staging project for authenticated tests; placeholder keys OK for security-only CI
- **Stripe:** Not invoked in current E2E; payment tests are UI-only

---

## CI/CD Details

### Retry and flake handling

- CI retries: `1` (Playwright config)
- Trace: `on-first-retry`
- Video: `retain-on-failure` in CI

### Reporting

- CI: `dot` reporter + HTML report (not opened)
- Local: `list` reporter
- View HTML: `npx playwright show-report`

### GitHub secrets (optional authenticated job)

```
FI_E2E_DEMO_ADMIN_EMAIL
FI_E2E_DEMO_ADMIN_PASSWORD
FI_E2E_TENANT_ID
FI_E2E_OTHER_TENANT_ID      # optional
FI_E2E_STAFF_ID               # optional
FI_E2E_STAFF_PIN              # optional
NEXT_PUBLIC_SUPABASE_URL      # real staging
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Repository variable: `FI_E2E_STAGING_URL`

---

## Monitoring and Maintenance

| Activity | Cadence |
|----------|---------|
| Review failed CI screenshots/traces | Every PR |
| Update selectors when UI copy changes | As needed — prefer role/label over text |
| Add Phase 2 journeys after demo tenant ready | Per sprint |
| Audit `@mutation` cleanup | After each staging run |
| Coverage gap review | Quarterly against runbook |

### Coverage matrix

| Runbook section | Automated | Manual |
|-----------------|-----------|--------|
| §1 Login/access | Partial (1.2–1.7) | 1.1 platform admin |
| §2 Core workflow | 2.1 patient create | 2.3–2.10 |
| §3 Financial | — | All |
| §4 Imaging | — | All |
| §5 RLS/soft-delete | Cross-tenant | Soft-delete boards |

---

## Run Immediately (no credentials)

```powershell
# One command: build → start → all public/security tests → shutdown
npm run test:e2e:smoke:production
```

Or step by step:

```powershell
npm run build
npm run start
$env:FI_E2E_BASE_URL="http://localhost:3000"
npm run test:e2e:security    # 4 tests × 5 browsers = 20 (or chromium only)
npm run test:e2e:smoke       # public + perf + a11y + nav
```

Chromium-only (fast):

```powershell
$env:FI_E2E_BROWSERS="chromium"
npm run test:e2e:smoke
```

## Run with staging credentials

```powershell
$env:FI_E2E_BASE_URL="https://your-staging-host"
$env:FI_E2E_TENANT_ID="<demo-tenant-uuid>"
$env:FI_E2E_DEMO_ADMIN_EMAIL="tester+smoketest@yourdomain.test"
$env:FI_E2E_DEMO_ADMIN_PASSWORD="<secret>"
npm run test:e2e:authenticated

# Mutation (patient create) — demo tenant only
$env:FI_E2E_ALLOW_MUTATIONS="1"
npm run test:e2e:mutation
```

---

## Phase 2 Roadmap

1. **CRM → case → consultation → payment** full pipeline (`@mutation` serial suite)
2. **Valid payment token** smoke with Stripe test mode
3. **Platform admin** journey with separate credentials
4. **axe-core** accessibility scans on login + dashboard
5. **Visual regression** (optional) for marketing pages only

---

## Related docs

- [E2E README / quick start](../../e2e/README.md)
- [Clinic readiness runbook](../smoke/fi-os-clinic-readiness-runbook.md)
- [Environment architecture](../runbooks/environment-architecture.md)
