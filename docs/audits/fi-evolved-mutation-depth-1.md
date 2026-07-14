# FI-EVOLVED-MUTATION-DEPTH-1 — Findings

**Milestone:** `FI-EVOLVED-MUTATION-DEPTH-1`  
**Status:** **GREEN (scoped)** — MD-01 + MD-02 + MD-03 + MD-05 PASS; MD-04 Doctor deferred/optional SKIP  
**Date:** 2026-07-14  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Plan:** [fi-evolved-mutation-depth-1-plan.md](./fi-evolved-mutation-depth-1-plan.md)  
**Prior pilot:** `FI-EVOLVED-OPERATIONAL-PILOT-1` GREEN (scoped) at `a8052a2b`

---

## Executive summary

Mutation+reload depth bake complete 2026-07-14. **MD-01 Consultant**, **MD-02 Nurse**, **MD-03 Finance**, and **MD-05 raw-password** PASS. MD-03 previously FAILED because the payment write gate ignored active `finance_admin` tenant-admin roles; fix `6df88546` is live on production. MD-05: ordinary login as `manager@evolvedhair.com.au` (no platform-admin impersonation) — Consultant workspace, bare tenant settle → `/crm`, Pipeline spot-check held. Help-needed: **0**. Doctor **MD-04** left deferred/optional SKIP (no separate Doctor raw-login bake required for GREEN).

---

## Session roster

| ID | Role | Identity | Mutation target | Status |
| -- | ---- | -------- | --------------- | ------ |
| MD-01 | Consultant | `manager@evolvedhair.com.au` (impersonation) · Consultant workspace | Pipeline stage-move + hard reload (golden SMOKETEST) | **PASS** |
| MD-02 | Nurse | `evieshackleton1@gmail.com` (impersonation) · Nurse workspace | Front desk check-in + hard reload (SMOKETEST-TMRW Deposit Due) | **PASS** |
| MD-03 | Finance | `harsh@evolvedhair.com.au` (impersonation) · Finance workspace / `finance_admin` | Money/invoice safe mutation + hard reload | **PASS** (re-bake after `6df88546`) |
| MD-04 | Doctor | — | Only if safe fixture | **SKIP** (optional; deferred) |
| MD-05 | Raw password | `manager@evolvedhair.com.au` (ordinary login) · Consultant workspace | Identity / landing / Pipeline spot-check (no impersonation) | **PASS** |

---

## Evidence log

| ID | Check | Result | Notes |
| -- | ----- | ------ | ----- |
| MD-01 | Consultant Pipeline stage-move + hard reload | **PASS** | Golden lead stage held after full reload; reverted; help-needed 0 |
| MD-02 | Nurse safe clinical + reload | **PASS** | SMOKETEST Front desk check-in held after full reload; ImagingOS reachability OK; help-needed 0 |
| MD-03 | Finance Money/invoice + reload | **PASS** | Due date mutate + hard reload held; Source labels OK; write gate fix live; help-needed 0 |
| MD-04 | Doctor safe mutation | **SKIP** | Optional; no safe Doctor fixture bake this milestone |
| MD-05 | ≥1 raw-password login | **PASS** | `manager@` ordinary session; no Exit impersonation; bare → `/crm`; Pipeline held |
| MD-06 | No P0 | **PASS** | No identity / security / patient-record loss |

---

## Session MD-01 — Consultant Pipeline stage-move

**Host:** `https://follicleintelligence.ai`  
**Surface:** `/crm` Pipeline + lead detail Pipeline tab  
**Fixture:** Golden SMOKETEST lead `c9a58f3d-e1e4-4187-9986-59faed41565d` (SMOKETEST-OPDAY-20260702) · patient `287348d5-18bd-4434-9bab-7caafacbfe86`  
**Help-needed count:** **0**

| Step | Result |
| ---- | ------ |
| Session present | **PASS** — Consultant workspace; Exit impersonation; CDP shows `manager@evolvedhair.com.au` |
| Lead selected | Golden lead `c9a58f3d-e1e4-4187-9986-59faed41565d` |
| Before stage | **Treatment planning** (`22648441-dab5-4ca0-92fb-17d9f84e865d`) |
| After stage-move | **Quote sent** (`619b2f30-cc69-4506-a144-fe8b7abfd502`) via Change stage on `?tab=pipeline`; history `Treatment planning → Quote sent` · `fi_admin_lead_detail` @ `2026-07-14T03:34:14Z` |
| Hard reload | Full navigate to same lead `?tab=pipeline` |
| After reload stage | **Quote sent** still selected; history row retained |
| Revert | **Quote sent → Treatment planning** @ `2026-07-14T03:34:33Z` (non-destructive) |
| Verdict | **PASS** |

