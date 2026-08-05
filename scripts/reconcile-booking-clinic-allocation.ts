/**
 * Dry-run clinic reconciliation for FI-CALENDAR-CLINIC-ALLOCATION-FIX-1A.
 *
 * Prints CSV-like report rows:
 *   appointment_id, appointment_date, current_clinic_id, resolved_clinic_id,
 *   clinic_source, staff_id, room_id, linked_enquiry_id, linked_consultation_id
 *
 * Does NOT write unless --apply is passed, and only backfills when the source is
 * deterministic and tenant-safe (appointment location / enquiry / patient / room).
 * Staff clinic alone is reported but not applied (lowest legacy signal).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reconcile-booking-clinic-allocation.ts --tenant=<uuid>
 *   npx tsx --env-file=.env.local scripts/reconcile-booking-clinic-allocation.ts --tenant=<uuid> --apply
 */

import { createClient } from "@supabase/supabase-js";
import {
  resolveAppointmentClinicIdDetailed,
  type AppointmentClinicSource,
} from "../src/lib/bookings/resolveAppointmentClinicId";

type Row = {
  id: string;
  start_at: string;
  clinic_id: string | null;
  assigned_staff_id: string | null;
  room_id: string | null;
  lead_id: string | null;
  patient_id: string | null;
  case_id: string | null;
};

const APPLY = process.argv.includes("--apply");
const APPLY_SOLE = process.argv.includes("--apply-sole-clinic");
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
const TENANT_ID =
  tenantArg?.slice("--tenant=".length)?.trim() ||
  process.env.FI_TENANT_ID?.trim() ||
  process.env.EVOLVED_PERTH_TENANT_ID?.trim() ||
  process.env.FI_SMOKE_TENANT_ID?.trim();

const APPLYABLE: ReadonlySet<AppointmentClinicSource> = new Set([
  "appointment_location_id",
  "consultation_clinic_id",
  "enquiry_clinic_id",
  "patient_selected_clinic_id",
  "room_clinic_id",
]);

