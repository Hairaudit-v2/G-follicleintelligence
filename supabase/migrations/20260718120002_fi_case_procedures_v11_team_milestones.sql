-- Case Procedure Day V1.1: structured nurse / technician assignments + milestone timestamps.

alter table fi_case_procedures
  add column if not exists nurse_user_id uuid references fi_users (id) on delete set null;

alter table fi_case_procedures
  add column if not exists technician_user_ids jsonb not null default '[]'::jsonb;

alter table fi_case_procedures
  add column if not exists procedure_milestones jsonb not null default '{}'::jsonb;

comment on column fi_case_procedures.nurse_user_id is
  'Primary circulating / recovery nurse (fi_users) for procedure day V1.1.';

comment on column fi_case_procedures.technician_user_ids is
  'Surgical technicians / assistants (fi_users ids, JSON array) for procedure day V1.1.';

comment on column fi_case_procedures.procedure_milestones is
  'Map of milestone key -> completed-at ISO timestamp (object JSON). Keys are app-defined.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'fi_case_procedures'
      and c.conname = 'fi_case_procedures_technician_ids_array'
  ) then
    alter table fi_case_procedures
      add constraint fi_case_procedures_technician_ids_array check (jsonb_typeof (technician_user_ids) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'fi_case_procedures'
      and c.conname = 'fi_case_procedures_milestones_object'
  ) then
    alter table fi_case_procedures
      add constraint fi_case_procedures_milestones_object check (jsonb_typeof (procedure_milestones) = 'object');
  end if;
end $$;
