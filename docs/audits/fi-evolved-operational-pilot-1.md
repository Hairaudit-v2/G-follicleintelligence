# FI-EVOLVED-OPERATIONAL-PILOT-1 — Findings

**Milestone:** `FI-EVOLVED-OPERATIONAL-PILOT-1`  
**Status:** **AMBER → path-to-GREEN (fixes landed; live P1 re-bake pending deploy)**  
**Date:** 2026-07-14  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Plan:** [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)  
**Kickoff commit:** `8a058a46`  
**P1 fix commit:** `fd4c945c`  

---

## Executive summary

Live clinic-day bake **day-1 planned roles complete** 2026-07-14. **S1 Reception (Jesika)** **PASS** — Front desk + Calendar OK; **check-in mutation + reload PASS** (08:00 SMOKETEST → Waiting held after full reload). **S2–S5:** prior evidence stands; **F-PILOT-06 / 11 / 18 code fixes landed** (unit tests green) — **live re-bake pending production deploy**. Staff-mapping gate **PASS**. **No P0.** Verdict remains **AMBER** until P1s re-verified live.

**Core question:** Can Evolved staff use agreed core workflows during a real clinic day without developer intervention?

**Key metric:** how often staff need help to complete ordinary work (not test count).  
**Help needed so far:** S1–S5 **0** each (auditor bake only).

---

## Kickoff readiness

| Item | Result |
| ---- | ------ |
| Plan read | Done |
| Findings status | **AMBER** — S1 mutation PASS; P1 code fixes landed; live P1 re-bake pending deploy |
| Browser login | **Yes** — S1 Jesika; S2 `manager` (Consultant); S3 Evie (Nurse); S4 Seetal (Doctor); S5 Harsh (Finance) impersonation |
| Raw staff password login | **Not this session** — Exit impersonation visible |
| First gate | Reception — **PASS** (check-in + reload); Consultant — **PARTIAL** (landing fix pending bake); Nurse — **PARTIAL** (PRP fix pending bake); Doctor — **PASS**; Finance — **PARTIAL** (Patients fix pending bake) |
| Staff mapping `npm run audit:staff-mapping` | **PASS** — 10 operators, 0 missing `fi_staff`, 0 missing access signal (HR-DRIFT monitor only; no fix) |

### Pilot day roster (Evolved)

| Role | Who to exercise | Email (known) | Surfaces | Session status |
| ---- | --------------- | ------------- | -------- | -------------- |
| Reception | Roslyn / Jesika | `roslynhrichards@outlook.com` / Jesika `j***@hotmail.com` (`jesika.watt11`) | Front desk, Today, Calendar/bookings, Patients | **S1 PASS** — doorway + Calendar view OK; **check-in mutation + reload PASS** |
| Consultant | manager@ | `manager@evolvedhair.com.au` | Pipeline, Consultations, Patients, Calendar | **S2 PARTIAL** — CRM usable; bare→Today (F-PILOT-06 fix landed; re-bake pending) |
| Nurse | Evie | `evieshackleton1@gmail.com` | Treatment appointments, imaging, Patients, Today | **S3 PARTIAL** — FD+Calendar+Imaging OK; PRP filter fix landed (re-bake pending) |
| Doctor | Dr Seetal | `seetskd@gmail.com` | Doctor workspace, Calendar, Patients | **S4 PASS** — `/doctor` landing + clinical spine usable; no new P0/P1 |
| Finance / clinic admin | Harsh | `harsh@evolvedhair.com.au` (`finance_admin` — **Finance workspace**, not clinic_admin) | Money (+ balances) | **S5 PARTIAL** — Money OK; Patients→Surgery fix landed (re-bake pending) |
| Manager / mapping | Paul / mapped pilot staff | `paul@evolvedhair.com.au` (owner) | Team access + staff mapping | Mapping gate only so far |

**Exact next session ask:** Deploy P1 fixes → live re-bake bare `/crm` (consultant), Calendar `type=prp` (nurse), Finance `/patients` (Harsh). HR-DRIFT remains monitor-only.

---

## Foundational prerequisites (already closed)

