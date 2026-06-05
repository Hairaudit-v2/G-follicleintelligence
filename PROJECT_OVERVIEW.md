# Follicle Intelligence — Project Overview

**Product context:** Internal and clinic-facing software for **Evolved Hair Clinics** and the broader **Follicle Intelligence** platform — evolving toward a **production-grade, purpose-built CRM + clinical operating system** for premium hair restoration (pipeline, contacts, scheduling, cases, consultations, and imaging).

**Document purpose:** Establish a **baseline** for engineers and stakeholders: what exists today, how it is structured, and what remains for an MVP comparable to Salesforce + HubSpot + Timely in scope (not in vendor feature parity).

**Last reviewed:** 2026-06-05 (Patients module audit + CRM lead detail + Appointments/Bookings).

---

## Project Summary

This repository is a **Next.js 14** monolith using the **App Router**, with **Supabase (PostgreSQL + Auth + Storage + RLS)** as the system of record. The main operational surface is **`/fi-admin`** (tenant picker → **`/fi-admin/[tenantId]/…`** workspace): cases, patients, CRM leads, bookings, calendar, consultations, directory, configuration, audit tooling, and system status.

The codebase deliberately combines:

- **A strong data foundation** — multi-tenant tables (`fi_*`), conservative RLS on many foundation entities, append-only CRM stage history, bookings linked to leads/persons/patients/cases.
- **Server-centric mutations** — Next.js **Server Actions** and **`/api/tenants/[tenantId]/...`** route handlers using **`@supabase/supabase-js`** (often **service role** on the server) plus explicit **CRM / portal gate** checks.
- **Typed boundaries** — **Zod** for API/action payloads; **TypeScript strict** mode; unit tests around CRM, bookings, patients, and OS roles (`npm run test:unit`).

It is **not** a thin CRUD wrapper: there is substantial domain logic (CRM gates, lead conversion, case/clinical extensions, event ingestion, HairAudit flows) and **design documentation** under `docs/design/` that tracks staged delivery.

**Honest positioning:** Core **CRM list + board (kanban) + lead detail + tasks/notes/comms**, **patient profiles**, **bookings**, and **case/surgery/post-op** structures are **in place**. **HubSpot-grade marketing automation**, and **Timely-grade scheduling** (resources, recurrence, reminders, patient self-serve) are **largely missing or early**. Security posture is **layered** but some legacy FI APIs and audit endpoints need tightening (called out in internal design audits).

---

## Tech Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| **Framework** | Next.js **14.2** (App Router) | `app/` routes; RSC + server components common in FI Admin layouts. |
| **Language** | TypeScript **5** (`strict`) | Path alias `@/*` → repo root. |
| **UI** | React **18**, **Tailwind CSS 3.4**, **tailwindcss-animate** | Global tokens in `app/globals.css`; content paths include `app/`, `components/`, `src/`. |
| **Components** | **Radix** (dropdown, slot), **CVA**, **clsx** / **tailwind-merge**, **lucide-react**, **framer-motion** | Shared primitives split between `components/ui/*` (marketing-style) and `src/components/fi-admin/*`, `src/components/fi/*`, `src/components/fi-design/*`. |
| **Validation** | **Zod** | API schemas under `src/lib/**` (e.g. bookings, patient images, CRM). |
| **Database** | **Supabase / PostgreSQL** | Migrations in `supabase/migrations/`; local workflow via Supabase CLI (`package.json` scripts). |
| **Auth** | **Supabase Auth** (`@supabase/ssr`, `@supabase/supabase-js`) | Password sign-in and recovery under `/follicle-intelligence/*`; session cookies via server client. |
| **Server data access** | **Service role** client (`lib/supabaseAdmin.ts`) + RLS for `authenticated` | Tenant membership via `fi_users` linked to `auth.uid()`. |
| **PDF / images** | **pdf-lib**, **sharp** | Reports and image pipeline where applicable. |
| **Analytics** | **@vercel/analytics** | Production web analytics (lightweight). |
| **Testing** | **tsx** test runner | `npm run test:unit` — focused unit tests on domain modules. |
| **Not in use** | Prisma, tRPC, Drizzle, React Query / Redux | Data access is Supabase client + loaders/actions; client state is mostly React hooks / URL state. |

---

## Folder Structure (Key Directories Only)

| Path | Role |
| --- | --- |
| `app/` | **App Router** pages and API routes. Marketing and product pages at root; `app/(fi-admin)/fi-admin/` is the internal OS shell; `app/api/tenants/[tenantId]/` is the primary JSON API for tenant-scoped CRM, patients, bookings, and cases. |
| `src/components/` | **Feature UI** for FI Admin, CRM, patients, bookings, cases, consultations, calendar, dashboard shell — largest React surface. |
| `src/lib/` | **Domain logic, loaders, policies, types** (CRM gates, patient timeline, case builders, FI OS dashboard loaders, etc.). |
| `lib/` | **Shared infrastructure** — Supabase browser client, admin client, FI actions, event ingest, legacy FI pipeline helpers. |
| `components/` | **Marketing / site** shared components (layout, ecosystem diagrams, some `ui/` primitives). |
| `supabase/migrations/` | **Source of truth for schema** — `fi_*` foundation, CRM, bookings, patients, consultations, case extensions. |
| `docs/design/` | **Architecture and stage checklists** — highly valuable for onboarding (foundation, CRM, bookings, dashboard roadmap). |
| `scripts/` | **Operational scripts** (copy-check, event verification). |

