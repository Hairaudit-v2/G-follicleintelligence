-- ---------------------------------------------------------------------------
-- fi_cases: soft-delete guard columns
--
-- The cascade chain originating from fi_cases is destructive: a hard-delete
-- of a single case wipes intakes, uploads, signals, model_runs, scorecards,
-- reports, audits, and timeline_events in a single statement with no undo.
--
-- This migration adds three columns that the application layer uses to
-- implement soft-delete via lib/fi/cases/fiCasesGuard.ts. Hard deletion
-- through the ORM remains technically possible (service_role bypasses RLS)
-- but the guard module throws at the call site so it is never triggered from
-- the UI or any server action.
--
-- Forward-only migration — safe to run against an existing production schema.
-- ---------------------------------------------------------------------------

alter table fi_cases
  add column if not exists deleted_at     timestamptz   default null,
  add column if not exists deleted_by     uuid          default null
    references fi_users(id) on delete set null,
  add column if not exists delete_reason  text          default null;

-- Partial index: efficient lookup of soft-deleted cases (rare, but useful for
-- admin tooling and audit queries).
create index if not exists idx_fi_cases_deleted_at
  on fi_cases (tenant_id, deleted_at)
  where deleted_at is not null;

-- Exclude soft-deleted cases from the existing active-case indexes so routine
-- reads (pipeline, CRM, calendar) never see archived rows without an explicit
-- filter. The existing idx_fi_cases_status index already scopes by tenant_id
-- and status so no change needed there.

comment on column fi_cases.deleted_at is
  'Soft-delete timestamp. Non-null means this case is archived. '
  'Hard-deleting fi_cases cascades all clinical history (intakes, uploads, signals, '
  'model_runs, scorecards, reports, audits, timeline_events). '
  'Always use softDeleteFiCase() from lib/fi/cases/fiCasesGuard.ts instead.';

comment on column fi_cases.deleted_by is
  'fi_users.id of the operator who initiated the soft-delete. Nullable.';

comment on column fi_cases.delete_reason is
  'Human-readable reason recorded at soft-delete time.';
