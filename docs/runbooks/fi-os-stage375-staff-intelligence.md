# FI OS Stage 3.75 — Staff organisational intelligence (structured layer)

## Scope

- Structured signal catalogue, optional DB snapshots/events, rule-based recommendations, manager-only staff directory panel, director/clinic manager home widget placeholder.
- **No** generative AI, external model calls, automated permission or workspace changes, or staff-facing punitive scores.

## Data computed today (best-effort)

Server loader (`staffIntelligence.server.ts`) reads existing tables when present:

- **CRM**: active tasks assigned to the staff member’s `fi_user_id` (`follow_ups_due`, composite `productivity_attention`), overdue CRM tasks (part of composite), **leads assigned** count (`fi_crm_leads.primary_owner_user_id`, excluding terminal statuses).
- **Consultations**: in-flight and past-date consultations for `consultant_staff_id` (`consultations_assigned`, `consultations_overdue`, `conversion_attention` mirror).

Many catalogue keys remain **0** until dedicated queries exist (stale leads heuristic, surgery readiness, imaging, training, audit, satisfaction, etc.) — see `TODO` comments in the loader.

## Visibility

- **RLS**: `fi_staff_performance_profiles` and `fi_staff_intelligence_events` — service role writes; no broad `authenticated` grants (tenant reads go through server + existing manager gate).
- **Staff directory panel**: same capability as staff feature-access management (`resolveCanManageStaffFeatureAccessSettings`).
- **Home widget `staff_intelligence_summary`**: workspace allowlist (`staffIntelligenceVisibility.ts`) **and** Stage 2 features **`dashboard` and `staff`** (both must be enabled).

## Stage 4 direction

Route-level feature enforcement, feature access audit trail, tenant operating mode admin UI (as per product roadmap).