| Area | Prior milestone / note |
| ---- | ---------------------- |
| Role landings | Trust landing / spine + role bake |
| Pipeline | Trust E2E + Pipeline allowlist |
| Money | Trust money + readiness GREEN |
| Reception | Trust CI + reception R1 |
| Clinical-intelligence trust | Readiness / tomorrow live bakes |
| Staff mapping | `audit:staff-mapping` gate |
| Golden-patient | Trust spine |
| CI / typecheck hygiene | `FI-CI-SIGNAL-HYGIENE-1` **COMPLETE / CLOSED** (`87ce552e` / e2e-smoke **29291826298**) |

Deferred backlog that **must not delay** this pilot: CI-TRIAGE-TEAM-01 (Eng/CI), CI-FIX-01 (Eng/CI), HR-DRIFT-01 (Ops/HR — monitor only unless P0 identity).

---

## Frozen pilot surfaces

Front desk · Today · Calendar and bookings · Pipeline · Patients · Consultations · Money · treatment appointments and imaging · Team access and staff mapping.

**Out of scope unless already approved:** Procedure Day automation, expanded Stripe/payment-provider workflows, advanced owner analytics, patient-portal expansion, new AI, new modules or navigation restructuring.

---

## Staff mapping snapshot (kickoff)

```
tenant_id=c2615b95-b707-4485-aa5f-be8f78ec868a
operators_with_login: 10
missing_fi_staff: 0
missing_access_signal: 0
PASS: all linked operators have fi_staff mapping
```

Roles seen (masked emails in script): Manager, consultant, Receptionist×2, owner, Nurse×2, Contractor Doctor / Hair Transplant Surgeon, CFO, Manager.

**P9 (mapping):** **PASS at kickoff** — re-check if HR sync runs mid-pilot.

---

## Evidence log

| Session | Role | Doorway OK? | Tasks completed | Help needed? | Blockers / notes |
| ------- | ---- | ----------- | --------------- | ------------ | ---------------- |
| S1 | Reception (Jesika impersonation) | **YES** — Reception workspace → `/front-desk` | View Front desk board; open Calendar (week); confirm 2 SMOKETEST surgeries; **Check in** 08:00 SMOKETEST-TMRW Unavailable → Waiting; **full reload held** Waiting=1 / Running late=1 | **0** (auditor bake) | Mutation+reload **PASS**; tablet N/A desktop |
| S2 | Consultant (manager@ impersonation) | **PARTIAL** — Consultant workspace + greeting; bare tenant → **Today** (expected `/crm`) | Pipeline board (H-scroll contained); `/leadflow`→`/crm`; golden lead+patient; consultation hub; Calendar (2 appts after settle); Money hub; reload lead held | **0** (auditor bake) | Pipeline under More (not primary rail); soft-nav on some consultation links; see F-PILOT-06..09 |
| S3 | Nurse (Evie impersonation) | **YES** — Nurse workspace; bare → `/front-desk` after settle | Front desk board; Calendar Surgery filter + 2 HT surgeries; PRP filter URL toggles; ImagingOS on golden patient; Patients hub; Tomorrow board (empty Jul 15); ImagingOS reload held | **0** (auditor bake) | Soft-nav ImagingOS / Open calendar; `type=prp` still showed Surgery cards (F-PILOT-11); Payment due hydrate flicker |
| S4 | Doctor (Seetal impersonation) | **YES** — Surgeon/Doctor workspace; bare → `/doctor` after brief Today flash | Doctor Workspace queues; Patients hub; Calendar Surgery (2 HT + readiness %); Surgery readiness board; golden patient + consultation hub; Doctor re-nav held | **0** (auditor bake) | Soft-nav Open surgery delayed then Calendar; readiness Room summary vs card blockers (F-PILOT-15); did not open Procedure Day automation |
| S5 | Finance (Harsh impersonation) | **YES** — Finance workspace; bare → `/financial-os` after brief Today flash | Money hub (manual tracking banner); payment Source labels; invoices balances = hub tiles; `/payments` FI_PAYMENTS honesty; Money re-nav held | **0** (auditor bake) | Direct `/patients` + `/patients/{id}` settle to Surgery `/cases` (F-PILOT-18); rail Calendar/Patients non-link labels |

### Session checklist template (per role)

