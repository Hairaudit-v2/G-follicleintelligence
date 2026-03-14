-- Add payload_json to fi_scorecards (versioned scorecard format)
alter table fi_scorecards add column if not exists payload_json jsonb default '{}';

-- Add config_json to fi_tenants (tenant-specific weight overrides)
alter table fi_tenants add column if not exists config_json jsonb default '{}';

create index if not exists idx_fi_scorecards_payload on fi_scorecards using gin (payload_json);
