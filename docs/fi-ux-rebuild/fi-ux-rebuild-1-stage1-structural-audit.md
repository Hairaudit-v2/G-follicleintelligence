# FI-UX-REBUILD-1 — Stage 1 Structural UX Audit

**Date:** 2026-07-11  
**Status:** Living product audit (code-grounded against current D6G shell)  
**Principle:** Design for a brand-new clinic employee. Never for modules.

> Older ground truth (2026-07-02): `docs/fi-ux-audit/*` — still useful for routes; **sidebar labels are outdated**.  
> This document supersedes that audit for **structure, nav, terminology, and finish pathway**.

---

## Executive summary

FI OS is an exceptional vertical operating system for hair restoration. The technology is advanced. The product experience still exposes **how the system was built** more than **how a clinic day works**.

### What already improved (do not re-litigate)

| Workstream | Outcome |
|---|---|
| **D6G-B** | Six-slot rail: **Today · Calendar · Patients · Team · Reports · More** |
| **D6G-C** | **Front desk** hub (ops · clinic flow · reception board · tomorrow) |
| **D6G-D** | **Surgery** hub (command · cases · procedure day · review) |
| **D6G-E** | **Team** hub (staff · roster · onboarding · compliance · training · access) |
| **D6G-F** | **Reports** hub (analytics · quality · surgery · performance · library) |
| **D6 / Today** | Attention-first day surface instead of a module dashboard |
| **D6G-G0 / G0B** | Role-safe nav + staff capability overrides (no full-access testing) |
| **Label cleanup (partial)** | LeadFlow → Enquiries, Patient Twin → Health record, *OS names hidden from primary rail |

### What still fails the “new hire” test

1. **Legacy routes still live as parallel products** (same job, different URLs).  
2. **More drawer is still a catalog of systems**, not a short list of jobs.  
3. **Finance and Pipeline were never consolidated** into a single human workspace.  
4. **Page titles and deep screens still say PatientOS, HR OS, Audit Intelligence, Workforce Intelligence.**  
5. **Enquiries / Follow-ups / CRM / LeadFlow paths** are three doors to one room.  
6. **Front desk has four tabs** that still sound like four products (Reception operations vs Clinic flow vs Reception board vs Tomorrow).  
7. **Post-login still dumps people into “Cases”** for many roles — wrong first second for reception and finance.

### Success definition for Stage 1 → finish

A receptionist, nurse, doctor, or finance person who has never used FI can answer within **10 seconds of login**:

> “What should I do next?”

Without opening Settings, without knowing what an “OS” is, without asking IT.

---

## North-star product structure (target)

Think **jobs**, not modules. Five daily places + one admin place.

```
┌─────────────────────────────────────────────────────────────┐
│  TODAY          What needs me right now                     │
│  CALENDAR       When things happen                          │
│  PEOPLE         Patients + enquiries (one human list)       │
│  CLINIC DAY     Front desk + today’s clinical flow          │
│  SURGERY        Cases, readiness, procedure day             │
│  MONEY          Take payment · invoices · balances          │
│  TEAM           Who works · roster · onboarding             │
│  INSIGHTS       How are we doing (manager+)                 │
│  SETTINGS       Configure the clinic (admin only)           │
└─────────────────────────────────────────────────────────────┘
```

**Primary rail target (≤ 6, always):**

| Slot | Human job |
|------|-----------|
| Today | Priority work queue |
| Calendar | Schedule |
| People | Find anyone in the clinic’s care funnel |
| Clinic | Front desk day-of operations |
| More | Surgery · Money · Team · Insights · Settings (role-filtered) |

*Current rail uses Patients + Team + Reports. Target path renames/reorders for clinic language and puts Front desk on the rail for frontline staff.*

---

# PHASE 1 — Full page inventory audit

**Legend:** Keep = retain as primary; Merge = absorb into hub; Delete = remove from product surface (route may soft-redirect); Legacy = keep URL for bookmarks, hide from nav.

Frequency: **H** daily · **M** weekly · **L** rare/admin.

