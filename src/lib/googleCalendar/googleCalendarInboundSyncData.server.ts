import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { FiCalendarIntegration } from "./googleCalendarTypes";

export type GoogleInboundCalendarScope = {
  calendarId: string;
  summary: string | null;
  isPrimary: boolean;
  inboundRowId: string | null;
};

type InboundSyncCalendarRow = {
  id: string;
  google_calendar_id: string;
  google_calendar_summary: string | null;
  is_primary: boolean;
};

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

/** Enabled inbound Google calendars for an integration; falls back to integration primary when none configured. */
export async function getGoogleInboundCalendarScopesForIntegration(
  integration: FiCalendarIntegration,
  opts: ServerOpts = {}
): Promise<GoogleInboundCalendarScope[]> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_calendar_inbound_sync_calendars")
    .select("id, google_calendar_id, google_calendar_summary, is_primary")
    .eq("integration_id", integration.id)
    .eq("tenant_id", integration.tenantId)
    .eq("is_enabled", true)
    .order("is_primary", { ascending: false })
    .order("google_calendar_summary", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as InboundSyncCalendarRow[];
  if (rows.length === 0) {
    const fallbackId = integration.calendarId.trim() || "primary";
    return [
      {
        calendarId: fallbackId,
        summary: integration.googleAccountEmail?.trim() || (fallbackId === "primary" ? "primary" : fallbackId),
        isPrimary: true,
        inboundRowId: null,
      },
    ];
  }

  return rows.map((row) => ({
    calendarId: row.google_calendar_id.trim(),
    summary: row.google_calendar_summary?.trim() ?? null,
    isPrimary: row.is_primary,
    inboundRowId: row.id,
  }));
}

export async function touchInboundSyncCalendarLastSynced(
  inboundRowId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<void> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_inbound_sync_calendars")
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", inboundRowId)
    .eq("tenant_id", tenantId.trim());

  if (error) throw new Error(error.message);
}
