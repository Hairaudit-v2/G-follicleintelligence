# API route inventory (`app/api/**/route.ts`)

**Generated:** security hardening continuation (2026). **Purpose:** classify each HTTP boundary for auth, tenant binding, service-role usage, public exposure, and production risk. **Indirect service role:** route file does not import `@/lib/supabaseAdmin`, but handlers call modules that do (typical for CRM JSON routes).

**Risk legend:** **Low** — gated session/secret and narrow effect; **Medium** — powerful credential or sensitive data path; **High** — shared secret / platform capability / unauthenticated data plane if misconfigured.

---

## Cron (scheduled / ops)

| Route | Methods | Auth model | Tenant binding | `supabaseAdmin` in route? | Public exposure | Prod risk |
|-------|---------|------------|------------------|---------------------------|-------------------|-----------|
| `app/api/cron/fi-payments/reminders/route.ts` | GET, POST | `assertCronAuthorized` → Bearer `FI_PAYMENTS_CRON_SECRET` or `CRON_SECRET` or `x-fi-payments-secret` | Query `tenantId` optional; else all tenants in job | No (cron server module) | URL is public; **needs secret** | Medium |
| `app/api/cron/fi-photo-protocol-alerts/route.ts` | GET, POST | Same pattern (`FI_PHOTO_PROTOCOL_ALERTS_CRON_SECRET` / `CRON_SECRET`) | Query `tenantId` optional; else iterates tenants | **Yes** (lists `fi_tenants`) | Public URL + secret | Medium |
| `app/api/cron/fi-reminder-jobs/route.ts` | GET, POST | `FI_REMINDER_CRON_SECRET` / `CRON_SECRET` / `x-fi-reminder-secret` | Job processor resolves tenants | No | Public URL + secret | Medium |
| `app/api/cron/iiohr-hr-perth-staff-sync/route.ts` | GET, POST | `CRON_SECRET` / `FI_HR_SYNC_CRON_SECRET` | `EVOLVED_PERTH_TENANT_ID` env | No | Public URL + secret | Medium |

---

## Legacy FI machine JSON (`/api/fi/*`)

**Auth:** `assertLegacyFiApiAccess` — `FI_LEGACY_FI_API_ENABLED` + `FI_LEGACY_FI_API_SECRET` (Bearer only). **Default:** disabled → **404** (not found).

| Route | Methods | Tenant binding | `supabaseAdmin` in route? | Public exposure | Prod risk |
|-------|---------|----------------|---------------------------|-------------------|-----------|
| `app/api/fi/events/route.ts` | POST | From JSON envelope | No | Public if flag on | **High** when enabled |
| `app/api/fi/submit/route.ts` | POST | Body | No | Same | **High** when enabled |
| `app/api/fi/uploads/route.ts` | POST | Body / case linkage | **Yes** | Same | **High** when enabled |
| `app/api/fi/cases/route.ts` | POST | `tenant_id` body | **Yes** | Same | **High** when enabled |
| `app/api/fi/partners/route.ts` | GET, POST | Query/body | **Yes** | Same | **High** when enabled |
| `app/api/fi/run-model/route.ts` | POST | Body | No | Same | **High** when enabled |

---

## Tenant portal JSON (session / optional insecure bypass)

**Auth:** `checkFiTenantPortalApiAccess` — production requires Supabase session (or cross-tenant OS role); `FI_ALLOW_INSECURE_API` only when `NODE_ENV !== 'production'`.

| Route | Methods | Tenant binding | `supabaseAdmin` in route? | Public exposure | Prod risk |
|-------|---------|----------------|---------------------------|-------------------|-----------|
| `app/api/fi/report/route.ts` | GET | `tenant_id` query + `case_id` / `report_id` | **Yes** | Authenticated (or bypass non-prod) | Medium |
| `app/api/fi/audit/approve/route.ts` | POST | `tenant_id` body | **Yes** | Same | Medium |
| `app/api/fi/audit/reject/route.ts` | POST | `tenant_id` body | **Yes** | Same | Medium |
| `app/api/fi/audit/queue/route.ts` | GET | `tenant_id` query | **Yes** | Same | Medium |
| `app/api/fi/audit/dashboard/route.ts` | POST | `tenant_id` body | **Yes** (passes client into loader) | Same | Medium |
| `app/api/fi/patient-twin/[patientId]/route.ts` | GET | `tenant_id` query + path `patientId` | No | Same | Medium |
| `app/api/tenants/[tenantId]/clinic-os/global-search/route.ts` | GET | Path `tenantId` | No | Same | Medium |
| `app/api/tenants/[tenantId]/consultations/search-links/route.ts` | GET | Path | No | Same | Low–Medium |

