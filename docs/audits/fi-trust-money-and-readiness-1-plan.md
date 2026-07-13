# FI-TRUST-MONEY-AND-READINESS-1 — Audit plan

**Milestone:** `FI-TRUST-MONEY-AND-READINESS-1`  
**Validates:** Money trust + surgery readiness operational truth (deferred from `FI-ROLE-JOURNEY-BAKE-1`)  
**Date:** 2026-07-13  
**Mode:** Audit-first (Phase 1), then evidence-backed fixes + live bake (Phase 2)  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)

---

## 1. Scope

### In scope

| Area | Surfaces | Trust question |
| ---- | -------- | -------------- |
| Money hub | `/financial-os`, Money CTAs, truth banner | Staff see **Money** as the single finance door; manual vs card capture honestly described |
| Payment records | `/financial/payments`, `/payments` (flag off) | Row-level **manual tracking** vs **provider-confirmed** labelling; disabled inbox copy |
| Financial clearance | Booking confirmation guard, `FinancialClearancePanel`, readiness/tomorrow boards | Staff errors and clearance copy point to **Money**, not architecture brands |
| Surgery readiness | `/surgery-readiness`, loader model | Staff/room assignment issues, deposit issues, 7-day escalation |
| Tomorrow board | `/front-desk/tomorrow`, loader | Surgery rows show manual payment + clearance chips consistently |
| Procedure day | `/procedure-day` loaders (flag off) | Non-interference when disabled; wiring present when enabled |
| Golden patient spine | Case/patient financial panels | Clearance on linked case does not contradict Money hub narrative |

### Out of scope

- Full `/financial/*` tree merge or new finance modules
- Hard-block procedure day start (SOP still owns OR-day hold)
- Stripe auto-sync into manual `fi_payment_records`
- Procedure Day enablement for pilot (`FI_PROCEDURE_DAY_ENABLED` stays off)
- Payments inbox enablement (`FI_PAYMENTS_ENABLED` stays off unless ops explicitly approves)
- Owner intelligence, patient portal, AI, finance reporting expansion
- Broad UX redesign of boards or nav

---

## 2. Roles to validate

| Priority | Role | Operator (Evolved) | Why |
| -------- | ---- | ---------------- | --- |
| **P0** | `finance_admin` | `harsh@evolvedhair.com.au` (CFO / Finance workspace) | Money hub landing, payment list labels, deposit tiles |
| **P1** | Nurse | `evie@…` / `diana@…` | Tomorrow board, front-desk clearance copy |
| **P1** | Doctor / surgeon | `s***@gmail.com` (Dr Seetal) | Surgery readiness board, assignment issues |
| **P2** | Consultant | `manager@evolvedhair.com.au` / `c***@icloud.com` | Case financial clearance panel on golden patient |
| **P2** | Clinic manager | `m***@evolvedhair.com.au` | Cross-check readiness manager filters |
| **Defer** | Reception | `j***@hotmail.com` | Money path via More only; spot-check disabled `/payments` link |

**Staff mapping gate (2026-07-13):** `10/10` operators mapped — includes `harsh@` after finance_admin reclassify.

---

## 3. Environment flags