---

## Current Features Status

Legend: **Completed** = usable end-to-end for at least one happy path; **In progress** = schema or partial UI exists; **Missing** = not present or only placeholder copy.

### Platform & access

| Area | Status | Detail |
| --- | --- | --- |
| Multi-tenant model (`fi_tenants`, `fi_users`) | **Completed** | Users scoped per tenant with `auth_user_id` and `role`. |
| FI Admin shell + tenant picker | **Completed** | `/fi-admin` loads tenants via `/api/tenants`; tenant routes under `/fi-admin/[tenantId]/*`. |
| Production portal gates | **Completed** | `assertFiTenantPortalAccess`, `assertFiAdminShellAccess` in `src/lib/fiOs/fiOsPortalGate.server.ts` (dev vs production behaviour documented in UI). |
| CRM workspace gate | **Completed** | `fi_admin` / `crm_operator` roles for CRM nav, patients, bookings, calendar (`crmShellAccess`). |
| Cross-tenant OS identities | **Completed** | `fi_os_identities` + roles for directory-style access (see migrations and `fiOsRoles`). |

### CRM (Salesforce / HubSpot direction)

| Area | Status | Detail |
| --- | --- | --- |
| Pipeline stages (`fi_crm_pipeline_stages`) | **Completed** | Tenant-scoped stages; lazy seeding pattern per design docs. |
| Leads (`fi_crm_leads`) + person anchor | **Completed** | Lead tied to `fi_persons`; optional `patient_id`, `case_id`, stage, owner. |
| Stage history (analytics-ready) | **Completed** | `fi_crm_lead_stage_history` append-only. |
| Lead list + filters + pagination | **Completed** | `/fi-admin/[tenantId]/crm` — table view with search, owner, stage, **updated date range**, sort, page size. |
| **Kanban / board by stage (MVP)** | **Completed** | List \| Board toggle; columns = tenant pipeline stages; drag or menu move → `crmMoveLeadStageAction` / `moveCrmLeadToStage` (history + activity); clinical/Norwood hints, overdue tasks, high-priority badge; responsive column stack. **Lead slide-over:** `CrmLeadSlideOverProvider` + `LeadSlideOver` / `crmLoadLeadSlideOverBundleAction` — quick preview (person, `formatClinicalScalesSummary`, stage + history, activity, tasks, notes, upcoming reminders, basics edit, convert); card click opens drawer; long-press / ⋯ menu / ⌘-click → full page; list title row opens drawer. |
| Lead detail (notes, tasks, comms, activity) | **Completed / evolving** | Rich workflows in `src/components/fi/crm/*`; APIs under `/api/tenants/.../crm/leads/[leadId]/*`. Slide-over reuses the same loaders/actions; full page remains source of truth for deep workflows. |
| Lead → patient/case conversion | **Completed** | Policy-driven conversion (`crmLeadConversionPolicy`, API route `convert`). |
| Sequences / marketing automation | **Missing** | No workflow engine, enrollments, or send-time scheduling. |
| Email provider / webhooks | **Missing** | Communications are modeled in CRM tables/UI; full ESP integration is not evidenced as first-class. |

### Patients & clinical CRM

| Area | Status | Detail |
| --- | --- | --- |
| `fi_persons` + `fi_patients` | **Completed** | Canonical person; one patient per person per tenant. |
| Patient profile (foundation) | **Completed** | `/fi-admin/[tenantId]/patients/[patientId]` — clinical, images, timeline, leads, bookings, cases. |
| Patient directory (data + UI) | **In progress** | Loader + `PatientDirectoryPage` built; **`/patients` route still shows Clinic OS placeholder** (no live list). |
| Structured clinical summary | **Completed** | `fi_patient_clinical_details` — scales, hairline pattern, bounded text + JSON flags. |
| Patient images (private bucket) | **Completed** | `fi_patient_images`; upload/edit/archive; categories include **before / after / progress**. |
| **Norwood / Ludwig** | **Completed** | DB + Zod + `hairLossScales.ts`; editable on profile; read-only on lead detail; kanban/reminder/appointment hints. |
| Universal timeline | **Completed** | Read-only merge in `src/lib/patients/timeline/*` (no patient-native activity writer). |

See **Patients Module** below for file map, hair-restoration gaps, and CRM/Appointment integration.

### Patients Module

**Naming:** Foundation patients live in **`fi_patients`** (linked to **`fi_persons`**). Legacy **`fi_global_patients`** still resolve via `v_fi_patient_resolution` and **`UniversalPatientRecord`** when no foundation row exists. Product “clinical scales” are columns on **`fi_patient_clinical_details`** (not a separate `clinical_scales` table).

#### What's built

