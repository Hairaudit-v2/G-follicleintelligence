# Follicle Intelligence — Project Overview

**Product context:** Internal and clinic-facing software for **Evolved Hair Clinics** and the broader **Follicle Intelligence** platform — evolving toward a **production-grade, purpose-built CRM + clinical operating system** for premium hair restoration (pipeline, contacts, scheduling, cases, consultations, and imaging).

**Document purpose:** Establish a **baseline** for engineers and stakeholders: what exists today, how it is structured, and what remains for an MVP comparable to Salesforce + HubSpot + Timely in scope (not in vendor feature parity).

**Last reviewed:** 2026-06-05 (CRM kanban MVP + `fi_crm_leads_shell_page` date filters).

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
