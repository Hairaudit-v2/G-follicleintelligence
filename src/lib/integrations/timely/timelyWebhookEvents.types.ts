/** Stored row shape for `fi_integration_webhook_events` (shared server + admin UI). */
export type FiIntegrationWebhookEventRow = {
  id: string;
  tenant_id: string;
  provider: string;
  event_type: string;
  route: string;
  status: string;
  payload: unknown;
  payload_hash: string | null;
  error_message: string | null;
  created_at: string;
};