| Layer | Location | Capability |
| --- | --- | --- |
| **Database** | `20260605140005_fi_patients_and_fi_patient_source_ids.sql`, `20260611120001_fi_patients_admin_fields.sql`, `20260612120001_fi_patient_clinical_details.sql`, `20260620120001_fi_patient_clinical_scales.sql`, `20260613120001_fi_patient_images.sql` | `fi_patients` (status, admin note, **reminder_consent**, preferred contact); **one** clinical row per patient; private image metadata with optional `lead_id` / `case_id` / `booking_id` anchors. |
| **Domain / policy** | `src/lib/patients/*`, `src/lib/patientImages/*` | Status allow-list, clinical text maxima, Norwood/Ludwig/hairline enums (`hairLossScales.ts`), image category/MIME policy, `changed_keys` diffs, consultation → patient scale sync (`clinicalDetailsConsultationSync.ts`). |
| **Loaders** | `patientProfileLoader.ts`, `patientDirectoryLoader.ts`, `clinicalDetailsServer.ts`, `patientImagesServer.ts`, `timeline/patientTimelineBuild.ts` | Profile graph: person, clinical, signed image tiles (max 50 active), leads by `patient_id`, cases by `foundation_patient_id`, bookings, CRM activity union, treatment timeline. Directory: search, filters, pagination (not routed). |
| **Server actions** | `lib/actions/fi-patient-actions.ts` | `updatePatientAdminDetailsAction`, `updatePatientClinicalDetailsAction`, `updatePatientImageDetailsAction`, `archivePatientImageAction` (CRM write gate; **no** patient create action). |
| **HTTP API** | `app/api/tenants/[tenantId]/patients/[patientId]/` | `PATCH` admin fields; `PATCH` `clinical-details`; `POST`/`PATCH`/archive under `images/`. |
| **FI Admin routes** | `app/(fi-admin)/fi-admin/[tenantId]/patients/` | **`page.tsx`** → `ClinicOsPatientsHome` (placeholder KPIs, global search hint). **`[patientId]/page.tsx`** → `PatientProfilePage`. **`new/page.tsx`** → hub (CRM lead / booking paths; **no** direct “create patient” form). |
| **Profile UI** | `src/components/fi/patients/*`, `src/components/fi/patient-images/*` | Header + summary KPIs; **editable** `PatientClinicalDetailsCard` (scales + text + optional JSON); **upload/gallery** `PatientImagesCard`; read-only timeline; linked leads, bookings, cases, CRM activity; admin notes + reminder consent. |
| **Directory UI (unwired)** | `PatientDirectoryPage`, filters, table | Fully implemented components; **not** mounted on `/patients` route yet. |
| **Patient creation** | `src/lib/crm/leadConversion.ts` | `resolveOrCreatePatient` on lead conversion (`fi_patient_source_ids` idempotency); no standalone operator “new patient” API. |
| **Tests** | `stage4a.test.ts` … `stage4d.test.ts`, `patientImages/stage4c.test.ts` | Policy, directory query, clinical merge, timeline sanitisation, images. |
| **Design docs** | `docs/design/21-patient-profile-foundation.md`, `22-patient-images-foundation.md`, `23-patient-treatment-timeline.md` | Stage 4A–4D checklists. |

**Clinical fields today:** Bounded text — primary concern, treatment interest, duration, family/medical history, meds, allergies, contraindications, scalp conditions, **`previous_hair_treatments`** (single textarea, not structured procedures). Structured enums — **Norwood**, **Ludwig**, **hairline_pattern**. Extensibility — `clinical_flags`, `metadata` JSON (staff-maintained; not HLI output).

**Image gallery:** Private Supabase bucket; categories `consult`, `scalp`, `donor`, `hairline`, `trichoscopy`, `post_op`, **`progress`**, **`before`**, **`after`**, `other`. Staff upload on profile; archive soft-deletes; signed URLs for active tiles. CRM lead **Clinical** tab and appointment drawer reuse **`LeadPhotoGalleryPanel`** (read-only grouping; edit on patient profile).

#### Gaps (full hair restoration workflow)

| Gap | Current state | Target for Evolved |
| --- | --- | --- |
| **Live patient directory** | Placeholder home at `/patients`; `loadPatientDirectoryPage` unused | Wire `PatientDirectoryPage` to route; replace preview KPIs with real counts |
| **Direct patient intake** | Only via **lead conversion** or ingest | Operator “create patient” (person + patient) without forcing a CRM lead |
| **Norwood / Ludwig depth** | Single current values on clinical row; UI selects in `ClinicalHairLossScaleFields` | Scale **history** over time (consult vs surgery vs 12-month review); optional diagram reference |
| **Hair characteristics** | Free text only (`primary_hair_concern`, `scalp_conditions`, etc.) | Structured fields: density, caliber, color, texture, donor quality — or dedicated JSON schema |
| **Previous procedures** | One field `previous_hair_treatments` | Table: procedure type, date, clinic, graft count, outcome, link to case/booking |
| **Consent forms** | **`reminder_consent`** + preferred contact on `fi_patients` only | Treatment, photography, GDPR, surgery consents with signed PDF/storage + expiry |
| **Progress tracking** | `progress` / `before` / `after` **categories** only | Comparison sets (baseline → 3/6/12 mo), graft survival notes, link to post-op case tracking |
| **Merged lead history** | Profile lists leads with **`patient_id`**; CRM lead detail has **`relatedLeads`** by **`person_id`** | Patient profile **person-level** enquiry history (all leads for person), stage timeline, merged comms |
| **Consultations on profile** | `fi_consultations.patient_id` exists; scales sync from `medical_hair_loss` draft | Consult list + deep link; complete consult → case/booking from patient shell |
| **Patient-native audit** | Profile activity = read-only **`fi_crm_activity_events`**; clinical/image edits **not** logged | `fi_patient_activity` or keyed CRM events with `changed_keys` only |
| **HLI / trichoscopy / graft math** | Explicitly deferred in design docs | Engine scores, measurement library, graft calculator tied to images and scales |
| **Before/after engine** | Manual tagged photos | Side-by-side viewer, alignment, export for marketing (consent-gated) |

