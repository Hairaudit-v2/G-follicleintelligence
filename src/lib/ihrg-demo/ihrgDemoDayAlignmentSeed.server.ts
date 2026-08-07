/**
 * Aligns IHRG Sydney Hair Institute to a dense operational "today"
 * for guided ReceptionOS / calendar demos.
 *
 * Does not rewrite historical TITAN surgery rows — only upserts
 * dedicated `demo_day_key` bookings + deposits + reception tasks,
 * and sets tenant calendar timezone to Australia/Sydney.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { createPaymentRecord } from "@/src/lib/payments/paymentRecordMutations.server";
import {
  addDaysToCalendarDate,
  calendarDateStringFromInstant,
  isoFromLocalDayMinutes,
} from "@/src/lib/calendar/calendarTimezone";
import {
  IHRG_DEMO_DAY_ALIGNMENT_FLAG,
  IHRG_DEMO_DAY_CLINIC_SLUG,
  IHRG_DEMO_DAY_KEY_METADATA,
  IHRG_DEMO_DAY_RECEPTION_TASK_SPECS,
  IHRG_DEMO_DAY_TIMEZONE,
  ihrgDemoDayTodaySpecs,
  ihrgDemoDayTomorrowSpecs,
  type IhrgDemoDayBookingSpec,
} from "./ihrgDemoDayAlignmentModel";

export type IhrgDemoDayAlignmentResult = {
  ok: boolean;
  clinicId: string | null;
  todayYmd: string | null;
  timezoneSet: boolean;
  createdBookings: number;
  updatedBookings: number;
  createdDeposits: number;
  existingDeposits: number;
  createdCalendarEvents: number;
  updatedCalendarEvents: number;
  createdReceptionTasks: number;
  existingReceptionTasks: number;
  warnings: string[];
  error?: string;
};

type PatientRow = {
  id: string;
  person_id: string;
  metadata: Record<string, unknown> | null;
};

type CaseRow = {
  id: string;
  patient_id: string | null;
  metadata: Record<string, unknown> | null;
};

function emptyResult(extra?: Partial<IhrgDemoDayAlignmentResult>): IhrgDemoDayAlignmentResult {
  return {
    ok: true,
    clinicId: null,
    todayYmd: null,
    timezoneSet: false,
    createdBookings: 0,
    updatedBookings: 0,
    createdDeposits: 0,
    existingDeposits: 0,
    createdCalendarEvents: 0,
    updatedCalendarEvents: 0,
    createdReceptionTasks: 0,
    existingReceptionTasks: 0,
    warnings: [],
    ...extra,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clinicSlug(metadata: unknown): string | null {
  const m = asRecord(metadata);
  const slug = m?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

function windowForSpec(
  ymd: string,
  spec: IhrgDemoDayBookingSpec
): { start: string; end: string } | null {
  const start = isoFromLocalDayMinutes(ymd, spec.localHour * 60, IHRG_DEMO_DAY_TIMEZONE);
  const end = isoFromLocalDayMinutes(
    ymd,
    spec.localHour * 60 + spec.durationHours * 60,
    IHRG_DEMO_DAY_TIMEZONE
  );
  if (!start || !end) return null;
  return { start, end };
}

async function resolveSydneyClinicId(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const r = row as { id: string; metadata: unknown };
    if (clinicSlug(r.metadata) === IHRG_DEMO_DAY_CLINIC_SLUG) return String(r.id);
  }
  return null;
}

async function ensureTenantSydneyTimezone(
  supabase: SupabaseClient,
  tenantId: string,
  result: IhrgDemoDayAlignmentResult
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_tenant_settings")
    .select("id, default_timezone, metadata")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    result.warnings.push("fi_tenant_settings missing — skipped timezone alignment.");
    return;
  }

  const row = data as {
    id: string;
    default_timezone: string | null;
    metadata: unknown;
  };
  const meta = asRecord(row.metadata) ?? {};
  const nextMeta = {
    ...meta,
    [IHRG_DEMO_DAY_ALIGNMENT_FLAG]: true,
    demo_day_operational_timezone: IHRG_DEMO_DAY_TIMEZONE,
  };

  if (row.default_timezone === IHRG_DEMO_DAY_TIMEZONE) {
    const { error: metaErr } = await supabase
      .from("fi_tenant_settings")
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (metaErr) throw new Error(metaErr.message);
    result.timezoneSet = true;
    return;
  }

  const { error: updErr } = await supabase
    .from("fi_tenant_settings")
    .update({
      default_timezone: IHRG_DEMO_DAY_TIMEZONE,
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (updErr) throw new Error(updErr.message);
  result.timezoneSet = true;
}

async function loadSydneyPatients(
  supabase: SupabaseClient,
  tenantId: string,
  clinicId: string
): Promise<PatientRow[]> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId)
    .contains("metadata", { demo_clinic_slug: IHRG_DEMO_DAY_CLINIC_SLUG })
    .limit(40);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => {
    const r = row as { id: string; person_id: string; metadata: unknown };
    return {
      id: String(r.id),
      person_id: String(r.person_id),
      metadata: asRecord(r.metadata),
    };
  });

  if (rows.length > 0) return rows;

  // Fallback: patients linked via Sydney clinic bookings
  const { data: bookings, error: bErr } = await supabase
    .from("fi_bookings")
    .select("patient_id")
    .eq("tenant_id", tenantId)
    .eq("clinic_id", clinicId)
    .not("patient_id", "is", null)
    .limit(40);
  if (bErr) throw new Error(bErr.message);
  const ids = [
    ...new Set(
      (bookings ?? [])
        .map((b) => (b as { patient_id: string | null }).patient_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (ids.length === 0) return [];

  const { data: patients, error: pErr } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (pErr) throw new Error(pErr.message);
  return (patients ?? []).map((row) => {
    const r = row as { id: string; person_id: string; metadata: unknown };
    return {
      id: String(r.id),
      person_id: String(r.person_id),
      metadata: asRecord(r.metadata),
    };
  });
}

async function loadCasesByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (patientIds.length === 0) return map;
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, patient_id, metadata")
    .eq("tenant_id", tenantId)
    .in("patient_id", patientIds)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const r = row as CaseRow;
    if (!r.patient_id || map.has(r.patient_id)) continue;
    map.set(String(r.patient_id), String(r.id));
  }
  return map;
}

async function findDemoDayBooking(
  supabase: SupabaseClient,
  tenantId: string,
  key: string
): Promise<{ id: string; patient_id: string | null; case_id: string | null } | null> {
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, patient_id, case_id, metadata")
    .eq("tenant_id", tenantId)
    .contains("metadata", { [IHRG_DEMO_DAY_KEY_METADATA]: key })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as
    | { id: string; patient_id: string | null; case_id: string | null }
    | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    patient_id: row.patient_id ? String(row.patient_id) : null,
    case_id: row.case_id ? String(row.case_id) : null,
  };
}

async function upsertDemoDayBooking(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  clinicId: string;
  spec: IhrgDemoDayBookingSpec;
  ymd: string;
  patient: PatientRow;
  caseId: string | null;
  result: IhrgDemoDayAlignmentResult;
}): Promise<{ bookingId: string; patientId: string; caseId: string | null } | null> {
  const window = windowForSpec(opts.ymd, opts.spec);
  if (!window) {
    opts.result.warnings.push(`Could not build local window for ${opts.spec.key}`);
    return null;
  }

  const now = new Date().toISOString();
  const title = `Demo Day — ${opts.spec.titleSuffix}`;
  const metadata = {
    [IHRG_DEMO_DAY_ALIGNMENT_FLAG]: true,
    [IHRG_DEMO_DAY_KEY_METADATA]: opts.spec.key,
    demo_clinic_slug: IHRG_DEMO_DAY_CLINIC_SLUG,
    enterprise_demo_booking: true,
  };

  const existing = await findDemoDayBooking(opts.supabase, opts.tenantId, opts.spec.key);
  if (existing) {
    const { error } = await opts.supabase
      .from("fi_bookings")
      .update({
        start_at: window.start,
        end_at: window.end,
        timezone: IHRG_DEMO_DAY_TIMEZONE,
        clinic_id: opts.clinicId,
        booking_status: "confirmed",
        title,
        metadata,
        updated_at: now,
      })
      .eq("tenant_id", opts.tenantId)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    opts.result.updatedBookings += 1;
    return {
      bookingId: existing.id,
      patientId: existing.patient_id ?? opts.patient.id,
      caseId: existing.case_id ?? opts.caseId,
    };
  }

  const { data, error } = await opts.supabase
    .from("fi_bookings")
    .insert({
      tenant_id: opts.tenantId,
      person_id: opts.patient.person_id,
      patient_id: opts.patient.id,
      case_id: opts.caseId,
      clinic_id: opts.clinicId,
      booking_type: opts.spec.kind,
      booking_status: "confirmed",
      title,
      description: "IHRG Demo Day alignment booking for guided ReceptionOS pitches.",
      start_at: window.start,
      end_at: window.end,
      timezone: IHRG_DEMO_DAY_TIMEZONE,
      location: IHRG_DEMO_DAY_CLINIC_SLUG,
      metadata,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  opts.result.createdBookings += 1;
  return {
    bookingId: String((data as { id: string }).id),
    patientId: opts.patient.id,
    caseId: opts.caseId,
  };
}

async function ensurePendingDeposit(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  bookingId: string;
  patientId: string;
  caseId: string | null;
  result: IhrgDemoDayAlignmentResult;
}): Promise<void> {
  const { data: existing, error: findErr } = await opts.supabase
    .from("fi_payment_records")
    .select("id")
    .eq("tenant_id", opts.tenantId)
    .eq("booking_id", opts.bookingId)
    .eq("payment_context", "surgery")
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (existing) {
    opts.result.existingDeposits += 1;
    return;
  }

  await createPaymentRecord(
    opts.tenantId,
    {
      payment_context: "surgery",
      patient_id: opts.patientId,
      case_id: opts.caseId ?? undefined,
      booking_id: opts.bookingId,
      amount_expected: 2500,
      amount_paid: 0,
      currency: "AUD",
      status: "pending",
      notes: "IHRG Demo Day — outstanding surgery deposit (synthetic)",
    },
    null
  );
  opts.result.createdDeposits += 1;
}

async function upsertDemoDayCalendarEvent(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  spec: IhrgDemoDayBookingSpec;
  ymd: string;
  patientId: string;
  result: IhrgDemoDayAlignmentResult;
}): Promise<void> {
  const window = windowForSpec(opts.ymd, opts.spec);
  if (!window) return;

  const calKey = `${opts.spec.key}-calendar`;
  const now = new Date().toISOString();
  const metadata = {
    enterprise_demo: true,
    [IHRG_DEMO_DAY_ALIGNMENT_FLAG]: true,
    [IHRG_DEMO_DAY_KEY_METADATA]: calKey,
    demo_calendar_event_key: calKey,
  };

  const { data: existingRows, error: findErr } = await opts.supabase
    .from("fi_calendar_events")
    .select("id, metadata")
    .eq("tenant_id", opts.tenantId)
    .contains("metadata", { [IHRG_DEMO_DAY_KEY_METADATA]: calKey })
    .limit(1);
  if (findErr) throw new Error(findErr.message);

  const existing = (existingRows ?? [])[0] as { id: string } | undefined;
  if (existing) {
    const { error } = await opts.supabase
      .from("fi_calendar_events")
      .update({
        start_time: window.start,
        end_time: window.end,
        title: `Demo Day — ${opts.spec.titleSuffix}`,
        location: IHRG_DEMO_DAY_CLINIC_SLUG,
        patient_id: opts.patientId,
        metadata,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    opts.result.updatedCalendarEvents += 1;
    return;
  }

  const { error } = await opts.supabase.from("fi_calendar_events").insert({
    tenant_id: opts.tenantId,
    provider: "google",
    calendar_id: `ihrg-demo-day-${IHRG_DEMO_DAY_CLINIC_SLUG}@follicleintelligence.local`,
    title: `Demo Day — ${opts.spec.titleSuffix}`,
    description: "IHRG Demo Day calendar event for guided pitches.",
    location: IHRG_DEMO_DAY_CLINIC_SLUG,
    start_time: window.start,
    end_time: window.end,
    event_type: opts.spec.kind === "surgery" ? "surgery" : "consultation",
    patient_id: opts.patientId,
    metadata,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  opts.result.createdCalendarEvents += 1;
}

async function upsertReceptionTasks(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  patients: PatientRow[];
  result: IhrgDemoDayAlignmentResult;
}): Promise<void> {
  const now = new Date();
  for (let i = 0; i < IHRG_DEMO_DAY_RECEPTION_TASK_SPECS.length; i++) {
    const spec = IHRG_DEMO_DAY_RECEPTION_TASK_SPECS[i]!;
    const patient = opts.patients[i % Math.max(opts.patients.length, 1)];
    const sourceRef = spec.key;

    const { data: existing, error: findErr } = await opts.supabase
      .from("fi_reception_tasks")
      .select("id")
      .eq("tenant_id", opts.tenantId)
      .eq("source_ref_id", sourceRef)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    const dueAt = new Date(now.getTime() + spec.dueInHours * 60 * 60 * 1000).toISOString();
    const metadata = {
      enterprise_demo: true,
      [IHRG_DEMO_DAY_ALIGNMENT_FLAG]: true,
      [IHRG_DEMO_DAY_KEY_METADATA]: spec.key,
    };

    if (existing) {
      const { error } = await opts.supabase
        .from("fi_reception_tasks")
        .update({
          title: spec.title,
          severity: spec.severity,
          status: "open",
          due_at: dueAt,
          patient_id: patient?.id ?? null,
          metadata,
          updated_at: now.toISOString(),
        })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
      opts.result.existingReceptionTasks += 1;
      continue;
    }

    const { error } = await opts.supabase.from("fi_reception_tasks").insert({
      tenant_id: opts.tenantId,
      title: spec.title,
      description: "IHRG Demo Day reception task for guided morning-prep demos.",
      source_type: "consultation",
      severity: spec.severity,
      status: "open",
      patient_id: patient?.id ?? null,
      source_ref_id: sourceRef,
      due_at: dueAt,
      metadata,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    if (error) throw new Error(error.message);
    opts.result.createdReceptionTasks += 1;
  }
}

export async function seedIhrgDemoDayAlignment(
  supabase: SupabaseClient,
  tenantId: string,
  now: Date = new Date()
): Promise<IhrgDemoDayAlignmentResult> {
  const result = emptyResult();
  try {
    const clinicId = await resolveSydneyClinicId(supabase, tenantId);
    if (!clinicId) {
      return emptyResult({
        ok: false,
        error: `Clinic slug "${IHRG_DEMO_DAY_CLINIC_SLUG}" not found. Run enterprise/IHRG seed first.`,
        warnings: [`Missing clinic ${IHRG_DEMO_DAY_CLINIC_SLUG}`],
      });
    }
    result.clinicId = clinicId;

    await ensureTenantSydneyTimezone(supabase, tenantId, result);

    const todayYmd = calendarDateStringFromInstant(now, IHRG_DEMO_DAY_TIMEZONE);
    const tomorrowYmd = addDaysToCalendarDate(todayYmd, 1, IHRG_DEMO_DAY_TIMEZONE);
    result.todayYmd = todayYmd;

    const patients = await loadSydneyPatients(supabase, tenantId, clinicId);
    if (patients.length === 0) {
      return {
        ...result,
        ok: false,
        error: "No Sydney demo patients found for Demo Day alignment.",
        warnings: [...result.warnings, "No Sydney patients"],
      };
    }

    const caseByPatient = await loadCasesByPatient(
      supabase,
      tenantId,
      patients.map((p) => p.id)
    );

    const schedule: Array<{ spec: IhrgDemoDayBookingSpec; ymd: string }> = [
      ...ihrgDemoDayTodaySpecs().map((spec) => ({ spec, ymd: todayYmd })),
      ...ihrgDemoDayTomorrowSpecs().map((spec) => ({ spec, ymd: tomorrowYmd })),
    ];

    for (let i = 0; i < schedule.length; i++) {
      const { spec, ymd } = schedule[i]!;
      const patient = patients[i % patients.length]!;
      const caseId = caseByPatient.get(patient.id) ?? null;
      const booking = await upsertDemoDayBooking({
        supabase,
        tenantId,
        clinicId,
        spec,
        ymd,
        patient,
        caseId,
        result,
      });
      if (!booking) continue;

      if (spec.withPendingDeposit) {
        await ensurePendingDeposit({
          supabase,
          tenantId,
          bookingId: booking.bookingId,
          patientId: booking.patientId,
          caseId: booking.caseId,
          result,
        });
      }

      await upsertDemoDayCalendarEvent({
        supabase,
        tenantId,
        spec,
        ymd,
        patientId: booking.patientId,
        result,
      });
    }

    await upsertReceptionTasks({ supabase, tenantId, patients, result });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ...result, ok: false, error: message, warnings: [...result.warnings, message] };
  }
}
