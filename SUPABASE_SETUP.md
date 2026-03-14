# Supabase Setup for Follicle Intelligence

## 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in values. See `.env.example` for Supabase URL, anon key, service role key, and storage bucket names.

**Note:** Migrations 20250220000001–000006 define the schema. If you previously ran older migrations, run `supabase db reset` or create a fresh project.

## 2. Storage Bucket

Create the `fi-intakes` bucket in Supabase:

1. Supabase Dashboard → Storage
2. New bucket: `fi-intakes` (private)
3. Service role bypasses RLS

## 3. Run Migrations

```bash
# With Supabase CLI
supabase db push

# Or run SQL manually in Supabase SQL Editor (in order):
# - 20250220000001_fi_tenants_users.sql
# - 20250220000002_fi_cases_intakes.sql
# - 20250220000003_fi_uploads.sql
# - 20250220000004_fi_signals.sql
# - 20250220000005_fi_model_runs_scorecards_reports.sql
# - 20250220000006_fi_audits.sql
# - 20250220000007_fi_scorecard_tenant_config.sql
```

## 4. Seed a Tenant (for testing)

```sql
insert into fi_tenants (name, slug) values ('Demo Tenant', 'demo');
```

Use the returned `id` for API calls: `/api/tenants/{tenant_id}/cases`

## 5. API Endpoints

| Endpoint                                           | Method | Purpose                                                    |
| -------------------------------------------------- | ------ | ---------------------------------------------------------- |
| `/api/tenants/[tenantId]/cases`                    | POST   | Create case (idempotent with `external_id`)                |
| `/api/tenants/[tenantId]/cases/[caseId]/uploads`   | POST   | Upload files (FormData: `type`, `files`) — canonical types |
| `/api/tenants/[tenantId]/cases/[caseId]/submit`    | POST   | Submit case for processing                                 |
| `/api/tenants/[tenantId]/cases/[caseId]/run-model` | POST   | Run model pipeline                                         |
| `/api/tenants/[tenantId]/tick-jobs`                | POST   | Process queued jobs                                        |
