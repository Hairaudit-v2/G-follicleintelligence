import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TIMELY = "timely";
const ENTITY_BOOKING = "booking";

export type TimelyZapierRecentImportRow = {
  external_id: string;
  booking_id: string;
  created_at: string;
  booking_start_at: string | null;
  booking_title: string | null;
};

export type TimelyZapierLastAppointment = {
  created_at: string;
  external_id: string;
  booking_id: string;
  booking_start_at: string | null;
  booking_title: string | null;
} | null;

export type TimelyZapierIntegrationSetup = {
  webhookSecretConfigured: boolean;
  timelyMappingsTotal: number;
  timelyPatientsSynced: number;
  timelyAppointmentsSynced: number;
  lastAppointment: TimelyZapierLastAppointment;
  recentBookingImports: TimelyZapierRecentImportRow[];
};

export async function loadTimelyZapierIntegrationSetup(tenantId: string): Promise<TimelyZapierIntegrationSetup> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const webhookSecretConfigured = Boolean(process.env.FI_TIMELY_WEBHOOK_SECRET?.trim());

  const mappingsQ = supabase
    .from("fi_external_entity_mappings")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("source_system", TIMELY);

  const patientsQ = supabase
    .from("fi_patient_source_ids")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("source_system", TIMELY);

  const appointmentsQ = supabase
    .from("fi_external_entity_mappings")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("source_system", TIMELY)
    .eq("entity_type", ENTITY_BOOKING);

  const [{ count: mappingsTotal, error: e1 }, { count: patientsCount, error: e2 }, { count: appointmentsCount, error: e3 }] =
    await Promise.all([mappingsQ, patientsQ, appointmentsQ]);

  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  if (e3) throw new Error(e3.message);

  const { data: lastRows, error: eLast } = await supabase
    .from("fi_external_entity_mappings")
    .select("created_at, external_id, internal_id")
    .eq("tenant_id", tid)
    .eq("source_system", TIMELY)
    .eq("entity_type", ENTITY_BOOKING)
    .order("created_at", { ascending: false })
    .limit(1);
  if (eLast) throw new Error(eLast.message);

  const lastMap = (lastRows ?? [])[0] as { created_at: string; external_id: string; internal_id: string } | undefined;

  let lastAppointment: TimelyZapierLastAppointment = null;
  if (lastMap) {
    const bid = String(lastMap.internal_id);
    const { data: bRow } = await supabase
      .from("fi_bookings")
      .select("start_at, title")
      .eq("tenant_id", tid)
      .eq("id", bid)
      .maybeSingle();
    const b = bRow as { start_at?: string; title?: string | null } | null;
    lastAppointment = {
      created_at: String(lastMap.created_at),
      external_id: String(lastMap.external_id),
      booking_id: bid,
      booking_start_at: b?.start_at != null ? String(b.start_at) : null,
      booking_title: b?.title != null ? String(b.title) : null,
    };
  }

  const { data: recentMaps, error: eRecent } = await supabase
    .from("fi_external_entity_mappings")
    .select("created_at, external_id, internal_id")
    .eq("tenant_id", tid)
    .eq("source_system", TIMELY)
    .eq("entity_type", ENTITY_BOOKING)
    .order("created_at", { ascending: false })
    .limit(20);
  if (eRecent) throw new Error(eRecent.message);

  const maps = (recentMaps ?? []) as { created_at: string; external_id: string; internal_id: string }[];
  const bookingIds = Array.from(new Set(maps.map((m) => String(m.internal_id)).filter(Boolean)));
  const bookingById = new Map<string, { start_at: string | null; title: string | null }>();
  if (bookingIds.length > 0) {
    const { data: bookings, error: eB } = await supabase
      .from("fi_bookings")
      .select("id, start_at, title")
      .eq("tenant_id", tid)
      .in("id", bookingIds);
    if (eB) throw new Error(eB.message);
    for (const row of (bookings ?? []) as { id: string; start_at: string; title: string | null }[]) {
      bookingById.set(String(row.id), {
        start_at: row.start_at != null ? String(row.start_at) : null,
        title: row.title != null ? String(row.title) : null,
      });
    }
  }

  const recentBookingImports: TimelyZapierRecentImportRow[] = maps.map((m) => {
    const bid = String(m.internal_id);
    const b = bookingById.get(bid);
    return {
      external_id: String(m.external_id),
      booking_id: bid,
      created_at: String(m.created_at),
      booking_start_at: b?.start_at ?? null,
      booking_title: b?.title ?? null,
    };
  });

  return {
    webhookSecretConfigured,
    timelyMappingsTotal: mappingsTotal ?? 0,
    timelyPatientsSynced: patientsCount ?? 0,
    timelyAppointmentsSynced: appointmentsCount ?? 0,
    lastAppointment,
    recentBookingImports,
  };
}