| Flag | Expected (pilot) | Bake impact |
| ---- | ---------------- | ----------- |
| `FI_PAYMENTS_ENABLED` | `false` | Money canonical; `/payments` honest disabled state; CTA → `/financial/payments` |
| `FI_PROCEDURE_DAY_ENABLED` | `false` | Procedure Day hidden; loaders must not break other boards |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` | includes Evolved UUID | Pipeline door for case linkage checks |
| `NODE_ENV` | `production` for live/E2E | Auth middleware fail-closed |

**Compare local vs production:**

```bash
npm run compare:bake-env
```

---

## 4. Check matrix

| ID | Check | Route / artifact | Roles | Evidence |
| -- | ----- | ---------------- | ----- | -------- |
| M1 | Money hub title + truth banner | `/financial-os` | finance_admin | Live screenshot + `moneyTrustCopy.test.ts` |
| M2 | Take payment CTA path when flag off | `/financial-os` → `/financial/payments` | finance_admin | Live + unit href test |
| M3 | Disabled payments inbox | `/payments` | finance_admin, reception | Live copy cites Money link |
| M4 | Payment row source labels | `/financial/payments` | finance_admin | **Requires non-empty `fi_payments` rows** |
| M5 | Manual payment record copy | Case/patient payment panel | consultant, finance | Live on case with `fi_payment_records` |
| C1 | Clearance guard message uses Money | Booking confirm (within 14d) | nurse/consultant | Unit + live attempt |
| C2 | Clearance panel reason — no FinancialOS brand | Case detail, readiness card | doctor, consultant | Live grep + UI |
| C3 | Deposit / clearance consistency | Money hub tiles vs board badges | finance_admin, nurse | Live compare same booking |
| R1 | Staff assignment issue | `/surgery-readiness` | doctor, manager | Live card with unassigned booking |
| R2 | Room assignment issue | `/surgery-readiness` | doctor, manager | Live card |
| R3 | 7-day high-risk escalation | Model + live | doctor | Unit + live surgery ≤7d |
| T1 | Tomorrow surgery clearance chips | `/front-desk/tomorrow` | nurse | Live tomorrow window |
| P1 | Procedure day loader non-interference | `/procedure-day` hidden | doctor | Unit + HTTP 404/redirect |
| G1 | Golden patient case clearance | `/cases/{id}` | consultant | Golden patient `287348d5-…` if case linked |

---

## 5. Evidence collection

### Automated (Phase 1 — safe, no secrets)

**Money + readiness unit bundle:**

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/financialOs/moneyTrustCopy.test.ts \
  src/lib/surgery/surgeryReadinessBoardModel.test.ts \
  src/lib/bookings/bookingSurgeryFinancialClearanceGuardCore.test.ts \
  src/lib/financialOs/financialClearanceCore.test.ts \
  src/lib/clinicOs/tomorrowBoardModel.test.ts \
  src/lib/clinicOs/tomorrowBoardRegression.test.ts \
  src/lib/procedureDay/procedureDayNonInterference.test.ts \
  src/lib/surgery/procedureDayBoardModel.test.ts \
  src/lib/patients/goldenPatientSpineCore.test.ts \
  src/lib/fiAdmin/fiOsShellPrimaryNav.test.ts
```

**Staff mapping:**

```bash
node scripts/run-with-system-ca.mjs tsx scripts/audit-staff-mapping-completeness.ts
```

**Code audit (payment source + clearance strings):**

```bash
rg -n "manual tracking|provider|FinancialOS signals|moneyClearanceBlockedStaffMessage" \
  src/lib/financialOs src/lib/payments app/\(fi-admin\)/fi-admin/\[tenantId\]/financial/payments
```

### Live bake (Phase 2)

- Tool: cursor-ide-browser MCP or manual browser
- Session: platform-admin impersonation of target operator
- Tenant: `c2615b95-b707-4485-aa5f-be8f78ec868a`
- Record: route, role, PASS/FAIL, screenshot note, defect ID

---

## 6. Defect classification

| Class | Definition | Fix in milestone? |
| ----- | ---------- | ----------------- |
| **P0** | Wrong money truth (implies bank proof when manual); clearance bypass; misleading disabled state | Yes — must fix before GREEN |
| **P1** | Staff-visible FinancialOS brand in clearance/errors; finance_admin landing/workspace regression | Yes |
| **P2** | Missing row-level payment source labels; readiness board not live-verified; clearance copy inconsistency | Yes if proven small/contained |
| **P3** | Empty payment list (data gap not product bug); pre-existing unit flake | Document; fix only if trivial |

**Carry-forward IDs from bake-1:**

| ID | Class | Item |
| -- | ----- | ---- |
| DEF-MONEY-01 | P2 | Manual vs provider-confirmed payment row labelling on `/financial/payments` |
| DEF-READY-01 | P2 | Deposit / financial clearance consistency + Money pointer on boards |
| MONEY-LIVE-01 | P3 | Empty payment list blocked row-label live verification |

