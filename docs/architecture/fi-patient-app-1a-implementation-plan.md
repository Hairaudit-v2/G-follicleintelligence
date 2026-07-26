# FI-PATIENT-APP-1A — Patient Gateway Discovery & Contract

**Status:** Discovery complete (no production mutations, no schema changes, no patient data migration, no mobile app implementation).  
**OpenAPI:** [`fi-patient-app-1a-openapi.yaml`](./fi-patient-app-1a-openapi.yaml)  
**Proposed base path:** `/api/patient/v1`

---

## 1. Executive verdict

FiOS already has a **web patient portal** identity spine (`fi_patients.portal_auth_user_id` → Supabase Auth) and reusable patient-safe loaders for **medications**, **imaging (released)**, and **visual summary**. Mobile can authenticate today with **Supabase Bearer tokens** via `resolveAuthUserId(request)`.

There is **no** versioned patient gateway. Staff CRM/booking/finance APIs must not be called by a mobile client. **Messaging has no patient-authenticated surface** and is deferred (501 in v1). Appointments and account need **thin patient-safe wrappers** around existing libraries.

| Domain | Reuse | New gateway work |
| --- | --- | --- |
| Auth / identity | Supabase Auth + `portal_auth_user_id` | `requirePatientGatewayContext(request, tenantId)` (Bearer-aware) |
| Profile | `resolvePatientProfile`, person fields | `GET .../me` DTO mapper |
| Imaging read | `loadPatientSafeImagingExportCardsForPatient` | Versioned list/get routes |
| Imaging upload | `uploadPatientPortalImage` | Move/alias under `/api/patient/v1/.../images` |
| Medications | loaders + reorder action logic | REST wrappers |
| Appointments | `loadBookingsForPatient`, `cancelBooking`, arrival intent | Patient-safe DTO + ownership gate |
| Account / pay | FinancialOS public token + pathway selection | Authenticated summary + ownership check |
| Messaging | — | Deferred (no inbox) |
| Audit | `publishPatientEvent` / analytics events | Gateway audit helper (no new table in 1A) |

---

## 2. Architecture audit (as-built)

### 2.1 Identity & authentication

| Piece | Location | Notes |
| --- | --- | --- |
| Auth provider | Supabase Auth | Staff + patient share Auth; roles differ by table |
| Staff membership | `fi_users.auth_user_id` + CRM/FI OS gates | `/api/tenants/...`, `/fi-admin` |
| Patient linkage | `fi_patients.portal_auth_user_id` | Migration `20260701120001_fi_medication_reorder_portal.sql` |
| Unique link | `idx_fi_patients_portal_auth_user_unique` | One auth user → at most one patient row globally |
| Portal resolve | `resolvePatientPortalAccess` | Cookie-oriented today (`resolveAuthUserId(null)`) |
| Bearer support | `resolveAuthUserId(request)` in `crmGate.ts` | Validates JWT via anon client `getUser()` |
| Middleware | `middleware.ts` | Production cookie gate for `/patient/*` only — **not** `/api/patient/*` |
| Sign-in UI | `/patient/[tenantId]/sign-in` | Web form; mobile uses Supabase SDK directly |

**Gap:** Portal access helpers do not accept `Request`, so Bearer-only mobile callers cannot use them as-is. Fix is a thin gate that passes `request` into `resolveAuthUserId`.

**Staff vs patient:** Patient portal users are **not** `fi_users` members. Calling staff routes with a patient token should fail membership checks — correct. Gateway must never use `assertCrmTenantWriteAllowed` for patient actors.

### 2.2 Canonical patient identity

Canonical mobile identity chain:

```text
Bearer access_token
  → auth.users.id                         (Supabase Auth)
  → fi_patients.portal_auth_user_id       (unique when set)
  → fi_patients.id                        (foundation patient id)
  → scoped by fi_patients.tenant_id
```

Supporting primitives:

- `resolvePatientProfile` — fail-closed exact `fi_patients.id` + `tenant_id`; detects `cross_tenant_denied`
- `assertPatientInTenant` patterns in images/payments/pathology — always `(tenant_id, patient_id)`
- Global/person resolution (`v_fi_patient_resolution`, `fi_global_patients`) is **staff/Patient Twin** territory — **out of patient gateway path**

### 2.3 Tenant isolation

Enforcement layers today:

