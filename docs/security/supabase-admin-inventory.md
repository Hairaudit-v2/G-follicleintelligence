# `supabaseAdmin()` call-site inventory

**Source of truth for regeneration:**

```bash
rg "supabaseAdmin\(" --glob "*.ts" --glob "*.tsx" --count-matches
rg -l "supabaseAdmin\(" --glob "*.ts" --glob "*.tsx" | wc -l
```

**Snapshot:** ~**230** distinct files under the repo reference `supabaseAdmin()` (including `lib/supabaseAdmin.ts` definition, `scripts/*`, and `app/(fi-admin)/*`). **Line counts** per file vary from **1** to **13+** in hot paths such as `revenueInvoiceMutations.server.ts` and `bookings.ts`.

This document classifies **by file / module** (not every physical call line) to satisfy “enumerate + classify” without a multi-thousand-line table in git. Line-level maps belong in generated CI artifacts if needed.

---

## Classification tiers

| Tier | Label | Meaning |
|------|--------|---------|
| **M** | **Must remain service role** | Ingestion, webhooks, cron workers, `auth.admin`, storage admin, cross-tenant FI Admin tools, idempotency helpers, or writes where RLS does not grant `authenticated` DML. |
| **L** | **RLS user-client candidate (later)** | Predominantly **tenant-scoped reads/writes** with `client ?? supabaseAdmin()` or explicit `eq('tenant_id', …)` on all branches; switching to a user JWT client would align DB enforcement with session identity. |
| **R** | **Redesign / high scrutiny** | Queries **without** `tenant_id` filters, FI Admin **system** pages that aggregate across tenants, or any path flagged by internal admin audits as “dangerous” if miscomposed. |
| **S** | **Script / offline** | `scripts/*` — not production request path; still protect secrets. |

---

## Tier **M** (must remain service role) — representative areas

| Area / pattern | Example files |
|----------------|---------------|
| FI event pipeline | `lib/fi/events/ingest.ts`, `lib/fi/events/mapping.ts`, `lib/fi/events/idempotency.ts`, `lib/fi/events/handlers/*.ts`, `lib/fi/pipeline.ts`, `lib/fi/jobRunner.ts` |
| Case submission / legacy services | `lib/fi/services/caseSubmission.ts` |
| Stripe / revenue | `app/api/fi-payments/stripe/webhook/route.ts`, `src/lib/revenueOs/revenueInvoiceMutations.server.ts`, `src/lib/revenueOs/fiPaymentRemindersCron.server.ts` |
| CRM gate internals (membership resolution) | `src/lib/crm/crmGate.ts` |
| FI OS impersonation persistence | `src/lib/fiOs/fiOsImpersonation.server.ts`, `app/api/fi-os/impersonation/start/route.ts` (`auth.admin.getUserById`) |
| Staff PIN crypto / session | `src/lib/staffPin/staffPin.server.ts`, `src/lib/staffPin/staffPinSession.server.ts` |
| Public payment link resolution | `src/lib/revenueOs/publicPaymentRequestLoaders.server.ts` |
| Reminder enqueue / processor | `src/lib/reminders/reminderEnqueue.server.ts`, `src/lib/reminders/reminderProcessor.server.ts`, `src/lib/reminders/reminderJobs.server.ts` |

---

## Tier **L** (migrate to RLS user client *later*, not now)

**Heuristic:** `*.server.ts` loaders and CRM modules that already take `client?: SupabaseClient` or use `client ?? supabaseAdmin()` **and** enforce tenant in query predicates.

| Area | Example files |
|------|---------------|
| CRM mutations / reads | `src/lib/crm/notes.ts`, `src/lib/crm/tasks.ts`, `src/lib/crm/leadCommunications.ts`, `src/lib/crm/pipeline.ts`, `src/lib/crm/activity.ts`, … |
| Patient / case loaders | `src/lib/patients/patientDirectoryLoader.ts`, `src/lib/cases/caseLoaders.ts`, `src/lib/cases/caseUpdate.ts`, `src/lib/patients/timeline/patientTimelineServer.ts` |
| Foundation resolvers | `src/lib/fi/foundation/resolvePerson.ts`, `resolveClinic.ts`, `resolveOrganisation.ts`, `tenantSettings.ts`, `createTimelineEvent.ts` |
| Booking / calendar | `src/lib/bookings/bookings.ts`, `src/lib/calendar/bookingResourceRequirements.server.ts`, `findNextAvailableBookingSlots.server.ts` |
| Pathology | `src/lib/pathology/pathologyRequestMutations.server.ts`, `pathologyResultLoad.server.ts`, … |