function csvEscape(v: string | null | undefined): string {
  const s = v ?? "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  if (!TENANT_ID) {
    console.error("Pass --tenant=<uuid> or set FI_TENANT_ID");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: clinics, error: clinicsErr } = await supabase
    .from("fi_clinics")
    .select("id")
    .eq("tenant_id", TENANT_ID);
  if (clinicsErr) throw new Error(clinicsErr.message);
  const allowedClinicIds = new Set((clinics ?? []).map((c) => String(c.id)));
  const soleClinicId = allowedClinicIds.size === 1 ? Array.from(allowedClinicIds)[0]! : null;

  const { data: bookings, error: bookingsErr } = await supabase
    .from("fi_bookings")
    .select(
      "id, start_at, clinic_id, assigned_staff_id, room_id, lead_id, patient_id, case_id"
    )
    .eq("tenant_id", TENANT_ID)
    .is("clinic_id", null)
    .order("start_at", { ascending: false })
    .limit(5000);
  if (bookingsErr) throw new Error(bookingsErr.message);

  const rows = (bookings ?? []) as Row[];
  const roomIds = Array.from(new Set(rows.map((r) => r.room_id).filter(Boolean))) as string[];
  const leadIds = Array.from(new Set(rows.map((r) => r.lead_id).filter(Boolean))) as string[];
  const patientIds = Array.from(
    new Set(rows.map((r) => r.patient_id).filter(Boolean))
  ) as string[];
  const staffIds = Array.from(
    new Set(rows.map((r) => r.assigned_staff_id).filter(Boolean))
  ) as string[];
  const caseIds = Array.from(new Set(rows.map((r) => r.case_id).filter(Boolean))) as string[];

  const roomClinic = new Map<string, string | null>();
  if (roomIds.length) {
    const { data, error } = await supabase
      .from("fi_clinic_rooms")
      .select("id, clinic_id")
      .eq("tenant_id", TENANT_ID)
      .in("id", roomIds);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      roomClinic.set(String(r.id), r.clinic_id != null ? String(r.clinic_id) : null);
    }
  }

  const leadClinic = new Map<string, string | null>();
  if (leadIds.length) {
    const { data, error } = await supabase
      .from("fi_crm_leads")
      .select("id, clinic_id")
      .eq("tenant_id", TENANT_ID)
      .in("id", leadIds);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      leadClinic.set(String(r.id), r.clinic_id != null ? String(r.clinic_id) : null);
    }
  }

  const patientClinic = new Map<string, string | null>();
  if (patientIds.length) {
    const { data, error } = await supabase
      .from("fi_patients")
      .select("id, primary_clinic_id")
      .eq("tenant_id", TENANT_ID)
      .in("id", patientIds);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      patientClinic.set(
        String(r.id),
        r.primary_clinic_id != null ? String(r.primary_clinic_id) : null
      );
    }
  }

  const staffClinic = new Map<string, string | null>();
  if (staffIds.length) {
    const { data, error } = await supabase
      .from("fi_staff")
      .select("id, working_hours")
      .eq("tenant_id", TENANT_ID)
      .in("id", staffIds);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const wh = r.working_hours as { primary_clinic_id?: unknown } | null;
      const cid =
        wh && typeof wh === "object" && wh.primary_clinic_id != null
          ? String(wh.primary_clinic_id).trim()
          : "";
      staffClinic.set(String(r.id), cid || null);
    }
  }

  /** Linked consultation clinic via case, when present. */
  const consultationClinicByCase = new Map<string, string | null>();
  if (caseIds.length) {
    const { data, error } = await supabase
      .from("fi_cases")
      .select("id, clinic_id")
      .eq("tenant_id", TENANT_ID)
      .in("id", caseIds);
    if (error) {
      // Cases table / column may differ across environments — skip non-fatally.
      console.error("[warn] fi_cases clinic lookup skipped:", error.message);
    } else {
      for (const r of data ?? []) {
        consultationClinicByCase.set(
          String(r.id),
          (r as { clinic_id?: string | null }).clinic_id != null
            ? String((r as { clinic_id: string }).clinic_id)
            : null
        );
      }
    }
  }

  console.log(
    [
      "appointment_id",
      "appointment_date",
      "current_clinic_id",
      "resolved_clinic_id",
      "clinic_source",
      "staff_id",
      "room_id",
      "linked_enquiry_id",
      "linked_consultation_id",
      "would_backfill",
      "sole_clinic_candidate",
    ].join(",")
  );

  let reportCount = 0;
  let wouldBackfill = 0;
  let soleCandidates = 0;
  let applied = 0;

  for (const row of rows) {
    const detailed = resolveAppointmentClinicIdDetailed(
      {
        appointmentClinicId: row.clinic_id,
        consultationClinicId: row.case_id
          ? (consultationClinicByCase.get(row.case_id) ?? null)
          : null,
        enquiryClinicId: row.lead_id ? (leadClinic.get(row.lead_id) ?? null) : null,
        patientSelectedClinicId: row.patient_id
          ? (patientClinic.get(row.patient_id) ?? null)
          : null,
        roomClinicId: row.room_id ? (roomClinic.get(row.room_id) ?? null) : null,
        staffClinicId: row.assigned_staff_id
          ? (staffClinic.get(row.assigned_staff_id) ?? null)
          : null,
      },
      { allowedClinicIds }
    );

    const canBackfill =
      Boolean(detailed.clinicId) &&
      detailed.source != null &&
      APPLYABLE.has(detailed.source);

    const soleCandidate = !detailed.clinicId && Boolean(soleClinicId);
    if (soleCandidate) soleCandidates += 1;

    reportCount += 1;
    if (canBackfill) wouldBackfill += 1;

    console.log(
      [
        csvEscape(row.id),
        csvEscape(row.start_at),
        csvEscape(row.clinic_id),
        csvEscape(detailed.clinicId),
        csvEscape(detailed.source),
        csvEscape(row.assigned_staff_id),
        csvEscape(row.room_id),
        csvEscape(row.lead_id),
        csvEscape(row.case_id),
        canBackfill ? "yes" : "no",
        soleCandidate ? (soleClinicId ?? "") : "",
      ].join(",")
    );

    const targetClinic =
      canBackfill && detailed.clinicId
        ? detailed.clinicId
        : APPLY_SOLE && soleCandidate
          ? soleClinicId
          : null;

    if ((APPLY || APPLY_SOLE) && targetClinic) {
      const { error } = await supabase
        .from("fi_bookings")
        .update({ clinic_id: targetClinic })
        .eq("tenant_id", TENANT_ID)
        .eq("id", row.id)
        .is("clinic_id", null);
      if (error) {
        console.error(`[apply-fail] ${row.id}: ${error.message}`);
      } else {
        applied += 1;
      }
    }
  }

  console.error(
    JSON.stringify(
      {
        mode: APPLY || APPLY_SOLE ? "apply" : "dry-run",
        tenantId: TENANT_ID,
        nullClinicBookings: reportCount,
        wouldBackfill,
        soleClinicId,
        soleCandidates,
        applied,
        note:
          soleCandidates > 0
            ? "Tenant has a single clinic; use --apply-sole-clinic to opt in (not applied by default)."
            : undefined,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