#### Integration with CRM Lead Detail and Appointments

| Surface | Today | Recommended next hooks |
| --- | --- | --- |
| **`CrmLeadDetailPageView` — Clinical tab** | Read-only `LeadClinicalDetailsPanel` + `LeadPhotoGalleryPanel` when `lead.patient_id` set; **related leads** by `person_id` on preview bridge | Inline “quick edit scales” with save → patient row; CTA when unconverted; show **all person leads** summary chip linking to patient |
| **`LeadSlideOver`** | Norwood hint via `clinicalScalesSummary`; no gallery/clinical sections | Compact scales line + thumb strip + “Open patient” |
| **`LeadBookNextAppointmentCard`** | Prefills appointment slide-over (`bookingLeadPrefill`) | Pass `patient_id` + Norwood into create form defaults |
| **Kanban** | `getNorwoodShortLabel` on cards when patient linked | Batch-load clinical scales in kanban extras (avoid N+1) |
| **`/appointments` + slide-over** | `appointmentSlideOverLoader` loads `clinicalDetails`, `clinicalScalesSummary`, `patientImages`; `AppointmentClinicalSection`, `AppointmentGallerySection` | Deep link header → patient profile; filter gallery by `booking_id`; post-complete sync scales to patient |
| **`/appointments/[id]` detail** | Tabs: overview, clinical notes, procedure photos, invoice preview, post-op plan; breadcrumbs to patient | Embed `PatientClinicalDetailsCard` read-only peek or “edit on patient” |
| **Bookings / calendar** | `PatientBookingsCard`; calendar clinical line when patient on booking | Unify copy: appointments route = bookings data |
| **Reminders** | `{{norwood_summary}}` from patient clinical row; `reminder_consent` on patient | Surface consent block on patient admin card before enqueue |
| **Consultation OS** | `syncConsultationMedicalHairLossToPatientClinicalDetails` on consult save | Patient profile card listing open/completed consults |

#### Recommended file structure (evolution)

Keep **`fi_patients`** and **`src/lib/patients`** as source of truth. Add submodules only where domain grows:

```text
src/lib/patients/                         # keep — core (current)
  patientProfileLoader.ts
  patientDirectoryLoader.ts
  clinicalDetailsServer.ts
  hairLossScales.ts
  clinicalScaleHistory.ts                 # new — append-only scale snapshots
  patientLeadHistory.ts                   # new — person_id → all leads + merged activity
  patientConsent.ts                       # new — consent types + storage paths
  previousProcedures.ts                   # new — structured procedure rows (or jsonb schema)

src/lib/patientImages/                    # keep (current)
  progressSeries.ts                       # new — group before/progress/after by case or date

src/components/fi/patients/               # keep (current)
  PatientDirectoryPage.tsx                # wire to route
  PatientConsentPanel.tsx                 # new
  PatientConsultationsCard.tsx            # new
  PatientPersonLeadHistoryCard.tsx        # new — supersedes linked-only leads list
  progress/PatientProgressCompare.tsx     # new

src/components/fi/crm/shared/
  PatientClinicalPeek.tsx                 # optional — scales + link for lead + appointment

app/(fi-admin)/fi-admin/[tenantId]/patients/
  page.tsx                                # switch: ClinicOsPatientsHome → PatientDirectoryPage
  [patientId]/page.tsx                    # keep
  new/page.tsx                            # keep hub; optional direct-create wizard

docs/design/
  24-patient-hair-restoration-roadmap.md  # new — scales history, procedures, consent, progress
```

**Principle:** one patient row per person per tenant, one clinical summary row, many images and bookings; CRM leads and cases are **anchors**, not duplicate patient records. Timely-style scheduling stays on **`fi_bookings`** / **`src/lib/bookings`**; patient module **consumes** booking and appointment UIs rather than forking storage.

#### Priority features (Evolved Hair Clinics)

| Priority | Feature | Why |
| --- | --- | --- |
| **P0** | **Wire patient directory** to `/patients` | Operators cannot discover patients without search/profile URL today |
| **P0** | **Person-level lead history on patient profile** | Multiple enquiries per person are common; only `patient_id` leads shown now |
| **P1** | **Consultations card** on patient + link to `fi_consultations` | Consult is the sales handoff; patient shell is the longitudinal record |
| **P1** | **Progress / before–after compare UI** | Categories exist; restoration clinics need visual follow-up |
| **P1** | **Appointment ↔ patient quick path** | Detail page has breadcrumbs; add norwood badge + gallery filter by booking |
| **P2** | **Structured previous procedures** | Replace single textarea for FUE/PRP history and medico-legal accuracy |
| **P2** | **Clinical scale history** | Track change from consult → surgery → reviews for outcomes reporting |
| **P2** | **Consent documents** | Beyond reminder opt-in; photography and procedure consents |
| **P3** | **Direct patient create** | Walk-ins without CRM lead first |
| **P3** | **Patient-native activity stream** | Audit clinical edits without polluting CRM lead feed |
| **P3** | **HLI / graft calculator integration** | After structured clinical + imaging foundation is stable |