---

## CRM / clinical tenant APIs (`assertCrmTenant*`)

**Auth:** `assertCrmTenantReadAllowed`, `assertCrmTenantWriteAllowed`, or `assertCrmTenantStaffManageAllowed` (+ optional `FI_ADMIN_API_KEY` / staff PIN floors per route). **Tenant:** path `tenantId` (UUID); handlers must keep `.eq('tenant_id', …)` in downstream queries.

| Route | Methods | Gate | `supabaseAdmin` in route? |
|-------|---------|------|---------------------------|
| `app/api/tenants/[tenantId]/appointments/route.ts` | GET, POST | Read / Write | No |
| `app/api/tenants/[tenantId]/appointments/[appointmentId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/bookings/route.ts` | GET, POST | Read / Write | No |
| `app/api/tenants/[tenantId]/bookings/[bookingId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/bookings/[bookingId]/cancel/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/bookings/[bookingId]/complete/route.ts` | POST | Write (+ staff PIN floor) | No |
| `app/api/tenants/[tenantId]/cases/route.ts` | GET, POST | Read / Write | **Yes** |
| `app/api/tenants/[tenantId]/cases/[caseId]/route.ts` | GET | Read | **Yes** |
| `app/api/tenants/[tenantId]/cases/[caseId]/submit/route.ts` | POST | Write | **Yes** |
| `app/api/tenants/[tenantId]/cases/[caseId]/uploads/route.ts` | POST | Write | **Yes** |
| `app/api/tenants/[tenantId]/cases/[caseId]/run-model/route.ts` | POST | Write | **Yes** |
| `app/api/tenants/[tenantId]/crm/leads/route.ts` | GET, POST | Read / Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/route.ts` | GET, PATCH | Read / Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/activity/route.ts` | GET, POST | Read / Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/stage/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/convert/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/previews/route.ts` | GET | Read | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/messages/preview/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/notes/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/notes/[noteId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/notes/[noteId]/archive/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/tasks/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/tasks/[taskId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/communications/route.ts` | GET, POST | Write (+ fi user resolve) | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/communications/[communicationId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/communications/[communicationId]/archive/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/crm/pipeline-stages/route.ts` | GET | Read | No |
| `app/api/tenants/[tenantId]/foundation-integrity/route.ts` | GET | Read | **Yes** |
| `app/api/tenants/[tenantId]/patient-directory/[patientId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/patient-directory/[patientId]/clinical-details/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/patient-directory/[patientId]/images/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/patient-directory/[patientId]/images/[imageId]/route.ts` | GET, DELETE | Write | No |
| `app/api/tenants/[tenantId]/patient-directory/[patientId]/images/[imageId]/archive/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/clinical-details/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/images/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/images/[imageId]/route.ts` | GET, PATCH | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/images/[imageId]/archive/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/pathology-requests/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/pathology-requests/[requestId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/pathology-requests/[requestId]/cancel/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/pathology-requests/[requestId]/send-to-patient/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/pathology-requests/[requestId]/pdf/route.ts` | GET | Read | **Yes** |
| `app/api/tenants/[tenantId]/patients/[patientId]/pathology-results/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/pathology-results/[resultId]/route.ts` | PATCH | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/pathology-results/[resultId]/ai-interpretation/route.ts` | GET, POST | Write | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/prescriptions/[prescriptionId]/pharmacy-order-pdf/route.ts` | GET | Read | No |
| `app/api/tenants/[tenantId]/patients/[patientId]/voice-notes/process/route.ts` | POST | Write | No |
| `app/api/tenants/[tenantId]/staff/route.ts` | GET, POST | Read / staff manage | No |
| `app/api/tenants/[tenantId]/staff/[staffId]/route.ts` | PATCH | Staff manage | No |
| `app/api/tenants/[tenantId]/tick-jobs/route.ts` | POST | Write | No |

**Public exposure:** HTTPS routes are **reachable** from the internet; **authorization** is session + CRM gate (or admin key). **Prod risk:** **Medium** — depends on `crmGate` correctness + no missing tenant filters in downstream libs.

---

## Integrations (shared secrets, tenant in path)

| Route | Methods | Auth model | Tenant binding | `supabaseAdmin` in route? | Prod risk |
|-------|---------|------------|----------------|---------------------------|-----------|
| `app/api/tenants/[tenantId]/integrations/timely/patient/route.ts` | POST | `assertTimelyWebhookAuthorized` | Path | No | Medium |
| `app/api/tenants/[tenantId]/integrations/timely/appointment/route.ts` | POST | Same | Path | No | Medium |
| `app/api/tenants/[tenantId]/integrations/timely/discovery/route.ts` | POST | Same | Path | **Yes** | Medium |
| `app/api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync/route.ts` | POST | `x-iiohr-sync-secret` vs `IIOHR_HR_SYNC_SECRET` + staff PIN reject | Path | No | Medium |

---

## Stripe

| Route | Methods | Auth model | Tenant binding | `supabaseAdmin` in route? | Prod risk |
|-------|---------|------------|----------------|---------------------------|-----------|
| `app/api/fi-payments/stripe/webhook/route.ts` | POST | `readFiPaymentsEnabled()` + Stripe **signature** (`verifyWebhook`) | From mapped checkout metadata | **Yes** | Medium (see `payment-webhook-idempotency.md`) |

---

## FI OS platform admin

| Route | Methods | Auth model | Tenant binding | `supabaseAdmin` in route? | Prod risk |
|-------|---------|------------|----------------|---------------------------|-----------|
| `app/api/fi-os/impersonation/start/route.ts` | POST | `resolveAuthUserId` + `loadFiOsIdentity` + **platform admin role**; rejects active staff PIN | Body `targetAuthUserId`, optional `tenantId` | **Yes** (`auth.admin.getUserById`) | **High** (break-glass support power) |
| `app/api/fi-os/impersonation/stop/route.ts` | POST | Session | — | No | Medium |

---

## Staff PIN clinic session

| Route | Methods | Auth model | Tenant binding | Service role | Prod risk |
|-------|---------|------------|----------------|--------------|-----------|
| `app/api/fi-staff-pin/login/route.ts` | POST | PIN verify server-side | Body | Indirect | Medium |
| `app/api/fi-staff-pin/logout/route.ts` | POST | Cookie | — | No | Low |

---

## Tenants directory + dev seed

| Route | Methods | Auth model | Tenant binding | `supabaseAdmin` in route? | Prod risk |
|-------|---------|------------|----------------|---------------------------|-----------|
| `app/api/tenants/route.ts` | GET | `resolveFiAdminTenantDirectory` (session / Bearer; dev list optional) | Session-derived | Indirect | Low–Medium |
| `app/api/tenants/[tenantId]/seed/route.ts` | POST | **Blocked when `NODE_ENV === 'production'`**; staff PIN reject | Path | **Yes** | Low (403 prod) |

---

## Health / utilities

| Route | Methods | Auth model | Tenant binding | `supabaseAdmin` in route? | Prod risk |
|-------|---------|------------|----------------|---------------------------|-----------|
| `app/api/health/iiohr-hr-staff-sync/route.ts` | GET | **None** | `EVOLVED_PERTH_TENANT_ID` env | No (loader may use admin internally) | **Medium** — public aggregates; no secrets in JSON per comment |
| `app/api/fi/copy-check/route.ts` | POST | **Production:** 404 unless `FI_ENABLE_PUBLIC_COPY_CHECK` affirmative | — | No | Low (default locked) |

---

## Counts

| Category | Approx. routes |
|----------|----------------|
| Cron | 4 |
| Legacy `/api/fi/*` | 6 |
| Tenant portal (`checkFiTenantPortalApiAccess`) | 8 |
| CRM / clinical (`assertCrmTenant*`) | 52 |
| Timely / IIOHR | 4 |
| Stripe | 1 |
| FI OS impersonation | 2 |
| Staff PIN | 2 |
| Tenants list + seed | 2 |
| Health + copy-check | 2 |
| **Total** | **83** distinct route files (duplicate path variants from OS may show 87 filesystem entries; consolidate on deploy) |

---

## Related docs

- [`infrastructure-hardening-audit.md`](./infrastructure-hardening-audit.md)
- [`fi-cases-rls-migration-verification.md`](./fi-cases-rls-migration-verification.md)
- [`payment-webhook-idempotency.md`](./payment-webhook-idempotency.md)
- [`supabase-admin-inventory.md`](./supabase-admin-inventory.md)

---

*Maps are complete for routing boundaries; downstream `supabaseAdmin` inside imported libraries is covered at file level in `supabase-admin-inventory.md`.*
