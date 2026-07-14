# FI-EVOLVED-OPERATIONAL-PILOT-1 — Findings

**Milestone:** `FI-EVOLVED-OPERATIONAL-PILOT-1`  
**Status:** **IN PROGRESS**  
**Date:** 2026-07-14  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Plan:** [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)  
**Kickoff commit:** `8a058a46`

---

## Executive summary

Live clinic-day bake **in progress** 2026-07-14. **S1 Reception (Jesika)** Front desk doorway PASS; Calendar reachable — **mutation+reload still not scored (do not invent PASS)**. **S2 Consultant (`manager@`)** exercised: Consultant workspace identity OK; Pipeline board usable; `/leadflow` → `/crm`; golden lead + patient + consultation path reachable; Calendar + Money readable; reload of golden lead held. Bare tenant lands **Today**, not expected `/crm` (P1 doorway gap). **S3 Nurse (Evie)** exercised: Nurse workspace + `evieshackleton1@gmail.com`; lands `/front-desk`; Calendar Surgery filter + surgery appointments OK; ImagingOS reachable on golden patient; Patients + Tomorrow OK; reload ImagingOS held. PRP type-filter honesty **PARTIAL** (URL `type=prp` still showed Surgery cards — F-PILOT-11). **S4 Doctor (Seetal)** exercised: Surgeon/Doctor workspace + `seetskd@gmail.com`; bare tenant settles `/doctor`; Patients + Calendar (2 HT surgeries) + Surgery readiness + consultation hub reachable; Doctor workspace reload held. No new Doctor P0/P1. Staff-mapping gate **PASS** (record-only). **Next ask:** Finance / clinic admin Harsh.

**Core question:** Can Evolved staff use agreed core workflows during a real clinic day without developer intervention?

**Key metric:** how often staff need help to complete ordinary work (not test count).  
**Help needed so far:** S1 Reception **0**; S2 Consultant **0**; S3 Nurse **0**; S4 Doctor **0** (auditor bake only).

---

## Kickoff readiness

| Item | Result |
| ---- | ------ |
| Plan read | Done |
| Findings status | **IN PROGRESS** |
| Browser login | **Yes** — S1 Jesika; S2 `manager` (Consultant); S3 Evie (Nurse); S4 Seetal (Doctor) impersonation |
| Raw staff password login | **Not this session** — Exit impersonation visible |
| First gate | Reception Front desk + Calendar — **PARTIAL** (mutation TBD); Consultant CRM spine — **PARTIAL** (landing not `/crm`); Nurse frontline + treatment/imaging — **PARTIAL** (PRP filter honesty); Doctor clinical spine — **PASS** |
| Staff mapping `npm run audit:staff-mapping` | **PASS** — 10 operators, 0 missing `fi_staff`, 0 missing access signal (HR-DRIFT monitor only; no fix) |

### Pilot day roster (Evolved)

| Role | Who to exercise | Email (known) | Surfaces | Session status |
| ---- | --------------- | ------------- | -------- | -------------- |
| Reception | Roslyn / Jesika | `roslynhrichards@outlook.com` / Jesika `j***@hotmail.com` (`jesika.watt11`) | Front desk, Today, Calendar/bookings, Patients | **S1 PARTIAL** — doorway + Calendar view OK; mutation+reload **not scored** |
| Consultant | manager@ | `manager@evolvedhair.com.au` | Pipeline, Consultations, Patients, Calendar | **S2 PARTIAL** — CRM spine usable; bare landing Today not `/crm` |
| Nurse | Evie | `evieshackleton1@gmail.com` | Treatment appointments, imaging, Patients, Today | **S3 PARTIAL** — Front desk + Calendar Surgery + ImagingOS + Patients/Tomorrow OK; PRP filter honesty gap |
| Doctor | Dr Seetal | `seetskd@gmail.com` | Doctor workspace, Calendar, Patients | **S4 PASS** — `/doctor` landing + clinical spine usable; no new P0/P1 |
| Finance / clinic admin | Harsh | `harsh@evolvedhair.com.au` (`finance_admin` / Money) | Money (+ balances) | *not started* — **next** |
| Manager / mapping | Paul / mapped pilot staff | `paul@evolvedhair.com.au` (owner) | Team access + staff mapping | Mapping gate only so far |