1. **Path tenant** — `/patient/[tenantId]/...` and proposed `/api/patient/v1/tenants/{tenantId}/...`
2. **Row filters** — every loader/mutation `.eq("tenant_id", tid)`
3. **Portal link** — patient row must match both `tenant_id` and `portal_auth_user_id`
4. **RLS** — patient tables are tenant-scoped for authenticated staff; mutations typically use **service role** behind server gates
5. **DTO redaction** — patient-safe mappers strip staff AI / finance internals

Gateway rule: **never** accept `patient_id` from the client for authorization. Optional body IDs (e.g. `prescription_item_id`, `bookingId`) must be re-checked against the resolved portal patient.

### 2.4 Image / storage

| Piece | Location |
| --- | --- |
| Bucket upload + row insert | `createPatientImageRecord` (`patientImagesServer.ts`) |
| Storage path | `buildPatientImageStoragePath({ tenantId, patientId, imageId, ... })` |
| Ownership assert | `assertPatientInTenant` before upload |
| Default release | `patient_portal_release_status: "held"` |
| Portal upload wrapper | `uploadPatientPortalImage` — derives patient from portal link + consent gate |
| Existing HTTP | `POST /api/patient/[tenantId]/images` (unversioned) |
| Patient-safe list | `loadPatientSafeImagingExportCardsForPatient` — **released only** |
| Signed URLs | `createSignedUrl` with TTL; raw `storage_path` not exposed to portal UI |
| Feature flag | `isPatientPortalImagingEnabled()` |

**Ownership proof (upload):** portal patient id is loaded from auth link → passed as `patientId` into `createPatientImageRecord` → row + storage path both stamped with that pair → optional case/booking links re-asserted against same patient.

**Ownership proof (read):** list filter `patient_portal_release_status === "released"` OR (proposed) own held uploads for same `patient_id`; image get must match `tenant_id` + `patient_id`.

### 2.5 Appointments

| Piece | Location | Patient-safe? |
| --- | --- | --- |
| Model | `fi_bookings` | Yes if filtered by patient |
| Loader | `loadBookingsForPatient` | Reusable |
| Staff HTTP | `/api/tenants/[tenantId]/bookings` | **No** — CRM gate |
| Cancel | `cancelBooking` | Reusable **only** after ownership + policy |
| Public arrival | `POST /api/public/booking-arrival` | Token-based; not auth-bound |
| Patient portal UI | none for appointments | Gap |

### 2.6 Account / payment

| Piece | Location | Patient-safe? |
| --- | --- | --- |
| Public pay page | `/pay/[paymentRequestToken]` | Token-scoped |
| Pathway selection | `publicPaymentPathwaySelection*.ts` | Derives patient from payment request |
| Stripe webhook | `/api/fi-payments/stripe/webhook` | Server-only |
| Staff finance APIs | FinancialOS / payments records | **No** |
| Authenticated patient account API | — | **Missing** |

v1 approach: authenticated **summary** of the portal patient’s open invoices/payment requests + pathway selection that re-validates `patient_id` match. Continue checkout via existing Stripe `checkout_url` / public token — **no new payment-method vault** in v1.

### 2.7 Messaging

| Channel | Status |
| --- | --- |
| CRM lead communications | Staff/lead scoped (`fi_crm_lead_communications`) |
| ReceptionOS SMS/email | Outbound Twilio / Resend |
| Reminders | Server cron delivery |
| Patient portal inbox | **Does not exist** |
| In-app patient↔clinic chat | **Does not exist** |

OpenAPI marks `GET .../messages` as **501** until a later phase (likely schema). Do not expose staff CRM message APIs to patients.

### 2.8 Existing patient portal surfaces (web)

| Route | Data |
| --- | --- |
| `/patient/[tenantId]/medications` | `loadMedicationPortalLines`, reorder requests |
| `/patient/[tenantId]/imaging` | safe export cards + upload component |
| `/patient/[tenantId]/visual-summary` | sanitized reports |
| Reorder mutation | `submitPatientMedicationReorderAction` (server action only) |

---

## 3. Security enforcement proofs (required for implementation)

These are **acceptance proofs** for FI-PATIENT-APP-1B+ — not schema work.

### 3.1 Canonical patient identity

| Proof | Expected |
| --- | --- |
| Valid Bearer + linked `portal_auth_user_id` for tenant | `patient_id` in responses equals `fi_patients.id` |
| Valid Bearer, no portal link | `403` `unlinked` — no patient data |
| Client sends foreign `patient_id` in body | Ignored / rejected; never used for queries |
| Auth user linked in tenant A calls tenant B | `403` (no row for `(tenant B, portal_auth_user_id)`) |