### A. Day start & operations

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Today | `/` | All | H | Partial vs Operations | **Yes** | — | — | Canonical “what now”. Strengthen as sole home. |
| Operations centre | `/operations` | Manager | M | Today + Front desk | No | → Front desk “Clinic overview” | Soft-delete nav | Legacy of “ops dashboard”. |
| Front desk hub | `/front-desk` | Reception, all | H | — | **Yes** | — | — | Correct product home for frontline. |
| Reception operations tab | `/front-desk` | Reception | H | Ops centre | **Yes** | Simplify naming | — | Rename to plain language (e.g. “Desk”). |
| Clinic flow tab | `/front-desk/clinic-flow` | Reception | H | Operations | **Yes** | Content merge with board if possible | — | Two “flow” words confuses. |
| Reception board tab | `/front-desk/reception-board` | Reception | H | `/reception` | **Yes** | Own board UI | — | Day board is essential. |
| Tomorrow board tab | `/front-desk/tomorrow` | Reception | H | `/tomorrow` | **Yes** | — | — | Prep for next day — keep. |
| Reception board (legacy) | `/reception` | Reception | H | Front desk tab | Legacy | → front-desk/reception-board | — | Hide from nav. |
| Reception command | `/reception-board` | Manager | L | Front desk | Legacy | → front-desk | Soft | “Cockpit” language is eng/ops. |
| ReceptionOS | `/reception-os` | Manager | L | Front desk + Reports | Legacy | → Reports or Front desk KPI | Soft | **Architecture name.** |
| Tomorrow (legacy) | `/tomorrow` | Reception | H | Front desk tab | Legacy | → front-desk/tomorrow | — | Hide from nav. |
| System status | `/system-status` | Platform | L | — | Admin only | — | Staff delete | Engineers/platform. |
| Global command centre | `/global-command-centre` | Platform / demo | L | Today | Demo only | — | Staff delete | Titan/demo surface. |

### B. Schedule

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Calendar | `/calendar` | Most | H | Bookings/Appts | **Yes** | Absorb bookings UI | — | One scheduling brain. |
| Appointments list | `/appointments` | Admin | M | Calendar | Merge | → Calendar list view | Soft | Separate list is 90s PMS. |
| Appointment detail | `/appointments/{id}` | All | M | Calendar drawer | Keep deep | Workspace panel | — | Prefer panel over full page. |
| Bookings board | `/bookings` | Ops | M | Calendar | Merge | → Calendar | Soft | “Bookings” vs appointments = jargon. |
| New booking | `/bookings/new` | Reception | H | Quick create | Keep action | Modal/panel | Soft page | Action ≠ page. |
| Rooms | `/rooms` | Admin | L | Settings | Merge | → Settings → Rooms | Soft | Config, not daily nav. |
| Calendar testing | `/calendar/testing` | Dev | L | — | Dev only | — | Prod delete | QA. |

### C. Patients & clinical

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Patients list | `/patients` | Most | H | Directory | **Yes** | Absorb directory | — | Title still “PatientOS” — rename. |
| New patient | `/patients/new` | Reception/CRM | H | Quick create | **Yes** | — | — | Essential. |
| Patient profile | `/patients/{id}` | All | H | Twin / timeline | **Yes** | One profile with tabs | — | Single patient home. |
| Timeline | `…/timeline` | Clinical | M | Profile history | Tab | — | — | Keep as tab, not nav item. |
| Patient twin path | `…/twin` | Clinical | M | Health record | Merge label | Profile “Health” | Soft name | “Twin” is product myth. |
| Imaging | `…/imaging` | Clinical | M | Imaging review | Keep | Profile tab | — | Inside patient. |
| Blood request/results | `…/blood-*` | Clinical | M | Pathology inbox | Keep | Patient + Labs inbox | — | Dual entry OK if linked. |
| Directory | `/directory` | Admin | L | Patients | Merge | → Patients | Soft | Pure duplicate. |
| Doctor workspace | `/doctor` | Doctor | H | Consultations | **Yes** | Could be Today filter | — | Role home for doctors. |
| Consultations list | `/consultations` | Clinical | H | Doctor workspace | **Yes** | Link both ways | — | List OK. |
| Consultation workspace | `/consultations/{id}` | Doctor | H | — | **Yes** | — | — | Core clinical. |
| Conversion board | `/consultation-conversion` | CRM/Mgr | M | Pipeline | Merge | → Pipeline / Insights | Soft | Sales language. |
| Prescriptions | `/prescriptions` | Doctor | H | — | **Yes** | — | — | Clear job. |
| Medication reorders | `/medication-reorders` | Clinical | M | Rx | Merge | → Prescriptions tab | Soft | |
| Pathology inbox | `/pathology/inbox` | Clinical | M | Patient labs | **Yes** | Clinical hub | — | Work queue. |
| Pathology email routes | `/configuration/pathology-email` | Admin | L | Settings | Merge | → Settings | Soft | Config. |
| Health record (foundation) | `/foundation-integrity` | Clinical | L | Patient twin | Merge | → Patient / Integrity admin | Soft staff nav | Sounds engineering. |
| Imaging review | `/imaging/review` | Clinical | M | Patient imaging | Keep | Clinical tools | — | Batch review OK. |