---

## 7. Acceptance criteria

| # | Criterion | Phase |
| - | --------- | ----- |
| 1 | Money hub PASS for `finance_admin` (landing, banner, CTAs) | Live |
| 2 | `/payments` disabled state honest with Money link | Live |
| 3 | Payment rows show staff-trustworthy source label (manual vs provider) when data exists | Live + code |
| 4 | Clearance guard + panel staff copy references **Money**, not FinancialOS | Unit + live |
| 5 | Surgery readiness shows staff/room assignment + deposit issues with escalation | Unit + live |
| 6 | Tomorrow board surgery section shows aligned clearance/deposit copy | Live |
| 7 | Procedure day flag off — no false OR-day claims; loaders non-interfering | Unit |
| 8 | No new modules; fixes limited to P0/P1 + contained P2 | Review |

---

## 8. Release decision rubric

| Verdict | Conditions |
| ------- | ---------- |
| **GREEN** | M1–M3, C1, C4 (guard copy), R1–R2 live PASS; M4 PASS or documented data seed; no open P0/P1 |
| **AMBER** | Money hub GREEN but readiness/tomorrow live incomplete OR payment rows unseeded (M4/M5 deferred) |
| **RED** | P0 money truth failure; clearance guard wrong; finance_admin landing regression |

---

## 9. Recommended bake sequence

1. **Finance admin baseline (harsh@)** — re-verify M1–M3 on production (prior GREEN post-`4e08a911`); then M4 after seeding or locating `fi_payments` rows.
2. **Data seed (controlled)** — create or locate:
   - One **manual** `fi_payment_records` row on a surgery booking in the 14-day window
   - One **`fi_payments`** row with `provider=stripe` and one with `provider=manual` (if tenant data absent, finance admin creates via existing flows — prefix `SMOKETEST-`)
3. **Consultant case clearance (G1, C2)** — golden patient `287348d5-…` / linked case; confirm `FinancialClearancePanel` copy.
4. **Doctor readiness (R1–R3)** — `/surgery-readiness` for upcoming surgery; confirm assignment + deposit issues.
5. **Nurse tomorrow (T1, C3)** — `/front-desk/tomorrow` for next-day surgery row; compare deposit label with Money hub.
6. **Procedure day non-interference (P1)** — confirm route hidden; no nav regression.

### Suggested first live bake

| Field | Value |
| ----- | ----- |
| Role | `finance_admin` — `harsh@evolvedhair.com.au` |
| Tenant | `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| Patient / case | Start with **golden patient** `287348d5-…` (SMOKETEST) — verify case financial panel; then locate any tenant surgery booking in the 14-day window on `/surgery-readiness` for cross-surface clearance compare |
| Blocker | `/financial/payments` empty on prior bake — **seed or query** `fi_payments` before M4 sign-off |

---

## 10. Phase 1 audit commands log

| Command | Date | Result |
| ------- | ---- | ------ |
| Money + readiness unit bundle (10 files) | 2026-07-13 | **96/97 pass** — 1 fail: `procedureDayNonInterference` nav subtest (pre-existing) |
| `audit:staff-mapping` (system CA) | 2026-07-13 | **PASS** — 10/10 operators |
| Code audit: payment page columns | 2026-07-13 | Provider column only; no Source / manual-vs-Stripe row label |
| Code audit: clearance unavailable reason | 2026-07-13 | `financialClearanceCore.ts` still emits "FinancialOS signals" (staff-visible via panel) |

---

## 11. Related docs

- [fi-trust-money-and-readiness-1.md](./fi-trust-money-and-readiness-1.md) — findings log
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md) — deferred gaps §11, §16
- [fi-os-clinic-readiness-runbook.md](../smoke/fi-os-clinic-readiness-runbook.md) — SMOKETEST conventions
- [financial-safety-audit.md](../production/evidence/financial-safety-audit.md) — dual payment truth context
