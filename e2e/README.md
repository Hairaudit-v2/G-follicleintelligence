# FI OS Playwright E2E

Browser e2e suite for Follicle Intelligence OS. Tests are grouped by business
value and tagged for selective execution.

**Full strategy:** [docs/testing/e2e-strategy.md](../docs/testing/e2e-strategy.md)

## Test tiers

| Tag | Scope | Credentials | CI |
|-----|-------|-------------|-----|
| `@security` | Unauthenticated fail-closed (admin shell, tenant dashboard, API) | None | `e2e-security.yml` (Chromium) |
| `@smoke` | Public business surfaces (marketing, login, payment link) | None | `e2e-smoke.yml` (cross-browser) |
| `@a11y` | Keyboard + semantic markup on public pages | None | Included in smoke CI |
| `@authenticated` | Tenant admin login → dashboard, cross-tenant, staff PIN | Demo env secrets | Authenticated projects only (public projects `grepInvert`); trust-trio job when secrets + staging URL set |
| `@mutation` | Patient create (demo tenant, opt-in) | `FI_E2E_ALLOW_MUTATIONS=1` | Optional |
| `@hubspot-production-smoke` | Canonical HubSpot workspace (production, read-only) | `FI_E2E_PRODUCTION_ADMIN_*` | `hubspot-production-smoke.yml` (manual / opt-in post-CI) |

Critical revenue path (lead → case → consultation → payment) remains in the
[clinic readiness runbook](../docs/smoke/fi-os-clinic-readiness-runbook.md) for
manual verification until a dedicated demo tenant supports safe mutation tests.

## Design principles

- **Role/label selectors** over CSS classes — see `e2e/pages/` page objects.
- **Shared assertions** in `e2e/helpers/` to avoid duplicated brittle checks.
- **No committed secrets** — credentials via `FI_E2E_DEMO_ADMIN_*` env only.
- **Production-mode host** — auth middleware fail-closed only activates when
  `NODE_ENV=production`; use `npm run build && npm run start`, not `next dev`.

## One-time setup

```
npm install
npx playwright install chromium          # security / local dev
npx playwright install --with-deps       # full cross-browser matrix
```

> **TLS note:** on some managed Windows networks the Playwright tarball fails
> with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Install on a clean network or set
> `NODE_EXTRA_CA_CERTS` — see prior README notes.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `FI_E2E_BASE_URL` | Yes | Host under test (`http://localhost:3000` or staging URL) |
| `FI_E2E_TENANT_ID` | For `@authenticated` | Demo tenant UUID |
| `FI_E2E_DEMO_ADMIN_EMAIL` | For `@authenticated` | Throwaway tenant admin email |
| `FI_E2E_DEMO_ADMIN_PASSWORD` | For `@authenticated` | Throwaway tenant admin password |
| `FI_E2E_OTHER_TENANT_ID` | Optional | Second tenant for cross-tenant isolation |
| `FI_E2E_STAFF_ID` | Staff PIN tests | Staff record UUID on demo tenant |
| `FI_E2E_STAFF_PIN` | Staff PIN tests | 4-digit floor PIN |
| `FI_E2E_ALLOW_MUTATIONS` | Mutation tests | Must be `1` — demo tenant only |
| `FI_E2E_PRODUCTION_ADMIN_EMAIL` | HubSpot production smoke | Production admin (read-only suite) |
| `FI_E2E_PRODUCTION_ADMIN_PASSWORD` | HubSpot production smoke | Production admin password |
| `FI_E2E_LOW_ROLE_EMAIL` | Optional HubSpot smoke | Low-role gating (AMBER skip if unset) |
| `FI_E2E_LOW_ROLE_PASSWORD` | Optional HubSpot smoke | Low-role password |
| `FI_E2E_PERF_BUDGET_MS` | Optional | Page load budget (default 8000) |
| `FI_E2E_BROWSERS` | Optional | Limit browsers, e.g. `chromium,firefox` |

## Running

**Security only (fast, Chromium):**

```
npm run build && npm run start
FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e:security
```

**One command (build → start → security → shutdown):**

```
npm run test:e2e:security:production
```

**Public smoke (cross-browser + mobile viewports):**

```
FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e:smoke
FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e:cross-browser
npm run test:e2e:smoke:production
```

**Authenticated journeys (requires demo credentials):**

```
FI_E2E_BASE_URL=https://<staging> \
FI_E2E_TENANT_ID=<uuid> \
FI_E2E_DEMO_ADMIN_EMAIL=tester+smoketest@yourdomain.test \
FI_E2E_DEMO_ADMIN_PASSWORD=<secret> \
npm run test:e2e:authenticated
```

**HubSpot production smoke (read-only; never commits storage state):**

```
FI_E2E_BASE_URL=https://follicleintelligence.ai \
FI_E2E_TENANT_ID=c2615b95-b707-4485-aa5f-be8f78ec868a \
FI_E2E_PRODUCTION_ADMIN_EMAIL=<secret> \
FI_E2E_PRODUCTION_ADMIN_PASSWORD=<secret> \
npm run test:e2e:hubspot-production-smoke
```

Evidence: `test-results/hubspot-production-smoke-summary.json` and
`test-results/hubspot-production-smoke-screenshots/`. Traces are disabled.

**Full suite:**

```
FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Layout

```
e2e/
  fixtures/
    auth.ts          — base test + authenticatedTest (worker-scoped session)
    baseUrl.ts       — FI_E2E_BASE_URL / tenant ID resolution
  helpers/
    access-denied.ts — shared fail-closed assertions
    credentials.ts   — env-gated demo credential checks
    test-data.ts       — SMOKETEST- data factories
    performance.ts     — soft load-time budgets
  pages/
    login.page.ts
    marketing.page.ts
    financial-dashboard.page.ts
    staff-pin-login.page.ts
    patient-create.page.ts
    public-pay.page.ts
  security/
    unauthenticated-access.spec.ts   @security
  journeys/
    public-surfaces.spec.ts          @smoke
    navigation-routing.spec.ts       @smoke
    accessibility-smoke.spec.ts      @smoke @a11y
    performance-smoke.spec.ts        @smoke
    tenant-admin-access.spec.ts      @authenticated
    cross-tenant-isolation.spec.ts   @authenticated
    staff-pin-access.spec.ts         @authenticated
    clinic-workflow.spec.ts          @authenticated @mutation
```

## Typechecking

```
npm run typecheck:e2e
```

Main `npm run typecheck` excludes `e2e/**` so the app typechecks without
Playwright installed locally.

## Adding new specs

1. Pick the right tag: `@security` (read-only, no session), `@smoke` (public),
   or `@authenticated` (needs demo tenant).
2. Import from `e2e/fixtures/auth.ts` — use `authenticatedTest` for session specs.
3. Add page interactions to `e2e/pages/` when a surface is reused across specs.
4. Prefer `getByRole`, `getByLabel`, and stable element ids over layout classes.
