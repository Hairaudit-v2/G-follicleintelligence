-- P0 hardening: webhook idempotency.
-- Enforce a single inbound webhook row per (tenant_id, route, payload_hash) so duplicate or
-- retried Zapier deliveries can be detected and short-circuited (HTTP 200) instead of re-running
-- side effects (booking / consultation / CRM writes).
--
-- Safe against historical duplicates: before creating the unique index we collapse the
-- payload_hash of older duplicate rows to NULL. The rows themselves are retained for audit, and
-- because the index is partial (payload_hash IS NOT NULL) the nulled rows are simply excluded.

update fi_integration_webhook_events e
set payload_hash = null
from (
  select id,
         row_number() over (
           partition by tenant_id, route, payload_hash
           order by created_at asc, id asc
         ) as rn
  from fi_integration_webhook_events
  where payload_hash is not null
) ranked
where e.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists uq_fi_integration_webhook_events_idempotency
  on fi_integration_webhook_events (tenant_id, route, payload_hash)
  where payload_hash is not null;

comment on index uq_fi_integration_webhook_events_idempotency is
  'Idempotency guard: at most one inbound webhook row per tenant+route+payload_hash; blocks duplicate/retried Zapier deliveries.';