**Exact next session ask:** Impersonate or log in **Finance / clinic admin Harsh** (`harsh@evolvedhair.com.au`) — Money (+ balances).

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
| S1 | Reception (Jesika impersonation) | **YES** — Reception workspace → `/front-desk` | View Front desk board; open Calendar (week); confirm 2 SMOKETEST surgeries visible after load | **0** (auditor bake) | Mutation+reload **not scored** — leave gap honest; tablet N/A desktop |
| S2 | Consultant (manager@ impersonation) | **PARTIAL** — Consultant workspace + greeting; bare tenant → **Today** (expected `/crm`) | Pipeline board (H-scroll contained); `/leadflow`→`/crm`; golden lead+patient; consultation hub; Calendar (2 appts after settle); Money hub; reload lead held | **0** (auditor bake) | Pipeline under More (not primary rail); soft-nav on some consultation links; see F-PILOT-06..09 |
| S3 | Nurse (Evie impersonation) | **YES** — Nurse workspace; bare → `/front-desk` after settle | Front desk board; Calendar Surgery filter + 2 HT surgeries; PRP filter URL toggles; ImagingOS on golden patient; Patients hub; Tomorrow board (empty Jul 15); ImagingOS reload held | **0** (auditor bake) | Soft-nav ImagingOS / Open calendar; `type=prp` still showed Surgery cards (F-PILOT-11); Payment due hydrate flicker |
| S4 | Doctor (Seetal impersonation) | **YES** — Surgeon/Doctor workspace; bare → `/doctor` after brief Today flash | Doctor Workspace queues; Patients hub; Calendar Surgery (2 HT + readiness %); Surgery readiness board; golden patient + consultation hub; Doctor re-nav held | **0** (auditor bake) | Soft-nav Open surgery delayed then Calendar; readiness Room summary vs card blockers (F-PILOT-15); did not open Procedure Day automation |
| — | Finance (Harsh) | — | — | — | *empty — not observed* |

### Session checklist template (per role)

| Check | Reception S1 | Consultant S2 | Nurse S3 | Doctor S4 | Finance |
| ----- | ------------ | ------------- | -------- | --------- | ------- |
| Correct login landing (P1) | **PASS** — Front desk / Reception workspace (impersonation) | **PARTIAL** — Consultant workspace OK; bare → Today not `/crm` (F-PILOT-06) | **PASS** — Nurse workspace; bare → `/front-desk` after settle | **PASS** — Surgeon workspace; bare → `/doctor` after settle | *pending* |
| Ordinary tasks completed (P2) | **PARTIAL** — view board + Calendar; no booking/check-in mutation yet | **PASS** — Pipeline view/work; lead/patient/consult path; Calendar; Money readable | **PASS** — Front desk; Calendar Surgery; ImagingOS; Patients; Tomorrow | **PASS** — Doctor queues; Patients; Calendar; Surgery readiness; consult path | *pending* |
| Wrong turns / missing data (P3) | Soft-nav Calendar rail briefly stayed on Front desk; direct `/calendar` OK | Pipeline not on primary rail (More); soft click on some patient consult links stayed on patient page; direct `/consultations/…` OK | Soft-nav ImagingOS + Open calendar; PRP filter still shows Surgery (F-PILOT-11) | Soft-nav Open surgery delayed; rail Today → bare then `/doctor`; Procedure Day not expanded | *pending* |
| Contradictory statuses (P4) | See findings F-PILOT-01 / F-PILOT-02 | Lead status **open** + stage **Consult completed**; consult hub **Completed** + **No patient linked** (F-PILOT-07/08) | Front desk **Payment due** 1→0 across revisits (hydrate); PRP filter vs Surgery badges | Readiness Room summary Clear vs cards “No room assigned” (F-PILOT-15); consult hub still No patient linked (F-PILOT-08) | *pending* |
| Failed saves / refresh integrity (P5) | **Not tested** — no mutation this slice | **PASS (nav reload)** — golden lead re-nav held Consultant workspace + patient link; **no CRM mutation** exercised | **PASS (nav reload)** — ImagingOS re-nav held Nurse workspace; **no capture/mutation** exercised | **PASS (nav reload)** — `/doctor` re-nav held Surgeon workspace + queues; **no Rx/clinical mutation** | *pending* |
| Workarounds / support interventions (P6) | None observed | Direct URL / More→Pipeline to reach CRM; no developer help | Direct URL for ImagingOS / Calendar when soft-nav stuck; no developer help | Direct `/surgery-readiness` / Calendar when soft-nav lag; no developer help | *pending* |
| Tablet usability (P7) | **Not observed** (desktop browser) | **Not observed** (desktop) | **Not observed** (desktop) | **Not observed** (desktop) | *pending* |
| Unresolved blockers (P8) | Room-assignment blockers on SMOKETEST appts — test fixtures, not live patient stop | Consult hub missing patient link on SMOKETEST fixture; SMOKETEST readiness/deposit blockers — fixture noise | Same SMOKETEST room/deposit blockers on FD board — fixture noise | SMOKETEST surgery readiness blockers (staff/room/consent/deposit) — fixture noise | *pending* |

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