### Scheduling (Timely direction)

| Area | Status | Detail |
| --- | --- | --- |
| Bookings table | **Completed** | `fi_bookings` — types (consultation, surgery, follow_up, …), status, anchors to lead/person/patient/case, assignee, clinic. |
| Bookings operator UI | **Completed** | List + new booking flows under `/bookings`. |
| Calendar page | **Completed (ops)** | `/fi-admin/[tenantId]/calendar` — **week (Mon–Sun UTC) default** + **day** toggle; **business-hour grid** (slot size + hours from `fi_tenant_settings.metadata.operational_calendar` or defaults); **staff + site columns** on day view (`fi_users` + `fi_clinics`); bookings via **`loadBookingsForTenantRange`** (same overlap semantics as tenant dashboard agenda) with CRM-style filters + search (`q`); **drag-and-drop reschedule** (`updateBookingAction`) with **assignee/site conflict** hints; detail **drawer + full edit**; **mobile stacked list**. Legacy preview grid remains in `ClinicOsCalendarHome` (unused by route). |
| Reminders / SMS / email cadence | **In progress (MVP)** | `fi_reminder_templates` + `fi_reminder_jobs` — triggers: `booking_created`, `booking_48h_before` / `booking_24h_before` (aliases `booking_48h`, `booking_24h`), **`post_consult`**, **`lead_created`**; job **`cancelled`** + **`error_log`**; **`entity_type`/`entity_id`/`patient_id` in `metadata`** for traceability. **Patient `reminder_consent` (default true for new rows)** + `preferred_contact_method`. Enqueue: **`syncBookingReminderJobs`** on booking create/update; **`syncLeadCreatedReminderJobs`** on lead create (patient consent); **`syncPostConsultReminderJobs`** when consultation is **Mark completed**. Pending jobs **cancelled** on reschedule (not deleted). Merge fields include **`{{norwood_summary}}`** (clinical scales). **Stub processor** `processReminderJobsOnce` (1× retry, skip/cancel ineligible bookings) + **`POST|GET /api/cron/fi-reminder-jobs`**. UI: **`/fi-admin/[tenantId]/settings/reminders`**, **dashboard upcoming reminders**, **booking edit drawer**, **operational calendar cards** + **mobile list** hints. CRM comms log on send when `lead_id` present. **Next:** Twilio/Resend, wire Vercel Cron, optional DB `entity_*` columns beyond metadata. |
| Recurring appointments / rooms / chairs | **Partial** | Single booking rows with `clinic_id` + assignee; no recurrence or optimization engine. |

### Appointments Module

**Naming in repo:** There is **no** `src/components/fi/appointments/`, `src/lib/appointments/`, or `app/.../appointments/` tree. Scheduling for Evolved Hair Clinics is implemented as the **Bookings** module (`fi_bookings`, `src/lib/bookings/`, `src/components/fi/bookings/`). Product copy may say “appointments”; engineering should treat **bookings = appointments** unless a future alias layer is added.

#### What's built

| Layer | Location | Capability |
| --- | --- | --- |
| **Database** | `supabase/migrations/20260610120001_fi_bookings.sql` | `fi_bookings`: `start_at` / `end_at`, `booking_type`, `booking_status`, anchors to **lead / person / patient / case**, `clinic_id`, `assigned_user_id` (`fi_users`), `metadata` jsonb, cancellation audit columns. Indexes on tenant + time, status, type, anchors. RLS: tenant members **SELECT**; writes via **service role** (FI Admin). |
| **Related entities** | `fi_reminder_jobs.booking_id`, `fi_patient_images.booking_id` | Reminder queue tied to bookings; images optionally scoped to a booking. **`fi_consultations` is separate** (no `booking_id`) — parallel “consult workspace” vs calendar event. |
| **Domain / policy** | `src/lib/bookings/bookingPolicy.ts`, `bookingApiSchemas.ts`, `bookingChangedFields.ts`, `bookingTime.ts` | Allow-listed types: `consultation`, `prp`, `prf`, `mesotherapy`, `exosomes`, `surgery`, `review`, `follow_up`, `other`. Statuses: scheduled → confirmed → arrived → completed / cancelled / no_show. **Consultation-only** on unconverted leads. |
| **Server mutations + loaders** | `src/lib/bookings/bookings.ts`, `server.ts` | `createBooking`, `updateBooking`, `cancelBooking`, `completeBooking`; overlap loaders (`loadBookingsForLead`, `loadBookingsForTenantRange`, `loadBookingsForOperatorView`, `loadBookingsForCalendarOverlap`). CRM **activity** on lead when `lead_id` set (`booking.created` / `updated` / `cancelled` / `completed`). |
| **Server actions** | `lib/actions/fi-booking-actions.ts` | `createBookingAction`, `updateBookingAction`, `cancelBookingAction`, `completeBookingAction` (CRM write gate + optional FI Admin key). |
| **HTTP API** | `app/api/tenants/[tenantId]/bookings/*` | List by range, create, patch, cancel, complete. |
| **FI Admin routes** | `/fi-admin/[tenantId]/bookings`, `/bookings/new`, `/calendar` | Operator list + filters + quick-create (`BookingOperatorPage`); new booking entry page; **operational calendar** (week/day, UTC business grid from `fi_tenant_settings.metadata.operational_calendar`). |
| **Calendar UI** | `src/components/fi/bookings/calendar/*`, `src/components/fi-admin/calendar/OperationalCalendarPage.tsx` | Drag-and-drop reschedule (`updateBookingAction`), staff + clinic columns (day view), filters, event drawer, **assignee/site conflict hints** on save. Clinical scale line on cards when patient linked. |
| **Lead-scoped UI** | `src/components/fi/bookings/LeadBookingPanel.tsx`, `BookingCreatePanel`, `BookingSummaryCard` | On CRM lead detail **Overview** tab: list upcoming/past, create/edit/cancel/complete, default **1h** slot (`bookingFormUtils.defaultRangeIso`). |
| **Edit drawer** | `src/components/fi/bookings/operator/BookingEditDrawer.tsx` | Full-field edit + **reminder jobs** list for that booking (used from operator + calendar flows). |
| **Reminders** | `src/lib/reminders/reminderEnqueue.server.ts` (`syncBookingReminderJobs`) | Templates: `booking_created`, `booking_48h_before`, `booking_24h_before`; jobs cancelled on reschedule; merge fields include Norwood summary when patient present. |
| **Other surfaces** | `CaseBookingsCard`, `PatientBookingsCard`, `DashboardTodayAgenda` | Bookings on case/patient; tenant home agenda reuses range loaders. |
| **Tests** | `src/lib/bookings/stage3a.test.ts`, `stage3b.test.ts`, `stage3c.test.ts` | Policy, operator query, calendar bucketing. |
| **Design doc** | `docs/design/19-booking-calendar-foundation.md` | Stage 3A/3B/3C checklist. |