**Implementation anchor:**

```ts
// proposed — no schema change
const authUserId = await resolveAuthUserId(request);
// select id from fi_patients where tenant_id = :tid and portal_auth_user_id = :authUserId
```

### 3.2 Tenant isolation

| Proof | Expected |
| --- | --- |
| All queries include `.eq("tenant_id", tid)` | Yes |
| Cross-tenant booking/image UUID | `404` (or `403`) without leaking other tenant existence details beyond existing patterns |
| Service role usage | Only behind gateway gate; never return admin fields |

### 3.3 Authorization

| Actor | Allowed |
| --- | --- |
| Portal-linked patient | Only `/api/patient/v1/**` patient DTOs for own record |
| Staff `fi_users` | Existing `/api/tenants/**` — unchanged |
| Unauthenticated | `401` |
| Patient token on staff route | Membership failure (`403`) |

Impersonation / platform admin bypasses used by staff CRM gates must **not** apply to the patient gateway.

### 3.4 Image ownership

| Proof | Expected |
| --- | --- |
| Upload | Storage path and `fi_patient_images.patient_id` = resolved portal patient |
| List default | Only `released` (+ optional own `held`) |
| Get other patient’s image id | `404`/`403` |
| Staff AI metadata | Absent from all patient DTOs (reuse safe export mapper) |
| Consent required & missing | Upload `403` `consent_required` |

### 3.5 Audit logging (without new tables)

Reuse existing analytics / row metadata — **no `fi_*_audit` migration in 1A/1B unless separately approved**.

| Action | Audit sink (proposed) |
| --- | --- |
| Image upload | Existing `publishPatientEvent({ eventType: "patient_images_uploaded", ... })` + timeline/post-capture pipeline |
| Medication reorder | Row `metadata.source = "patient_gateway_v1"` (today: `patient_portal_1d`) |
| Appointment cancel | Existing CRM `booking.cancelled` activity when lead-linked; plus `publishPatientEvent` with actor auth id in metadata |
| Pathway selection | Existing FinancialOS pathway writes |
| Gateway denials (optional) | `publishPatientEvent` / imaging event with `denied: true` — metadata keys only, no PHI payloads |

**Gateway helper (implementation phase):** `writePatientGatewayAudit({ tenantId, patientId, authUserId, action, entityType, entityId, metadata })` wrapping `publishPatientEvent` so every v1 mutation has a consistent actor stamp (`actor_kind: "patient_portal"`, `actor_auth_user_id`).

---

## 4. Reuse vs new endpoint matrix

### 4.1 Reusable as-is (gate swap only)

- `resolveAuthUserId(request)` — Bearer
- `loadPatientSafeImagingExportCardsForPatient`
- `uploadPatientPortalImage` / `createPatientImageRecord` / consent gate
- `loadMedicationPortalLines` / `loadMedicationReorderRequestsForPatient` / `validatePatientReorderEligibility`
- `loadBookingsForPatient`
- Visual summary portal sanitize/load helpers
- Public payment pathway core (with ownership assert added)

### 4.2 Thin gateway wrappers required

| Endpoint | Wraps |
| --- | --- |
| `GET /session`, `GET .../me` | portal access + person display fields |
| `GET/POST .../images` | existing portal imaging services |
| `GET/POST .../medications/reorders` | extract core from `submitPatientMedicationReorderAction` |
| `GET .../appointments` | `loadBookingsForPatient` + DTO |
| `POST .../cancel-request` | ownership + policy + `cancelBooking` or request record |
| `POST .../arrival-intent` | ownership + arrival intent server |
| `GET .../account` | invoice/payment-request loaders filtered by patient |
| `POST .../payment-requests/{token}/pathway` | public pathway selection + patient match |

### 4.3 Must build new / defer

| Capability | Why |
| --- | --- |
| Versioned `/api/patient/v1` router + shared gate | Does not exist |
| Bearer-aware `requirePatientGatewayContext` | Portal helper is cookie-only |
| Patient appointment DTO + cancel policy | No patient-facing booking API |
| Authenticated account summary | Only public token pay page today |
| Messaging inbox | No patient message store — **501 / later phase** |
| Reschedule / self-book | High policy risk; defer unless product mandates |
| Payment method vault | Out of scope; use Stripe Checkout URLs |

---

## 5. Implementation plan (post-1A)

> 1A delivers this document + OpenAPI only. Phases below are sequencing for later tickets.

