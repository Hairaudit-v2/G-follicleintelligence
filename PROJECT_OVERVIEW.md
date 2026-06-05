# Follicle Intelligence — Project Overview

**Product context:** Internal and clinic-facing software for **Evolved Hair Clinics** and the broader **Follicle Intelligence** platform — evolving toward a **production-grade, purpose-built CRM + clinical operating system** for premium hair restoration (pipeline, contacts, scheduling, cases, consultations, and imaging).

**Document purpose:** Establish a **baseline** for engineers and stakeholders: what exists today, how it is structured, and what remains for an MVP comparable to Salesforce + HubSpot + Timely in scope (not in vendor feature parity).

**Last reviewed:** 2026-06-05 (CRM lead detail tabs + Appointments/Bookings module audit).

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
| Patient directory + profile | **Completed** | Gated CRM shell; clinical details, images, timeline, linked leads. |
| Structured clinical summary | **Completed** | `fi_patient_clinical_details` — hair concern, meds, allergies, family history, etc. |
| Patient images (private bucket) | **Completed** | `fi_patient_images` with categories including **`before` / `after`**, consult, post_op, etc.; APIs for upload/archive. |
| **Norwood / Ludwig scale fields** | **Completed** | `fi_patient_clinical_details` + patient profile / consultation medical panel; surfaced on CRM kanban cards when linked patient has clinical rows. |
| Universal timeline | **Completed / evolving** | Timeline filters and types in `src/lib/patients/timeline/*`. |

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
