# FI OS Operator Guide (Canonical)

**FI-UX-AUDIT-1** — Grounded in deployed UI as of 2026-07-02.  
If this guide disagrees with the app, the app wins — file a drift note against [02-ui-terminology-dictionary.md](./02-ui-terminology-dictionary.md).

---

## Getting in

1. Open **`/follicle-intelligence/login`**.
2. Sign in with clinic staff credentials.
3. Select your clinic (tenant) if prompted at **`/fi-admin`**.
4. You land on **Dashboard** (`/fi-admin/{tenantId}`) or **Cases** depending on role.

**Kiosk (staff PIN):** `/fi-admin/{tenantId}/staff-pin-login` → use **Calendar** and **Reception board**; other modules redirect back to Calendar.

---

## Finding anything

### Sidebar

Primary navigation is the left sidebar. Labels match [02-ui-terminology-dictionary.md](./02-ui-terminology-dictionary.md).  
Disabled items show a hint (e.g. "Requires CRM shell role for this tenant.").

### Global search (top bar)

- Placeholder: **Search patients, leads, cases…**
- **Patients** and **Cases** appear first.
- **Leads** load in a second pass (do not assume leads are missing — wait a moment).

### Quick create (top bar)

Button: **Quick create** (⇧⌘K / Ctrl+Shift+K)

| Item | Goes to |
|------|---------|
| New consultation | `/consultations/new` |
| New patient | `/patients/new` |
| New enquiry | `/leadflow#fi-os-crm-create-lead` |
| New case | `/cases/new` |
| New task | `/crm` (open lead → Timeline tab) |
| Upload patient photos | `/foundation-integrity#fi-os-foundation-media` |
| Add clinical note | `/appointments` |

Greyed items mean your role lacks CRM or bookings access.

---

## Running the clinic day (reception)

**Open:** Sidebar → **Reception board** → `/fi-admin/{tenantId}/reception`

> Legacy URL `/reception-board` still works; new guides use `/reception`.

### What you see

- **Page title:** Reception Board
- **Header links:** Open Calendar · Open Operations Centre · Open Procedure Day · Open FinancialOS · Quick Create Booking
- **Flow lanes:** Arriving soon · Waiting · Checked in · In consultation / treatment · Ready for handoff · Completed
- **Action alerts:** Red/yellow items with deep links (often **Resolve in calendar →**)

### Standard patient flow

1. Find patient in **Arriving soon** or **Waiting**.
2. Click **Check in patient** → moves to **Checked in**.
3. Click **Start consultation** → **In consultation / treatment**.
4. Click **Complete visit** → **Completed**.

Other actions: **Start treatment**, **Mark no-show**, **Cancel appointment** (full session only; not on staff PIN).

### Refresh

Use **Live refresh** — not the browser reload button.

### Empty day

Use **Open Calendar** or **Quick Create Booking** to schedule.

---

## Calendar

**Open:** Sidebar → **Calendar** → `/calendar`

### Views

**Day** · **Week** · **Month**

### Density

**Comfortable** · **Compact** · **Command**

### Today strip

Chips include: Appointments today, Consultations, PRP, Surgeries, Arrived, Completed, Waiting, Unassigned.

### Surgery blockers

Readiness and blockers show **on the calendar card** — open the booking drawer to assign **room** and **surgeon**.

### Quick book

Month view empty day: **Quick book** or **Open · click to schedule**.

---

## Patients

**Open:** Sidebar → **Patients** → `/patients`

- **New patient:** Quick create → **New patient** or `/patients/new`
- **Profile:** `/patients/{patientId}`
- **Patient Journey ribbon:** shows stage, blockers, recommended next step
- **Timeline / Twin / Imaging:** sub-routes from profile

Pathology from patient: blood request and results under patient routes.  
**Results inbox:** Sidebar → Pathology → **Results inbox** → `/pathology/inbox`

---

## Leads & CRM

**Open:** Sidebar → **Leads** → **LeadFlow** (`/leadflow`) or **CRM workspace** (`/crm`)

- **New enquiry:** Quick create → **New enquiry**
- **Follow ups:** Sidebar → **Follow ups** (same CRM workspace)
- **New task:** Quick create → **New task** → open lead → Timeline tab

Requires CRM shell role.

---

## Consultations & doctor workspace

| Surface | Route |
|---------|-------|
| Doctor workspace | `/doctor` |
| Consultations list | `/consultations` |
| New consultation | `/consultations/new` |
| Conversion board | `/consultation-conversion` |

---

## Surgery

| Surface | Route | Sidebar path |
|---------|-------|--------------|
| Case worklist | `/cases` | Cases |
| New case | `/cases/new` | Quick create → New case |
| SurgeryOS | `/surgery-os` | Cases → SurgeryOS |
| Readiness board | `/surgery-readiness` | Cases → Readiness board |
| Procedure day | `/procedure-day` | Cases → Procedure day |

**Booking:** Use case wizard (4 steps) or calendar surgery drawer.  
**Success screen:** confirms deposit, room, surgeon; shows pre-op checklist.

**Day-of:** Procedure day → stage buttons through session.

---

## Financial

| Surface | Route |
|---------|-------|
| FinancialOS command | `/financial-os` |
| Operational dashboard | `/financial/dashboard` |
| Payments inbox | `/payments` (when enabled) |

Patient payment link: `/pay/{token}` (public).

---

## Workforce & HR

When HR nav is enabled:

| Surface | Route |
|---------|-------|
| WorkforceOS | `/workforce-os` |
| Onboarding Centre | `/hr-os/onboarding` |

Sub-nav: Planning, Procedure Staffing, Payroll, Shift Cost, Recruitment, Staff Access.

---

## Settings

**Open:** Sidebar → **Settings** → `/configuration`

Tabs: **branding**, **calendar** (via `?tab=`).  
Additional settings under `/settings/*` (admin users, integrations, payments, reminders).

---

## Roles at a glance

| You are… | Start here |
|----------|------------|
| Reception | Reception board |
| Nurse | Patients → Procedure day |
| Doctor | Doctor workspace → Calendar |
| Surgery coordinator | Cases → Readiness board |
| CRM | LeadFlow |
| Manager | Operations centre → ReceptionOS |
| Finance | FinancialOS |

Full journeys: [04-role-journeys.md](./04-role-journeys.md)

---

## UAT mode (training)

```bash
FI_STAFF_UAT_MODE_ENABLED=1
```

Shows collapsible **UAT guide — what this screen is for** on: Reception board, Calendar, Procedure day, WorkforceOS, Patient profile.

---

## When something is missing

1. **Module unavailable** → `/module-unavailable?featureDenied=...` — feature flag off for tenant.
2. **Grey sidebar item** — read the hint; role or feature gate.
3. **Staff PIN redirect** — you hit a restricted route; use Calendar or ask admin.

---

## Related docs

- Routes: [01-route-inventory.md](./01-route-inventory.md)
- Labels: [02-ui-terminology-dictionary.md](./02-ui-terminology-dictionary.md)
- Workflows: [03-workflow-maps.md](./03-workflow-maps.md)
- UAT script: [../fi-os-staff-uat-script.md](../fi-os-staff-uat-script.md)