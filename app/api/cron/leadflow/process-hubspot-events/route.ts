/**
 * GET /api/cron/leadflow/process-hubspot-events
 * LeadFlowOS LF-2C: Vercel Cron wrapper to drain pending HubSpot fi_external_events.
 * Authorisation: Bearer `CRON_SECRET` or `FI_LEADFLOW_CRON_SECRET`, or header `x-fi-leadflow-secret`.
 */
import { NextRequest } from "next/server";

import { handleLeadFlowHubspotEventsCronGet } from "@/src/lib/leadFlow/leadflowHubspotEventsCron.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handleLeadFlowHubspotEventsCronGet(req);
}
