import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenantCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { resolveGoogleCalendarAccessToken } from "@/src/lib/googleCalendar/googleCalendarAuth.server";
import { getGoogleInboundCalendarScopesForIntegration } from "@/src/lib/googleCalendar/googleCalendarInboundSyncData.server";
import { syncGoogleCalendarEvents } from "@/src/lib/googleCalendar/googleCalendarService.server";
import type { GoogleCalendarSyncResult } from "@/src/lib/googleCalendar/googleCalendarTypes";
import { revalidateLiveDataSurfacesForTenant } from "@/src/lib/integrations/revalidateLiveDataPaths.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  bookingsOverlapByTitleAndStart,
  buildDryRunSummaryFromSyncResult,
  buildGoogleCalendarBackfillDiagnosticsPatch,
  buildGoogleCalendarBookingMetadata,
  buildWriteSummaryFromSyncAndBookings,
  detectGoogleCalendarExternalSource,
  looksLikeGoogleCalendarAppointment,
  mapGoogleEventTypeToBookingType,
  matchPatientByEventTitle,
  resolveGoogleCalendarBackfillDateRange,
  type GoogleCalendarBackfillDryRunSummary,
  type GoogleCalendarBackfillWriteSummary,
} from "./googleCalendarBackfillCore";

const GOOGLE_CALENDAR_BOOKING_SOURCE = "google_calendar";
const BOOKING_ENTITY = "booking";

export type RunGoogleCalendarBackfillInput = {
  tenantId: string;
  clinicId?: string | null;
  calendarSourceId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dryRun?: boolean;
  promoteSafeBookings?: boolean;
  skipRevalidation?: boolean;
};

export type GoogleCalendarBackfillResult =
  | {
      ok: true;
      dryRun: boolean;
      rangeStart: string;
      rangeEnd: string;
      timeZone: string;
      summary: GoogleCalendarBackfillDryRunSummary | GoogleCalendarBackfillWriteSummary;
      syncResult: GoogleCalendarSyncResult;
      warnings: string[];
    }
  | { ok: false; error: string; warnings?: string[] };

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
  now?: Date;
};

type BookingPromotionCounters = {
  createdBookings: number;
  updatedBookings: number;
  sentToReview: number;
  skippedDuplicates: number;
};

