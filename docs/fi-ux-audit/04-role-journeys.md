# FI OS Role-Based User Journeys

First-time user paths — **no assumed knowledge**. Each journey lists sidebar entry, exact labels, and exit criteria.

**Personas** (`fiWorkspaceProfiles.ts`) shape dashboard widgets only; **RBAC and route guards are authoritative.**

---

## Reception (`reception` persona / front desk)

**Access:** Dashboard, Reception board, ReceptionOS, Calendar (if bookings nav), Tomorrow board, global search, Quick create (subset).

| Step | You see | You click | Route |
|------|---------|-----------|-------|
| 1 | Login form | Sign in | `/follicle-intelligence/login` |
| 2 | Tenant home or Cases redirect | Sidebar **Reception board** | `/fi-admin/{tenantId}/reception` |
| 3 | UAT guide (if enabled) | Read purpose + next best action | In-page panel |
| 4 | Flow board lanes | **Check in patient** on next arrival | — |
| 5 | Lane updates | **Start consultation** | — |
| 6 | Handoff | **Complete visit** | — |
| 7 | Alert row | **Resolve in calendar →** (or specific link) | `/calendar` |
| 8 | Stale data | **Live refresh** (not browser reload) | — |

**Exit:** One patient moved from Arriving soon → Completed without engineer help.

**Staff PIN variant:** Start at `/staff-pin-login` → lands on Calendar if hitting restricted URL.

---

## Nurse (`nurse` persona)

**Access:** Patients, Calendar, Procedure day (if enabled), WorkforceOS (if HR nav), Reception board read/flow (role-dependent).

| Step | You see | You click | Route |
|------|---------|-----------|-------|
| 1 | Global search | Patient name | Top bar |
| 2 | Patient profile | Patient Journey ribbon | `/patients/{id}` |
| 3 | Blocker chips | Linked fix screen | varies |
| 4 | Sidebar **Cases** → **Procedure day** | Today's surgeries | `/procedure-day` |
| 5 | Procedure card | Stage buttons | — |
| 6 | Sidebar **WorkforceOS** | Critical attention queue | `/workforce-os` |

**Exit:** Nurse identifies patient blockers and today's procedure status.

---

## Doctor (`doctor` persona / `fi_doctor`)

**Access:** Doctor workspace, Consultations, Calendar, Cases, Prescriptions, Patients.

| Step | You see | You click | Route |
|------|---------|-----------|-------|
| 1 | Sidebar **Doctor workspace** | Today's consult list | `/doctor` |
| 2 | Reception queue | **Start consultation** / **Complete visit** | `/reception` |
| 3 | Sidebar **Consultations** | Open consult | `/consultations/{id}` |
| 4 | Sidebar **Calendar** | Surgery card blockers | `/calendar` |
| 5 | Booking drawer | Assign surgeon + room | Calendar drawer |
| 6 | Sidebar **Cases** → **Readiness board** | Blocker chips | `/surgery-readiness` |

**Exit:** Consult completed; surgery blockers visible on calendar card.

---

## Surgery coordinator

**Access:** Cases, Calendar, SurgeryOS, Readiness board, Patients, FinancialOS (deposit).

| Step | You see | You click | Route |
|------|---------|-----------|-------|
| 1 | Patient journey | Book surgery CTA | `/patients/{id}` |
| 2 | Case wizard | Steps 1–4 + **Find next available slots** | `/cases/new` |
| 3 | Success screen | Pre-op checklist + next actions | — |
| 4 | **Readiness board** | Clear red chips | `/surgery-readiness` |
| 5 | **Procedure day** (day-of) | Monitor stages | `/procedure-day` |

**Exit:** Surgery booked with deposit, room, surgeon; readiness green.

---

## CRM operator (`crm_operator` / LeadFlow)

**Access:** Leads, LeadFlow, CRM workspace, Follow ups, Quick create: New enquiry, New task.

| Step | You see | You click | Route |
|------|---------|-----------|-------|
| 1 | Sidebar **Leads** | **LeadFlow** sub-item | `/leadflow` |
| 2 | Quick create | **New enquiry** | `/leadflow#fi-os-crm-create-lead` |
| 3 | Lead detail | Timeline tab → add task | `/crm/leads/{id}` |
| 4 | Pipeline | Stage change | CRM workspace |
| 5 | Convert | Patient + case paths | `/patients/new`, `/cases/new` |

**Exit:** Enquiry captured, task scheduled, stage updated.

---

## Clinic manager / Director (`clinic_manager`, `director`)

**Access:** Full nav minus role blocks; Operations centre, Analytics, FinancialOS, ReceptionOS.

| Step | You see | You click | Route |
|------|---------|-----------|-------|
| 1 | Dashboard widgets | Attention centre | `/` |
| 2 | **Operations centre** | Day snapshot + CTAs | `/operations` |
| 3 | **ReceptionOS** | KPIs / export | `/reception-os` |
| 4 | **Analytics** | Clinic metrics | `/analytics` |
| 5 | **FinancialOS** | Executive view | `/financial-os` |
| 6 | **Settings** | Configuration hub | `/configuration` |

**Exit:** Manager sees clinic health without opening individual patient records.

---

## Finance admin (`finance_admin`)

**Access:** FinancialOS, `/financial/*`, Payments inbox (if enabled). Sidebar may hide clinical modules per `primaryNavClinicalBlocks`.

| Step | You see | You click | Route |
|------|---------|-----------|-------|
| 1 | **FinancialOS** | Dashboard | `/financial-os` |
| 2 | Operational | **Payments** / **Invoices** | `/financial/payments` |
| 3 | Pathway | **Pathway inbox** | `/financial/pathway-inbox` |
| 4 | Public link | Patient pays | `/pay/{token}` |

---

## Platform admin (`fi_platform_admin`)

**Access:** `/fi-admin/system/*`, `/fi-admin/platform/*`, all tenants, impersonation.

| Step | Route |
|------|-------|
| System overview | `/fi-admin/system` |
| Tenants | `/fi-admin/system/tenants` |
| Impersonation | `/fi-admin/system/users` |
| Intelligence replay | `/fi-admin/system/intelligence-event-logs/replay` |

---

## Auditor (`fi_auditor`)

**Post-login:** `/hair-audit/admin`  
**FI OS:** Audit intelligence `/audit` when tenant access granted.

---

## Tenant backend admin role matrix (sidebar visibility)

| Role | Calendar | Patients | Cases | Rx | Doctor | Analytics | Audit |
|------|----------|----------|-------|-----|--------|-----------|-------|
| clinic_admin | hidden | hidden | hidden | hidden | hidden | hidden | policy |
| operations_admin | hidden | hidden | hidden | shown | shown | hidden | hidden |
| finance_admin | shown | shown | shown | shown | shown | hidden | hidden |
| dashboard_viewer | shown | shown | shown | shown | shown | hidden | hidden |
| data_safety_admin | shown | shown | shown | shown | shown | hidden | hidden |

Source: `primaryNavClinicalBlocks()` in `fiOsShellPrimaryNav.ts`.

---

## Journey test harness

```bash
# Enable in-app guides + friction telemetry
FI_STAFF_UAT_MODE_ENABLED=1

# Automated smoke before manual walkthrough
pnpm smoke:operational-day
```

Record findings in `docs/fi-os-real-clinic-uat-checklist.md` using labels from [02-ui-terminology-dictionary.md](./02-ui-terminology-dictionary.md).