### Evidence URLs

- Board: `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/crm`
- Lead Pipeline tab (mutation + reload): `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/crm/leads/c9a58f3d-e1e4-4187-9986-59faed41565d?tab=pipeline`

### Observe (not scored as MD-01 fail)

- Board cards for SMOKETEST did not expose **Move stage** in More (nav-only secondary on those shells); desktop drag handle absent (`FI_PIPELINE_ENABLE_DESKTOP_DRAG` / board path). Mutation exercised via lead detail **Change stage** under Pipeline tab — still Consultant Pipeline stage mutation + reload.
- Related-leads chips still labelled “Consult completed” while canonical stage is Treatment planning / Quote sent — fixture/display lag observed previously (F-PILOT-08 class); not patient-record loss.

---

## Session MD-02 — Nurse Front desk check-in + hard reload

**Host:** `https://follicleintelligence.ai`  
**Surface:** `/front-desk` (Nurse workspace landing)  
**Fixture:** `SMOKETEST-TMRW-20260714 SMOKETEST-TMRW-DEPOSIT-DUE surgery` (10:00 HT) — seed-evolved-smoketest-tomorrow-board  
**Identity:** Impersonating `evieshackleton1` · profile `evieshackleton1@gmail.com` · **Nurse workspace**  
**Help-needed count:** **0**

| Step | Result |
| ---- | ------ |
| Session present | **PASS** — Nurse workspace; Exit impersonation; Front desk current; CDP/banner `evieshackleton1` |
| Before mutation | Running late **1** / Waiting **1**; DEPOSIT-DUE card CTA **Check in patient**; UNAVAILABLE already Waiting (prior Reception S1 check-in) |
| Mutation | **Check in patient** on DEPOSIT-DUE → toast **Check in patient — saved** |
| Soft refresh | Running late **0** / Waiting **2**; DEPOSIT-DUE CTA → **Start consultation** |
| Hard reload | Full navigate to `/front-desk` |
| After reload | Running late **0** / Waiting **2** held; both SMOKETEST cards Waiting + Start consultation |
| Revert | **Not available** via More actions (no Undo check-in; Cancel / Mark no-show / Complete visit left untouched as more destructive). Left checked-in on SMOKETEST fixture — acceptable |
| Imaging path | **Reachable** — direct `/patients/287348d5-…/imaging` → ImagingOS · Clinical imaging workspace (Gallery/Capture/Protocols/zone data). **No capture/zone mutation** (not safely reversible for this bake) |
| Verdict | **PASS** |

### Evidence URLs

- Front desk (mutation + reload): `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/front-desk`
- ImagingOS (reachability only): `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/patients/287348d5-18bd-4434-9bab-7caafacbfe86/imaging`

### Observe (not scored as MD-02 fail)

- Brief board lag after save toast: card stayed in Running late with Check in still visible until Refresh / hydrate completed — same class as prior Payment due hydrate flicker; did not lose the mutation.
- More actions on checked-in card: Start treatment / Complete visit / Mark no-show / Cancel appointment / Find patient / Open calendar / Open patient — no undo check-in.

---

## Session MD-03 — Finance Money mutation + hard reload

**Host:** `https://follicleintelligence.ai`  
**Surface:** `/financial/payments` + golden case finances `cases/80ae7196-…`  
**Identity:** Impersonating **harsh** · badge **Finance workspace** · profile `harsh@evolvedhair.com.au` · Exit impersonation visible · `finance_admin`  
**Fixtures:** SMOKETEST payment rows Manual `230631c0-…` / Stripe `2abda5f6-…`; invoice `6815cad5-ed06-4ae0-9964-f664ab4757fa` (SMOKETEST manual · surgery_deposit · partially_paid); golden case `80ae7196-…` / patient `287348d5-…`  
**Help-needed count:** **0**  
**FI_PAYMENTS_ENABLED:** OFF — Manual payment tracking path (expected)  
**Prior:** **FAIL** (mutate blocked) · P1 fix `6df88546` · **re-bake PASS** 2026-07-14