### Observations / findings (do not invent severity beyond evidence)

| ID | Severity | Note |
| -- | -------- | ---- |
| F-PILOT-01 | **P2 (observe)** | First Calendar paint briefly showed **READ-ONLY** + **Today · 0 appointments** while Front desk already listed the same-day SMOKETEST rows; after settle → **LIVE** + **2 appointments**. Transient contradiction / load flicker — not scored as lost patient data. |
| F-PILOT-02 | **P2 (observe)** | Status vocabulary tension: Front desk **Waiting = 0** while Calendar summary **Waiting = 2** for the same two unarrived surgeries (FD uses Running late / Arriving soon). Risk of staff confusion — not silent record loss. |
| F-PILOT-03 | **note** | Soft click on Calendar rail left URL on `/front-desk` briefly (busy state); direct navigate to `/calendar` succeeded. |
| F-PILOT-04 | **note** | Session is **impersonation**, not raw Jesika/Roslyn password login — identity doorway still valid for reception chrome; raw-login still desirable for P1 purity. |
| F-PILOT-05 | **note** | After Calendar round-trip, Front desk briefly showed tenant-level subtitle + **Payment due = 0** without readiness row; **Refresh** restored **Perth** subtitle, **Payment due = 1**, and surgery-readiness blocker. Favours stale/partial hydrate over permanent mutation loss — still tighten before GREEN on P5. |

**No P0** identity/security/patient-record loss observed in S1 slice. **No code fix** applied (observations only).  
**Explicit:** Reception Calendar **mutation + reload integrity NOT PASS** — not tested; do not invent.

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
| F-PILOT-06 | **P1** | Consultant bare-tenant landing is **Today**, not expected canonical **`/crm`**. Identity chrome correct; Pipeline reachable via More / direct URL / `/leadflow`. Regression vs prior role-bake claim (bare → `/crm`). **No code fix in this slice** (evidence only unless ops prioritizes). |
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
| F-PILOT-11 | **P1** | Calendar resource filter **`type=prp`** does not hide Surgery-tagged appointments — staff can misread HT surgeries as PRP list. Controls reachable; filter honesty fails. **No code fix in this slice** (evidence only unless ops prioritizes). |
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

## Exit checklist (GREEN when all met — unscored overall)

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | No P0 identity, security, or patient-record issue | *pending* (S1–S4: none observed) |
| 2 | No core mutation lost after reload | *pending* — Reception mutation not tested; Consultant/Nurse/Doctor nav reload only |
| 3 | Staff identify correct canonical doorway | *partial* — Reception YES; Nurse YES; Doctor YES (`/doctor`); Consultant identity YES but `/crm` landing miss |
| 4 | Reception: Front Desk + Calendar reliable | *partial* — both reachable; mutation TBD |
| 5 | Consultants: enquiries + consultations progress | *partial* — Pipeline + paths usable; landing + consult linkage gaps |
| 6 | Nurses: treatment appointments + imaging reachable | *partial* — reachable; PRP filter honesty P1 open |
| 7 | Money states understandable and consistent | *partial* — Consultant can open Money hub; finance role not baked |
| 8 | Active pilot staff correctly mapped after HR sync | **PASS at kickoff** |
| 9 | Critical issues resolved or have safe SOPs | *pending* (F-PILOT-06 + F-PILOT-11 P1 open; Doctor no new P1) |
| 10 | Readiness rescore supported by real usage evidence | *pending* |

**Overall verdict:** **IN PROGRESS** — not GREEN / not RED

---

## Related

- [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)
- [fi-ci-signal-hygiene-1.md](./fi-ci-signal-hygiene-1.md)
- [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md)