| Check | Reception S1 | Consultant S2 | Nurse S3 | Doctor S4 | Finance S5 |
| ----- | ------------ | ------------- | -------- | --------- | ---------- |
| Correct login landing (P1) | **PASS** — Front desk / Reception workspace (impersonation) | **PARTIAL** — Consultant workspace OK; bare → Today not `/crm` (F-PILOT-06; fix landed) | **PASS** — Nurse workspace; bare → `/front-desk` after settle | **PASS** — Surgeon workspace; bare → `/doctor` after settle | **PASS** — Finance workspace; bare → `/financial-os` after settle |
| Ordinary tasks completed (P2) | **PASS** — view board + Calendar + **check-in mutation** | **PASS** — Pipeline view/work; lead/patient/consult path; Calendar; Money readable | **PASS** — Front desk; Calendar Surgery; ImagingOS; Patients; Tomorrow | **PASS** — Doctor queues; Patients; Calendar; Surgery readiness; consult path | **PASS** — Money hub; payment records Source labels; invoices/balances; `/payments` honesty |
| Wrong turns / missing data (P3) | Soft-nav Calendar rail briefly stayed on Front desk; direct `/calendar` OK | Pipeline not on primary rail (More); soft click on some patient consult links stayed on patient page; direct `/consultations/…` OK | Soft-nav ImagingOS + Open calendar; PRP filter still shows Surgery (F-PILOT-11; fix landed) | Soft-nav Open surgery delayed; rail Today → bare then `/doctor`; Procedure Day not expanded | Patients rail was non-link / `/patients` → `/cases` Surgery (F-PILOT-18; fix landed); Money path no wrong turn |
| Contradictory statuses (P4) | See findings F-PILOT-01 / F-PILOT-02 | Lead status **open** + stage **Consult completed**; consult hub **Completed** + **No patient linked** (F-PILOT-07/08) | Front desk **Payment due** 1→0 across revisits (hydrate); PRP filter vs Surgery badges | Readiness Room summary Clear vs cards “No room assigned” (F-PILOT-15); consult hub still No patient linked (F-PILOT-08) | Outstanding AUD 125 = deposits due AUD 125 = invoice balances 50+75 — **consistent**; manual vs provider Source labels honest |
| Failed saves / refresh integrity (P5) | **PASS** — check-in 08:00 → Waiting; reload held Waiting=1 / Running late=1; Start consultation replaced Check in | **PASS (nav reload)** — golden lead re-nav held Consultant workspace + patient link; **no CRM mutation** exercised | **PASS (nav reload)** — ImagingOS re-nav held Nurse workspace; **no capture/mutation** exercised | **PASS (nav reload)** — `/doctor` re-nav held Surgeon workspace + queues; **no Rx/clinical mutation** | **PASS (nav reload)** — `/financial-os` re-nav held Finance workspace + same tiles; **no payment mutation** |
| Workarounds / support interventions (P6) | None observed | Direct URL / More→Pipeline to reach CRM; no developer help | Direct URL for ImagingOS / Calendar when soft-nav stuck; no developer help | Direct `/surgery-readiness` / Calendar when soft-nav lag; no developer help | Use Money/Invoices for balances (not Patients); no developer help |
| Tablet usability (P7) | **Not observed** (desktop browser) | **Not observed** (desktop) | **Not observed** (desktop) | **Not observed** (desktop) | **Not observed** (desktop) |
| Unresolved blockers (P8) | Room-assignment blockers on SMOKETEST appts — test fixtures, not live patient stop | Consult hub missing patient link on SMOKETEST fixture; SMOKETEST readiness/deposit blockers — fixture noise | Same SMOKETEST room/deposit blockers on FD board — fixture noise | SMOKETEST surgery readiness blockers (staff/room/consent/deposit) — fixture noise | Patients hub unreachable under Finance (F-PILOT-18); SMOKETEST open deposits expected fixture noise |

---

## Session 1 detail — Reception (Jesika) · 2026-07-14

**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Identity:** Impersonating **jesika.watt11** · badge **Reception workspace** · profile `jesika.watt11@hotma…` · **Exit impersonation** visible  
**Tool:** cursor-ide-browser MCP

