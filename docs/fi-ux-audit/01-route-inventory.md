# FI OS Route Inventory (Deployed)

**Source:** `app/` (360 `page.tsx` / `route.ts` / `layout.tsx` files), `middleware.ts`, gate modules.  
**Route group** `(fi-admin)` does not appear in URLs.

## Entry & auth

| Route | Purpose | Auth |
|-------|---------|------|
| `/follicle-intelligence/login` | Staff login | Public |
| `/follicle-intelligence/forgot-password` | Password reset | Public |
| `/follicle-intelligence/update-password` | Password update | Public |
| `/fi-login` | Alias → login | Public |
| `/fi-admin` | Tenant picker | FI shell access |
| `/fi-admin/{tenantId}/staff-pin-login` | Kiosk PIN login | Public (tenant exists) |
| `/fi-admin/{tenantId}/staff-time-clock` | Time clock kiosk | Public (tenant exists) |

**Post-login redirects** (`fiOsRedirect.server.ts`):

- `fi_auditor` → `/hair-audit/admin`
- `fi_admin` / `fi_platform_admin` → `/fi-admin`
- Clinical roles → `/fi-admin/{tenantId}/cases`
- Default member → `/fi-admin/{tenantId}/cases`

## Layout gates

| Prefix | Gate |
|--------|------|
| `/fi-admin/*` | `assertFiAdminShellAccess()` (prod) |
| `/fi-admin/{tenantId}/*` | `assertFiTenantPortalAccess()` + `enforceFiFeatureRouteOrRedirect()` |
| `/fi-admin/{tenantId}/patients/*` | `patient_os` read |
| `/fi-admin/{tenantId}/crm/*` | `lead_flow` read |
| `/fi-admin/{tenantId}/financial/*` | `financial_os` read |
| `/fi-admin/system/*`, `/fi-admin/platform/*` | `fi_platform_admin` only |
| `/patient/{tenantId}/*` | Supabase + patient portal link |

**Staff PIN:** restricted routes redirect to `/fi-admin/{tenantId}/calendar` (`staffPinPermissions.ts`).

## Route aliases (redirects)

| From | To |
|------|-----|
| `/fi-admin/{tenantId}/reception-board` | Same page as `/reception` (both exist) |
| `/fi-admin/{tenantId}/financial` | `/financial/dashboard` |
| `/fi-admin/{tenantId}/surgery-booking` | `/patients` |
| `/patient/{tenantId}` | `/patient/{tenantId}/medications` |
| `/fi_clinic_admin`, `/crm_operator` | Role-based tenant redirect |
| Feature denied | `/module-unavailable?featureDenied=...` |

---

## FI Admin — tenant routes (`/fi-admin/{tenantId}/`)

### Today / operations

| Route | Nav label (sidebar) | Page file |
|-------|---------------------|-----------|
| `/` | Dashboard | `[tenantId]/page.tsx` |
| `/operations` | Operations centre | `operations/page.tsx` |
| `/reception` | **Reception board** (patient flow dashboard) | `reception/page.tsx` |
| `/reception-board` | **Command center** — different UI (`Clinic operations cockpit`) | `reception-board/page.tsx` |
| `/reception-os` | ReceptionOS | `reception-os/page.tsx` |
| `/tomorrow` | Tomorrow board | `tomorrow/page.tsx` |
| `/calendar` | Calendar | `calendar/page.tsx` |
| `/calendar/testing` | (dev QA) | `calendar/testing/page.tsx` |
| `/procedure-day` | Procedure day | `procedure-day/page.tsx` |
| `/system-status` | — | `system-status/page.tsx` |
| `/global-command-centre` | — | `global-command-centre/page.tsx` |

### Scheduling & appointments

| Route | Notes |
|-------|-------|
| `/appointments` | Appointments list |
| `/appointments/{appointmentId}` | Single appointment |
| `/bookings` | Bookings board |
| `/bookings/new` | New booking |
| `/rooms` | Room management |
| `/dashboard/calendar?tenantId=` | Alt calendar entry |

### Patients & clinical

| Route | Nav / context |
|-------|---------------|
| `/patients` | Patients |
| `/patients/new` | New patient |
| `/patients/{patientId}` | Patient profile |
| `/patients/{patientId}/timeline` | Timeline |
| `/patients/{patientId}/twin` | Patient twin |
| `/patients/{patientId}/imaging` | Imaging |
| `/patients/{patientId}/blood-request` | Pathology request |
| `/patients/{patientId}/blood-results/{resultId}` | Pathology result |
| `/doctor` | Doctor workspace |
| `/consultations` | Consultations |
| `/consultations/new` | New consultation |
| `/consultations/{id}` | Consultation workspace |
| `/consultations/{id}/forms/*` | Structured forms |
| `/consultation-conversion` | Conversion board |
| `/prescriptions` | Prescriptions |
| `/prescriptions/new` | New prescription |
| `/medication-reorders` | Medication reorders |
| `/directory` | Patient directory |