async function loadTenantTimeZone(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("default_timezone, metadata")
    .eq("id", tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return resolveTenantCalendarTimezone(
    (data as { default_timezone?: string | null; metadata?: Record<string, unknown> | null } | null) ??
      null
  );
}

async function loadActiveIntegration(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ id: string; calendar_id: string } | null> {
  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .select("id, calendar_id, status, access_token_encrypted, refresh_token_encrypted")
    .eq("tenant_id", tenantId.trim())
    .neq("status", "disconnected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    id: string;
    calendar_id: string;
    access_token_encrypted?: string | null;
    refresh_token_encrypted?: string | null;
  };
  if (!row.access_token_encrypted?.trim() && !row.refresh_token_encrypted?.trim()) return null;
  return { id: row.id, calendar_id: row.calendar_id };
}

async function persistBackfillDiagnostics(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { data: healthRow, error: loadError } = await supabase
    .from("fi_calendar_sync_health")
    .select("id, metadata")
    .eq("tenant_id", tenantId.trim())
    .eq("integration_id", integrationId.trim())
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);

  const existingMeta =
    healthRow &&
    typeof (healthRow as { metadata?: unknown }).metadata === "object" &&
    !Array.isArray((healthRow as { metadata?: unknown }).metadata)
      ? ((healthRow as { metadata: Record<string, unknown> }).metadata ?? {})
      : {};

  const merged = { ...existingMeta, ...patch };

  if (healthRow) {
    const { error } = await supabase
      .from("fi_calendar_sync_health")
      .update({ metadata: merged, updated_at: new Date().toISOString() })
      .eq("id", (healthRow as { id: string }).id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("fi_calendar_sync_health").insert({
    tenant_id: tenantId.trim(),
    integration_id: integrationId.trim(),
    provider: "google",
    metadata: merged,
  });
  if (error) throw new Error(error.message);
}

async function loadPatientNameCandidates(
  supabase: SupabaseClient,
  tenantId: string
): Promise<
  { patientId: string; personId: string; displayName: string; leadId: string | null }[]
> {
  const { data: patients, error: pErr } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim());
  if (pErr) throw new Error(pErr.message);
  if (!patients?.length) return [];

  const patientRows = patients as { id: string; person_id: string }[];
  const patientIds = patientRows.map((p) => p.id);

  const { data: members, error: mErr } = await supabase
    .from("fi_network_subject_members")
    .select("patient_id, network_subject_id")
    .eq("tenant_id", tenantId.trim())
    .eq("membership_status", "active")
    .in("patient_id", patientIds);
  if (mErr) throw new Error(mErr.message);

  const subjectIds = [
    ...new Set(
      ((members ?? []) as { network_subject_id: string }[]).map((m) => m.network_subject_id)
    ),
  ];
  const labelBySubject = new Map<string, string>();
  if (subjectIds.length) {
    const { data: subjects, error: sErr } = await supabase
      .from("fi_network_subjects")
      .select("id, display_label")
      .in("id", subjectIds);
    if (sErr) throw new Error(sErr.message);
    for (const row of (subjects ?? []) as { id: string; display_label: string | null }[]) {
      const label = row.display_label?.trim();
      if (label) labelBySubject.set(row.id, label);
    }
  }

  const labelByPatient = new Map<string, string>();
  for (const member of (members ?? []) as {
    patient_id: string;
    network_subject_id: string;
  }[]) {
    const label = labelBySubject.get(member.network_subject_id);
    if (label) labelByPatient.set(member.patient_id, label);
  }

  const personIds = patientRows.map((p) => p.person_id);
  const leadByPerson = new Map<string, string>();
  if (personIds.length) {
    const { data: leads, error: lErr } = await supabase
      .from("fi_crm_leads")
      .select("id, person_id, status")
      .eq("tenant_id", tenantId.trim())
      .in("person_id", personIds);
    if (lErr) throw new Error(lErr.message);
    for (const lead of (leads ?? []) as { id: string; person_id: string; status: string }[]) {
      const status = lead.status.trim().toLowerCase();
      if (status === "archived" || status === "lost" || status === "converted") continue;
      if (!leadByPerson.has(lead.person_id)) {
        leadByPerson.set(lead.person_id, lead.id);
      }
    }
  }

  return patientRows
    .map((p) => {
      const displayName = labelByPatient.get(p.id);
      if (!displayName) return null;
      return {
        patientId: p.id,
        personId: p.person_id,
        displayName,
        leadId: leadByPerson.get(p.person_id) ?? null,
      };
    })
    .filter(Boolean) as {
    patientId: string;
    personId: string;
    displayName: string;
    leadId: string | null;
  }[];
}

async function loadBookingsInRange(
  supabase: SupabaseClient,
  tenantId: string,
  timeMin: string,
  timeMax: string,
  clinicId?: string | null
): Promise<{ id: string; title: string | null; start_at: string; booking_status: string }[]> {
  let query = supabase
    .from("fi_bookings")
    .select("id, title, start_at, booking_status")
    .eq("tenant_id", tenantId.trim())
    .lt("start_at", timeMax)
    .gt("end_at", timeMin);

  if (clinicId?.trim()) {
    query = query.eq("clinic_id", clinicId.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    title: string | null;
    start_at: string;
    booking_status: string;
  }[];
}

async function loadCalendarEventsInRange(
  supabase: SupabaseClient,
  tenantId: string,
  timeMin: string,
  timeMax: string,
  calendarSourceId?: string | null
) {
  let query = supabase
    .from("fi_calendar_events")
    .select(
      "id, external_event_id, calendar_id, title, start_time, end_time, event_type, patient_id, lead_id, metadata"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("provider", "google")
    .lt("start_time", timeMax)
    .gt("end_time", timeMin);

  if (calendarSourceId?.trim()) {
    query = query.eq("calendar_id", calendarSourceId.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    external_event_id: string | null;
    calendar_id: string;
    title: string;
    start_time: string;
    end_time: string;
    event_type: string | null;
    patient_id: string | null;
    lead_id: string | null;
    metadata: Record<string, unknown>;
  }[];
}

async function loadBookingMapping(
  supabase: SupabaseClient,
  tenantId: string,
  externalEventId: string
): Promise<{ id: string; internal_id: string | null } | null> {
  const { data, error } = await supabase
    .from("fi_external_entity_mappings")
    .select("id, internal_id")
    .eq("tenant_id", tenantId.trim())
    .eq("source_system", GOOGLE_CALENDAR_BOOKING_SOURCE)
    .eq("entity_type", BOOKING_ENTITY)
    .eq("external_id", externalEventId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: String((data as { id: string }).id),
    internal_id:
      (data as { internal_id: string | null }).internal_id == null
        ? null
        : String((data as { internal_id: string }).internal_id),
  };
}

async function promoteSafeGoogleCalendarBookings(
  input: {
    tenantId: string;
    integrationId: string;
    clinicId?: string | null;
    calendarSourceId?: string | null;
    timeMin: string;
    timeMax: string;
    dryRun: boolean;
  },
  opts: ServerOpts
): Promise<BookingPromotionCounters> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const counters: BookingPromotionCounters = {
    createdBookings: 0,
    updatedBookings: 0,
    sentToReview: 0,
    skippedDuplicates: 0,
  };

  const [calendarEvents, bookings, patientCandidates] = await Promise.all([
    loadCalendarEventsInRange(
      supabase,
      input.tenantId,
      input.timeMin,
      input.timeMax,
      input.calendarSourceId
    ),
    loadBookingsInRange(supabase, input.tenantId, input.timeMin, input.timeMax, input.clinicId),
    loadPatientNameCandidates(supabase, input.tenantId),
  ]);

  const timeZone = await loadTenantTimeZone(supabase, input.tenantId);

  for (const event of calendarEvents) {
    if (event.metadata?.deleted_from_provider || event.metadata?.deleted_locally) continue;

    const extId = event.external_event_id?.trim();
    if (!extId) continue;

    const externalSource = detectGoogleCalendarExternalSource({
      id: extId,
      summary: event.title,
      description: typeof event.metadata?.description === "string" ? event.metadata.description : null,
      status: "confirmed",
    });

    const existingBookingId = bookingsOverlapByTitleAndStart(
      event.title,
      event.start_time,
      bookings
    );
    if (existingBookingId) {
      counters.skippedDuplicates += 1;
      if (!input.dryRun) {
        const { data: existingBooking } = await supabase
          .from("fi_bookings")
          .select("id, metadata")
          .eq("tenant_id", input.tenantId.trim())
          .eq("id", existingBookingId)
          .maybeSingle();
        if (existingBooking) {
          const meta = buildGoogleCalendarBookingMetadata({
            externalEventId: extId,
            sourceCalendarId: event.calendar_id,
            externalSource,
            integrationId: input.integrationId,
            existingMetadata: (existingBooking as { metadata: Record<string, unknown> }).metadata,
          });
          await supabase
            .from("fi_bookings")
            .update({ metadata: meta, updated_at: new Date().toISOString() })
            .eq("id", existingBookingId)
            .eq("tenant_id", input.tenantId.trim());
          counters.updatedBookings += 1;
        }
      } else {
        counters.updatedBookings += 1;
      }
      continue;
    }

    const mapping = await loadBookingMapping(supabase, input.tenantId, extId);
    let patientId = event.patient_id?.trim() || null;
    let leadId = event.lead_id?.trim() || null;
    let personId: string | null = null;

    if (!patientId && !leadId) {
      const nameMatch = matchPatientByEventTitle(event.title, patientCandidates);
      if (nameMatch.status === "ambiguous") {
        counters.sentToReview += 1;
        continue;
      }
      if (nameMatch.status === "matched") {
        patientId = nameMatch.patientId;
        personId = nameMatch.personId;
        leadId = nameMatch.leadId;
      }
    }

    if (!patientId && !leadId) continue;

    const bookingType = mapGoogleEventTypeToBookingType(event.event_type);
    const bookingMeta = buildGoogleCalendarBookingMetadata({
      externalEventId: extId,
      sourceCalendarId: event.calendar_id,
      externalSource,
      integrationId: input.integrationId,
    });

    if (mapping?.internal_id) {
      if (input.dryRun) {
        counters.updatedBookings += 1;
        continue;
      }
      const { error } = await supabase
        .from("fi_bookings")
        .update({
          title: event.title,
          start_at: event.start_time,
          end_at: event.end_time,
          booking_type: bookingType,
          timezone: timeZone,
          patient_id: patientId,
          lead_id: leadId,
          metadata: bookingMeta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mapping.internal_id)
        .eq("tenant_id", input.tenantId.trim());
      if (!error) counters.updatedBookings += 1;
      continue;
    }

    if (input.dryRun) {
      counters.createdBookings += 1;
      continue;
    }

    const insertRow: Record<string, unknown> = {
      tenant_id: input.tenantId.trim(),
      booking_type: bookingType,
      booking_status: "scheduled",
      title: event.title,
      start_at: event.start_time,
      end_at: event.end_time,
      timezone: timeZone,
      metadata: bookingMeta,
    };
    if (input.clinicId?.trim()) insertRow.clinic_id = input.clinicId.trim();
    if (patientId) insertRow.patient_id = patientId;
    if (leadId) insertRow.lead_id = leadId;
    if (personId) insertRow.person_id = personId;

    const { data: created, error: createError } = await supabase
      .from("fi_bookings")
      .insert(insertRow)
      .select("id")
      .single();
    if (createError || !created) continue;

    const bookingId = String((created as { id: string }).id);
    counters.createdBookings += 1;

    await supabase.from("fi_external_entity_mappings").upsert(
      {
        tenant_id: input.tenantId.trim(),
        source_system: GOOGLE_CALENDAR_BOOKING_SOURCE,
        entity_type: BOOKING_ENTITY,
        external_id: extId,
        internal_id: bookingId,
      },
      { onConflict: "tenant_id,source_system,entity_type,external_id" }
    );
  }

  return counters;
}

/** Import historical Google Calendar events into FI OS for a tenant and date range. */
export async function runGoogleCalendarBackfill(
  input: RunGoogleCalendarBackfillInput,
  opts: ServerOpts = {}
): Promise<GoogleCalendarBackfillResult> {
  const tenantId = input.tenantId.trim();
  const dryRun = Boolean(input.dryRun);
  const warnings: string[] = [];
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const integration = await loadActiveIntegration(supabase, tenantId);
  if (!integration) {
    return { ok: false, error: "No active Google Calendar integration with valid tokens." };
  }

  const timeZone = await loadTenantTimeZone(supabase, tenantId);
  const range = resolveGoogleCalendarBackfillDateRange({
    startDate: input.startDate,
    endDate: input.endDate,
    timeZone,
    now: opts.now,
  });
  if ("error" in range) {
    return { ok: false, error: range.error };
  }

  if (input.calendarSourceId?.trim()) {
    const tokenResult = await resolveGoogleCalendarAccessToken(tenantId, opts);
    if (!tokenResult.ok) {
      return { ok: false, error: tokenResult.error };
    }
    const scopes = await getGoogleInboundCalendarScopesForIntegration(
      tokenResult.data!.integration,
      opts
    );
    if (!scopes.some((s) => s.calendarId === input.calendarSourceId!.trim())) {
      return {
        ok: false,
        error: `Calendar "${input.calendarSourceId.trim()}" is not enabled for inbound sync.`,
      };
    }
  }

  logStructured("info", "google_calendar_backfill_start", {
    tenantId,
    integrationId: integration.id,
    dryRun,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
    timeMin: range.timeMin,
    timeMax: range.timeMax,
    calendarSourceId: input.calendarSourceId ?? null,
    promoteSafeBookings: Boolean(input.promoteSafeBookings),
  });

  const syncResult = await syncGoogleCalendarEvents(tenantId, {
    supabaseClientForTests: opts.supabaseClientForTests,
    fetchOverride: opts.fetchOverride,
    integrationId: integration.id,
    timeMin: range.timeMin,
    timeMax: range.timeMax,
    calendarSourceId: input.calendarSourceId?.trim() || undefined,
    dryRun,
  });

  if (!syncResult.ok) {
    return { ok: false, error: syncResult.error, warnings };
  }

  const sync = syncResult.data.result;
  const failedCount = sync.failedCalendars?.length ?? 0;
  const drySummary = buildDryRunSummaryFromSyncResult(sync, failedCount);

  let bookingCounts: BookingPromotionCounters = {
    createdBookings: 0,
    updatedBookings: 0,
    sentToReview: 0,
    skippedDuplicates: 0,
  };

  if (input.promoteSafeBookings) {
    bookingCounts = await promoteSafeGoogleCalendarBookings(
      {
        tenantId,
        integrationId: integration.id,
        clinicId: input.clinicId,
        calendarSourceId: input.calendarSourceId,
        timeMin: range.timeMin,
        timeMax: range.timeMax,
        dryRun,
      },
      opts
    );
    drySummary.ambiguousReviewRequired += bookingCounts.sentToReview;

    const cancelledEvents = await loadCalendarEventsInRange(
      supabase,
      tenantId,
      range.timeMin,
      range.timeMax,
      input.calendarSourceId
    );
    for (const row of cancelledEvents) {
      if (!row.metadata?.deleted_from_provider) continue;
      const extId = row.external_event_id?.trim();
      if (!extId) continue;
      const cancelled = await markGoogleCalendarLinkedBookingCancelled(
        supabase,
        tenantId,
        extId,
        dryRun
      );
      if (cancelled && !dryRun) bookingCounts.updatedBookings += 1;
    }
  }

  if (failedCount > 0) {
    warnings.push(
      `${failedCount} calendar source(s) failed during fetch — partial results may be incomplete.`
    );
  }

  const summary = dryRun
    ? drySummary
    : buildWriteSummaryFromSyncAndBookings(drySummary, bookingCounts);

  if (!dryRun) {
    const diagnosticsPatch = buildGoogleCalendarBackfillDiagnosticsPatch({
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
      importedCount:
        (summary as GoogleCalendarBackfillWriteSummary).createdCalendarEvents +
        (summary as GoogleCalendarBackfillWriteSummary).updatedCalendarEvents,
      reviewCount:
        (summary as GoogleCalendarBackfillWriteSummary).sentToReview +
        drySummary.ambiguousReviewRequired,
      warnings,
      now: opts.now,
    });
    await persistBackfillDiagnostics(supabase, tenantId, integration.id, diagnosticsPatch);

    if (!input.skipRevalidation) {
      revalidateLiveDataSurfacesForTenant(tenantId, { includeIntegrationsSettings: true });
    }
  }

  logStructured("info", "google_calendar_backfill_complete", {
    tenantId,
    integrationId: integration.id,
    dryRun,
    summary,
  });

  return {
    ok: true,
    dryRun,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
    timeZone,
    summary,
    syncResult: sync,
    warnings,
  };
}

/** Cancel linked FI bookings when a Google event is cancelled (used in tests and promotion). */
export async function markGoogleCalendarLinkedBookingCancelled(
  supabase: SupabaseClient,
  tenantId: string,
  externalEventId: string,
  dryRun: boolean
): Promise<boolean> {
  const mapping = await loadBookingMapping(supabase, tenantId, externalEventId);
  if (!mapping?.internal_id) return false;
  if (dryRun) return true;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_bookings")
    .update({
      booking_status: "cancelled",
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", mapping.internal_id)
    .eq("tenant_id", tenantId.trim());
  if (error) throw new Error(error.message);
  return true;
}