### D. Surgery

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Surgery hub | `/surgery` | Surgery team | H | SurgeryOS | **Yes** | — | — | Correct front door. |
| Surgery cases tab | `/surgery/cases` | Coord | H | `/cases` | **Yes** | — | — | |
| Procedure day tab | `/surgery/procedure-day` | Day team | H | `/procedure-day` | **Yes** | — | — | Rename to “Surgery day”. |
| Surgery review tab | `/surgery/review` | Surgeon/Mgr | M | Intelligence | **Yes** | Staff-safe language | — | |
| Cases worklist (legacy) | `/cases` | Coord | H | Surgery cases | Legacy | → /surgery/cases | Soft | Hide nav. |
| Case detail | `/cases/{id}` | All | H | — | **Yes** | — | — | Entity page. |
| New case | `/cases/new` | Coord | H | — | **Yes** | Wizard OK | — | “New surgery” label. |
| SurgeryOS | `/surgery-os` | Coord | M | Surgery hub | Legacy | → /surgery | Soft | **Architecture name.** |
| Readiness board | `/surgery-readiness` | Coord | H | Surgery review/command | Merge | → Surgery “Ready?” | Soft nav | Essential job, bad name. |
| Procedure day legacy | `/procedure-day` | Day team | H | Surgery tab | Legacy | → surgery/procedure-day | Soft | |
| Graft counting | `/surgery-os/graft-counting` | OR | M | Review | Admin/OR | → Surgery tools | Soft | Specialist. |
| Surgery intelligence | `/surgery-os/intelligence` | Mgr | L | Reports | Admin | → Reports surgery | Soft | |
| Surgery booking alias | `/surgery-booking` | — | L | Cases | Delete nav | → Patients/Cases | Soft | Dead alias. |

### E. Pipeline (sales / CRM)

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Enquiries (LeadFlow) | `/leadflow` | CRM | H | CRM | Merge | **One Pipeline workspace** | Soft | Two URLs, one job. |
| CRM workspace | `/crm` | CRM | H | LeadFlow + Follow-ups | **Yes** as Pipeline | Absorb LeadFlow | — | Canonical pipeline. |
| Follow-ups nav | same `/crm` | CRM | H | CRM | Delete nav row | → Pipeline tab “Tasks” | Soft | Third door. |
| Lead detail | `/crm/leads/{id}` | CRM | H | — | **Yes** | — | — | |
| Conversion board | `/consultation-conversion` | CRM | M | Pipeline stages | Merge | Pipeline board view | Soft | |

### F. Finance

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Finances (FinancialOS) | `/financial-os` | Finance/Mgr | H | `/financial/*` | **Yes** as Money hub | Absorb operational tree | Soft dual | Two finance products. |
| Financial executive | `/financial-os/executive` | Director | M | Reports | Tab | Money or Insights | Soft | |
| AR | `/financial-os/accounts-receivable` | Finance | H | Invoices | Tab | Money | Soft | |
| Financial dashboard | `/financial/dashboard` | Finance | H | FinancialOS | Merge | Money hub | Soft | |
| Payments (fin tree) | `/financial/payments` | Finance | H | `/payments` | Merge | One Payments | Soft | |
| Invoices | `/financial/invoices` | Finance | H | — | Tab | Money | Soft | |
| Pathway inbox | `/financial/pathway-inbox` | Finance | M | — | Tab | Money “Plans” | Soft | Internal word “pathway”. |
| Expenses / providers / etc. | `/financial/*` deep | Finance | M–L | — | Tabs | Money | Soft | Collapse tree. |
| Payments inbox | `/payments` | Reception/Fin | H | financial/payments | Merge | Money → Payments | Soft | RevenueOS hint in code. |