**Procedure types vs product language:** DB already includes **Consultation** (`consultation`), **Hair Transplant** (`surgery`), **Follow-up** (`follow_up`), plus **PRP** and related clinical types (`prp`, `prf`, `mesotherapy`, `exosomes`). There is **no** separate `procedure` catalog table — duration and defaults are **manual** `start_at`/`end_at` (default +1h in forms), not type-driven templates.

**Staff / roles:** `assigned_user_id` → any `fi_users` row in tenant picker. **No** surgeon vs coordinator vs nurse role dimension on bookings; CRM gate uses `fi_admin` / `crm_operator` (and `admin` for mutations), not per-procedure eligibility.

#### Gaps (Timely-style scheduling for hair clinics)

| Gap | Current state | Target for Evolved |
| --- | --- | --- |
| **Type-driven durations** | Free-form end time; no `procedure_duration_minutes` catalog | Consultation 45–60m, FUE day-block for `surgery`, PRP 30m, etc., auto-fill end from type + override |
| **Hair transplant naming** | UI label “Surgery” (`surgery`) | Product label “Hair transplant” / FUE variant; optional alias without breaking DB enum |
| **Resource model** | One assignee + one clinic per row | Surgeon + assistant + room/chair; multi-resource or metadata array |
| **Availability / working hours** | Business grid hours only (tenant metadata); **no** per-clinician availability or blocked time | Timely-style “who is free at 2pm Tuesday”; respect leave/lunch |
| **Conflict enforcement** | **Hints** on calendar save (`bookingConflictsForOperationalCalendar`); not DB-excluded double-book | Hard block or soft warn with override reason |
| **Recurrence / series** | Single rows only | PRP courses, post-op review series |
| **Patient self-booking** | None | Public slot picker against availability |
| **Consultation ↔ booking link** | `fi_consultations` and `fi_bookings` independent | Completing consult should optionally create/update linked booking; single timeline |
| **Clinical / photo context in scheduler** | Calendar shows patient name + clinical scales line; no inline gallery | Norwood badge, before/after thumb, lead stage on event card and drawer |
| **Timezone** | Field exists; grid documented as **UTC** | Clinic-local wall clock (Evolved UK timezones) |
| **Room / chair inventory** | `clinic_id` only | Chair 1–N under clinic for day-view columns |
| **No-show workflow** | Status `no_show` exists | Automated follow-up task + reminder template |
| **Reporting** | None in-app | Utilisation by surgeon, type mix, no-show rate |

#### Integration with CRM lead UI (new detail page + slide-over)

| Surface | Today | Recommended next hooks |
| --- | --- | --- |
| **`CrmLeadDetailPageView` (Overview tab)** | `LeadBookingPanel` with full create/edit | Add **“Schedule”** CTA opening calendar deep-link `?leadId=` + next slot; show **next appointment** in overview stats (reuse `deriveCrmLeadNextAction`-style helper for bookings). |
| **`LeadSlideOver`** | No bookings section | Compact **upcoming booking** row + “Open calendar” / “Book consultation” (prefill `consultation`, lead anchors). |
| **Shared CRM components** | `src/components/fi/crm/shared/*` person/clinical only | Optional `LeadUpcomingBookingStrip` in `shared/` consuming `FiBookingRow[]`. |
| **Payload loaders** | `loadCrmShellLeadDetailPagePayload` includes `detail.leadBookings` | Already sufficient; ensure slide-over bundle keeps `leadBookings` in sync after `router.refresh()`. |
| **Conversion gate** | Only `consultation` before `converted_at` | Surface in booking UI when lead unconverted (already server-enforced). |
| **Reminders** | Jobs keyed by `booking_id`; CRM comms when `lead_id` | Show on lead Timeline tab next to tasks; link from `LeadRemindersSection` to booking drawer. |

