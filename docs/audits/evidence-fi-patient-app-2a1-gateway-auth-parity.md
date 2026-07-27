# FI-PATIENT-APP-2A.1 — Native Gateway Authorization Parity Repair

**Ticket:** FI-PATIENT-APP-2A.1  
**Branch:** `feature/fi-patient-app-2a1-gateway-auth-parity`  
**Date:** 2026-07-27  
**Verdict:** **GREEN**

Companion JSON: `evidence-fi-patient-app-2a1-gateway-auth-parity.json`

---

## Root cause

Not a route-specific authorization split in `/me` / `/journey` / `/billing`.

All five patient gateway routes share `requirePatientGatewayContext`. After a successful gate:

- `/me` and `/journey` cannot return 403 for “missing domain data”
- `/billing` with zero invoices returns a patient-safe empty/zero **200**
- `/appointments` / `/messages` empty lists also return **200**

### Why Android looked inconsistent

1. **Home / Journey** call real APIs (`getMe`, `getJourney`). With an unlinked portal auth user they correctly returned **403 `unlinked`**, mapped in the app to “You do not have access to this information.”
2. **Appointments / Messages** screens in FI-PATIENT-APP-2A are **placeholders** and do **not** call the gateway — so they appeared to “PASS” without proving API authorization.
3. Database inspection before repair: **0** `fi_patients` rows had `portal_auth_user_id` set. The golden SMOKETEST patient (`FI_E2E_PATIENT_ID`) was active with tenant/person but **no portal link**.

So the same valid Supabase bearer could sign in to the app, then fail the gateway gate on every real `/api/patient/v1/*` call.

No authorization weakening was required or performed.

---

## Repair executed

### Synthetic demo fixture (approved demo-data path)

Added idempotent seed (does **not** modify golden SMOKETEST patient identity):

- `src/lib/patientPortal/patientGatewayMobileDemoFixtureCore.ts`
- `src/lib/patientPortal/patientGatewayMobileDemoFixtureSeed.server.ts`
- `scripts/seed-patient-gateway-mobile-demo.ts`
- npm script: `seed:patient-gateway-mobile-demo`

Creates/links one unambiguous chain:

`auth.users` → `fi_patients.portal_auth_user_id` → active patient + person + tenant

Fixture email (safe to document): `e2e-patient-gateway-mobile@fi-demo.example`  
Password: local-only via seed stdout / `FI_E2E_PATIENT_GATEWAY_MOBILE_PASSWORD` (not committed).

### Parity regression tests

`src/lib/patientPortal/patientGatewayAuthParity2a1.test.ts` documents:

- empty journey state ⇒ patient-safe DTO (not deny)
- empty billing ⇒ zero/empty 200 shape (not deny)
- unlinked auth remains fail-closed

### Live probe helper

`scripts/probe-patient-gateway-mobile-parity.ts` — prints status/code only with UUID/JWT redaction.

---

## Live proofs (same bearer; redacted)

| Check | Result |
|-------|--------|
| A `/me` | **200** `ok:true` |
| B `/journey` | **200** patient-safe early stage |
| C `/appointments` | **200** empty upcoming/past |
| D `/billing` | **200** zero outstanding / empty |
| E `/messages` | **200** default general thread |
| F invalid bearer `/me` | **401** `invalid_token` |
| H foreign `patientId` claim | **403** `ownership_denied` |
| G wrong `tenantId` claim | **403** `wrong_tenant` |

Golden SMOKETEST patient portal link remained **unset** (no production identity “repair”).

---

## Mandatory proofs A–L

| ID | Result |
|----|--------|
| A–E same valid bearer across me/journey/appointments/billing/messages | **PASS** (live probe) |
| F invalid bearer denied | **PASS** |
| G wrong tenant denied | **PASS** |
| H foreign patient id cannot alter identity | **PASS** |
| I inactive/unlinked fail-closed | **PASS** (gate core tests + pre-repair DB state) |
| J 1B–1F gateway suites | **PASS** (core + server + non-regression samples below) |
| K FiOS webapp product surfaces unchanged | **PASS** (additive seed/tests/scripts only; no web UI changes) |
| L Android physical retest | **OPERATOR** — sign in with synthetic fixture email above; Home + Journey should load; placeholders still render |

### Test commands run

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/patientPortal/patientGatewayAuthParity2a1.test.ts \
  src/lib/patientPortal/patientGatewayGateCore.test.ts \
  src/lib/patientPortal/patientGatewayMeCore.test.ts \
  src/lib/patientPortal/patientGatewayJourneyCore.test.ts \
  src/lib/patientPortal/patientGatewayBillingCore.test.ts \
  src/lib/patientPortal/patientGatewayOwnershipCore.test.ts

node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/patientPortal/patientGatewayGate.server.test.ts \
  src/lib/patientPortal/patientGatewayJourney.server.test.ts \
  src/lib/patientPortal/patientGatewayAppointments.server.test.ts \
  src/lib/patientPortal/patientGatewayBilling.server.test.ts \
  src/lib/patientPortal/patientGatewayMessaging.server.test.ts \
  src/lib/patientPortal/patientGatewayBillingNonRegression.test.ts \
  src/lib/patientPortal/patientGatewayMessagingNonRegression.test.ts
```

Results: **33/33** then **51/51** passed (2026-07-27).

---

## Security invariants preserved

- Bearer only
- Canonical patient/tenant server-derived
- No client patientId/tenantId resolution
- No cross-patient / cross-tenant access
- No fuzzy identity matching
- Fail closed for unlinked / inactive / ambiguous / claim mismatch
- No gate weakening
- No demo-patient special case in route handlers

---

## Explicit non-changes

- No mobile client authorization bypass
- No ownership guard relaxation
- No webapp UI / staff CRM path changes
- No golden SMOKETEST patient portal backfill
