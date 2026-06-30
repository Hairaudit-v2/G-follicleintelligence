import "server-only";

import { insertFiExternalEvent } from "@/src/lib/leadFlow/leadFlowFoundation.server";
import type { FiExternalEventRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import {
  computeHubSpotLeadFlowProviderEventId,
  flattenHubSpotLeadFlowWebhookBody,
  resolveHubSpotContactObjectId,
  resolveHubSpotDealObjectId,
  resolveHubSpotLeadFlowEventType,
} from "@/src/lib/leadFlow/hubspotLeadFlowCore";

export type QueueHubSpotLeadFlowWebhookResult = {
  queued: number;
  duplicates: number;
  events: Array<{ id: string; duplicate: boolean; provider_event_id: string }>;
};

export async function queueHubSpotLeadFlowWebhookEvents(
  tenantId: string,
  body: unknown
): Promise<QueueHubSpotLeadFlowWebhookResult> {
  const items = flattenHubSpotLeadFlowWebhookBody(body);
  const events: QueueHubSpotLeadFlowWebhookResult["events"] = [];
  let queued = 0;
  let duplicates = 0;

  for (const payload of items) {
    const eventType = resolveHubSpotLeadFlowEventType(payload);
    const providerEventId = computeHubSpotLeadFlowProviderEventId(tenantId, payload, eventType);
    const externalId =
      resolveHubSpotContactObjectId(payload) ?? resolveHubSpotDealObjectId(payload);

    const inserted = await insertFiExternalEvent({
      tenantId,
      provider: "hubspot",
      eventType,
      externalId,
      providerEventId,
      payloadJson: payload,
      status: "pending",
    });

    const row: FiExternalEventRow | null = inserted.row;
    if (!row?.id) continue;

    events.push({ id: row.id, duplicate: inserted.duplicate, provider_event_id: providerEventId });
    if (inserted.duplicate) duplicates += 1;
    else queued += 1;
  }

  return { queued, duplicates, events };
}