### G. Team & workforce

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Team hub | `/team` | Manager | H | Workforce/HR | **Yes** | — | — | Correct. |
| Staff directory | `/team/staff` | Manager | H | `/staff` | **Yes** | — | — | |
| Roster | `/team/roster` | Mgr / override | H | workforce roster | **Yes** | — | — | Capability overrides OK. |
| Onboarding | `/team/onboarding` | Manager | M | hr-os/onboarding | **Yes** | — | — | Drop “Centre”. |
| Compliance / Training / Identity | `/team/*` | Manager | M | hr-os * | **Yes** | Role-gate identity | Soft | Identity = admin only. |
| WorkforceOS hub | `/workforce-os` | Manager | M | Team | Legacy | → /team | Soft | **Architecture.** |
| Workforce deep (planning, payroll…) | `/workforce-os/*` | HR/Mgr | M | Team tabs | Merge selectively | Team | Soft | |
| HR OS | `/hr-os` | HR | M | Team | Legacy | → /team | Soft | **Architecture.** |
| Staff legacy | `/staff` | Manager | M | Team staff | Legacy | → /team/staff | Soft | |
| Staff PIN / time clock | `/staff-pin-login`, `/staff-time-clock` | Frontline | H | — | **Yes** | — | — | Kiosk — keep separate. |

