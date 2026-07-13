# FI-PLATFORM-READINESS-AUDIT-1

**Title:** Post-UX-Rebuild Operational, Product and Commercial Readiness Assessment  
**Repository:** `follicleintelligence` (canonical production path under `/fi-admin/[tenantId]`)  
**Audit date:** 2026-07-13  
**Method:** Evidence-first code, route, migration, flag, test and production-doc inspection  
**Code changes during audit:** None  

---

## 1. Executive verdict

### Direct answers

| Question | Verdict |
| -------- | ------- |
| **Is FI ready for daily Evolved Hair staff use?** | **No — not as a full clinic OS.** Ready only for a **controlled pilot subset** of workflows (enquiries, calendar/bookings, patients, consultations, cases, front desk check-in) with trained operators and explicit non-goals. |
| **Which roles are ready?** | **Consultant** (partial–usable), **clinic admin** (tooling ready, high training load), **platform admin** (ready for internal ops). Receptionist ready for **day-board + booking** if CRM/bookings shell and Front desk are configured. |
| **Which roles still face material friction?** | **Receptionist** (post-login to Cases, payment dual doors, pipeline dual UI), **nurse** (procedure day default off; treatment imaging discoverability), **surgeon** (OR day gated; dual surgery stacks), **roster manager** (deep paths, dual staff identity), **finance** (dual Money products; Stripe off), **clinic owner** (no single owner home). |
| **Is the UX rebuild complete?** | **No.** Shell hubs (D6G) and Front desk legacy redirects are largely landed. Pipeline cutover, Money consolidation, role landings, and “new hire in 10 seconds” remain incomplete. |
| **Does the system feel like one operating system?** | **Partially.** Data can link enquiry → patient → consult → case → booking → payment, but staff still navigate **modules and dual entry points**, not one spine. |
| **Is it safe to begin a second-clinic pilot?** | **No** for self-serve or lightly guided pilot. **Yes only** as white-glove, Evolved-ops-style deployment with frozen feature set and platform-admin onboarding. |
| **Five most important next actions** | See §18 and Phase 1 roadmap. |

### Bottom line

Follicle Intelligence is a **deep vertical platform codebase** with real multi-tenant persistence across CRM, patients, calendar, consultations, surgery cases, finance engines, imaging, workforce and platform admin. After the UX rebuild it is **easier to navigate at the chrome layer**, but it is **not yet a hireable single product**. Critical surgery-day and payments features are **off by default**, pipeline and finance retain dual surfaces, post-login still dumps many clinic roles into **`/cases`**, operational readiness criteria fail even when journey smoke “passes,” and formal Evolved production decision remains **NO-GO (48/100, 2026-06-27)** until P0 evidence is re-scored.

**Do not treat route existence, dual-run mounts, unit test volume, or smoke PASS as production completeness.**

---

## 2. Readiness scorecard

### Product completeness scores (0–100%)

| # | Dimension | Score | Confidence | Strongest evidence | Largest deduction |
| - | --------- | ----: | ---------- | ------------------ | ----------------- |
| 1 | Platform capability | **72%** | High | Migrations + server actions across CRM, patients, bookings, cases, finance, workforce, imaging | Dual stacks reduce “one platform” |
| 2 | Workflow completeness | **48%** | High | Operational-day smoke lead→surgery book; procedure/follow-up incomplete | Procedure day off; follow-up F3; payment truth |
| 3 | UX coherence | **52%** | High | D6G rail + Front desk/Surgery/Team/Reports hubs (2026-07-11 Stage 1 audit) | Dual doors, post-login Cases, More catalog |
| 4 | Data integrity | **68%** | Medium–High | Tenant-scoped tables, CRM stage history, service-role + gates | Dual lead/staff/surgery models; clearance advisory |
| 5 | Permission and security safety | **58%** | Medium | Portal gates, CRM gates, SA-1, impersonation audit | Stacked auth; SA-1 defers without staff map; open P0 DR/identity docs |
| 6 | Staff operational readiness | **42%** | High | Manual UAT Pending (Sprint 7/9); reception cold load | Training burden; wrong landings; flag-gated day work |
| 7 | Owner and reporting usefulness | **55%** | Medium | Report catalog (gross margin, AR, CPL, attribution) | No single owner home; incomplete outcome spine |
| 8 | Tablet and mobile readiness | **50%** | Medium | Tablet layout e2e exists; pipeline horizontal scroll contracts | Boards need horizontal scroll; More drawer density |
| 9 | Evolved Hair production readiness | **40%** | High | Formal NO-GO 48/100; July smoke better but no re-score ≥95 | P0 evidence + role UAT + operational 3–4/7 |
| 10 | Controlled pilot-clinic readiness | **35%** | Medium | Provisioning + entitlements Phase 1 | Product still module-shaped; dual systems |
| 11 | General commercial readiness | **28%** | High | Multi-tenant model exists | Not self-serve; not clean sell surface |

### Weighted operational-readiness score

**Weighting (Evolved daily ops):**

| Weight | Dimension |
| -----: | --------- |
| 25% | Workflow completeness |
| 20% | Staff operational readiness |
| 15% | Data integrity |
| 15% | Permission and security safety |
| 10% | UX coherence |
| 10% | Evolved production readiness |
| 5% | Tablet/mobile |

**Weighted operational score ≈ 46 / 100** — **NOT READY** for unrestricted daily use.

### Weighted commercial-readiness score

**Weighting (second clinic / sell):**

| Weight | Dimension |
| -----: | --------- |
| 30% | General commercial readiness |
| 20% | Controlled pilot readiness |
| 15% | UX coherence |
| 15% | Permission and security safety |
| 10% | Platform capability |
| 10% | Owner reporting |

**Weighted commercial score ≈ 38 / 100** — **NOT READY** for general multi-clinic onboarding.

---

## 3. Evidence limitations

1. **No live browser session** against production Evolved during this audit — production-path conclusions are from code gates, env defaults, smoke manifests and dated docs.  
2. **Date tension:** Evolved formal decision **2026-06-27**; clinic-day smoke **2026-07-02**; UX Stage 1 **2026-07-11**. Later smoke does not automatically clear NO-GO without re-score.  
3. **Unit suite historically unclean** (~3829 pass / ~22 fail in Sprint 9 notes) — count ≠ readiness.  
4. **Cross-tenant smoke often SKIPPED** without `FI_SMOKE_OTHER_TENANT_ID`.  
5. **E2E treatment imaging / authenticated suites skip** without fixture env IDs.  
6. **Viewport assessments** are code- and contract-based (classes, e2e scroll contracts), not fresh visual QA screenshots on every device.  
7. **Documentation alone never upgrades status** above implementation evidence.

---

## 4. Platform inventory