#### Gap list (engineering backlog)

1. **Procedure template service** — `booking_type` → default duration, title, color (extend `operatorBookingLabels` + tenant settings JSON).
2. **Availability tables** — `fi_staff_availability` / `fi_clinic_hours` + overlap query used before create.
3. **Unified appointment drawer** — merge `BookingEditDrawer` + clinical peek (patient scales, link to `CrmLeadDetailPageView` clinical tab).
4. **Consultation sync** — optional `fi_consultations.booking_id` or pairing via `metadata.consultation_id`.
5. **Route alias** — `/appointments` → `/bookings` for operator training (optional).
6. **Slide-over + board** — next booking badge on `CrmLeadKanbanCard` from batch loader (kanban extras already have clinical lines).
7. **Real timezone** — tenant/clinic TZ in calendar grid and datetime pickers.
8. **Production reminders** — already stubbed; wire transport (see Scheduling row above).

#### Recommended file structure (evolution, not mandatory rename)

Keep **`fi_bookings`** and **`src/lib/bookings`** as the source of truth. Add product-facing aliases only where useful:

```text
src/lib/bookings/                    # keep — core domain (current)
src/lib/appointments/                # optional thin re-export + Timely-specific helpers
  index.ts                           # export * from '../bookings'
  procedureTemplates.ts              # type → duration, labels, colors
  availability.ts                    # free-busy queries
  bookingLeadSummary.ts              # next/upcoming for CRM widgets

src/components/fi/bookings/          # keep — all scheduling UI (current)
src/components/fi/crm/shared/
  LeadUpcomingBookingStrip.tsx       # optional — CRM + slide-over

src/components/fi/appointments/       # optional — only if marketing wants separate folder
  AppointmentQuickSchedule.tsx       # wrapper → BookingCreatePanel + templates

app/(fi-admin)/fi-admin/[tenantId]/
  bookings/                          # keep (operator list)
  bookings/new/                      # keep
  calendar/                          # keep (Timely-style grid)
  appointments/                      # optional redirect → bookings

docs/design/
  20-appointments-timely-roadmap.md   # new — procedure catalog + availability spec
```

**Principle:** one table (`fi_bookings`), one mutation path (`fi-booking-actions` + `bookings.ts`), multiple views (list, calendar, lead panel, case/patient cards). New Timely features extend **loaders + policy**, not a second appointments table.

### Cases, surgery, post-op (clinical OS)

| Area | Status | Detail |
| --- | --- | --- |
| `fi_cases` + `fi_intakes` | **Completed** | Legacy case lifecycle + PII in intakes; extended with foundation FKs and treatment fields. |
| Case index + detail + summary doc | **Completed** | Rich case UI (readiness, timeline, surgery plan, procedure day, post-op, follow-ups). |
| Surgery plans / procedures / post-op | **Completed** | Migrations `fi_case_surgery_plans`, `fi_case_procedures`, `fi_case_post_op_tracking`. |
| Consultation OS | **In progress → completing** | `fi_consultations` with structured JSON, status workflow; UI panels and autosave (`useConsultationAutosave.ts`). |

### Reporting, analytics, marketing site

| Area | Status | Detail |
| --- | --- | --- |
| System status page | **Completed** | Integration-style readiness summary for operators. |
| **CRM funnel analytics / revenue reports** | **Missing** | Stage history exists in DB; **no** dedicated BI dashboards in-app. |
| HairAudit / FI model & reports | **Completed / parallel track** | Legacy `/api/fi/*` and audit queues — product adjacent to CRM; some routes need auth hardening per `docs/design/19-fi-os-current-state-and-dashboard-roadmap.md`. |
| Public marketing pages | **Completed** | Multiple `app/*/page.tsx` routes for brand and education (separate from FI Admin). |

### Database entities (high-signal tables)

| Domain | Representative tables |
| --- | --- |
| Tenancy & users | `fi_tenants`, `fi_users`, `fi_os_identities` |
| Geography of care | `fi_organisations`, `fi_clinics`, settings tables (`fi_tenant_settings`, …) |
| People & patients | `fi_persons`, `fi_person_roles`, `fi_patients`, `fi_patient_source_ids`, `fi_patient_clinical_details`, `fi_patient_images` |
| CRM | `fi_crm_pipeline_stages`, `fi_crm_leads`, `fi_crm_lead_stage_history`, `fi_crm_activity_events`, notes, tasks, communications (see migrations `fi_crm_*`) |
| Scheduling | `fi_bookings`, `fi_reminder_templates`, `fi_reminder_jobs` |
| Clinical record | `fi_cases`, `fi_intakes`, `fi_consultations`, `fi_case_surgery_plans`, `fi_case_procedures`, `fi_case_post_op_tracking`, `fi_timeline_events`, `fi_media_assets` |
| Legacy / AI audit | `fi_global_cases`, `fi_reports`, model runs, signals, uploads (older `202502*` migrations) |

---

## Obvious Gaps for a Hair Clinic CRM