| Step | Observation |
| ---- | ----------- |
| Open existing tab | URL already `/front-desk`; board Today with counters Running late 1 · Waiting 0 · Arriving soon 1 · Blockers 2 |
| Board content | SMOKETEST surgery cards (room missing); Needs attention list with readiness/room blockers |
| Calendar | Loads week view; after settle shows **Today · 2 appointments** matching board SMOKETEST HT surgeries (08:00 + 10:00) |
| Return to Front desk | Board still usable; subtitle / Payment due count shifted vs earlier snapshot (see F-PILOT-02) |
| **Check-in mutation (gap closer)** | Click **Check in patient** on 08:00 SMOKETEST-TMRW Unavailable (was Running late=2 / Waiting=0) → board updates to Running late=1 / Waiting=1; 08:00 card moves to **Waiting**; CTA becomes **Start consultation** |
| **Reload integrity** | Hard navigate same `/front-desk` URL — counters held **Running late 1 · Waiting 1**; 08:00 remains under Waiting; Reception workspace + Jesika impersonation held |

### Observations / findings (do not invent severity beyond evidence)

| ID | Severity | Note |
| -- | -------- | ---- |
| F-PILOT-01 | **P2 (observe)** | First Calendar paint briefly showed **READ-ONLY** + **Today · 0 appointments** while Front desk already listed the same-day SMOKETEST rows; after settle → **LIVE** + **2 appointments**. Transient contradiction / load flicker — not scored as lost patient data. |
| F-PILOT-02 | **P2 (observe)** | Status vocabulary tension: Front desk **Waiting = 0** while Calendar summary **Waiting = 2** for the same two unarrived surgeries (FD uses Running late / Arriving soon). Risk of staff confusion — not silent record loss. |
| F-PILOT-03 | **note** | Soft click on Calendar rail left URL on `/front-desk` briefly (busy state); direct navigate to `/calendar` succeeded. |
| F-PILOT-04 | **note** | Session is **impersonation**, not raw Jesika/Roslyn password login — identity doorway still valid for reception chrome; raw-login still desirable for P1 purity. |
| F-PILOT-05 | **P2 (observe)** | After Calendar round-trip, Front desk briefly showed tenant-level subtitle + **Payment due = 0** without readiness row; **Refresh** restored **Perth** subtitle, **Payment due = 1**, and surgery-readiness blocker. Favours stale/partial hydrate over permanent mutation loss. |

**No P0** identity/security/patient-record loss observed in S1.  
**Reception Calendar / Front desk mutation + reload: PASS** (check-in 08:00 SMOKETEST → Waiting; reload held).  

---

## Session 2 detail — Consultant (`manager@`) · 2026-07-14

**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Identity:** Impersonating **manager** · badge **Consultant workspace** · profile `manager@evolvedh…` · greeting **Good morning, Manager** · **Exit impersonation** visible · not Auditor  
**Tool:** cursor-ide-browser MCP  
**Fixtures:** golden lead `c9a58f3d-e1e4-4187-9986-59faed41565d` · golden patient `287348d5-18bd-4434-9bab-7caafacbfe86` · consultation `26660e8e-62ca-4de5-a93d-3d0410cfc2f6`

| Step | Observation |
| ---- | ----------- |
| Bare tenant URL | Stays on **Today / Home** (`…/c2615b95-…`) — **not** redirect to `/crm` (vs prior role-bake expectation) |
| Identity | Consultant workspace; Manager greeting; `manager@` profile chip |
| `/crm` Pipeline | Loads Enquiries board: Visible 300 / Active 265 / columns with cards; New / Contacting / Qualified / Consultation / … columns |
| H-scroll | Board scroller `overflow-x: auto` + `overscroll-x-contain`; page `scrollWidth` ≈ viewport — **containment OK** |
| `/leadflow` | Settles to `/crm` (Pipeline) |
| Nav reachability | Pipeline under **More** (primary rail: Today, Calendar, Patients, Front desk, Team) |
| Golden lead | Holds on CRM lead URL (no `/cases` eject); patient id linked in subtitle |
| Golden patient | Patient page usable; linked leads; recorded payments; View consultations / New consultation CTAs |
| Consultation path | Direct `/consultations/26660e8e-…` → Consultation hub; pathways Start links; visit context **Scalp hair transplant · Completed** but **No patient linked** |
| Calendar | First paint **Today · 0 appointments**; after settle **Today · 2 appointments** (SMOKETEST-TMRW) — same flicker pattern as S1 |
| Money | `/financial-os` title **Money**; truth banner (manual tracking / card capture off); deposits/outstanding tiles readable while Consultant workspace |
| Reload | Re-navigate golden lead after Money visit — still Consultant workspace, same lead/patient, Status open |

