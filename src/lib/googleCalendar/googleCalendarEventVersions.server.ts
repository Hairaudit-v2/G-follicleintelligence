import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CalendarEventOwnershipSource } from "@/src/lib/calendar/providers/calendarProviderAdapter";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type EventVersionRow = {
  id: string;
  tenant_id: string;
  provider: string;
  google_calendar_id: string;
  external_event_id: string;
  local_event_id: string | null;
  external_etag: string | null;
  external_updated_at: string | null;
  local_updated_at: string | null;
  ownership_source: CalendarEventOwnershipSource;
  last_synced_at: string | null;
  version_status: string;
  metadata: Record<string, unknown>;
};

export type UpsertEventVersionInput = {
  tenantId: string;
  googleCalendarId: string;
  externalEventId: string;
  localEventId?: string | null;
  externalEtag?: string | null;
  externalUpdatedAt?: string | null;
  localUpdatedAt?: string | null;
  ownershipSource: CalendarEventOwnershipSource;
  versionStatus: "synced" | "pending_local" | "pending_external" | "conflict";
};

/** Skip processing when etag and updated timestamp match the stored version. */
export function shouldProcessEventVersion(
  existing: EventVersionRow,
  externalEtag: string | null | undefined,
  externalUpdatedAt: string | null | undefined
): boolean {
  if (externalEtag?.trim() && existing.external_etag?.trim() === externalEtag.trim()) {
    return false;
  }
  if (externalUpdatedAt?.trim() && existing.external_updated_at?.trim()) {
    const incomingMs = Date.parse(externalUpdatedAt);
    const storedMs = Date.parse(existing.external_updated_at);
    if (!Number.isNaN(incomingMs) && !Number.isNaN(storedMs) && incomingMs <= storedMs) {
      return false;
    }
  }
  return true;
}

export async function upsertCalendarEventVersion(
  input: UpsertEventVersionInput,
  opts: ServerOpts = {}
): Promise<EventVersionRow> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("fi_calendar_event_versions")
    .select("*")
    .eq("tenant_id", input.tenantId.trim())
    .eq("provider", "google")
    .eq("google_calendar_id", input.googleCalendarId.trim())
    .eq("external_event_id", input.externalEventId.trim())
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);

  const payload = {
    tenant_id: input.tenantId.trim(),
    provider: "google",
    google_calendar_id: input.googleCalendarId.trim(),
    external_event_id: input.externalEventId.trim(),
    local_event_id: input.localEventId ?? null,
    external_etag: input.externalEtag ?? null,
    external_updated_at: input.externalUpdatedAt ?? null,
    local_updated_at: input.localUpdatedAt ?? null,
    ownership_source: input.ownershipSource,
    last_synced_at: now,
    version_status: input.versionStatus,
    updated_at: now,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("fi_calendar_event_versions")
      .update(payload)
      .eq("id", (existing as EventVersionRow).id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to update event version.");
    return data as EventVersionRow;
  }

  const { data, error } = await supabase
    .from("fi_calendar_event_versions")
    .insert({ ...payload, created_at: now, metadata: {} })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create event version.");
  return data as EventVersionRow;
}