### Phase 1B — Gateway foundation (no schema)

1. Add `src/lib/patientPortal/patientGatewayGate.server.ts`
   - `requirePatientGatewayContext(request, tenantId)` → `{ authUserId, patientId, tenantId, clinicName }`
   - Pass `request` into `resolveAuthUserId`
2. Add `writePatientGatewayAudit` wrapping `publishPatientEvent`
3. Mount routes under `app/api/patient/v1/...`
4. Keep legacy `POST /api/patient/[tenantId]/images` as thin delegate to v1 upload **or** document deprecation — no dual business logic
5. Contract tests: unauthenticated / unlinked / cross-tenant / happy path

### Phase 1C — Imaging + medications parity

1. `GET/POST` images + visual summary
2. Medications list + reorders REST (share validation with server action)
3. Consent status endpoint
4. Feature-flag parity with `isPatientPortalImagingEnabled`

### Phase 1D — Appointments + account

1. Appointment list/get + arrival-intent
2. Cancel-request with explicit tenant policy (default: request-only or cancel if before cutoff)
3. Account summary + pathway selection ownership check
4. Do **not** expose staff FinancialOS mutation surfaces

### Phase 1E — Mobile client (separate ticket)

1. Supabase Auth mobile SDK session
2. Call `/api/patient/v1` with Bearer
3. Deep link `/pay/{token}` for checkout when `checkout_url` present
4. Messaging UI blocked until inbox product + schema approved

### Explicit non-goals (still)

- No production data backfill of `portal_auth_user_id`
- No RLS redesign
- No new audit tables unless a later security ticket requires them
- No patient PHI in analytics metadata beyond existing id references

---

## 6. Suggested package layout (implementation phase)

```text
app/api/patient/v1/
  session/route.ts
  tenants/[tenantId]/me/route.ts
  tenants/[tenantId]/consent/route.ts
  tenants/[tenantId]/images/route.ts
  tenants/[tenantId]/images/[imageId]/route.ts
  tenants/[tenantId]/visual-summary/route.ts
  tenants/[tenantId]/appointments/route.ts
  tenants/[tenantId]/appointments/[bookingId]/route.ts
  tenants/[tenantId]/appointments/[bookingId]/cancel-request/route.ts
  tenants/[tenantId]/appointments/[bookingId]/arrival-intent/route.ts
  tenants/[tenantId]/medications/route.ts
  tenants/[tenantId]/medications/reorders/route.ts
  tenants/[tenantId]/account/route.ts
  tenants/[tenantId]/account/payment-requests/[publicToken]/pathway/route.ts
  tenants/[tenantId]/messages/route.ts          # 501

src/lib/patientPortal/
  patientGatewayGate.server.ts
  patientGatewayAudit.server.ts
  patientGatewayDtos.ts
```

---

## 7. Test plan (contract)

| Case | Result |
| --- | --- |
| No Authorization | 401 |
| Bearer valid, unlinked | 403 unlinked |
| Linked tenant A, call tenant B | 403 |
| Upload without consent when required | 403 |
| Upload with link | row `patient_id` = portal patient; release `held`; analytics event |
| List images | only released (+ optional own held) |
| Get foreign image UUID | 404/403 |
| List appointments | only `patient_id` match |
| Cancel other patient’s booking | 404/403 |
| Reorder other patient’s Rx item | 403 |
| Pathway token for other patient | 403 |
| Messages | 501 `messaging_not_available` |
| Staff API with patient token | still 403 membership |

---

## 8. Open product decisions (blockers for 1D, not 1A)

1. **Self-cancel:** immediate `cancelBooking` vs clinic-review request  
2. **Held uploads visibility:** show patients their pending held uploads?  
3. **Multi-clinic:** unique `portal_auth_user_id` implies one patient row per auth user — confirm product acceptance  
4. **Messaging:** push-only notifications vs future inbox (schema)  
5. **Deprecation** of unversioned `POST /api/patient/[tenantId]/images`

---

## 9. Deliverables checklist (1A)

- [x] Architecture audit across identity, auth, patient, imaging, appointments, account, messaging, audit  
- [x] OpenAPI for `/api/patient/v1`  
- [x] Reuse vs new endpoint matrix  
- [x] Explicit enforcement proofs for identity, tenant isolation, authorization, image ownership, audit  
- [x] Implementation plan for later phases  
- [x] No production mutations / schema changes / migrations / mobile app code in this ticket