### Observations / findings

| ID | Severity | Note |
| -- | -------- | ---- |
| F-PILOT-06 | **P1 (fix landed)** | Consultant bare-tenant landing was **Today**, not expected canonical **`/crm`**. Cause: `staff_role` manager/owner returned Today before `workspace_profile=consultant`. Fix: defer manager/owner Today until after workspace profile / tenant admin resolution (`fiOsRoleLandingCore`). Unit test added. **Live re-bake pending deploy.** |
| F-PILOT-07 | **P2 (observe)** | Lead status dropdown **open** while operational stage shows **Consult completed** — vocabulary contradiction for staff. |
| F-PILOT-08 | **P2 (observe)** | Consultation hub shows visit **Completed** + lead stage Consult completed, but **Patient: No patient linked** / Link patient disabled — while patient record path clearly links the same SMOKETEST person. Fixture / linkage honesty gap. |
| F-PILOT-09 | **note** | Soft click on patient-page Scalp consultation / View consultations often left URL on patient page; direct consultation URL succeeded (mirrors Reception soft-nav note). |
| F-PILOT-10 | **note** | Impersonation session (not raw `manager@` password) — chrome still valid for Consultant doorway; System diagnostics visible (platform operator overlay). |

**No P0** identity/security/patient-record loss in S2. **No CRM mutation** (save/stage-move) exercised — P5 scored only for re-navigation integrity. **No code fix** applied.

### Consultant PASS / PARTIAL matrix (S2)

| Surface / check | Result |
| --------------- | ------ |
| Identity (greeting, email, Consultant workspace) | **PASS** |
| Bare landing → `/crm` | **PARTIAL** (Today) |
| Pipeline board usable + H-scroll containment | **PASS** |
| `/leadflow` → `/crm` | **PASS** |
| Golden lead / enquiry progress without CRM eject | **PASS** |
| Consultation / case path | **PARTIAL** (reachable; patient-link contradiction on hub) |
| Patients | **PASS** |
| Calendar | **PASS** (after settle; same 0→2 flicker as S1) |
| Money (`/financial-os`) | **PASS** (readable) |
| Reload integrity (lead re-nav) | **PASS** (no mutation) |
| Help needed | **0** |

---

## Session 3 detail — Nurse (Evie) · 2026-07-14

**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Identity:** Impersonating **evieshackleton1** · badge **Nurse workspace** · profile `evieshackleton1@gmail.com` · **Exit impersonation** visible · not Auditor  
**Tool:** cursor-ide-browser MCP  
**Fixtures:** golden patient `287348d5-18bd-4434-9bab-7caafacbfe86` · SMOKETEST-TMRW surgeries on Calendar Today

| Step | Observation |
| ---- | ----------- |
| Start surface | Already on `/front-desk` Today board with Nurse workspace + Evie email |
| Bare tenant URL | Brief **Home/Today** flash → settles to **`/front-desk`** (canonical Nurse doorway OK) |
| Front desk | Running late 1 · Arriving soon 1 · Blockers 2; SMOKETEST HT cards + room-assignment blockers |
| Calendar | Week view; **Today · 2 appointments** (SMOKETEST Hair Transplant · Surgery) |
| Resource filters | Consultations / **PRP** / **Surgery** / Follow-up / Doctor / Nurse present under Resource filters |
| Surgery filter | `?type=surgery` — both Surgery-tagged HT appointments remain visible |
| PRP filter | `?type=prp` — URL updates but **same Surgery HT cards still shown** (honesty gap) |
| Front desk / Tomorrow Open calendar | Soft click often stays on current URL; direct `/calendar` OK |
| Patients | Hub loads (819 active); journey stages + SMOKETEST queue readable under Nurse workspace |
| Imaging | Soft click **ImagingOS** on patient often stuck; direct `/patients/…/imaging` → **ImagingOS · Clinical imaging workspace** (Gallery/Capture/Protocols/zone data) |
| Tomorrow | `/tomorrow` → `/front-desk/tomorrow`; empty board for Wed 15 Jul (honest zero counts) |
| Reload | Re-nav ImagingOS after Front desk/Calendar — still Nurse workspace + ImagingOS chrome |

