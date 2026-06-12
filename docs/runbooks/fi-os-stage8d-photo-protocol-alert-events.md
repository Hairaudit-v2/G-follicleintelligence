# FI OS Stage 8D — Photo protocol alert events (persisted)

## Purpose

Stage 8D turns **computed** Smart Clinical Photography alerts (`protocolAlerts.ts`) into **persisted, idempotent** operational records in `hli_photo_protocol_alert_events`, with FoundationOS UI for triage (acknowledge / resolve / dismiss), deep links back to Patient Twin / analytics anchors, and stubs for future delivery (email / Slack / webhooks). HairAudit and Hair Longevity remain compatible via `source_system` and thin adapter modules — **no duplicate alert rule engines**.

## Migration

- **File**: `supabase/migrations/20260801120001_fi_os_stage8d_photo_protocol_alert_events.sql`
- **Table**: `public.hli_photo_protocol_alert_events`

Key fields: `source_system`, `source_record_id`, `tenant_id`, `clinic_id`, `patient_id`, `case_id`, `protocol_session_id` (FK → `hli_photo_protocol_sessions`), `alert_type`, `severity`, `status`, `message`, `recommended_action`, `payload`, `idempotency_key` (unique), detection timestamps, acknowledgement / resolution actor FKs to `fi_users`, `created_at` / `updated_at`.

Check constraints match application enums (`source_system`, `alert_type`, `severity`, `status`).

**RLS**: `service_role` full DML; `authenticated` **select** and **update** when `tenant_id` is set and `fi_os_can_select_clinical_intelligence_tenant_data(tenant_id)` (same gate as Stage 5 clinical intelligence events — tenant members + platform read roles). Inserts are expected from server-side jobs using the service role.

## Idempotency strategy

- **Key generator** (pure): `buildPhotoProtocolAlertIdempotencyKey` in `protocolAlertEventsPure.ts`.
- **Stable parts**: `v1`, `source_system`, `tenant:{uuid|global}`, `session:{uuid}`, `type:{alert_type}`, `patient:{id|-}`, `case:{id|-}`, `src:{source_record_id|-}`.
- **Upsert**: `upsertPhotoProtocolAlertEventsForTenant` recomputes alerts, merges with existing rows on `idempotency_key`, and upserts so **one row per logical alert**. `last_detected_at`, `message`, `recommended_action`, `payload`, and `severity` refresh on each run; **workflow status** (`acknowledged`, `resolved`, `dismissed`) is preserved until operators change it via actions.

## Alert lifecycle

| Status        | Meaning |
|---------------|---------|
| `open`        | Active; shown as needing attention. |
| `acknowledged`| Operator saw it; condition may still exist. |
| `resolved`    | Treated as closed operationally. |
| `dismissed`   | Suppressed / not actionable; still refreshed in place if the computed alert persists. |

Transitions are enforced in `assertPhotoProtocolAlertStatusTransition` (acknowledge from `open`; resolve from `open` or `acknowledged`; dismiss from any).

## Manual refresh

- **FoundationOS UI**: `PhotoProtocolAlertEventsTable` → **Refresh alerts** calls `refreshPhotoProtocolAlertsAction` → `upsertPhotoProtocolAlertEventsForTenant`.
- **Cron (optional)**: `POST` or `GET` `/api/cron/fi-photo-protocol-alerts` with Bearer `FI_PHOTO_PROTOCOL_ALERTS_CRON_SECRET` or `CRON_SECRET` (or header `x-fi-photo-protocol-alerts-secret`). Optional query `tenantId=<uuid>` scopes to one tenant; otherwise all `fi_tenants` (capped at 500) are processed sequentially.

## Future cron / delivery path

1. **Cron** (or Edge worker) calls `upsertPhotoProtocolAlertEventsForTenant` on a schedule (native Vercel cron can reuse `CRON_SECRET` if listed in the route’s allowed secrets).
2. **Delivery worker** reads `hli_photo_protocol_alert_events` where `shouldDeliverPhotoProtocolAlert(ev, channel)` is true (Stage 8D stub: `in_app` + `open` only).
3. Use `buildPhotoProtocolAlertDeliveryPayload` for a normalised envelope (title/body/deep links).
4. Record sends in a **future** `hli_photo_protocol_alert_deliveries` table (not in Stage 8D).

## FoundationOS UI manual test

1. Open `/fi-admin/{tenantId}/foundation-integrity` as a tenant user with write access.
2. Confirm **Clinical photography protocol** KPIs still render (Stage 8C).
3. Under **Persisted protocol alerts**, click **Refresh alerts** — expect rows when incomplete sessions / rules fire.
4. Use **Open Twin** — URL must end with `#smart-photo-protocol` and scroll to the Smart Photography Protocol card.
5. **Acknowledge** / **Resolve** / **Dismiss** — row status updates after `router.refresh()`.
6. **Analytics anchor** link should land on `#fi-os-photo-protocol-analytics`.

## HairAudit / Hair Longevity compatibility

- Rows carry `source_system` (`fi_os`, `hairaudit`, `hair_longevity`).
- Adapters: `hairAuditPhotoProtocolAlertEvents.server.ts`, `hairLongevityPhotoProtocolAlertEvents.server.ts` — filter upserts/loads by `source_system` only; rules stay in `protocolAlerts.ts`.

## Intentionally not included

- Donor density analysis, Norwood/Ludwig/Sinclair grading, outcome prediction.
- Real email/Slack/webhook sends (stubs only).
- Automatic “re-open” of `resolved` alerts when conditions recur (preserved by design in Stage 8D upsert merge).

## Recommended Stage 8E prompt

> Stage 8E — Photo protocol alert **delivery**: add `hli_photo_protocol_alert_deliveries` (channel, status, error, sent_at), wire `shouldDeliverPhotoProtocolAlert` to enqueue rows after upsert, integrate Resend/Slack with idempotent send per `(alert_event_id, channel)`, and add operator toggles per tenant for channels + quiet hours. Keep persistence in Stage 8D tables; do not duplicate `protocolAlerts.ts` rules.