1. **Pipeline UX** — **MVP kanban** is live under `/fi-admin/[tenantId]/crm?view=board` (drag between columns, refresh, filters) plus **lead slide-over** for fast triage without leaving the board. Deeper sales analytics (velocity, forecasting) remain future work.
2. **Marketing automation** — No lead scoring beyond manual fields, no sequences, no landing-page → CRM attribution loop inside this repo at product level.
3. **Scheduling depth** — Bookings are **flat events**; missing **clinician/resource calendars**, **recurrence**, **waitlists**, and **patient self-booking** tied to real-time availability.
4. **Engagement & reminders** — **MVP queue + templates** are in place (`fi_reminder_templates`, `fi_reminder_jobs`, cron processor stub). **Tenant home** includes an **Upcoming reminders** widget (`loadUpcomingReminders` / `loadOperationalDashboardReminderJobs`): next **7 days**, cap **10** rows, **My vs All** (booking assignee + lead primary owner), **mark sent / cancel / reschedule** server actions with optimistic UI, **clinical scales** line on patient-linked rows, and deep links to patient/lead/case. First-class **SMS/ESP delivery**, patient-facing consent UX polish, and **no-show analytics** remain.
5. **Trichoscopy / surgical planning math** — Norwood/Ludwig are **structured on patients**; **graft calculators** and imaging-linked trichoscopy workflows are not standardized in-app.
6. **Reporting** — Data is **analytics-ready** (stage history, bookings timestamps); **in-app BI** (conversion rates, stage dwell, no-show rates) is largely **unbuilt**.
7. **Security consistency** — Internal docs flag APIs that trust **`tenant_id` query params** without mirroring layout-level checks; closing this gap is essential before externalizing APIs.

---

## Recommended Next Priorities for MVP

Prioritized for **Evolved Hair Clinics daily operations** while preserving the strong foundation.

| Priority | Initiative | Why |
| --- | --- | --- |
| **P0** | **Tenant home dashboard** — today’s appointments, stale leads, tasks due | Replaces “land on cases” default with actionable clinic ops (`docs/design/19-fi-os-current-state-and-dashboard-roadmap.md` aligns). |
| **P0** | **Harden tenant-scoped APIs** — unify `assertFiTenantPortalAccess` / CRM gates on every `/api/tenants/...` and legacy FI audit list | Reduces breach risk; unlocks safe mobile / third-party consumers. |
| **P1** | **Calendar week view + filters** — clinicians, rooms, booking types | Closes the gap to Timely for front desk; reuses `fi_bookings`. |
| **P1** | **Tenant CRM dashboard widgets** — stale leads, stage dwell, tasks due (uses board + history) | Complements the new kanban as the exec snapshot (`docs/design/19-fi-os-current-state-and-dashboard-roadmap.md`). |
| **P1** | **Norwood reporting / cohort views** | Structured scale exists; add saved views / exports for clinical ops. |
| **P2** | **Production reminders** — Twilio/SendGrid, delivery receipts, Vercel Cron | MVP queue + templates + merge fields exist; wire real transport and monitor `fi_reminder_jobs`. |
| **P2** | **Funnel metrics page** — SQL views or materialized summaries from `fi_crm_lead_stage_history` | Uses existing append-only history; small win for leadership. |
| **P3** | **Marketing automation MVP** — static segments + manual bulk tasks (not full HubSpot) | Avoids over-engineering; pairs with CRM tasks. |

---

## Architecture Recommendations & Improvements

1. **Keep the “Supabase + Next server” pattern** — It matches multi-tenant healthcare CRM needs: RLS for **read**, **service role + explicit gates** for **writes**, audit-friendly history tables. Avoid introducing ORMs until migrations become painful.

2. **Centralize API authorization** — Add a **single helper** per route class (`requireTenantSession`, `requireCrmWrite`) and tests that fail closed when `tenantId` is mismatched. Treat design doc warnings on audit queue as a **template** for review of all `tenant_id` query routes.

3. **Introduce lightweight shared DTOs** — You already use Zod in pockets; **extend consistently** across `/api/tenants` and server actions to prevent drift between UI and DB.

4. **Kanban before new CRM tables** — The schema already has stages, leads, and history; **board UI + optimistic concurrency** is the highest ROI CRM feature.

5. **Calendar: separate “view model” from storage** — Continue storing **absolute `start_at`/`end_at`** in `fi_bookings`; add **projection queries** (day/week) and optional **`clinic_id` / `assigned_user_id` indexes** for performance before recurring appointment schema.

6. **ConsultationOS** — Finish autosave + **completed → case** bridge as the canonical clinical sales handoff (tables already support `converted_to_case`).

7. **Design system consolidation** — `components/ui`, `src/components/fi-design`, and `src/components/fi-admin/dashboard-ui` overlap; document **which layer to use for new FI Admin screens** (prefer `fi-design` + dashboard tokens for OS consistency).

8. **Observability** — For MVP production, add **structured logging** around server actions (tenant, user, entity id, duration) and **Supabase RLS denial** monitoring — not present in `package.json` dependencies today.

9. **Testing strategy** — Unit tests are strong for **pure policy** modules; add a **small Playwright smoke** suite later for login → tenant → create lead → move stage — not required for every PR but valuable before MVP launch.

---

## Related Documentation

- `docs/design/19-fi-os-current-state-and-dashboard-roadmap.md` — Route-by-route audit and gaps.
- `docs/design/17-crm-foundation-architecture.md` / `18-crm-foundation-implementation-checklist.md` — CRM schema rationale.
- `supabase/README.md` — migration workflow.

---

*This overview is derived from source code and migrations in this repository. When behaviour conflicts with this document, trust the code and migrations.*