### Observations / findings

| ID | Severity | Note |
| -- | -------- | ---- |
| F-PILOT-11 | **P1 (fix landed)** | Calendar resource filter **`type=prp`** still showed Surgery-tagged appointments. Cause: CalendarOS-mapped rows bypassed booking URL filters (excluded IDs computed but not applied). Fix: `applyCalendarOsBookingUrlFilters` in loader. Unit test added. **Live re-bake pending deploy.** |
| F-PILOT-12 | **note** | Soft-nav: patient **ImagingOS** and board **Open calendar** often left URL unchanged; direct URLs succeeded (same pattern as F-PILOT-03/09). |
| F-PILOT-13 | **P2 (observe)** | Front desk **Payment due** counter shifted 1→0 across revisits without mutation (hydrate flicker, mirrors F-PILOT-05). |
| F-PILOT-14 | **note** | Impersonation session (not raw Evie password) — chrome still valid for Nurse doorway. |

**No P0** identity/security/patient-record loss in S3. **No imaging capture / booking mutation** exercised — P5 scored only for re-navigation integrity. **No code fix** applied.

### Nurse PASS / PARTIAL matrix (S3)

| Surface / check | Result |
| --------------- | ------ |
| Identity (email, Nurse workspace) | **PASS** |
| Bare landing → `/front-desk` | **PASS** (after settle) |
| Front desk Today board | **PASS** |
| Calendar treatment appointments | **PASS** (Surgery filter + 2 HT surgeries) |
| Calendar Surgery / PRP / treatment filters | **PARTIAL** (Surgery OK; PRP honesty fail F-PILOT-11) |
| Front desk Open calendar | **PARTIAL** (soft-nav; direct OK) |
| Imaging / clinical path | **PASS** (ImagingOS via patient; soft-nav workaround) |
| Patients | **PASS** |
| Tomorrow | **PASS** (empty honest board) |
| Reload integrity (ImagingOS re-nav) | **PASS** (no mutation) |
| Help needed | **0** |

---

## Session 4 detail — Doctor (Seetal) · 2026-07-14

**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Identity:** Impersonating **seetskd** · badge **Surgeon workspace** · page **Doctor Workspace** · profile `seetskd@gmail.com` · **Exit impersonation** visible · not Auditor  
**Tool:** cursor-ide-browser MCP  
**Fixtures:** golden patient `287348d5-18bd-4434-9bab-7caafacbfe86` · consultation `26660e8e-62ca-4de5-a93d-3d0410cfc2f6` · SMOKETEST-TMRW surgeries on Calendar Today  
**Scope note:** Surgery readiness / Calendar surgery context exercised; **Procedure Day automation not expanded** (out of scope).

| Step | Observation |
| ---- | ----------- |
| Start surface | Already on `/doctor` with Surgeon workspace + Seetal email |
| Bare tenant URL | Brief **Home/Today** flash → settles to **`/doctor`** (canonical Doctor doorway OK) |
| Identity | Surgeon workspace chrome; Doctor Workspace H1; clinical workload queues (3 awaiting review / 2 consults today) |
| Patients | Hub loads under Surgeon workspace (819 active); journey stages + SMOKETEST queue readable |
| Calendar | First paint **Today · 0 appointments**; after settle **Today · 2 appointments**; Surgery filter shows HT Surgery cards with **10% ready / 3 blockers** |
| Open surgery (Doctor CTA) | Soft click lagged on `/doctor` then landed Calendar — usable; not wrong product surface |
| Surgery readiness | `/surgery-readiness` loads: 3 upcoming / 0 ready / 3 blocked; clearance list + procedure cards readable |
| Golden patient | Patient page usable; **Surgery readiness** / ImagingOS / consultations CTAs present; Pre-op incomplete blockers shown |
| Consultation path | Direct `/consultations/26660e8e-…` → Consultation hub under Surgeon workspace; pathways Start links; **No patient linked** (same fixture gap as S2) |
| Rail Today | Links bare tenant → settles back to `/doctor` |
| Reload | Re-nav `/doctor` after patient/consult/readiness tour — still Surgeon workspace + same physician queues |

### Observations / findings

