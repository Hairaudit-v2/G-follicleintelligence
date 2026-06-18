import { z } from "zod";

/**
 * Inbound HubSpot timeline-sync webhook payloads (Phase 1).
 *
 * Schemas are permissive (`.passthrough()`) on purpose: HubSpot sends rich, evolving property
 * bags and we never want an unexpected extra field to 400 a delivery. Known identity/activity
 * fields are typed; everything else is preserved and stored in the timeline event metadata.
 */

const identityFields = {
  /** HubSpot contact (record) id — maps to fi_person_source_ids(source_system='hubspot'). */
  hubspot_contact_id: z.string().trim().min(1).max(120).optional(),
  /** Contact email — used for fallback identity match against fi_persons.metadata.email_normalized. */
  email: z.string().trim().max(320).optional(),
  /** Existing FI CRM lead link (when the caller already knows it). */
  crm_lead_id: z.string().uuid().optional(),
};

const activityFields = {
  event_type: z.string().trim().min(1).max(120).optional(),
  /** ISO 8601 timestamp of the activity; defaults to now() when absent. */
  occurred_at: z.string().trim().min(1).max(40).optional(),
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().max(8000).optional(),
};

export const hubspotContactWebhookSchema = z
  .object({
    ...identityFields,
    ...activityFields,
    properties: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const hubspotEmailEventWebhookSchema = z
  .object({
    ...identityFields,
    ...activityFields,
    /** HubSpot email event id — globally unique; used as the dedupe key. */
    email_event_id: z.string().trim().min(1).max(200),
    email_address: z.string().trim().max(320).optional(),
    subject: z.string().trim().max(500).optional(),
  })
  .passthrough();

export const hubspotDealWebhookSchema = z
  .object({
    ...identityFields,
    ...activityFields,
    /** HubSpot deal id — maps to fi_crm_lead_source_ids(source_system='hubspot_deal'). */
    hubspot_deal_id: z.string().trim().min(1).max(120),
    /** Zapier alias for hubspot_contact_id. */
    contact_id: z.string().trim().min(1).max(120).optional(),
    /** Zapier alias for deal_stage. */
    stage: z.string().trim().max(200).optional(),
    deal_stage: z.string().trim().max(200).optional(),
    deal_name: z.string().trim().max(500).optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    deposit_amount: z.union([z.string(), z.number()]).optional(),
    procedure_type: z.string().trim().max(200).optional(),
    close_date: z.string().trim().max(40).optional(),
  })
  .passthrough();

export type HubspotContactWebhookPayload = z.infer<typeof hubspotContactWebhookSchema>;
export type HubspotEmailEventWebhookPayload = z.infer<typeof hubspotEmailEventWebhookSchema>;
export type HubspotDealWebhookPayload = z.infer<typeof hubspotDealWebhookSchema>;
