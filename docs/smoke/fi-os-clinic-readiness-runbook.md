# FI OS Clinic Operational Readiness — Smoke Runbook

**Purpose:** verify the app works end-to-end for a real demo clinic after the
security/RLS hardening patches (`fix(financial-os)` / `feat(clinic-os)` /
`feat(fi-os)` series, see `git log`). Run this before pointing a staging
clinic at the app, and again after any patch that touches auth, RLS, or the
financial/surgery pipeline.

## How to use this doc

1. Run the automated script layer: [scripts/fi-production-smoke-test.ts](../../scripts/fi-production-smoke-test.ts)
   ```
   FI_BASE_URL=https://<staging-host> FI_SMOKE_TENANT_ID=<uuid> npm run smoke:prod
   ```
   Optionally set `FI_SMOKE_OTHER_TENANT_ID=<second-tenant-uuid>` to also
   exercise cross-tenant denial checks (J). This layer only performs
   **unauthenticated** requests — it never logs in, never mutates data, and
   is safe to run against a real staging deployment.
2. Run the Playwright e2e layer ([e2e/README.md](../../e2e/README.md), added
   in Patch 7): covers the same fail-closed checks (1.5–1.7 below) as proper
   browser tests, plus confirming the public login route still loads.
   ```
   FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e
   FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e:headed   # headed/debug mode
   ```
   Point `FI_E2E_BASE_URL` at a local production build (`npm run build && npm run start`)
   or a staging deployment — not `next dev` (the auth guard in `middleware.ts`
   only activates when `NODE_ENV=production`). This suite is also
   unauthenticated/read-only as of Patch 7; authenticated flows are still
   manual until the fixture in `e2e/fixtures/auth.ts` is wired up.
3. Walk the manual checklist below for everything that requires an
   authenticated session, form interaction, or visual confirmation — this
   remains the fallback for sections 2–5 and for the authenticated parts of
   section 1 until the e2e suite grows auth coverage. Each row has a "how to
   verify" so a non-author tester can execute it.
4. Fill in the pass/fail matrix at the bottom and attach it to the patch/PR.

## Demo data conventions (do not seed real PII)

- Prefix every record created during this run with `SMOKETEST-` in the
  name/first-name field (e.g. patient first name `SMOKETEST-Patient`, lead
  name `SMOKETEST-Lead`, quote reference note `SMOKETEST run <date>`).
- Use a throwaway phone (`0000000000`) and a `+demo` email alias
  (`tester+smoketest@yourdomain.test`) — never a real patient's contact info.
- At the end of the run, soft-delete (do not hard-delete) every
  `SMOKETEST-` record you created, via the normal in-app delete action. Do
  not run any destructive SQL/cleanup script outside the records you
  created in this session.
- Use the two demo tenants already provisioned for this purpose if
  available (ask whoever holds `FI_SMOKE_TENANT_ID` for staging); never run
  this against a tenant with real patient data.

---

## 1. Login / access

