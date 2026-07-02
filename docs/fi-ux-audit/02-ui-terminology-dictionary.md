# FI OS UI Terminology Dictionary

**Rule:** Use **Canonical** labels in all guides. **Deprecated** labels are documented for search/replace only.

**No i18n** — all labels are hardcoded English in TypeScript config.

---

## Shell & global actions

| Canonical | Location | Deprecated / drift | Source |
|-----------|----------|-------------------|--------|
| **Search patients, leads, cases…** | Top bar search placeholder | — | `ClinicOsGlobalSearch.tsx` |
| **Quick create** | Top bar button (⇧⌘K) | — | `FiOsTopBar.tsx` |
| **New consultation** | Quick create item | — | `fiOsQuickCreateItems.ts` |
| **New patient** | Quick create item | — | `fiOsQuickCreateItems.ts` |
| **New enquiry** | Quick create item | "New lead" | `fiOsQuickCreateItems.ts` |
| **New case** | Quick create item | — | `fiOsQuickCreateItems.ts` |
| **New task** | Quick create item | — | `fiOsQuickCreateItems.ts` |
| **Upload patient photos** | Quick create item | — | `fiOsQuickCreateItems.ts` |
| **Add clinical note** | Quick create item | — | `fiOsQuickCreateItems.ts` |
| **Open Calendar** | Dashboard / ops CTAs | "Open CalendarOS" (internal copy) | `ReceptionBoardDashboard.tsx`, `ClinicOsOperationsCentre.tsx` |
| **Quick Create Booking** | Reception / ops header | — | `ReceptionBoardDashboard.tsx` |
| **Open Operations Centre** | Reception links | — | `ReceptionBoardDashboard.tsx` |
| **Open Procedure Day** | Reception links | — | `ReceptionBoardDashboard.tsx` |
| **Open FinancialOS** | Reception links | — | `ReceptionBoardDashboard.tsx` |

---

## Sidebar navigation (`fiOsShellPrimaryNav.ts`)

| Canonical nav label | Route | shortLabel | Notes |
|---------------------|-------|------------|-------|
| Dashboard | `/fi-admin/{tenantId}` | Home | |
| Doctor workspace | `/doctor` | Doctor | Requires bookings access |
| Calendar | `/calendar` | Cal | |
| Operations centre | `/operations` | Ops | |
| ReceptionOS | `/reception-os` | RecOS | Analytics-style reception |
| SurgeryOS | `/surgery-os` | SurgOS | |
| **Reception board** | `/reception` | Rec | Canonical; not "Reception Board" |
| Tomorrow board | `/tomorrow` | Tmrw | |
| Patients | `/patients` | Patients | |
| Leads | `/leadflow` | Leads | Sub: LeadFlow, CRM workspace |
| Follow ups | `/crm` | Tasks | Same workspace as CRM |
| Consultations | `/consultations` | Consult | Sub: Conversion board |
| Cases | `/cases` | Cases | Sub: Case worklist, SurgeryOS, Readiness board, Procedure day |
| Prescriptions | `/prescriptions` | Rx | |
| Pathology | `/patients` | Labs | Sub: Results inbox, Email routes |
| Patient Twin | `/foundation-integrity` | Twin | |
| Audit intelligence | `/audit` | Audit | |
| Academy | `#` | Academy | Disabled — "Coming soon." |
| Payments | `/payments` | Pay | When `FI_PAYMENTS_ENABLED` |
| FinancialOS | `/financial-os` | Fin | |
| Analytics | `/analytics` | Analytics | |
| Staff | `/staff` | Staff | |
| Onboarding Centre | `/hr-os/onboarding` | Onboard | When HR nav visible |
| WorkforceOS | `/workforce-os` | Workforce | |
| Settings | `/configuration` | Settings | |

### Legacy shell drift (`clinicOsShellConfig.ts`)