Production staff chrome is **`FiOsAppShell`** (`src/components/fi-os/FiOsAppShell.tsx`). Routes live under `/fi-admin/[tenantId]/…`.

**Status legend:** Complete · Mostly complete · Partial · Scaffold · Obsolete  
**Persistence:** Real database · API · local state · mock  
**Discoverability:** Clear · weak · hidden  

| Area | Purpose | Primary users | Production route | Status | Persistence | Discoverability | Permission safety | Workflow integration | Test evidence | Main risks | Recommendation |
| ---- | ------- | ------------- | ---------------- | ------ | ----------- | --------------- | ----------------- | -------------------- | ------------- | ---------- | -------------- |
| Today | Next actions / day home | All | `/` | Mostly complete | DB aggregates | Clear | Safe shell | Partial | UX e2e, unit | Dual feed vs operational home; allowlist | Keep; sole home |
| Search | Find people/bookings | Frontline, clinical | Ctrl+K global search | Mostly complete | DB | Clear | Portal | Connected | Unit | Identity quality | Keep |
| Quick Create | Start core entities | Reception, CRM, clinical | Ctrl+Shift+K | Partial | Nav-only palette | Clear | CRM/bookings flags | Partial | Unit | Several items dump into lists | Repair |
| Enquiries / Pipeline | Capture & progress leads | Reception, consultant | `/crm`; `/leadflow` | Mostly complete | `fi_crm_*` | Weak (dual doors) | CRM shell | Partial | Heavy unit; dual-run | V1 allowlist; LeadFlow parallel | Consolidate |
| Patients / health records | Care record | Clinical, reception | `/patients/*`, twin, timeline | Mostly complete | persons/patients | Clear | Bookings + modules | Connected (twin read) | Unit | Twin naming; legacy global | Keep; one home |
| Calendar | Scheduling | Most | `/calendar` | Mostly complete | `fi_bookings` | Clear | Bookings board | Connected | Calendar e2e | Dual UI; Google approve ≠ booking | Keep |
| Front desk | Day-of clinic flow | Reception | `/front-desk`, `/front-desk/tomorrow` | Mostly complete | Board + tasks | Clear | Portal + PIN | Connected | Smoke | Cold load 17–27s | Keep |
| Procedure / Surgery day | Live OR board | OR team | `/surgery/procedure-day`, `/procedure-day` | Partial (gated) | Case + Surgery OS | Hidden when off | Env + module | Partial | Smoke skips off | Default off; dual stack | Repair then enable |
| Consultations | Document consult | Doctors, consultants | `/consultations`, `/doctor` | Mostly complete | consultations + forms | Clear | CRM/bookings | Connected | Unit + journey | Handoffs multi-hop | Keep |
| Surgery cases | Case lifecycle | Coord, surgeons | `/surgery`, `/cases` | Mostly complete | `fi_cases` | Clear hub | Surgery module | Connected | Unit + smoke | Dual URLs | Consolidate under Surgery |
| Surgery booking | Book procedure | Reception, coord | `/surgery-booking`, calendar | Mostly complete | bookings | Weak | Bookings | Partial | Unit | Prefill gaps | Repair spine |
| Surgical planning | Plans / readiness | Surgeons, coord | Case + `/surgery-readiness` | Mostly complete | plans + readiness | Weak jargon | Clinical | Partial | Unit | Staff/room missing | Keep as Ready? |
| Financial clearance | Safe surgery money gates | Finance, coord | Case + Financial OS | Partial | snapshots + payments | Weak | Finance | Partial | Unit | Often advisory | Repair |
| Payments & finance | Money ops | Finance, reception | `/financial-os`, `/financial/*`, `/payments` | Mostly complete engine | ledger + payment records | Weak dual | Finance + env | Partial | Unit | Payments inbox off | Consolidate Money |
| Imaging | Photos / protocols | Clinical | Patient imaging, `/imaging/review` | Mostly complete | images + Imaging OS | Partial | Imaging | Connected | Phase tests, e2e | AI stubs; multi packages | Keep |
| Treatment imaging | PRP/meso/exosome protocols | Nurses, clinical | Appointment detail checklist | Mostly complete | protocol + images | Weak | Clinical | Partial | E2E fixture-gated | Discover via appointment URL | Keep; improve entry |
| Pathology | Labs | Clinical | `/pathology/inbox` | Mostly complete | pathology tables | Partial | Clinical | Partial | Unit | Config vs clinical | Keep |
| Medical intelligence | Decision support | Doctors | Panels | Partial | derived | Hidden | Clinical | Isolated | Unit | Over-trust AI | Defer promise |
| Follow-up & outcomes | Post-care | Clinical | Forms, outcomes, `/audit` | Partial | encounters + outcomes | Weak | Audit | Fragmented | Unit | F3 follow-up missing | Repair |
| HairAudit | Outcome network | Clinical, platform | Audit + settings | Partial | links + reports | Hidden | Mixed | Partial | Unit | Complexity | Defer sell story |
| Team directory | Who works | Managers | `/team/staff` | Mostly complete | fi_staff + members | Clear | Team tabs | Connected | Workforce e2e | Dual identity | Consolidate |
| Staff profiles | Individual staff | Managers | staff twin / workforce staff | Partial | DB + placeholders | Weak | Team | Partial | Unit | Placeholder panels | Repair/hide |
| Staff onboarding | Hire → access | Managers | `/team/onboarding` | Mostly complete | invites + grants | Clear | Manager | Connected | Unit | Admin-heavy | Keep |
| Access management | Roles / overrides | Admins | settings staff-access | Mostly complete | SA-1 | Hidden | Admin | Connected | Unit | Stack complexity | Keep + SOP |
| Roster | Shifts | Roster mgr | `/team/roster` | Mostly complete | shifts tables | Clear | Capability | Connected | Unit + e2e | Legacy URLs | Keep |
| Standard hours | Default week | Roster | workforce standard-hours | Mostly complete | `fi_staff_standard_hours` | Weak deep path | Workforce | Connected | Unit | Buried | Consolidate |
| Leave | Time away | Managers | availability blocks | Partial | availability blocks | Weak | Workforce | Partial | Unit | Not full PTO product | Defer product |
| Training / competencies | Privileges | Managers, OR | team training + academy | Partial | academy tables | Weak | Entitlements | Partial | Unit | Not hard-gated on OR | Defer auto-block |
| Documents / compliance | Creds | HR, managers | `/team/compliance` | Mostly complete | compliance | Partial | HR | Partial | Unit | HR OS add-on | Keep under Team |
| Configuration | Clinic setup | Admin | `/configuration`, settings | Mostly complete | settings | Admin clear | Caps | Connected | Branding tests | Sprawl | Consolidate Settings |
| Reports / insights | Performance | Managers, owners | `/reports/*` | Mostly complete | runs + aggregates | Clear managers | analytics_os | Partial | Unit | Not warehouse BI | Keep |
| Tenant branding | Brand | Admin | configuration | Mostly complete | settings + storage | Admin | Branding perms | OK | Smoke | — | Keep |
| Tenant provisioning | New clinic | Platform | platform onboarding | Mostly complete | provisioning | Platform | Platform admin | Connected | Tests | Sandbox seeds | Keep |
| Platform admin | Cross-tenant | Platform | `/fi-admin/system/*` | Mostly complete | system | Platform | platform_admin | Isolated | Partial e2e | High power | Keep |
| Patient portal | Self-serve | Patients | `/patient/[tenantId]/*` | Partial | images/meds | Weak | Portal env | Partial | Smoke | Imaging off default | Defer breadth |
| Integrations | HubSpot, GCal, Timely, IIOHR, Stripe | Admin | settings + crons | Partial–Mostly | queues | Admin | Secrets | Partial | Live-data audit | Dual paths | Repair SoR rules |
| Background jobs | Async ops | Ops | `/api/cron/*` | Mostly complete | job tables | Hidden | Cron secrets | Connected | Scripts | Silent fail risk | Keep + monitor |

