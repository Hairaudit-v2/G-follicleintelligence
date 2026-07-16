/**
 * GET /api/cron/hubspot/incremental-notes-backup
 * Stage P3 — Vercel Cron scheduled HubSpot notes incremental backup.
 */
import { NextRequest } from "next/server";

import { handleHubspotIncrementalNotesBackupCronGet } from "@/src/lib/onboarding-os/hubspotIncrementalNotesBackupCron.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  return handleHubspotIncrementalNotesBackupCronGet(req);
}
