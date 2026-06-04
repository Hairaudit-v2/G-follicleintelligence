-- Stage 5A: Case / treatment profile columns for FI Admin CMS (CRM ↔ SurgeryOS bridge).
-- treatment_type: operator-facing procedure / pathway label (free text).
-- planning_notes: pre-operative planning context (not graft counts — deferred to Stage 5B).

alter table fi_cases add column if not exists treatment_type text;
alter table fi_cases add column if not exists planning_notes text;

comment on column fi_cases.treatment_type is 'Stage 5A: optional treatment / pathway label for tenant case profile.';
comment on column fi_cases.planning_notes is 'Stage 5A: high-level planning notes (not surgical graft planning).';
