import "server-only";

import {
  calendarDateStringFromInstant,
  resolveTenantCalendarTimezone,
} from "@/src/lib/calendar/calendarTimezone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { autoCloseOpenPunchesForTenant } from "./staffTimeClock.server";
import { loadWorkforceTimeClockPolicy } from "./staffTimeClockPolicy.server";

export async function runWorkforceTimeClockAutoCloseCron(): Promise<{
  tenantsProcessed: number;
  punchesClosed: number;
}> {
  const supabase = supabaseAdmin();
  const { data: tenants, error } = await supabase.from("fi_tenants").select("id");
  if (error) throw new Error(error.message);

  let tenantsProcessed = 0;
  let punchesClosed = 0;

  for (const t of tenants ?? []) {
    const tenantId = String((t as { id: string }).id);
    const policy = await loadWorkforceTimeClockPolicy(tenantId, supabase);
    if (!policy.autoCloseEnabled) continue;

    const { data: settings } = await supabase
      .from("fi_tenant_settings")
      .select("default_timezone, metadata")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const tz = resolveTenantCalendarTimezone(
      settings as { default_timezone?: string | null; metadata?: Record<string, unknown> | null } | null
    );
    const today = calendarDateStringFromInstant(new Date(), tz);

    const result = await autoCloseOpenPunchesForTenant({
      tenantId,
      beforeWorkDate: today,
      autoCloseLocalHour: policy.autoCloseLocalHour,
      timeZone: tz,
      client: supabase,
    });
    if (result.closed > 0) tenantsProcessed += 1;
    punchesClosed += result.closed;
  }

  return { tenantsProcessed, punchesClosed };
}