| ID | Severity | Note |
| -- | -------- | ---- |
| F-PILOT-15 | **P2 (observe)** | Surgery readiness checklist summary shows **Room · Clear / 3 cleared** while the same board’s procedure cards still list **No room assigned on the booking**. Staff can misread clearance — not silent record loss. **No code fix in this slice** (evidence only). |
| F-PILOT-16 | **note** | Soft-nav: Doctor **Open surgery** briefly stayed on `/doctor` before Calendar; mirrors F-PILOT-03/09/12. Direct Calendar / `/surgery-readiness` OK. |
| F-PILOT-17 | **note** | Impersonation session (not raw Seetal password) — chrome still valid for Doctor doorway. **Open surgery day** visible on readiness; deliberately not exercised (Procedure Day out of scope). |

**No P0** identity/security/patient-record loss in S4. **No prescription / clinical mutation** exercised — P5 scored only for re-navigation integrity. **No code fix** applied. **No new Doctor P1.**

### Doctor PASS / PARTIAL matrix (S4)

| Surface / check | Result |
| --------------- | ------ |
| Identity (email, Surgeon/Doctor workspace) | **PASS** |
| Bare landing → `/doctor` | **PASS** (after settle) |
| Doctor Workspace queues | **PASS** |
| Patients | **PASS** |
| Calendar treatment / surgery appointments | **PASS** (after settle; Surgery filter + readiness %) |
| Surgery readiness / treatment context | **PASS** (board readable; not Procedure Day) |
| Consultation / clinical path | **PASS** (reachable; fixture No patient linked carried from F-PILOT-08) |
| Soft-nav Open surgery | **PARTIAL** (lag; lands Calendar) |
| Reload integrity (`/doctor` re-nav) | **PASS** (no mutation) |
| Help needed | **0** |

---

## Session 5 detail — Finance (Harsh) · 2026-07-14

**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Identity:** Impersonating **harsh** · badge **Finance workspace** · profile `harsh@evolvedhair.com.au` · **Exit impersonation** visible · not Auditor · **not** Clinic manager / `clinic_admin` chrome  
**Tool:** cursor-ide-browser MCP  
**Fixtures:** SMOKETEST payment rows (Manual tracking AUD 550 / Provider confirmed Stripe AUD 825); open surgery-deposit invoices AUD 50 + AUD 75

| Step | Observation |
| ---- | ----------- |
| Start surface | Already on `/financial-os` Money with Finance workspace + Harsh email |
| Bare tenant URL | Brief **Home/Today** flash → settles to **`/financial-os`** (canonical Finance doorway OK) |
| Money hub | H1 **Money**; **Manual payment tracking** banner (card capture off; operational tracking not POS/settlement proof) |
| Health tiles | Outstanding **AUD 125.00** (2 invoices) = Deposits due **AUD 125.00** (2 surgery deposits); Revenue collected AUD 0.00; blockers 0 |
| Collection priorities | SMOKETEST manual payment invoice AUD 50 + SMOKETEST Stripe payment invoice AUD 75 — matches tiles |
| Payment records | `/financial/payments`: **Manual tracking** (MANUALLY RECORDED · AUD 550) + **Provider confirmed (Stripe)** (SUCCEEDED · AUD 825) — Source honesty OK |
| `/payments` | Honest off-state: “`FI_PAYMENTS_ENABLED` is off” + redirect staff to Money as single finance door |
| Invoices / balances | Two `surgery_deposit` PARTIALLY PAID rows: balances AUD 75 + AUD 50 = hub outstanding |
| Patients path | Direct `/patients` and `/patients/{id}` settle to **Surgery `/cases`**; primary rail Calendar/Patients render as non-link labels; balances reachable via Money/Invoices |
| Reload | Re-nav `/financial-os` after payments/invoices/patients tour — still Finance workspace + same Money tiles |

### Observations / findings

| ID | Severity | Note |
| -- | -------- | ---- |
| F-PILOT-18 | **P1 (fix landed)** | Under **Finance workspace**, `/patients` settled to **Surgery `/cases`**; rail **Patients** was non-navigable. Cause: `finance_admin` excluded from bookings/PatientOS gate (redirect → `/cases`) and clinical-blocked in primary nav. Fix: allow `finance_admin` bookings board nav + enable Patients href to `/patients` (Calendar stays blocked). Tests added. **Live re-bake pending deploy.** |
| F-PILOT-19 | **note** | Impersonation session (not raw Harsh password) — chrome still valid for Finance doorway (`finance_admin`, not clinic_admin). |