| Step | Result |
| ---- | ------ |
| Session present | **PASS** — Finance workspace; impersonating harsh; profile `harsh@evolvedhair.c…` |
| Source labels | **PASS** — `/financial/payments`: **Manual tracking** (MANUALLY RECORDED · AUD 550.00) + **Provider confirmed (Stripe)** (SUCCEEDED · AUD 825.00) |
| Write gate live | **PASS** — `canMutate` UI present: Due date Save, Record payment…, Send payment link; no “finance or a manager must sign in to edit” / “Finance or manager access is required…” |
| Before mutation | SMOKETEST manual invoice `6815cad5-…` due date **empty/null** |
| Mutation | Set due date **2026-08-15** → Save → banner **Due date saved.** |
| Hard reload | Full navigate to `cases/80ae7196-…` |
| After reload | Due date input **2026-08-15**; RSC/payload `due_date: "2026-08-15"` on invoice `6815cad5-…` |
| Revert | **Not available via UI** — Save disabled when due empty; clearing to null not exposed. Left `2026-08-15` on SMOKETEST fixture — acceptable (non-destructive additive) |
| Verdict | **PASS** |

### P1 — finance_admin Money writes (closed)

| Field | Detail |
| ----- | ------ |
| ID | **MD-03-P1** |
| Severity | **P1** (was open; **CLOSED** on re-bake) |
| Symptom | Finance workspace / `finance_admin` (Harsh) could not mutate payment/invoice controls |
| root cause | Write gate only accepted legacy `fi_users.role`; ignored active `fi_tenant_admin_users.admin_role=finance_admin` |
| Fix | `6df88546` — allow active `finance_admin` / `clinic_admin` in payment write gate |
| Re-bake | **PASS** — due-date mutate + hard reload held on production |

### Evidence URLs

- Payment records (Source labels): `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/financial/payments`
- Golden case finances (mutation + reload): `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/cases/80ae7196-c15e-4929-8e1d-7ceaad5a2a31`

### Observe (not scored as separate fail)

- Soft-click on Money hub **Payment records** / **Open invoice** sometimes fails to navigate (SPA click lag); direct URL navigation works — P2 soft-nav class, not MD-03 score driver.
- `/financial/payments` and `/financial/invoices` remain list/read-only surfaces; mutation UX is on case PaymentRecordPanel + CaseRevenuePaymentsCard.

---

## Session MD-05 — Raw-password Consultant login

**Host:** `https://follicleintelligence.ai`  
**Surface:** Consultant chrome · bare tenant landing · `/crm` Pipeline  
**Identity:** Ordinary raw-password session · profile **`manager@evolvedhair.com.au`** · **Consultant workspace** · **no** platform-admin impersonation  
**Help-needed count:** **0**  
**Bake:** 2026-07-14 (cursor-ide-browser)

| Step | Result |
| ---- | ------ |
| Session present | **PASS** — profile menu / chrome show `manager@evolvedhair.com.au`; badge **Consultant workspace**; CDP: no “Exit impersonation”, no impersonating text; not Platform admin / Auditor |
| Bare tenant home | Navigate `…/fi-admin/c2615b95-…` → brief Home/Today flash → settles **`/crm`** (Pipeline) — F-PILOT-06 landing held for raw login |
| Pipeline spot-check | **PASS** — Visible **300** / Active **265**; Board (300); SMOKETEST-TMRW + SMOKETEST-OPDAY cards present; Planning / quote (1) held |
| Verdict | **PASS** |

### Evidence URLs

- Bare tenant (landing settle): `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a` → `/crm`
- Pipeline: `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/crm`

### Observe (not scored as MD-05 fail)

- Raw-password Consultant session shows Pipeline **Read-only** banner (“browse Pipeline and open leads, but changes are unavailable”) — identity/landing purity for MD-05 still PASS; mutation depth already covered under MD-01 impersonation path. Not treated as P0 identity/security loss.

---

## Exit checklist

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | MD-01 Consultant stage-move + reload | **PASS** |
| 2 | MD-02 Nurse safe clinical + reload | **PASS** |
| 3 | MD-03 Finance PASS or safe SKIP | **PASS** |
| 4 | MD-05 raw-password login | **PASS** |
| 5 | MD-06 no P0 | **PASS** |
| 6 | MD-04 Doctor PASS or SKIP | **SKIP** (optional / deferred) |

**Overall verdict:** **GREEN (scoped)** — MD-01–03 + MD-05 closed; MD-04 Doctor deferred/optional SKIP; no P0

---

## Related

- [fi-evolved-mutation-depth-1-plan.md](./fi-evolved-mutation-depth-1-plan.md)
- [fi-evolved-operational-pilot-1.md](./fi-evolved-operational-pilot-1.md)