### Cases & surgery

| Route | Nav sub-item |
|-------|--------------|
| `/cases` | Case worklist |
| `/cases/new` | New case |
| `/cases/{caseId}` | Case detail |
| `/cases/{caseId}/summary` | Case summary |
| `/surgery-os` | SurgeryOS |
| `/surgery-os/graft-counting` | Graft counting |
| `/surgery-readiness` | Readiness board |

### CRM / leads

| Route | Nav label |
|-------|-----------|
| `/leadflow` | LeadFlow |
| `/crm` | CRM workspace / Follow ups |
| `/crm/leads/{leadId}` | Lead detail |

### Pathology

| Route | Nav sub-item |
|-------|--------------|
| `/pathology/inbox` | Results inbox |
| `/configuration/pathology-email` | Email routes |

### Imaging & foundation

| Route | Nav |
|-------|-----|
| `/imaging/review` | Imaging clinical review |
| `/foundation-integrity` | Patient Twin |

### Financial

| Route | Surface |
|-------|---------|
| `/financial-os` | FinancialOS command centre |
| `/financial-os/executive` | Executive |
| `/financial-os/accounts-receivable` | AR |
| `/financial/dashboard` | Operational financial |
| `/financial/payments` | Payments |
| `/financial/invoices` | Invoices |
| `/financial/pathway-inbox` | Pathway inbox |
| `/payments` | Payments (RevenueOS inbox) |

### Workforce & HR

| Route | Sub-nav |
|-------|---------|
| `/workforce-os` | Command Centre |
| `/workforce-os/planning` | Planning |
| `/workforce-os/procedure-staffing` | Procedure Staffing |
| `/workforce-os/payroll` | Payroll |
| `/workforce-os/staff-access` | Staff Access |
| `/workforce-os/staff/{staffId}` | Member profile |
| `/hr-os` | Workforce Dashboard (legacy) |
| `/hr-os/onboarding` | Onboarding Centre |
| `/hr-os/compliance` | Compliance |
| `/hr/staff-import` | IIOHR import |

### Settings & configuration

| Route | Nav |
|-------|-----|
| `/configuration` | Settings |
| `/configuration?tab=branding` | Branding tab |
| `/configuration?tab=calendar` | Calendar tab |
| `/settings/admin-users` | Admin users |
| `/settings/integrations` | Integrations |
| `/settings/payments` | Payment settings |
| `/services` | Services catalogue |

### Other tenant routes

| Route | Purpose |
|-------|---------|
| `/audit` | Audit intelligence |
| `/analytics` | Analytics |
| `/staff` | Staff directory |
| `/staff/role-review` | Role review |
| `/onboarding-os/import-review` | Onboarding import |

---

## Platform & system (`fi_platform_admin`)

| Route | Label |
|-------|-------|
| `/fi-admin/system` | Overview |
| `/fi-admin/system/tenants` | Tenants |
| `/fi-admin/system/users` | User impersonation |
| `/fi-admin/system/audit-logs` | Audit logs |
| `/fi-admin/platform/onboarding` | Tenant onboarding |

---

## Patient portal

| Route | Purpose |
|-------|---------|
| `/patient/{tenantId}/sign-in` | Portal login (public) |
| `/patient/{tenantId}/medications` | Medications (default landing) |
| `/patient/{tenantId}/imaging` | Imaging upload/view |
| `/patient/{tenantId}/visual-summary` | Visual summary |

---

## Related surfaces

| Route | Purpose |
|-------|---------|
| `/hair-audit/admin` | Auditor workspace |
| `/pay/{paymentRequestToken}` | Public payment link |

---

## Key tenant APIs (FI OS)

Grouped under `/api/tenants/{tenantId}/`:

- **Ops:** `reception-board`, `reception-os`, `procedure-day`, `clinic-os/global-search`
- **Scheduling:** `calendar/appointments`, `bookings`, `appointments`
- **CRM:** `crm/leads`, `crm/pipeline-stages`
- **Pathology:** `pathology-inbox`, `pathology-email-routes`
- **Patients:** `patients/{id}/*`, `patient-directory/{id}/*`

Full API inventory: `docs/security/api-routes-inventory.md` (engineering).

---

## Counts

| Category | Count |
|----------|-------|
| App router files | 360 |
| FI Admin tenant pages | ~130 |
| API route handlers | 138 |
| Code-defined redirects | 15+ |