### H. Reports & intelligence

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Reports hub | `/reports` | Mgr+ | M | Analytics/Audit | **Yes** | — | — | Correct Insights home. |
| Analytics / Quality / etc. | `/reports/*` | Mgr | M | legacy | **Yes** | — | — | Staff-friendly labels already. |
| Library | `/reports/library` | Mgr | M | — | **Yes** | — | — | Report runners. |
| Admin audit tab | `/reports/admin` | Admin | L | intelligence | Admin | — | Soft staff | |
| Analytics legacy | `/analytics` | Mgr | M | reports/analytics | Legacy | → reports | Soft | |
| Audit intelligence | `/audit` | Auditor/Mgr | L | reports/quality | Legacy | → Quality review | Soft | **Architecture.** |
| D6 intelligence/* | `/intelligence/*` | Platform | L | — | Platform only | Settings admin | Soft staff | Never staff nav. |

### I. Settings

| Screen | Route | Role | Freq | Duplicate | Keep | Merge | Delete | Notes |
|--------|-------|------|------|-----------|------|-------|--------|-------|
| Configuration hub | `/configuration` | Admin | M | settings/* | **Yes** | Absorb settings tree | Soft | One Settings. |
| Services | `/services` | Admin | L | Settings | Merge | Settings → Services | Soft | |
| Settings subroutes | `/settings/*` | Admin | M | Configuration | Merge | Tabs under Settings | Soft | Too many top-level. |

---

# PHASE 2 — Duplicate workflow audit

| Workflow | Entry 1 | Entry 2 | Entry 3 | Problem | Recommendation |
|----------|---------|---------|---------|---------|----------------|
| **Day-of patient flow** | Front desk → Reception board | `/reception` | Operations centre | Same day board, three mental models | **One Front desk.** Soft-redirect legacy. |
| **Tomorrow prep** | Front desk → Tomorrow | `/tomorrow` | — | Duplicate URL | Keep one tab; hide legacy. |
| **Reception KPIs** | ReceptionOS | Operations | Reports | Analytics dressed as ops | KPIs → Insights; ops → Front desk. |
| **Schedule something** | Calendar | Bookings | Appointments | Three schedule products | **Calendar only** for humans. |
| **Find a patient** | Patients | Directory | Global search | Directory is redundant | Patients + search. |
| **Patient health picture** | Profile | Twin | Health record (foundation) | Three names for one person | **One patient record**, tabs inside. |
| **Start consult** | Reception board | Doctor workspace | Consultations | OK if linked; labels diverge | Same verb: “Start consult” everywhere. |
| **Enquiry → patient** | Enquiries `/leadflow` | CRM `/crm` | Follow-ups (also `/crm`) | Classic CRM maze | **Pipeline** with stages + tasks. One nav item. |
| **Book surgery** | Case wizard | Calendar surgery | Patient journey CTA | Multiple good entries, no spine | Prefer **Patient → Book surgery**; Cases is worklist not home. |
| **Surgery readiness** | Readiness board | Surgery command | Case chips | “Where do I clear blockers?” | One **Ready for surgery** list inside Surgery. |
| **Surgery day** | Procedure day | Surgery tab | Cases | “Procedure day” is clinical jargon for staff | Rename **Surgery day**. |
| **Take a payment** | Payments inbox | Financial payments | FinancialOS | Reception vs finance split | Reception: **Take payment** action; Finance: **Money** hub. |
| **Invoices / balances** | Finances | financial/* | Reports revenue | Two finance apps | **One Money workspace.** |
| **Staff list** | Team → Staff | `/staff` | Workforce directory | Triple directory | Team only. |
| **Roster** | Team → Roster | Workforce roster | HR roster | Capability override path is good; URLs many | Team roster only in nav. |
| **Onboarding hire** | Team onboarding | HR OS onboarding | OnboardingOS import | HR product suite bleed | Team → Onboarding; import stays admin tool. |
| **Clinic performance** | Reports | Analytics legacy | Audit OS | Three insight homes | Reports only. |
| **Labs work queue** | Pathology inbox | Patient blood results | Config email routes | Config in clinical nav | Inbox clinical; routes in Settings. |

---

# PHASE 3 — Navigation audit

### Current primary rail (staff collapse mode)

| Slot | Verdict | Action |
|------|---------|--------|
| Today | Keep | Make true home for all roles (role-weighted feed). |
| Calendar | Keep | — |
| Patients | Rename → **People** (later) or keep Patients + nest enquiries | Avoid “CRM” forever. |
| Team | Keep for managers; **off by default** for pure reception (already) | Capability overrides OK. |
| Reports | Rename → **Insights** for humans | “Reports” is OK if manager-only. |
| More | Keep | **Cut contents by ~50%.** |

### Full catalog (sidebar / More)

| Current nav item | Keep | Rename | Merge into | Delete | Reason |
|------------------|------|--------|------------|--------|--------|
| Today | ✓ | — | — | — | Day spine |
| Calendar | ✓ | — | — | — | Schedule spine |
| Front desk | ✓ | — | — | — | Clinic day spine |
| Surgery | ✓ | — | — | — | OR spine |
| Patients | ✓ | People (opt) | — | — | Record spine |
| Enquiries | ✓ | **Pipeline** | + Follow-ups | Follow-ups row | One sales door |
| Follow-ups | | Tasks (tab) | Pipeline | ✓ as top item | Duplicate door |
| Consultations | ✓ | — | Clinical tools | — | Clinical job |
| Conversion board | | Pipeline stages | Pipeline | top-level | Sales board |
| Doctor workspace | ✓ | **My day (Doctor)** | Today role filter | optional later | Clearer |
| Prescriptions | ✓ | — | — | — | Clear |
| Pathology | ✓ | **Labs** | — | — | Human word |
| Health record | | Patient integrity (admin) | Patient | staff nav | Engineering surface |
| Reports | ✓ | **Insights** | — | — | Human |
| Team | ✓ | — | — | — | Human |
| Payments | ✓ | **Take payment** or Money tab | Money | dual with Finances | One money door |
| Finances | ✓ | **Money** | + Payments tree | — | Human |
| Settings | ✓ | — | — | — | Admin |
| ReceptionOS (legacy) | | — | Front desk / Insights | ✓ nav | Architecture |
| SurgeryOS (legacy) | | — | Surgery | ✓ nav | Architecture |
| WorkforceOS / HR OS (legacy) | | — | Team | ✓ nav | Architecture |
| LeadFlow (page title) | | Enquiries | Pipeline | brand only | CRM brand bleed |
| Audit intelligence | | Quality | Insights | ✓ as label | Architecture |
| Academy (disabled) | | — | Team training | hide | Dead weight |
| D6 intelligence items | | — | Platform admin | staff ✓ delete | Internal |

### Target More drawer (staff) — max ~12 destinations

1. Front desk  
2. Surgery  
3. Pipeline (if role)  
4. Consultations  
5. Doctor day (if role)  
6. Labs  
7. Money  
8. Team (if role)  
9. Insights (if role)  
10. Settings (if role)  

Everything else is **inside** those hubs as tabs or search.

**50%+ reduction:** From ~25+ catalog rows + legacy directs → ~10 More destinations + 5 rail slots.

---

# PHASE 4 — Human workflow mapping

## ROLE → DAILY BEHAVIOR MAP

### Receptionist

- Arrive and see **who is coming today**
- Confirm / reschedule appointments when patients call
- Check people in when they walk in
- Tell the clinical team “patient is here”
- Take deposits and simple payments
- Answer “where do I go?” for patients
- Prep tomorrow’s list before leaving
- Exception: some sites also build the **weekly roster** (capability override — not a new role)

**Software should feel like:** a day board + calendar + patient search + pay button. Not “modules.”

### Doctor / surgeon (consult)

- See who is waiting for me
- Open the consultation
- Review photos and history
- Explain plan and document
- Write prescriptions
- Request labs when needed
- Book or approve surgery when ready
- Leave a clear next step for reception/CRM

**Software should feel like:** My list → patient → write → next patient.

### Nurse / surgical assistant

- Know which surgeries are today
- See room / stage / readiness blockers
- Support check-in and pre-op tasks
- Capture or review images as protocol requires
- Update procedure stages when asked
- Find patient history quickly without finance noise

**Software should feel like:** Today’s list + surgery day board + patient lookup.

### Clinic manager

- Is the clinic running? (arrivals, delays, no-shows)
- Are surgeries ready? (payments, consent, staffing)
- Who is on the roster this week?
- Any staff access / onboarding stuck?
- How did we perform this week? (light insights)

**Software should feel like:** Today (ops) → Surgery ready → Team → Insights.

### Finance admin

- What money is owed
- What was paid today
- Failed / pending payment plans
- Invoices and pathways without opening clinical charts
- End-of-day reconciliation

**Software should feel like:** Money inbox → balances → patient payment context only when needed.

### CRM / patient advisor

- New enquiries that need a reply
- Follow-ups due today
- Move people toward consult and surgery
- Hand clean notes to clinical team
- Not re-learn “LeadFlow vs CRM vs Tasks”

**Software should feel like:** One pipeline board + task list + convert to patient.

### Surgeon (OR day)

- Confirm list for the day
- See readiness (not accounting dashboards)
- Progress stages
- Review graft/photo tools if used
- Hand off cleanly after last case

**Software should feel like:** Surgery day board only.

---

# PHASE 5 — Terminology redesign

| Current name | Problem | Better name |
|--------------|---------|-------------|
| ReceptionOS | Product codename | Front desk (metrics → Insights) |
| SurgeryOS | Product codename | Surgery |
| FinancialOS | Product codename | Money / Finances |
| WorkforceOS | Product codename | Team |
| HR OS | Product codename | Team |
| AnalyticsOS | Product codename | Insights / Analytics |
| AuditOS / Audit intelligence | Security-product vibe | Quality review |
| LeadFlow | Internal CRM brand | Enquiries / Pipeline |
| Patient Twin | Sci-fi, not clinic | Health record (on patient) |
| PatientOS (page title) | Architecture leak | Patients |
| OnboardingOS | Architecture leak | Staff onboarding |
| Onboarding Centre | Corporate HR suite | Onboarding |
| Procedure day | Clinical/jargon for desk staff | Surgery day |
| Operations centre | War-room language | Clinic overview |
| Command centre / Command | Military software | Home / Overview |
| Readiness board | Abstract | Ready for surgery |
| Conversion board | Sales jargon for clinicians | Consult → surgery |
| Foundation integrity | Engineering | Record completeness (admin) |
| Presence intelligence | Internal D6 | Arrival confirmation (admin) |
| Signal learning | Internal D6 | Priority tuning (admin) |
| Graft tray review | Specialist OK if OR-only | Graft count review (OR) |
| RevenueOS (code hints) | Architecture | Payments |
| Pathway inbox | Internal finance | Payment plans |
| Identity & access | OK for managers; scary for staff | Staff access (managers only) |
| AcademyOS | Dead / future | Training (under Team) |

**Rule:** If it ends in **OS**, it is not a user-facing name.  
**Rule:** If a new hire needs the glossary, rename it.

---

# PHASE 6 — Cognitive friction scores

*Score: “Would a first-time clinic employee understand this screen immediately?” (1–10). Below 7 = redesign.*

| Screen | UX Score | Reason |
|--------|----------|--------|
| Calendar | **8** | Familiar metaphor; polish density/labels |
| Reception board (flow lanes) | **7** | Lanes are human; page still multi-product linked |
| Today surface | **7** | Right idea; signal language still product-y |
| Patients list | **6** | List OK; “PatientOS” / twin language hurts |
| Patient profile | **6** | Powerful but tab overload |
| Front desk hub (4 tabs) | **5** | Four near-synonyms for “desk work” |
| Doctor workspace | **6** | Role-right; naming still “workspace” |
| Consultation | **7** | Task-shaped if templates clear |
| Surgery hub | **6** | Better than SurgeryOS; “command/review” still abstract |
| Procedure day | **6** | OR staff get it; reception may not |
| Readiness board | **5** | Chip language; needs plain English |
| Enquiries / CRM / Follow-ups | **4** | Classic CRM maze — worst daily confusion |
| Finances / FinancialOS tree | **4** | Two products; pathway/AR jargon |
| Payments (split) | **5** | Job is simple; entry points are not |
| Team hub | **7** | Good structure; legacy HR titles under tabs |
| WorkforceOS / HR OS legacy | **3** | Pure architecture |
| Reports hub | **7** | Improving; library is advanced |
| Analytics / Audit legacy | **4** | Module names + charts without story |
| Settings / configuration | **5** | Hub helps; deep tree is IT |
| Intelligence / D6 admin | **2** | Correctly internal — never staff |
| Global command centre | **2** | Demo/platform theatre |

---

# PHASE 7 — Delete / merge lists (product surface)

### Delete from staff navigation (hard)

- ReceptionOS, SurgeryOS, WorkforceOS, HR OS, AnalyticsOS, Audit intelligence (as labels)
- Follow-ups as a **separate top-level** item
- Directory as a **separate top-level** item
- Academy (disabled)
- All `/intelligence/*` for non-platform roles
- Global command centre, system status for clinic staff
- Bookings board + Appointments list as peer nav of Calendar
- Dual Payments + Finances top-level (keep one Money)

### Merge (product)

| Merge from | Into |
|------------|------|
| `/reception`, `/reception-board`, `/reception-os`, `/operations`, `/tomorrow` | **Front desk** |
| `/surgery-os`, `/cases` (list), `/procedure-day`, `/surgery-readiness` | **Surgery** |
| `/leadflow`, Follow-ups row, conversion board | **Pipeline** |
| `/financial-os` + `/financial/*` + `/payments` | **Money** |
| `/workforce-os`, `/hr-os`, `/staff` | **Team** |
| `/analytics`, `/audit` | **Insights / Reports** |
| Patient twin + foundation integrity (staff) | **Patient record** |
| Rooms, pathology email routes | **Settings** |

### Soft-delete (routes live, nav gone, eventual redirect)

All “legacy (direct)” More items already partially hidden — complete the job with **canonical redirects** after one release of dual-run.

---

# PHASE 8 — Finish pathway (how to complete FI-UX-REBUILD-1)

You have completed **IA scaffolding** (rail + hubs). You have **not** finished **product simplicity**.  
Treat the rest as a deliberate sequence — not more modules.

## Stage map

| Stage | Name | Outcome | Est. effort |
|-------|------|---------|-------------|
| **S0** | Freeze rules | No new *OS product names in UI; no new top-level nav items without IA review | 1 day |
| **S1** | **This audit** | Shared truth for PMs/design/eng | Done |
| **S2** | Language pass | All page titles + CTAs human; zero *OS in staff chrome | 1–2 weeks |
| **S3** | Front desk v2 | One board metaphor; ≤2 tabs; legacy redirects | 2 weeks |
| **S4** | Pipeline v1 | One Enquiries/Pipeline workspace; kill Follow-ups top nav | 2 weeks |
| **S5** | Money v1 | Single Money hub; reception “Take payment” action | 2–3 weeks |
| **S6** | Surgery plain language | Ready for surgery + Surgery day; hide SurgeryOS titles | 1–2 weeks |
| **S7** | Patient one-home | Profile tabs only; retire twin/foundation from nav | 2 weeks |
| **S8** | Role home & login | Reception → Front desk/Today; Doctor → Doctor day; Finance → Money; never Cases for all | 1 week |
| **S9** | More drawer diet | ≤10 destinations; hide remaining legacy | 1 week |
| **S10** | Staff go-live smoke | Matrix + real clinic day scripts per role | 1 week |
| **S11** | Redirect freeze | Soft-redirect legacy URLs; monitor 404/bookmark | Ongoing |

## Sequencing principles

1. **Language before layout** — renaming *OS titles is cheaper than rewiring and immediately reduces fear.  
2. **One workflow spine at a time** — Front desk, then Pipeline, then Money. Do not parallelize three hubs.  
3. **Redirects after dual-run** — never strand bookmarks on day one.  
4. **Role homes beat universal dashboards** — the same six rail slots can land on different first screens.  
5. **Capability overrides stay** — exceptions (receptionist + roster) must not re-inflate roles.  
6. **Platform admin ≠ clinic staff** — D6 intelligence stays invisible to clinics.

## Definition of done (product)

- [ ] No staff-facing string contains `OS`, `LeadFlow`, `Twin`, `Command Centre`, `Intelligence` (except admin tools).  
- [ ] No job has more than **one** primary nav entry.  
- [ ] More drawer ≤ 10 items for any non-admin role.  
- [ ] New receptionist day script completable in **15 minutes** without a trainer.  
- [ ] New doctor day script: see list → complete consult → prescribe.  
- [ ] Finance day script never requires opening SurgeryOS/WorkforceOS.  
- [ ] All role preflight scenarios still PASS (D6G-G0 matrix).  
- [ ] Unit + e2e nav suites green; no temporary full-access grants.

## What not to do

- Do not add another OS or “Centre.”  
- Do not “fix” confusion by adding a 7th primary rail item.  
- Do not train staff on architecture diagrams.  
- Do not keep three CRMs because engineering likes domain packages.  
- Do not expose D6 bake / presence / signal learning to clinics.

---

## Recommended product IA (final target)

### Primary rail (role-adaptive)

| Everyone | Frontline bias | Manager bias |
|----------|----------------|--------------|
| Today | Today | Today |
| Calendar | Calendar | Calendar |
| People | People | People |
| Clinic | **Front desk** | Front desk |
| More | Surgery · Money · … | + Team · Insights · Settings |

### Hubs only (no peer modules)

| Hub | Contains |
|-----|----------|
| **Today** | Prioritised tasks, arrivals, blockers |
| **Calendar** | All time-based scheduling |
| **People** | Patients + enquiries (tabs or segmented list) |
| **Front desk** | Live board · tomorrow · desk actions |
| **Surgery** | Cases · ready · surgery day · review |
| **Money** | Take payment · invoices · plans · AR |
| **Team** | Staff · roster · onboarding · access |
| **Insights** | Performance · quality · library |
| **Settings** | Branding · rooms · integrations · labs email |

---

## Appendix A — Already done (protect)

- Six-slot collapsed rail  
- Front desk / Surgery / Team / Reports consolidated routes  
- Staff-hidden More labels for *OS / engines / identity audit  
- Role preflight matrix + capability overrides (G0B)  
- Today live signals program (D6*)  
- Conceptual *OS docs archived  

## Appendix B — Source of truth (code)

| Concern | File |
|---------|------|
| Sidebar catalog | `src/lib/fiAdmin/fiOsShellPrimaryNav.ts` |
| Minimal rail | `src/lib/fiAdmin/fiOsMinimalNav.ts` |
| More regrouping | `src/lib/fiOs/navigation/fiOsNavigationRegroupingCore.ts` |
| Front desk | `src/lib/fiOs/frontDesk/frontDeskWorkspaceCore.ts` |
| Surgery | `src/lib/fiOs/surgery/surgeryWorkspaceCore.ts` |
| Team | `src/lib/fiOs/team/teamWorkspaceCore.ts` |
| Reports | `src/lib/fiOs/reports/reportsWorkspaceCore.ts` |
| Preflight matrix | `docs/workforce/fi-os-role-permission-preflight-matrix.md` |

## Appendix C — Audit method

- Code inventory of `app/(fi-admin)/fi-admin/[tenantId]/*`  
- Live nav registries (not marketing site)  
- Cross-check prior `docs/fi-ux-audit` (2026-07-02) for drift  
- Role behaviour written from clinic operations, not package boundaries  

---

**Owner recommendation:** Treat S2–S5 as the next product milestone (**FI-UX-REBUILD-1 Finish Track**). Engineering implements; product owns naming and kill list. Design owns hub tab counts (≤4 tabs per hub). Success is measured by **time-to-first-correct-action** for a new hire — not by feature completeness.