**Caveat:** migration requires **threading the user-scoped Supabase client** from `crmGate` / session into these modules and verifying **every** branch (including admin-key bypass) still satisfies policy intent.

---

## Tier **R** (dangerous / needs redesign) — explicit list

These warrant **design review** independent of “migrate to RLS”:

| File | Concern |
|------|---------|
| `app/(fi-admin)/fi-admin/system/clinics/page.tsx` | Cross-tenant selects without `tenant_id` in primary query (see `tools/audit-supabase-admin-from.result.csv` DANGEROUS rows). |
| `app/(fi-admin)/fi-admin/system/staff/page.tsx` | Same pattern — aggregate `fi_staff` without tenant filter in first query. |
| `app/(fi-admin)/fi-admin/system/services/page.tsx` | Selects `fi_services` tenant column set without narrowing predicate in scanner view. |
| `app/(fi-admin)/fi-admin/system/medication-catalogue/page.tsx` | Broad `fi_medication_catalogue` read. |
| `app/(fi-admin)/fi-admin/system/academy/page.tsx` | `fi_staff_source_ids` without tenant filter. |
| `app/(fi-admin)/fi-admin/system/audit-logs/page.tsx` | `fi_os_impersonation_sessions` count without tenant scope. |
| `lib/fi/events/mapping.ts` | Historically sensitive cross-linking of global ↔ tenant ids; keep service role but **require** defensive `tenant_id` pairing on all mutating paths (partially addressed in prior audits). |
| `src/components/fi-admin/prescribing/PrescriptionsWorkspacePage.tsx` | Uses `supabaseAdmin()` inside a **UI module** (currently server component — verify never `"use client"`). Prefer moving queries into `*.server.ts` loaders only. |

**Note:** FI Admin **tenant-scoped** pages under `app/(fi-admin)/fi-admin/[tenantId]/…` generally use `tenant_id` filters; risk concentrates in **`/fi-admin/system/*`**.

---

## Tier **S** (scripts)

`scripts/verify-fi-event-ingestion.ts`, `scripts/hubspot-import-next-500.ts`, `scripts/provision-evolved-tenant.ts`, `scripts/import-approved-fi-services.ts`, `scripts/seed-evolved-perth-service-room-eligibility.ts`, `scripts/hubspot-commit-latest-dry-run-batch.ts`, …

Treat as **production-adjacent**: same `SUPABASE_SERVICE_ROLE_KEY` secrets; run only from locked-down CI or operator workstations.

---

## Appendix A — `app/api` routes with **direct** `supabaseAdmin` import

(Also listed in [`api-routes-inventory.md`](./api-routes-inventory.md).)

- `app/api/fi-payments/stripe/webhook/route.ts`
- `app/api/cron/fi-photo-protocol-alerts/route.ts`
- `app/api/fi-os/impersonation/start/route.ts`
- `app/api/tenants/[tenantId]/integrations/timely/discovery/route.ts`
- `app/api/fi/audit/{approve,reject,queue,dashboard}/route.ts`
- `app/api/fi/report/route.ts`
- `app/api/fi/{cases,uploads,partners}/route.ts`
- `app/api/tenants/[tenantId]/{cases,cases/[caseId]/*,foundation-integrity,seed,pathology-requests/.../pdf}/route.ts`

All other `app/api/**/route.ts` files use **indirect** service role through imported `src/lib/*` modules.

---

## Appendix B — Raw `rg --count-matches` excerpt

The repository contains **more than 350** physical `supabaseAdmin(` occurrences; the excerpt below is **truncated** (first chunk from workspace ripgrep). Regenerate locally for a full paste into a spreadsheet.

```
# Run: rg "supabaseAdmin\(" --glob "*.{ts,tsx}" --count-matches
# (output truncated in docs — see CI artifact or local command)
```

---

## Related docs

- [`api-routes-inventory.md`](./api-routes-inventory.md)
- [`payment-webhook-idempotency.md`](./payment-webhook-idempotency.md)
- [`infrastructure-hardening-audit.md`](./infrastructure-hardening-audit.md)

---

*No broad refactors performed — maps only.*
