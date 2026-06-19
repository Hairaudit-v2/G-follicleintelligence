# FI OS Playwright foundation

Minimal e2e foundation (Patch 7). Currently covers **unauthenticated
security smoke tests only** — see [security/unauthenticated-access.spec.ts](security/unauthenticated-access.spec.ts).
No login, no patient/booking/payment workflow, no data mutation.

## One-time setup (do this in a clean network environment)

`@playwright/test` is declared in `package.json` but the browser binaries
are not committed. Install both where TLS is **not** intercepted by a
corporate proxy/AV (see the TLS note below):

```
npm install                  # resolves @playwright/test from the registry
npx playwright install chromium
```

> **TLS-interception note:** on some managed Windows machines the
> `playwright` npm tarball fails to download with
> `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, and the failed install rolls back and
> corrupts `node_modules`. If you hit this, do the `npm install` on a
> network without TLS interception (or point Node at the corporate root CA
> via `NODE_EXTRA_CA_CERTS`) — do **not** repeatedly retry the install on the
> intercepting network. The rest of the app installs fine; only the
> Playwright tarball is affected.

## Typechecking

The main app typecheck (`npm run typecheck`) **intentionally excludes**
`e2e/**` and `playwright.config.ts` (see the `exclude` list in
[tsconfig.json](../tsconfig.json)). This keeps `npm run typecheck` green even
when `@playwright/test` is not installed locally — for example on the
TLS-intercepted machine described below, where the Playwright tarball can't be
downloaded. Without this exclusion, every typecheck would fail on the missing
`@playwright/test` types.

The e2e suite is still fully typechecked, just under its own config:

```
npm run typecheck:e2e        # uses tsconfig.e2e.json
```

[tsconfig.e2e.json](../tsconfig.e2e.json) extends the main config, re-includes
`e2e/**/*.ts` + `playwright.config.ts`, and uses Node-compatible compiler
settings. It **requires `@playwright/test` to be installed**, so
`typecheck:e2e` will fail until you run `npm install` in a clean network
environment (see the one-time setup above). That's expected — run it in CI or
on an unintercepted network, not on the TLS-intercepted machine.

## Running

**Security only (FI-LAUNCH-035)** — against an already-running production server:

```
npm run build && npm run start
FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e:security
```

**One command** (build → start → security suite → shutdown):

```
npm run test:e2e:security:production
```

Full suite (all e2e specs):

```
FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e
FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e:headed
```

`FI_E2E_BASE_URL` is required — the suite throws a clear error if it's
unset (see [fixtures/baseUrl.ts](fixtures/baseUrl.ts)). Point it at:

- a local production build: `npm run build && npm run start` (defaults to
  `http://localhost:3000`), **not** `next dev` — the auth fail-closed
  behavior in `middleware.ts` only activates when `NODE_ENV=production`; or
- a staging deployment URL.

Optional `FI_E2E_TENANT_ID` supplies a real tenant UUID for routes that need
one; without it, tests fall back to a syntactically valid placeholder UUID
(fine for "access denied" assertions, since no tenant data is read).

## Node TLS on managed Windows (Supabase scripts / `npm run dev`)

On some corporate networks, Node’s default CA store fails Supabase HTTPS with
`UNABLE_TO_VERIFY_LEAF_SIGNATURE` while browsers and the Supabase MCP plugin
still work.

- **`npm run dev`** — runs Next with `node --use-system-ca`.
- **`npm run check:env`**, **`npm run seed:enterprise-demo`**, **`npm run validate:titan-global-command-centre`** — run via `scripts/run-with-system-ca.mjs`, which uses `node --use-system-ca --import tsx` (the `tsx` CLI re-execs Node without the flag).
- Do **not** set `NODE_OPTIONS=--use-system-ca` — Node rejects that flag in
  `NODE_OPTIONS` on some builds. Clear it with `Remove-Item Env:NODE_OPTIONS`
  (PowerShell) if present.
- Alternative: point Node at your corporate root CA with `NODE_EXTRA_CA_CERTS`.

## Layout

```
e2e/
  fixtures/
    baseUrl.ts   — FI_E2E_BASE_URL / FI_E2E_TENANT_ID resolution
    auth.ts      — documented placeholder for a future authenticated-session
                   fixture; not wired up yet (see comments in the file for why)
  security/
    unauthenticated-access.spec.ts
```

## What's deliberately out of scope (Patch 7)

- Authenticated flows (platform admin, tenant admin, staff PIN session) —
  blocked on having a safe, non-secret way to provision demo credentials
  for CI. See `e2e/fixtures/auth.ts` for the intended fixture shape once
  that exists.
- The full patient/lead/booking/payment workflow — see
  [docs/smoke/fi-os-clinic-readiness-runbook.md](../docs/smoke/fi-os-clinic-readiness-runbook.md)
  for the manual checklist that covers this today.

## Adding new specs

- Keep unauthenticated, read-only checks in `e2e/security/`.
- Anything that needs a session should import `test`/`expect` from
  `e2e/fixtures/auth.ts` (not directly from `@playwright/test`) so it picks
  up the auth fixture once it exists, without every spec needing an edit.