### Production flag defaults (high impact)

| Flag / behaviour | Default | Effect |
| ---------------- | ------- | ------ |
| `FI_PROCEDURE_DAY_ENABLED` | Off | Surgery day hidden |
| `FI_PAYMENTS_ENABLED` | Off | Payments inbox disabled |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` | Allowlist | Pipeline dual-run |
| Today surface / workspace shell | Allowlist | Nav collapse requires both |
| Post-login clinic roles | → `/cases` | Wrong first screen for many roles |
| Patient portal imaging | Off | Limited self-serve |

---

## 5. Role workflow findings

Scoring key (0–5): **discoverability · completion · data integrity · efficiency · role appropriateness · consistency · confidence after refresh · mobile/tablet**

### 5.1 Receptionist

| Intended landing | Actual landing |
| ---------------- | -------------- |
| Front desk Today | **`/cases`** post-login (`fiOsRedirect.server.ts` / `docs/fi-os-access-production.md`) |

**Primary nav:** Today, Calendar, Patients; More → Front desk, Pipeline, Payments (if on).

| Task | Route / actions | Transitions | Friction |
| ---- | --------------- | ----------: | -------- |
| New enquiry | New → enquiry → `/crm` | 2–3 | OK if CRM shell |
| Duplicate check | Global search | 1–2 | Depends on data quality |
| Patient identity | Patients new / convert | 2–4 | Solid conversion when used |
| Contact enquiry | Lead comms/tasks | 2–3 | ESP incomplete |
| Move stage | Pipeline board | 1–2 | V1 vs legacy |
| Book consultation | Calendar / bookings | 2–4 | Triple schedule product |
| Payment | `/payments` or financial | 2–5 | Often env-off / manual |
| Confirmation | Reminders / reception comms | 2–4 | Not one-click |
| Check-in | `/front-desk` board | 1 | Strong |
| Next action | Today / board | 1 | Feed allowlist |

**Scores:** discoverability **2** · completion **3** · integrity **4** · efficiency **2** · role fit **2** · consistency **2** · refresh **4** · mobile **3**  
**Average ~2.8 / 5**

### 5.2 Consultant

| Task | Trace | Notes |
| ---- | ----- | ----- |
| Assigned enquiry | Pipeline filters | Works when owner set |
| History | Lead + patient / twin | Multi-surface |
| Complete consultation | `/consultations/[id]` forms | Strong; handoffs after complete |
| Recommendation | Forms + case handoff | OK |
| Images / pathology | Handoffs + modules | Multi-hop |
| Quote | CRM quote draft | No rich editor |
| Progress / follow-up | Stage + tasks | Policy-dependent |

**Scores:** 3 · 4 · 4 · 3 · 4 · 3 · 4 · 3 → **avg ~3.5**

### 5.3 Nurse — treatment / clinical day

| Step | Trace | Evidence | Status |
| ---- | ----- | -------- | ------ |
| See today’s assigned work | Today / Calendar / Front desk / Surgery day | Today allowlist; procedure day **off by default** | Partial |
| Access treatment appointment | Calendar → appointment detail | `/appointments/[id]` | Live |
| Complete PRP / exosome / mesotherapy / dutasteride-meso imaging protocol | **Treatment Photos** checklist on regenerative bookings | `treatmentImagingProtocol.ts`: types `prp`, `prf`, `mesotherapy`, `exosomes`; dutasteride via mesotherapy + text heuristics; e2e `treatment-imaging-protocol.spec.ts` (fixture-gated) | Mostly complete when booking typed correctly |
| Record treatment | Booking/procedure notes + imaging slots | Appointment + imaging ingest | Partial–mostly |
| Add notes | Clinical notes / appointment notes paths | Exists; Quick Create dumps to appointments list | Weak discovery |
| Missing clinical information | Readiness / twin / medical intelligence panels | Fragmented | Partial |
| Follow-up actions | Tasks / follow-up forms | UAT **F3**: follow-up often missing after procedure | Partial |

**Scores:** 2 · 3 · 4 · 2 · 3 · 2 · 4 · 3 → **avg ~2.9**

### 5.4 Surgeon

| Step | Trace | Evidence | Status |
| ---- | ----- | -------- | ------ |
| Review patient | Patients → profile / twin | Live | Mostly |
| History, meds, pathology, imaging | Twin sections + patient tabs + pathology inbox | Twin is **read model**, not SoR | Mostly (assemble) |
| Surgical plan | Case → Surgery planning section | `CASE_DETAIL_SECTION_IDS.surgeryPlanning`; `fi_case_surgery_plans` | Mostly |
| Donor / recipient planning | Plan fields `donor_strategy_notes`, `recipient_strategy_notes`, graft range readiness | `casesIndexLoaders` / readiness | Mostly |
| Financial & readiness blockers | Case readiness + Financial OS clearance snapshot | Advisory clearance; staff/room often missing (UAT F2) | Partial |
| Operative information | Case procedure day section + Surgery OS / graft counting | Dual stacks; day board gated | Partial |
| Post-op outcomes | Post-op section + outcome intelligence + audit | Fragmented product surfaces | Partial |

**Scores:** 3 · 3 · 4 · 2 · 4 · 2 · 4 · 2 → **avg ~3.0**

### 5.5 Roster manager

| Step | Trace | Evidence | Status |
| ---- | ----- | -------- | ------ |
| Onboard staff | Team → Onboarding | `/team/onboarding` | Mostly |
| Role + capability exception | Staff access grants (SA-1) | `fi_staff_access_grants` + templates | Mostly (admin skill) |
| Standard hours | Workforce standard-hours | Deep path under workforce-os | Live, weak discovery |
| Weekly/fortnightly roster | Team → Roster | Command centre loader | Mostly |
| Leave | Availability blocks (`leave`, `sick_leave`, …) | Not full PTO product | Partial |
| Replace unavailable | Roster edit / reassignment | Live mutations | Mostly |
| Edit shift | Roster drawer | Unit scroll contract allows horizontal grid scroll | Mostly |
| Confirm calendar impact | Surgery staffing / calendar eligibility | Bridges exist; not always obvious | Partial |

**Scores:** 2 · 4 · 4 · 3 · 3 · 2 · 4 · 3 → **avg ~3.1**

### 5.6 Clinic administrator

Settings sprawl; staff access dual model (tenant admin users vs SA-1); high capability, high cognitive load.  
**Scores:** 3 · 4 · 4 · 2 · 4 · 2 · 4 · 2 → **avg ~3.1**

### 5.7 Finance user

Dual Money products (`/financial-os` vs `/financial/*` vs `/payments`); payments env-off; clearance advisory.  
**Scores:** 2 · 3 · 4 · 2 · 3 · 2 · 4 · 2 → **avg ~2.8**

### 5.8 Clinic owner

| Step | Trace | Evidence | Status |
| ---- | ----- | -------- | ------ |
| Enquiry volume | Pipeline + marketing CPL report | Report catalog | Partial–mostly |
| Conversion | Conversion board + CRM stages + revenue attribution | Multiple surfaces | Partial |
| Scheduled revenue | Financial OS / reports | Live generators when data exists | Partial |
| Surgery profitability | `surgery_gross_margin` report | Requires snapshots + cost models | Partial |
| Team utilisation | Workforce / roster + reports | No single utilisation KPI home | Weak |
| Patient outcomes | Outcome intelligence / audit | Fragmented | Partial |
| Surgeon performance | Attribution by consultant; incomplete surgeon scorecard | Partial | Partial |
| Operational risks | Today attention + system status | Partial | Partial |
| Actions requiring intervention | Today feed when enabled | Allowlist | Partial |

**No single owner command surface.** Reports library is financial-heavy Phase 1.  
**Scores:** 2 · 2 · 3 · 2 · 3 · 2 · 3 · 2 → **avg ~2.4**

### 5.9 Platform administrator

System routes, impersonation, tenant directory — **mostly ready** for internal operators.  
**Scores:** 4 · 4 · 4 · 4 · 5 · 4 · 4 · 3 → **avg ~4.0**

### Role readiness matrix

| Role | Daily ready? | Material friction |
| ---- | ------------ | ----------------- |
| Receptionist | Pilot only | Landing, payments, dual CRM/schedule |
| Consultant | Closest to ready | Multi-hop handoffs, quote UI |
| Nurse | Not full | Surgery day flag, treatment entry, follow-up |
| Surgeon | Partial | OR day, dual stacks, readiness data quality |
| Roster manager | Pilot with training | Deep paths, dual staff IDs |
| Clinic admin | Tooling yes | Complexity |
| Finance | Not clean | Dual money, Stripe off |
| Owner | Insights partial | No owner home |
| Platform admin | Yes | Power-user surfaces |

---

## 6. Navigation and information-architecture findings (Section C)

### Primary navigation model (post-rebuild)

**Collapsed rail (D6G-B)** — six slots (`fiOsMinimalNav.ts` / `fiOsNavigationRegroupingCore.ts`):

1. Today  
2. Calendar  
3. Patients  
4. Team  
5. Reports  
6. More (action → drawer)

**Full sidebar** (when nav collapse off) exposes many more module rows (Front desk, Surgery, Pipeline, Consultations, Rx, Pathology, Finances, Payments, Doctor, Settings, …).

| Concern | Finding |
| ------- | ------- |
| Primary destinations | **5 links + More** in collapse mode; **~15+** in expanded module sidebar |
| Role-based visibility | CRM/bookings shell, tenant admin role blocks, SA-1 feature overlays, Team tab IDs, env flags |
| Drawer behaviour | More drawer groups by workflow (Front desk, Pipeline, Patients, Clinical, Surgery, Finance, Reports, Team, Settings) |
| Active state | Slot-based for rail; hub sub-routes partially mapped (Team includes workforce/hr-os/staff) |
| Route-gate alignment | Stage 4 `fiRouteFeatureMap` + `module-unavailable`; **not** 1:1 with SA-1 module keys |
| Staff overrides | SA-1 grants + Stage 2 feature map; **defers** if no `fi_staff` mapping |
| Expanded groups persistence | `buildNavExpandedGroupsStorageKey` — localStorage prefs (UI only) |
| Tablet/mobile | Bottom nav + More; tablet e2e asserts main column scroll + limited body overflow |
| Duplicate destinations | Front desk legacy redirects OK; Surgery/cases dual; Team/workforce/hr dual; finance dual; CRM/LeadFlow dual |
| Admin in daily workflow | Intelligence bake/presence/nav-audit only when `showNavigationAdminSurfaces`; system-status still reachable |
| Tasks requiring More/Config | Front desk (if not using Today alone), Surgery, Pipeline, Money, Consultations, Pathology — **most daily clinical work is not on the rail** |
| Hidden / URL-only | Many workforce deep routes, reception-os (platform), calendar testing, global-command-centre, foundation-integrity |
| Fallback routes | Procedure day disabled → calendar href; surgery deny → calendar; feature denied → module-unavailable |

### Recommended compact primary model (evidence-based)

**Do not** assume labels. Recommended for Evolved day roles:

| Slot | Why |
| ---- | --- |
| **Today** | Sole “what next” home (role-weighted) |
| **Calendar** | Scheduling spine |
| **People** | Patients + enquiries search/list (or Patients with Pipeline nested) |
| **Clinic** | Front desk day ops (critical for reception; currently buried in More) |
| **More** | Surgery · Pipeline · Money · Team · Insights · Settings (role-filtered) |

**Optional sixth slot by role:** Team for managers; Surgery for OR days when flag on.

The proposed model **Today · Calendar · Enquiries · Patients · Team · More** is **close but suboptimal**: Enquiries and Patients split a single “people funnel”; Front desk is missing for reception; Team/Reports on the rail for pure reception is wrong.

### Route classification (major)

| Route / surface | Classification |
| --------------- | -------------- |
| `/` Today | **Primary** |
| `/calendar` | **Primary** |
| `/front-desk`, tomorrow | **Primary** (should be rail for frontline) / currently secondary in More |
| `/patients/*` | **Primary** |
| `/crm`, pipeline | **Secondary** (More) or primary for CRM personas |
| `/leadflow` | **Should redirect** → Pipeline |
| `/consultations/*`, `/doctor` | **Secondary / contextual** |
| `/surgery/*`, `/cases/*` | **Secondary** hub + **contextual** case workspace |
| `/procedure-day` | **Secondary** when enabled; else remove from nav |
| `/appointments/*` | **Contextual** (from calendar) |
| `/financial-os`, `/financial/*`, `/payments` | **Secondary** Money hub; consolidate |
| `/team/*` | **Secondary** (primary for managers only) |
| `/workforce-os/*`, `/hr-os/*`, `/staff` | **Redirect / secondary legacy** → Team |
| `/reports/*` | **Secondary** Insights |
| `/analytics`, `/audit` | **Redirect** → Reports |
| `/configuration`, `/settings/*`, services, rooms | **Configuration** |
| `/fi-admin/system/*`, platform onboarding | **Platform administration** |
| `/reception`, `/reception-board`, `/operations`, `/tomorrow` | **Redirected** (keep soft) |
| `/reception-os` | **Platform only** |
| Quick Create items | **Quick Create** (fix in-place for core 4) |
| Global search | **Primary action** (not a nav slot) |
| Intelligence D6 routes | **Platform / config** — not staff daily |

### Horizontal page scrolling

| Surface | Risk |
| ------- | ---- |
| Pipeline V1 board | **Desktop board uses `overflow-x-auto`** (`pipelineUi.tsx`) — internal board scroll by design; tablet stack avoids nested column scroll (a11y test). **Must not rely on browser-bottom scrollbar** — currently intended as container scroll. |
| Legacy CRM kanban | `lg:overflow-x-auto` on board |
| Roster grid | Unit contract: grid scrolls horizontally; page root must not clip |
| Tables (leads, finance) | `overflow-x-auto` wrappers — acceptable internal |

**Acceptance for boards:** horizontal navigation must stay inside the board region, not the document root.

---

## 7. Entity-coherence findings (Section D)

| Entity | Canonical DB identity | Display name(s) | Primary workspace | Duplicates / risks | Authoritative? |
| ------ | --------------------- | --------------- | ----------------- | ------------------ | -------------- |
| Person | `fi_persons` | Person / contact | Patient / lead anchors | Source IDs | Yes for identity |
| Lead | `fi_crm_leads` | Enquiry / lead / LeadFlow | Pipeline `/crm` | Parallel `fi_leads` LeadFlow store | **CRM lead is staff SoR**; dual risk |
| Patient | `fi_patients` | Patient / PatientOS | `/patients/[id]` | Legacy global patient mode | Yes when foundation-linked |
| Consultation | `fi_consultations` + form instances | Consultation | Consultation workspace | Conversion board read model | Yes |
| Appointment | `fi_bookings` | Appointment / booking | Calendar / appointment detail | Sample bookings prefix; Google staged events without FI booking | **FI booking SoR** |
| Payment | `fi_payment_records` + Financial OS transactions | Payment / invoice / pathway | Money hub (fragmented) | Dual payment layers | Ambiguous to staff |
| Surgery case | `fi_cases` | Case / surgery | Case detail + Surgery hub | `fi_surgeries` live OR stack | Case is planning SoR; surgery OS parallel |
| Pathology result | Pathology result tables | Labs / pathology | Inbox + patient blood | — | Yes when filed |
| Imaging encounter | `fi_patient_images` + protocol sessions | Imaging / photos / Treatment Photos | Patient imaging + appointment protocol | Multiple adapters/packages | Image row + session |
| Treatment | Booking type regenerative + notes | Treatment / PRP… | Appointment + treatment protocol | No single `fi_treatments` product entity | **Booking + imaging as proxy** |
| Staff member | `fi_staff` vs `fi_staff_members` | Staff | Team | **Major dual identity** | Reconcile required |
| Roster shift | `fi_staff_shifts` (+ related) | Shift | Team roster | Legacy workforce URLs | Yes when roster schema present |
| Competency | Projections + privileges | Competency / privilege | Team training / academy | IIOHR import partial | Projection, not always gate |
| Outcome review | Outcome tables + audit reports | Outcome / HairAudit | Audit / case outcomes | Fragmented | Case + audit joint |

### Cross-cutting entity issues

1. **Mismatched counts/summaries:** Today widgets, reception board, readiness, financial clearance and executive tiles use **independent loaders** — risk of divergent “blocked” counts.  
2. **Status derivation duplicated** across cases readiness, surgery presentation, front desk issues.  
3. **Actions that should be workspace-local:** stage move, check-in, payment take, image capture, shift edit, grant override — some still force module navigation.  
4. **Orphan risk:** bookings without staff/room; quotes without booking FK; leads without `pipeline_stage_id` (UAT F1); staff without grants.

---

## 8. Functional-trust findings (Section E)

### Systematic markers

| Pattern | Production-path impact |
| ------- | ---------------------- |
| Feature flags | Procedure day, payments, pipeline V1, Today, workspace shell — **hide or dual-run real features** |
| Placeholder / coming soon | Notifications top bar “coming soon”; feature access request “coming soon”; staff twin outcome/audit **Placeholder** panels |
| Stub AI pipelines | Imaging classification stubs when live AI not activated |
| Sample / demo | Reception demo mode; calendar sample appointments; onboarding sandbox seed |
| localStorage | Nav density, calendar theme, report period, graft device id — **UI prefs only**, not domain SoR |
| Dual-run / fallback routes | Pipeline V1 allowlist; procedure day → calendar; feature denied landing |
| Hard-coded Evolved paths | IIOHR Perth staff sync cron naming; smoke tenant docs — operational coupling |
| Empty catch / swallowed errors | Scattered in loaders (investigate per incident); front-desk page surfaces load errors |
| Optimistic calendar store | Hydrates from `FiBookingRow[]` — must revalidate after mutations |

### Critical control trust (production paths)

| Control area | Handler | Permission | Server mutation | Persist/reload | Errors | Notes |
| ------------ | ------- | ---------- | --------------- | -------------- | ------ | ----- |
| Pipeline stage move | Yes | CRM write gate | Yes | Yes | Yes | Drag flag env; dual UI |
| Pipeline card More actions | Yes (menu) | CRM | Yes | Yes | Yes | Pointer/drag interaction carefully handled in V1 |
| Quick Create | Nav only for most | Shell flags | N/A until destination | N/A | N/A | Not true create |
| Calendar mutations | Yes | Bookings | Yes | Yes if actions used | Yes | Conflict preview exists |
| Roster edit/generate | Yes | Workforce manage | Yes | Yes | Schema check | Actor fi_user resolution required |
| Staff permission overrides | Yes | Admin | Grants table | Yes | Yes | Complex UI |
| Onboarding invitations | Yes | Manage | Yes | Yes | Yes | Host generation via request headers |
| Patient workspace saves | Yes | Modules | Yes | Yes | Yes | Consent gates |
| Payment / clearance | Partial | Finance | Yes when used | Manual records common | Partial | Clearance advisory |
| Imaging capture complete | Yes | Clinical | Yes | Yes | Yes | Protocol % completion |
| Procedure-day transitions | Gated | Procedure day | Yes when enabled | Yes | Yes | Default off |

### Trust hotspots (severity)

1. **Payments UI when flag off** — can mislead if deep-linked.  
2. **Financial clearance not hard-blocking all surgery paths.**  
3. **Google calendar approve without FI booking** (`no_fi_booking_created`).  
4. **Staff twin placeholders** look like empty outcomes.  
5. **Notifications button** non-functional.  
6. **Pipeline dual-run** — different UX/behaviour per tenant allowlist.  
7. **Reception cold load** damages trust even when data correct.

---

## 9. Responsive UX findings (Section F)

| Viewport | Assessment |
| -------- | ---------- |
| 1920×1080 | Comfortable; boards use internal horizontal scroll |
| 1440×900 | Acceptable; density higher on finance tables |
| 1366×768 | Risk of nested scroll + sticky chrome crowding |
| 12" tablet landscape | Rail/bottom patterns; tablet e2e contracts for main scroll |
| 12" tablet portrait | More reliance on More + bottom nav; boards stack (Pipeline V1) |
| Mobile | Bottom nav; tables degrade to overflow; not primary OR/finance device |

| Daily surface | Content without excess scroll | Nested scroll | Horizontal overflow | Touch targets | Sticky | Empty/error |
| ------------- | ----------------------------- | ------------- | ------------------- | ------------- | ------ | ----------- |
| Today | Partial | Main column | Low | OK | Chrome fixed | FiOs empty states |
| Front desk | Partial (dense board) | Yes | Risk on dense days | OK | Yes | Dual CTAs post Sprint 9 |
| Calendar | Intentional internal | Yes | Resource lanes | Mixed | Controls | Yes |
| Pipeline board | Columns need H-scroll desktop | Board-level | **By design** | Drag vs tap risk | Header | Yes |
| Patients list | Table H-scroll | Main | Tables | OK | Filters | Yes |
| Case detail | Long vertical page | Section nav | Low | OK | Section nav | Readiness chips |
| Team roster | Grid H-scroll | Grid | Contractual | Drawer | Partial | Schema errors |
| Reports | Vertical | Main | Tables | OK | Filters | Generate empty copy |
| Money | Dense multi-page | Nested | Tables | Weak on small | Partial | Migration soft-fail |

**Acceptable:** internal board/table/roster scrolling.  
**Problematic:** document-level horizontal scrollbar; fixed header + double nested mains; 17–27s reception load without progressive feedback.

---

## 10. Security and multi-tenant findings (Section G)

### Separation

| Tier | Assessment |
| ---- | ---------- |
| **1. Safe for Evolved Hair** | **Conditionally** for limited modules after identity, secrets, DR evidence and SOP sign-off. Core tenant filters and portal gates exist. |
| **2. Safe for controlled pilot clinic** | **Only** with platform-admin provisioning, frozen modules, manual money policy, no assumption of procedure day/Stripe, white-glove training. |
| **3. Ready for general multi-clinic onboarding** | **No.** |

### Controls

| Area | Finding |
| ---- | ------- |
| Tenant isolation | Strong pattern on tenant routes; platform cross-tenant roles powerful by design |
| RLS | Present on foundation; many mutations use **service role + app gates** — RLS not sole enforcer |
| Role gates | Layered: OS roles, fi_users, tenant admin, SA-1, CRM shell, PIN floor |
| Capability overrides | Real grants table; UI complex |
| Mutation authorization | CRM/finance/workforce gates; progressive defer if unmapped staff |
| Impersonation | Platform admin; audited sessions |
| Audit trails | CRM activity, grants audit, platform events, financial audit events — uneven coverage |
| PHI exposure | Risk via imaging, twin, exports; portal and public pay links need careful config |
| Public links | Payment tokens, invite tokens, shared visual summary PDF |
| Invite host generation | Request host + `NEXT_PUBLIC_SITE_URL` fallback (password recovery documented) |
| Patient portal | Gated; imaging default off |
| Background jobs | Cron secrets; tenant-scoped workers expected |
| Evolved hard-coding | Perth HR sync naming; demo tenant docs — mitigate for commercial |
| Timezone | Perth assumed in Evolved docs; calendar settings exist — verify per tenant |
| Configurable services / thresholds / terminology | Services/rooms/tax/pipeline stages yes; product language still FI-module |
| Branding | Tenant branding pipeline |
| Provisioning | Onboarding OS |
| Support/diagnostics | System status, intelligence event logs, staff UAT telemetry mode |

---

## 11. Test-confidence findings (Section H)

| Critical workflow | Unit | Integration | E2E | Production smoke | Missing evidence |
| ----------------- | :---: | :---------: | :-: | :--------------: | ---------------- |
| Login + portal gate | Partial | — | Security unauth | smoke:prod optional | Real Evolved identity proof |
| Enquiry create + stage move | Strong | — | Weak | Operational day | Multi-role manual |
| Duplicate person prevention | Partial | — | — | — | Operator UX proof |
| Book consultation | Strong | — | Calendar e2e | Operational day | Staff/room always set |
| Check-in front desk | Strong | — | Partial | Operational day | Cold load SLA |
| Consultation complete + handoffs | Strong | — | Partial | Operational day | Email send |
| Quote accept → surgery book | Medium | — | — | Operational day | Prefill completeness |
| Payment / deposit | Medium | Stripe unit | Public pay smoke | Manual records | Live Stripe ops |
| Financial clearance block | Medium | — | — | — | Hard-block product QA |
| Treatment imaging protocol | Medium | — | Fixture-gated | — | Full capture+reload |
| Surgery day procedure | Strong cores | — | — | **Skipped when flag off** | Live OR day |
| Case readiness blockers | Strong | — | — | Partial | Staff assignment discipline |
| Roster create/edit/leave | Strong | — | Roster permission e2e | — | Fortnightly generate UX |
| Staff grant override | Strong | — | Partial | — | End-to-end UI |
| Owner reports generate | Medium | — | — | — | Snapshot data freshness |
| Cross-tenant isolation | Partial | — | Journey optional | Often SKIPPED | Always-on second tenant |
| Patient portal imaging | Flag tests | — | Visual summary smoke | — | Prod imaging on |
| Impersonation | Partial | — | — | — | Break-glass drill |

### Confidence killers

- High-risk paths with **no authenticated E2E mutation** in CI (revenue spine manual).  
- Tests **skip** without fixture IDs.  
- Tests pass while UX dual doors remain.  
- Unit failures pre-existing.  
- Smoke PASS with **operational readiness 3–4/7**.  
- Sample/demo modes can green-path pilot review.

---

## 12. Evolved Hair go-live assessment

| Gate | Status |
| ---- | ------ |
| Formal production decision (2026-06-27) | **NO-GO 48/100** |
| Clinic-day automated journey (2026-07-02) | Happy path PASS; procedure day optional |
| Operational criteria staff/room/procedure/follow-up | **Fail / skip** common |
| Manual multi-role UAT | **Pending** |
| UX rebuild complete | **No** |
| Recommended go-live | **Limited pilot only** after Phase 1 trust closure |

**Roles for limited pilot:** trained receptionist (board+calendar+pipeline), consultant, clinic admin, platform support.  
**Exclude or flag-off:** full OR day automation, Stripe as bank truth, owner self-serve BI, untrained nurse OR workflow, second-clinic self-serve.

---

## 13. External pilot assessment

| Requirement | Ready? |
| ----------- | ------ |
| Tenant provision | Engineering yes |
| Branding / services / rooms | Yes with admin time |
| Role templates | Yes |
| Clean job-based UX | No |
| Single Money / Pipeline / Team story | No |
| Support playbooks | Partial |
| DR / security evidence package | Incomplete |
| Default safe flags | Conservative (good) but hides product |

**Verdict:** **Not ready** for external pilot without white-glove FI operators embedded.

---

## 14. Prioritised post-rebuild roadmap (Section J)

### Phase 1 — Trust and blocker closure

| Item | Evidence | Users | Sev | Change | Deps | Acceptance | Scope | Before Evolved go-live | Before external pilot |
| ---- | -------- | ----- | --- | ------ | ---- | ---------- | ----- | :--------------------: | :-------------------: |
| Role-based post-login landing | `fi-os-access-production.md` → `/cases` | Reception, finance, nurses | Critical | Land Front desk / Today / Money / Doctor by role | Redirect map | Role matrix automated + manual | M | Yes | Yes |
| Close payment truth narrative | Payments flag off; dual finance | Finance, reception | Critical | One Money hub; explicit manual vs Stripe badge | SOP | Staff quiz pass; no dual nav | M | Yes | Yes |
| Financial clearance SOP + guard sign-off | BLK-FIN-01/02 | Finance, OR | Critical | Ops acknowledgement + staging test | Guard code | Signed checklist | S | Yes | Yes |
| DR / PITR / restore evidence | BLK-SEC-01 | All | Critical | Documented restore drill | Infra | Evidence registry row | M | Yes | Yes |
| Real Evolved identity + grants complete | BLK-SEC-05; SA-1 defer | All | Critical | Every staff mapped + templates | Provisioning | Access matrix green | M | Yes | Yes |
| Production cron + secrets proof | BLK-SEC-02 notes | Ops | High | Cron 200 + rotation | Ops | Evidence registry | S | Yes | Yes |
| Reception cold load budget | F4 17–27s | Reception | High | Progressive load / cache | Perf work | p95 &lt; 15s staff sign-off | L | Yes | Preferred |
| Procedure day product decision | Flag default off | OR team | High | Enable with staffing discipline **or** explicit non-goal | Staff/room data | Written decision | S | Yes | Yes |

### Phase 2 — Workflow consolidation

| Item | Evidence | Users | Sev | Change | Scope | Before Evolved | Before pilot |
| ---- | -------- | ----- | --- | ------ | ----- | :------------: | :----------: |
| Single Pipeline cutover | S4 dual-run; LeadFlow door | CRM | High | V1 on Evolved; redirect LeadFlow | M | Yes | Yes |
| Single Money workspace | Dual financial trees | Finance | High | Hub + tabs; retire dual nav | L | Yes | Yes |
| Cases only under Surgery | Dual `/cases` | Surgery | Med | Redirect worklist | S | Preferred | Yes |
| Team-only staff entry | workforce/hr/staff URLs | Managers | Med | Redirect legacy | M | Preferred | Yes |
| Calendar SoR labelling | Google approve no booking | Reception | High | UI copy + connector fix plan | M | Yes | Yes |
| Patient single record naming | Twin / foundation | Clinical | Med | Labels + tabs | S | Preferred | Yes |
| Treatment imaging entry from Today/Front desk | Nurse protocol weak discovery | Nurses | Med | Deep link from day board | S | Preferred | Yes |
| Follow-up creation after procedure | F3 | Clinical | High | Automation or hard task | M | Yes | Yes |

### Phase 3 — Staff adoption readiness

| Item | Change | Scope | Before Evolved | Before pilot |
| ---- | ------ | ----- | :------------: | :----------: |
| Role landing + Today weighting | Profile-driven home | M | Yes | Yes |
| Contextual help (beyond UAT mode) | Staff guides default-off but available | M | Preferred | Yes |
| Production smoke matrix green | Role smoke + reload assertions | L | Yes | Yes |
| Measured bake (D6 style) for frontline | Allowlist bake → full tenant | M | Yes | Yes |
| Tablet SOP for boards | Pipeline/roster training | S | Preferred | Yes |

### Phase 4 — Operational intelligence

| Item | Change | Scope |
| ---- | ------ | ----- |
| Owner home (enquiry, conversion, revenue, risk) | Compose from existing reports + Today | L |
| Unified stuck-patient view | Cross consult/CRM/case/payment | L |
| Team utilisation + surgeon performance packs | Reports Phase 2 | L |
| Outcome completeness dashboards | Outcome + imaging linkage | L |

### Phase 5 — Pilot-clinic productisation

| Item | Change | Scope |
| ---- | ------ | ----- |
| Go-live wizard defaults | Safe flags, seeded stages, services | L |
| Tenant terminology pack | Clinic language without OS names | M |
| Support diagnostics pack | Per-tenant health | M |
| Migration/import playbooks | HubSpot/Timely/GCal SoR | L |
| Commercial entitlements billing | Beyond manual provision | XL |

### Phase 6 — Advanced intelligence

Cross-patient comparison, predictive models, benchmarking, competency-to-outcome, full longitudinal twin — **after** Phases 1–3 trust and adoption.

---

## 15. Do-not-build-yet list

1. New parallel “OS” modules or nav destinations.  
2. Public multi-clinic self-serve signup.  
3. Warehouse-grade BI / investor dashboard as staff product.  
4. Live AI vision default-on without review queues and ops ownership.  
5. Full patient portal chart editing.  
6. Automated competency hard-blocks on OR assignment without data quality.  
7. Marketing automation sequences / ESP product.  
8. HairAudit network commercial packaging.  
9. Predictive revenue models before payment truth.  
10. Replacing Timely/Google as dual SoR without cutover SOP.  
11. Expanding dual staff identity models further.  
12. More dual-run surfaces (finish cutovers instead).

---

## 16. Top 20 issues table

| # | Issue | Severity | Evidence |
| - | ----- | -------- | -------- |
| 1 | Post-login → Cases for clinic roles | Critical | `docs/fi-os-access-production.md` |
| 2 | Procedure day default off | Critical (OR) | Env + smoke skip |
| 3 | Payments / money dual product + flag | Critical | `FI_PAYMENTS_ENABLED`, dual routes |
| 4 | Pipeline dual-run + LeadFlow door | High | Allowlist + `/leadflow` |
| 5 | Operational readiness staff/room/follow-up fails | High | Smoke score 3–4/7 |
| 6 | Formal Evolved NO-GO / incomplete P0 evidence | Critical | readiness-scorecard 48/100 |
| 7 | Dual staff identity (`fi_staff` vs members) | High | Workforce architecture |
| 8 | Dual surgery stacks (cases vs Surgery OS) | High | Parallel tables/routes |
| 9 | Google approve ≠ FI booking | High | BLK-CAL-01 |
| 10 | Reception cold load | High | F4 |
| 11 | Manual multi-role UAT pending | High | Sprint 7/9 |
| 12 | Financial clearance advisory not universal hard gate | High | BLK-FIN + readiness |
| 13 | SA-1 defer when staff unmapped | High | staffAccess guards |
| 14 | Quote editor / booking prefill incomplete | Medium | Pipeline audit 2026-06-16 |
| 15 | Treatment imaging discoverability | Medium | Appointment deep link only |
| 16 | Owner no single command surface | Medium | Reports catalog only |
| 17 | Horizontal board scroll risk vs page scroll | Medium | pipelineUi overflow-x-auto |
| 18 | Staff twin placeholders | Medium | staff twin page |
| 19 | Notifications coming soon control | Low–Med | FiOsTopBar |
| 20 | E2E revenue path not in CI | High | e2e README |

---

## 17. Top 10 strengths table

| # | Strength | Evidence |
| - | -------- | -------- |
| 1 | Deep multi-domain DB persistence | Migrations + actions across OS modules |
| 2 | Front desk consolidation + legacy redirects | S3.4E redirects to `/front-desk` |
| 3 | D6G shell hubs (Surgery, Team, Reports) | Navigation regrouping core |
| 4 | Consultation forms + guided handoffs | Consultation OS + pipeline audit fixes |
| 5 | CRM stage history + conversion | CRM foundation |
| 6 | Workforce roster engine depth | workforce-os loaders + e2e |
| 7 | SA-1 entitlements engine | staffAccessRegistry + grants |
| 8 | Treatment imaging protocol for regenerative types | `treatmentImagingProtocol.ts` |
| 9 | Financial report generators | reportCatalog generateEnabled |
| 10 | Operational day automated smoke harness | `smoke:operational-day` + manifest |

---

## 18. Recommended next implementation milestone

### Milestone ID

**`FI-TRUST-LANDING-AND-SPINE-1`**

### Copy-ready implementation brief

```text
Milestone: FI-TRUST-LANDING-AND-SPINE-1
Goal: Close the five highest-confidence-destroying gaps after UX rebuild
      without adding new modules.

Out of scope: new OS surfaces, live AI expansion, commercial self-serve,
              procedure-day feature inventing, full Money rewrite in one PR.

In scope (ordered):

1) Role-based post-login landing
   - Reception / frontline → /front-desk (or Today when feed enabled)
   - Consultant → /crm (Pipeline)
   - Doctor/nurse clinical → /doctor or Today clinical filter
   - Finance → /financial-os
   - Manager/owner → / (Today)
   - Preserve safe `next` redirects
   - Unit + e2e: role → expected path

2) Navigation truth for frontline
   - Ensure Front desk reachable without hunting (rail or first More group)
   - Hide/redirect LeadFlow from staff nav when Pipeline is canonical
   - No admin intelligence links for non-platform staff

3) Money narrative v1
   - Single primary “Money” entry in More
   - Payments inbox: if FI_PAYMENTS_ENABLED false, show intentional empty/disabled
     state with operator copy (manual records path) — no dead buttons
   - Deep links from case clearance use same hub language

4) Pipeline allowlist decision for Evolved
   - Document tenant on V1 allowlist or not
   - If on: mount V1 only; soft-redirect /leadflow → /crm
   - Board: keep horizontal scroll INSIDE board container; assert no
     documentElement horizontal overflow in e2e (desktop + tablet)

5) Staff mapping completeness script
   - Audit Evolved: every active worker has fi_staff + SA-1 template/grants
   - Fail CI/smoke if unmapped operators with login

Acceptance:
- New hire reception role lands on day board, not Cases
- Pipeline has one staff door
- Money has one staff door + honest payment status
- Board does not depend on browser bottom scrollbar
- Mapped staff list green for Evolved pilot users
- No new dual-run surfaces introduced

Do not implement other roadmap phases in this milestone.
```

---

## Appendix A — Production-path completeness definition (used throughout)

A feature is complete only if: discoverable · correct role can access · workflow completable · data persists · refresh preserves · empty/error handled · connected modules consistent · understandable without developers · production-safe.

---

## Appendix B — Key evidence index

| Source | Role |
| ------ | ---- |
| `src/components/fi-os/FiOsAppShell.tsx` | Production chrome |
| `src/lib/fiAdmin/fiOsMinimalNav.ts` | Primary rail |
| `src/lib/fiOs/navigation/fiOsNavigationRegroupingCore.ts` | D6G groups |
| `src/config/fiRouteFeatureMap.ts` | Route→feature |
| `src/lib/imaging-os/treatmentImagingProtocol.ts` | Nurse treatment protocol |
| `src/lib/cases/caseDetailNavConstants.ts` | Surgeon case sections |
| `src/lib/staffAccess/*` | Grants / overrides |
| `src/lib/reports/reportCatalog.ts` | Owner reports |
| `docs/fi-os-access-production.md` | Post-login `/cases` |
| `docs/fi-ux-rebuild/fi-ux-rebuild-1-stage1-structural-audit.md` | UX Stage 1 |
| `docs/production/readiness-scorecard.md` | 48/100 NO-GO |
| `docs/fi-os-operational-readiness-report.md` | Smoke + 3/7 |
| `docs/fi-os-sprint9-uat-findings.md` | UAT pending, F1–F4 |
| `e2e/README.md` | E2E tiers |
| `e2e/journeys/treatment-imaging-protocol.spec.ts` | Treatment photos e2e |
| `e2e/fi-ux-tablet-layout.spec.ts` | Tablet scroll contracts |

---

*End of FI-PLATFORM-READINESS-AUDIT-1. No code was modified during this audit.*
