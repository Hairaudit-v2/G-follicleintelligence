-- CalendarOS GC-10 — seed FI Event Bus subscribers for CalendarOS operational events.

insert into public.fi_platform_event_subscribers (
  tenant_id,
  subscriber_key,
  source_module,
  event_name,
  target_module,
  handler_key,
  is_enabled,
  retry_limit,
  metadata
)
select
  null,
  v.subscriber_key,
  'calendar_os',
  v.event_name,
  v.target_module,
  v.handler_key,
  true,
  3,
  '{}'::jsonb
from (
  values
    ('analytics-calendar-event-created', 'calendar.event.created', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-event-updated', 'calendar.event.updated', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-event-cancelled', 'calendar.event.cancelled', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-event-deleted', 'calendar.event.deleted', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-sync-started', 'calendar.sync.started', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-sync-completed', 'calendar.sync.completed', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-sync-failed', 'calendar.sync.failed', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-webhook-received', 'calendar.webhook.received', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-webhook-sub-created', 'calendar.webhook.subscription.created', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-webhook-sub-renewed', 'calendar.webhook.subscription.renewed', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-webhook-sub-expired', 'calendar.webhook.subscription.expired', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-reconcile-conflict', 'calendar.reconciliation.conflict_detected', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('analytics-calendar-review-item-created', 'calendar.review_item.created', 'analytics_os', 'analytics.calendarEventCaptured'),
    ('notifications-calendar-conflict', 'calendar.reconciliation.conflict_detected', 'notifications_os', 'notifications.calendarConflictDetected'),
    ('audit-calendar-webhook-received', 'calendar.webhook.received', 'audit_os', 'audit.calendarWebhookReceived')
) as v (subscriber_key, event_name, target_module, handler_key)
on conflict do nothing;
