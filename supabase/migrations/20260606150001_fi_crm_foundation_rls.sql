-- Follicle Intelligence CRM foundation (Stage 2B): RLS + privileges for `fi_crm_*` tables.
--
-- Design: docs/design/17-crm-foundation-architecture.md,
--         docs/design/18-crm-foundation-implementation-checklist.md Phase 2.
--
-- Authenticated: tenant-scoped SELECT only (same pattern as `fi_foundation_rls.sql` /
-- `fi_tenant_org_clinic_settings`). No INSERT/UPDATE/DELETE policies for authenticated —
-- Phase 1 mutations stay on the service-role path (FI Admin server actions), not broad
-- client-side writes.
--
-- service_role: explicit SELECT + INSERT/UPDATE/DELETE so privileged server code can
-- mutate CRM rows while RLS remains enabled (Supabase service client uses this role).

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_crm_pipeline_stages enable row level security;
alter table fi_crm_leads enable row level security;
alter table fi_crm_lead_stage_history enable row level security;
alter table fi_crm_activity_events enable row level security;
alter table fi_crm_tasks enable row level security;
alter table fi_crm_notes enable row level security;
alter table fi_crm_messages enable row level security;
alter table fi_crm_quote_templates enable row level security;
alter table fi_crm_quotes enable row level security;
alter table fi_crm_lead_source_ids enable row level security;

-- ---------- fi_crm_pipeline_stages ----------
create policy fi_crm_pipeline_stages_select_tenant_member
  on fi_crm_pipeline_stages for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_pipeline_stages.tenant_id
    )
  );

-- ---------- fi_crm_leads ----------
create policy fi_crm_leads_select_tenant_member
  on fi_crm_leads for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_leads.tenant_id
    )
  );

-- ---------- fi_crm_lead_stage_history ----------
create policy fi_crm_lead_stage_history_select_tenant_member
  on fi_crm_lead_stage_history for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_lead_stage_history.tenant_id
    )
  );

-- ---------- fi_crm_activity_events ----------
create policy fi_crm_activity_events_select_tenant_member
  on fi_crm_activity_events for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_activity_events.tenant_id
    )
  );

-- ---------- fi_crm_tasks ----------
create policy fi_crm_tasks_select_tenant_member
  on fi_crm_tasks for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_tasks.tenant_id
    )
  );

-- ---------- fi_crm_notes ----------
create policy fi_crm_notes_select_tenant_member
  on fi_crm_notes for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_notes.tenant_id
    )
  );

-- ---------- fi_crm_messages ----------
create policy fi_crm_messages_select_tenant_member
  on fi_crm_messages for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_messages.tenant_id
    )
  );

-- ---------- fi_crm_quote_templates ----------
create policy fi_crm_quote_templates_select_tenant_member
  on fi_crm_quote_templates for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_quote_templates.tenant_id
    )
  );

-- ---------- fi_crm_quotes ----------
create policy fi_crm_quotes_select_tenant_member
  on fi_crm_quotes for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_quotes.tenant_id
    )
  );

-- ---------- fi_crm_lead_source_ids ----------
create policy fi_crm_lead_source_ids_select_tenant_member
  on fi_crm_lead_source_ids for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_lead_source_ids.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges: authenticated read-only; service_role full DML for server actions
-- ---------------------------------------------------------------------------
grant select on fi_crm_pipeline_stages to authenticated, service_role;
grant select on fi_crm_leads to authenticated, service_role;
grant select on fi_crm_lead_stage_history to authenticated, service_role;
grant select on fi_crm_activity_events to authenticated, service_role;
grant select on fi_crm_tasks to authenticated, service_role;
grant select on fi_crm_notes to authenticated, service_role;
grant select on fi_crm_messages to authenticated, service_role;
grant select on fi_crm_quote_templates to authenticated, service_role;
grant select on fi_crm_quotes to authenticated, service_role;
grant select on fi_crm_lead_source_ids to authenticated, service_role;

grant insert, update, delete on fi_crm_pipeline_stages to service_role;
grant insert, update, delete on fi_crm_leads to service_role;
grant insert, update, delete on fi_crm_lead_stage_history to service_role;
grant insert, update, delete on fi_crm_activity_events to service_role;
grant insert, update, delete on fi_crm_tasks to service_role;
grant insert, update, delete on fi_crm_notes to service_role;
grant insert, update, delete on fi_crm_messages to service_role;
grant insert, update, delete on fi_crm_quote_templates to service_role;
grant insert, update, delete on fi_crm_quotes to service_role;
grant insert, update, delete on fi_crm_lead_source_ids to service_role;