| # | Check | How to verify | Pass/Fail |
|---|---|---|---|
| 1.1 | Platform admin can access `/fi-admin/system` | Log in as a `fi_platform_admin` user, navigate to `/fi-admin/system`, confirm the dashboard renders (no redirect to login, no 403 page). | |
| 1.2 | Tenant admin can access clinic dashboard | Log in as a tenant admin/owner, navigate to `/fi-admin/<tenantId>/financial/dashboard`, confirm it renders with that tenant's data only. | |
| 1.3 | Staff PIN flow works | From `/fi-admin/<tenantId>/staff-pin-login`, enter a valid staff ID + PIN, confirm redirect to `/fi-admin/<tenantId>/calendar` and that the PIN session can view the calendar but is scoped (no full admin nav). | |
| 1.4 | Staff PIN flow rejects bad PIN | Submit the same staff ID with a wrong PIN; confirm a 401 / inline error, no session cookie set, no redirect. | |
| 1.5 | Cross-tenant access denied (UI) | While logged in as Tenant A's admin, manually navigate to `/fi-admin/<TenantB-id>/financial/dashboard`. Confirm a 403/redirect — never Tenant B data. | |
| 1.6 | Cross-tenant access denied (API) | Run automated check **J** (`FI_SMOKE_OTHER_TENANT_ID` set) or, with Tenant A's session cookie, `fetch` `/api/tenants/<TenantB-id>/cases` from devtools — expect 401/403, not a 200 with data. | |
| 1.7 | Unauthenticated requests blocked in production | Automated checks **H**/**I** cover `/fi-admin/system` and `/fi-admin/<tenantId>/financial/dashboard` with no session — confirm both fail closed (redirect/401/403, never 200). Note: middleware guard in [middleware.ts](../../middleware.ts) only applies when `NODE_ENV=production`; this check is only meaningful against a production-mode deployment, not local `next dev`. | |

## 2. Core clinic workflow

| # | Check | How to verify | Pass/Fail |
|---|---|---|---|
| 2.1 | Create patient | Patients screen → create with `SMOKETEST-Patient` first name + throwaway contact info. Confirm it saves and appears in search. | |
| 2.2 | Search patient | Search `SMOKETEST-Patient` from global search / patients list. Confirm the record is found and only that tenant's results show. | |
| 2.3 | Create lead | CRM → new lead `SMOKETEST-Lead`. Confirm it lands in the pipeline at the expected stage. | |
| 2.4 | Convert lead to case | Use the lead conversion action ([leadConversion.ts](../../src/lib/crm/leadConversion.ts)). Confirm a case is created and linked back to the lead. | |
| 2.5 | Create consultation booking | Book a consultation against the new case from the calendar/booking flow. Confirm it appears on the calendar and on the case detail. | |
| 2.6 | Consultation form draft/save | Open the consultation form, fill partially, save as draft. Reload and confirm the draft persisted (no data loss). | |
| 2.7 | Consultation form submit | Complete and submit the form. Confirm the case transitions to the expected next status and the form is now read-only/locked. | |
| 2.8 | Generate quote/invoice/payment request | From the case, generate a quote ([crmQuoteMutations.server.ts](../../src/lib/crm/crmQuoteMutations.server.ts)). Confirm it appears in Payments Inbox and on the case financial tab. | |
| 2.9 | Confirm surgery booking | Book/confirm a surgery date for the case. Confirm the booking appears under [bookings.ts](../../src/lib/bookings/bookings.ts)-backed views. | |
| 2.10 | Case appears on operational boards | Confirm the `SMOKETEST-` case shows on: Surgery Readiness Board ([SurgeryReadinessBoard.tsx](../../src/components/fi-admin/surgery/SurgeryReadinessBoard.tsx)), Tomorrow Board ([TomorrowBoard.tsx](../../src/components/fi-admin/clinicOs/TomorrowBoard.tsx)), Procedure Day Board ([ProcedureDayBoard.tsx](../../src/components/fi-admin/surgery/ProcedureDayBoard.tsx)) once it meets each board's date/status filter. | |

## 3. Financial workflow

| # | Check | How to verify | Pass/Fail |
|---|---|---|---|
| 3.1 | Deposit pending state | On the quote/case before deposit payment, confirm the financial dashboard and case detail both show "deposit pending" (not blank, not a false "paid"). | |
| 3.2 | Balance due state | After a partial/deposit payment, confirm the balance-due amount displayed matches invoice total minus payments received, on both the case view and financial dashboard. | |
| 3.3 | Payments Inbox source links | Open Payments Inbox ([paymentsInboxLoader.server.ts](../../src/lib/revenueOs/paymentsInboxLoader.server.ts)). Confirm the `SMOKETEST-` quote row links correctly to its case and patient (click through, verify it lands on the right record, not another tenant's). | |

## 4. Image / clinical workflow

| # | Check | How to verify | Pass/Fail |
|---|---|---|---|
| 4.1 | Upload patient image | On the `SMOKETEST-Patient` case, upload a non-PII placeholder image via the uploads route ([app/api/fi/uploads/route.ts](../../app/api/fi/uploads/route.ts)). Confirm it appears in the case's image list. | |
| 4.2 | Signed image URL works | Open the uploaded image from the UI; confirm it loads (signed URL resolves, no 403/expired-link error). | |
| 4.3 | Blood/image extraction reports "analysis unavailable", not fake success | Run the case through the model pipeline. Confirm the report shows the hormonal/image section as omitted or explicitly "not analysed" — **not** a populated-looking result. This is expected and correct: [blood_extract.ts](../../lib/fi/stages/blood_extract.ts) and [image_extract.ts](../../lib/fi/stages/image_extract.ts) are intentionally stubbed (`STATUS: NOT IMPLEMENTED`) and return an honest empty/unavailable result rather than placeholder data. A regression here would be the stub silently returning fabricated marker values. | |

## 5. Soft-delete / RLS regression

| # | Check | How to verify | Pass/Fail |
|---|---|---|---|
| 5.1 | Soft-deleted case disappears from boards/search | Soft-delete the `SMOKETEST-` case via the normal delete action (see [activeCaseFilter.ts](../../src/lib/cases/activeCaseFilter.ts) for the filter logic). Confirm it no longer appears on the Surgery Readiness / Tomorrow / Procedure Day boards or in case search. | |
| 5.2 | Soft-deleted case still resolvable directly if your app supports an "archived" view | If there's an explicit archived/trash view, confirm the case *does* appear there (proves it's soft, not hard, deleted) — otherwise confirm it's retrievable via a direct DB check (`deleted_at IS NOT NULL`), not skip this entirely. | |
| 5.3 | Tenant A cannot see Tenant B patient records | While logged in as Tenant A, attempt to view/search a known Tenant B patient by ID or name. Confirm zero results / 403 — never a leak. | |
| 5.4 | Tenant A cannot see Tenant B case records | Same as 5.3 for a case ID. Try both the UI case-detail URL and the `/api/tenants/<TenantB>/cases/<caseId>` API directly. | |

---

## Pass/Fail matrix template

Copy this into the PR description after running the checklist:

```
FI OS Clinic Readiness Smoke — <date> — <tenant(s) tested> — <tester>

Automated (scripts/fi-production-smoke-test.ts):
  A-K: PASS / FAIL / SKIPPED (paste script output)

Automated (npm run test:e2e — e2e/security/unauthenticated-access.spec.ts):
  PASS / FAIL (paste `playwright test` summary)

1. Login/access:        1.1 _  1.2 _  1.3 _  1.4 _  1.5 _  1.6 _  1.7 _
2. Core workflow:       2.1 _  2.2 _  2.3 _  2.4 _  2.5 _  2.6 _  2.7 _  2.8 _  2.9 _  2.10 _
3. Financial:           3.1 _  3.2 _  3.3 _
4. Image/clinical:      4.1 _  4.2 _  4.3 _
5. Soft-delete/RLS:     5.1 _  5.2 _  5.3 _  5.4 _

Blockers found: <list or "none">
SMOKETEST records created and soft-deleted: <list or "none left">
```

## Known blockers for staging clinic use (as of this patch)

- **Blood/image extraction is intentionally unimplemented** (see 4.3). This is
  correct-by-design (no fabricated results) but means no real clinical
  scorecard signal exists yet from blood/image uploads — a staging clinic
  should be told this section is not live, not treated as a bug.
- **Playwright is now set up (Patch 7) but only covers unauthenticated
  security checks** (`e2e/security/unauthenticated-access.spec.ts`).
  Sections 1.1–1.4 (authenticated login/PIN flows) and sections 2–5 remain
  manual until the auth fixture in `e2e/fixtures/auth.ts` is wired up with
  real (throwaway, env-supplied) demo credentials. First-time setup
  (`npm install` to pull `@playwright/test`, then `npx playwright install
  chromium`) must be run on a network **without** TLS interception — on some
  managed machines the Playwright tarball fails with
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and a failed install corrupts
  `node_modules`. See [e2e/README.md](../../e2e/README.md) for the full note.
- **Middleware auth guard only activates when `NODE_ENV=production`**
  (`middleware.ts`); running this checklist against `next dev` will not
  exercise 1.7's fail-closed behavior — use a production build or a deployed
  staging host for that check.
- Any other blocker discovered while executing this checklist should be
  logged in the pass/fail matrix above and triaged before staging clinic
  go-live.