| Legacy label | Canonical (FI OS sidebar) |
|--------------|---------------------------|
| Reception Board (page H1 on `/reception`) | **Reception board** (sidebar) |
| `/reception-board` route | **Clinic operations cockpit** — not the same as `/reception` |
| LeadFlow (module name) | **Leads** (nav) + **LeadFlow** (sub-item) |

---

## Reception board

### Page title

| Canonical | Source |
|-----------|--------|
| **Reception Board** | `ReceptionBoardDashboard.tsx` (page H1 — title case OK on page) |

### Flow lanes (`receptionBoardPresentation.ts`)

| Canonical lane label |
|---------------------|
| Arriving soon |
| Waiting |
| Checked in |
| In consultation / treatment |
| Ready for handoff |
| Completed |

### Flow actions (`receptionBoardFlowPolicy.ts`)

| Canonical action label | Chip/short UI | Action key |
|------------------------|---------------|------------|
| **Check in patient** | May show "Check in" on chip | `mark_arrived` |
| **Start consultation** | May show "Start consult" | `start_consultation` |
| **Start treatment** | — | `start_treatment` |
| **Complete visit** | — | `complete` |
| **Mark no-show** | — | `mark_no_show` |
| **Cancel appointment** | — | `cancel` |

### Card links

| Canonical | Source |
|-----------|--------|
| Open booking | Flow card |
| Open patient | Flow card |

### Refresh

| Canonical | Deprecated |
|-----------|------------|
| **Live refresh** (button) | Full page reload |

---

## Calendar

| Canonical | Source |
|-----------|--------|
| Day | `CalendarTopControls.tsx` |
| Week | |
| Month | |
| Comfortable | `CalendarOsDensityToggle.tsx` |
| Compact | |
| Command | |
| Quick book | Month empty-day CTA |
| Appointments today | Today strip chip |
| Consultations | Today strip |
| Surgeries | Today strip |
| Arrived | Today strip |
| Completed | Today strip |
| Waiting | Today strip |
| Unassigned | Today strip |

---

## Global search (`ClinicOsGlobalSearch.tsx`)

| Section heading | Load order |
|-----------------|------------|
| Patients | First pass |
| Cases | First pass |
| Leads | **Deferred** second fetch (`?scope=leads`) |

---

## Procedure day

| Canonical | Source |
|-----------|--------|
| Procedure day | Sidebar sub-item under Cases |
| Open Calendar | `ProcedureDayBoard.tsx` header link |

---

## Module names (product)

Use these spellings in guides:

| Canonical | Wrong |
|-----------|-------|
| FI OS | FiOS, Fi-OS |
| Reception board | ReceptionBoard (route segment OK) |
| ReceptionOS | Reception OS |
| SurgeryOS | Surgery OS |
| FinancialOS | Financial OS |
| WorkforceOS | Workforce OS |
| LeadFlow | Lead Flow |
| Patient Twin | PatientTwin (code id OK) |
| Calendar | CalendarOS (internal only) |

---

## Roles (display)

### Workspace personas (`fiWorkspaceProfiles.ts`)

Director, Clinic manager, Surgeon, Doctor, Nurse, Consultant, **Reception**, Academy trainer, Auditor, Platform admin, Default

### Tenant admin roles (`tenantAdminRoles.ts`)

Clinic admin, Finance admin, Operations admin, Dashboard viewer, Data safety admin

### Platform roles (`fiOsRoles.ts`)

FI platform admin, FI admin, FI auditor, FI clinic admin, FI doctor, FI nurse, FI consultant

---

## Standardization checklist for guide authors

1. Routes: always `/fi-admin/{tenantId}/reception` not `/reception-board` in new docs.
2. Actions: use full labels from `RECEPTION_BOARD_FLOW_ACTION_LABELS` in test scripts.
3. Nav: match `fiOsShellPrimaryNav.ts` label strings exactly.
4. Quick create: match `FI_OS_QUICK_CREATE_ITEMS[].label`.
5. Verify every button name against source file before publishing.