**No P0** identity/security/patient-record loss in S5. **No payment mutation** exercised — P5 scored only for re-navigation integrity. **No code fix** applied.

### Finance PASS / PARTIAL matrix (S5)

| Surface / check | Result |
| --------------- | ------ |
| Identity (email, Finance workspace / `finance_admin`) | **PASS** |
| Bare landing → `/financial-os` | **PASS** (after settle) |
| Manual tracking banner | **PASS** |
| Payment Source labels (Manual tracking / Provider confirmed Stripe) | **PASS** |
| Deposits / outstanding balances consistency | **PASS** (125 = 50+75) |
| `/payments` FI_PAYMENTS_ENABLED honesty | **PASS** |
| Ordinary Money tasks without wrong turns | **PASS** (Money path) |
| Patients / related patient balances via Patients | **PARTIAL** (→ Surgery; F-PILOT-18) |
| Reload integrity (`/financial-os` re-nav) | **PASS** (no mutation) |
| Help needed | **0** |

---

## Exit checklist (GREEN when all met — unscored overall)

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | No P0 identity, security, or patient-record issue | **Hold** — S1–S5: none observed |
| 2 | No core mutation lost after reload | **PASS (S1)** — Reception check-in held after reload; other roles nav reload only |
| 3 | Staff identify correct canonical doorway | *partial* — Reception/Nurse/Doctor/Finance YES; Consultant identity YES but `/crm` landing miss (**fix landed**, re-bake pending) |
| 4 | Reception: Front Desk + Calendar reliable | **PASS** — both reachable; check-in mutation + reload PASS |
| 5 | Consultants: enquiries + consultations progress | *partial* — Pipeline + paths usable; landing fix landed; consult linkage P2 observe |
| 6 | Nurses: treatment appointments + imaging reachable | *partial* — reachable; PRP filter fix landed (re-bake pending) |
| 7 | Money states understandable and consistent | *partial* — Money hub PASS; Finance Patients fix landed (re-bake pending) |
| 8 | Active pilot staff correctly mapped after HR sync | **PASS at kickoff** (HR-DRIFT monitor) |
| 9 | Critical issues resolved or have safe SOPs | *partial* — P1 fixes code-landed (06/11/18); live re-verify open |
| 10 | Readiness rescore supported by real usage evidence | *pending* — S1 mutation PASS; wait deploy + P1 live bake for GREEN |

**Overall verdict:** **AMBER — path to GREEN** (Reception mutation PASS; P1 code fixes landed; not RED — no P0). **Not GREEN** until live re-verify of F-PILOT-06 / 11 / 18 on production.

### Remaining gaps (post fix slice)

| Gap | Severity | Owner hint |
| --- | -------- | ---------- |
| Live re-bake F-PILOT-06 Consultant bare → `/crm` | **P1 re-verify** | After deploy |
| Live re-bake F-PILOT-11 Calendar `type=prp` | **P1 re-verify** | After deploy |
| Live re-bake F-PILOT-18 Finance `/patients` | **P1 re-verify** | After deploy |
| HR-DRIFT-01 mapping after HR sync | Monitor | Ops / HR — not code |
| Raw password logins / tablet | Observability | Optional purity / P7 |

### P1 fix summary (engineering)

| ID | Before | After (code) | Tests |
| -- | ------ | ------------ | ----- |
| F-PILOT-06 | `manager` staff_role → bare Today before consultant workspace | workspace `consultant` / job homes win over manager/owner Today | `fiOsRoleLandingCore.test.ts` |
| F-PILOT-11 | CalendarOS rows ignored `type=prp` filter | excluded IDs applied via `applyCalendarOsBookingUrlFilters` | `calendarOsDisplayPipeline.test.ts` |
| F-PILOT-18 | `finance_admin` Patients → `/cases`; rail disabled | bookings gate allows finance_admin; Patients nav → `/patients` enabled | `tenantAdminRoles.test.ts`, `fiOsShellPrimaryNav.test.ts` |

---

## Related

- [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)
- [fi-ci-signal-hygiene-1.md](./fi-ci-signal-hygiene-1.md)
- [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md)
