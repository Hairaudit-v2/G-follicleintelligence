import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ENTERPRISE_DEMO_CASE_KEY_METADATA,
  ENTERPRISE_DEMO_BOOKING_KEY_METADATA,
  ENTERPRISE_DEMO_SURGERY_KEY_METADATA,
} from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoSurgerySpecs,
  validateEnterpriseDemoSurgerySpecs,
  type EnterpriseDemoSurgerySpec,
} from "./enterpriseDemoSurgeriesGenerator";
import { ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA } from "./enterpriseDemoPatientsSeed.server";

export const ENTERPRISE_DEMO_SURGERY_METADATA_FLAG = "enterprise_demo_surgery";
export const ENTERPRISE_DEMO_CASE_METADATA_FLAG = "enterprise_demo_case";
export const ENTERPRISE_DEMO_BOOKING_METADATA_FLAG = "enterprise_demo_booking";

export type EnterpriseDemoSurgeriesSeedResult = {
  createdCases: number;
  existingCases: number;
  createdBookings: number;
  existingBookings: number;
  createdSurgeries: number;
  existingSurgeries: number;
  createdTeamAssignments: number;
  existingTeamAssignments: number;
  createdGraftSessions: number;
  existingGraftSessions: number;
  createdGraftEvents: number;
  existingGraftEvents: number;
  linkedConsultations: number;
  createdDemoUsers: number;
  warnings: string[];
};

type ClinicRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type StaffRow = {
  id: string;
  email: string | null;
  fi_user_id: string | null;
  staff_metadata: Record<string, unknown> | null;
};

type PatientRow = {
  id: string;
  person_id: string;
  metadata: Record<string, unknown> | null;
};

type ConsultationRow = {
  id: string;
  structured_data: Record<string, unknown> | null;
  case_id: string | null;
};

type CaseRow = {
  id: string;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
};

type BookingRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type SurgeryRow = {
  id: string;
  metadata: Record<string, unknown> | null;
  booking_id: string | null;
};

function clinicMetadataSlug(row: ClinicRow): string | null {
  const slug = row.metadata?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

function metadataKey(metadata: unknown, key: string): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEnterpriseDemoCaseMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_CASE_METADATA_FLAG] === true;
}

function isEnterpriseDemoBookingMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_BOOKING_METADATA_FLAG] === true;
}

function isEnterpriseDemoSurgeryMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_SURGERY_METADATA_FLAG] === true;
}

function demoStaffKeyFromMetadata(metadata: unknown): string | null {
  return metadataKey(metadata, "demo_staff_key");
}

function demoPatientKeyFromMetadata(metadata: unknown): string | null {
  return metadataKey(metadata, "demo_patient_key");
}

function demoConsultationKeyFromStructured(data: unknown): string | null {
  return metadataKey(data, ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA);
}

async function loadClinicIdBySlug(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const clinic = row as ClinicRow;
    const slug = clinicMetadataSlug(clinic);
    if (slug) map.set(slug, String(clinic.id));
  }
  return map;
}

async function loadStaffRows(supabase: SupabaseClient, tenantId: string): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, email, fi_user_id, staff_metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as {
      id: string;
      email: string | null;
      fi_user_id: string | null;
      staff_metadata: unknown;
    };
    const staff_metadata =
      raw.staff_metadata && typeof raw.staff_metadata === "object" && !Array.isArray(raw.staff_metadata)
        ? (raw.staff_metadata as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      email: raw.email != null ? String(raw.email) : null,
      fi_user_id: raw.fi_user_id != null ? String(raw.fi_user_id) : null,
      staff_metadata,
    };
  });
}

async function loadPatientRows(supabase: SupabaseClient, tenantId: string): Promise<PatientRow[]> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; person_id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      person_id: String(raw.person_id),
      metadata,
    };
  });
}

async function loadConsultationRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ConsultationRow[]> {
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("id, structured_data, case_id")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; structured_data: unknown; case_id: string | null };
    const structured_data =
      raw.structured_data && typeof raw.structured_data === "object" && !Array.isArray(raw.structured_data)
        ? (raw.structured_data as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      structured_data,
      case_id: raw.case_id != null ? String(raw.case_id) : null,
    };
  });
}

async function loadCaseRows(supabase: SupabaseClient, tenantId: string): Promise<CaseRow[]> {
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, external_id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; external_id: string | null; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      external_id: raw.external_id != null ? String(raw.external_id) : null,
      metadata,
    };
  });
}

async function loadBookingRows(supabase: SupabaseClient, tenantId: string): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

async function loadSurgeryRows(supabase: SupabaseClient, tenantId: string): Promise<SurgeryRow[]> {
  const { data, error } = await supabase
    .from("fi_surgeries")
    .select("id, metadata, booking_id")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown; booking_id: string | null };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      metadata,
      booking_id: raw.booking_id != null ? String(raw.booking_id) : null,
    };
  });
}

function findStaffByDemoKey(rows: StaffRow[], key: string): StaffRow | undefined {
  return rows.find((row) => demoStaffKeyFromMetadata(row.staff_metadata) === key);
}

function findPatientByDemoKey(rows: PatientRow[], key: string): PatientRow | undefined {
  return rows.find((row) => demoPatientKeyFromMetadata(row.metadata) === key);
}

function findConsultationByDemoKey(rows: ConsultationRow[], key: string): ConsultationRow | undefined {
  return rows.find((row) => demoConsultationKeyFromStructured(row.structured_data) === key);
}

function findCaseByDemoKey(rows: CaseRow[], key: string): CaseRow | undefined {
  return rows.find(
    (row) =>
      metadataKey(row.metadata, ENTERPRISE_DEMO_CASE_KEY_METADATA) === key || row.external_id === key
  );
}

function findBookingByDemoKey(rows: BookingRow[], key: string): BookingRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, ENTERPRISE_DEMO_BOOKING_KEY_METADATA) === key);
}

function findSurgeryByDemoKey(rows: SurgeryRow[], key: string): SurgeryRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, ENTERPRISE_DEMO_SURGERY_KEY_METADATA) === key);
}

async function ensureDemoFiUserForStaff(
  supabase: SupabaseClient,
  tenantId: string,
  staff: StaffRow,
  now: string
): Promise<{ fiUserId: string | null; created: boolean }> {
  if (staff.fi_user_id) return { fiUserId: staff.fi_user_id, created: false };

  const demoStaffKey = demoStaffKeyFromMetadata(staff.staff_metadata);
  const email = staff.email?.trim().toLowerCase();
  if (!email) return { fiUserId: null, created: false };

  const { data: existingUser, error: findErr } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  let fiUserId: string;
  let created = false;

  if (existingUser?.id) {
    fiUserId = String((existingUser as { id: string }).id);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("fi_users")
      .insert({
        tenant_id: tenantId,
        email,
        role: "member",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    fiUserId = String((inserted as { id: string }).id);
    created = true;
  }

  const { error: staffUpdErr } = await supabase
    .from("fi_staff")
    .update({
      fi_user_id: fiUserId,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("id", staff.id);
  if (staffUpdErr) throw new Error(staffUpdErr.message);

  staff.fi_user_id = fiUserId;
  if (demoStaffKey && staff.staff_metadata) {
    staff.staff_metadata.enterprise_demo_user = true;
  }

  return { fiUserId, created };
}

function buildCaseMetadata(spec: EnterpriseDemoSurgerySpec): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_CASE_METADATA_FLAG]: true,
    [ENTERPRISE_DEMO_CASE_KEY_METADATA]: spec.demoCaseKey,
    demo_patient_key: spec.demoPatientKey,
    demo_clinic_slug: spec.clinicSlug,
    demo_consultation_key: spec.demoConsultationKey,
    enterprise_demo: true,
    display_name: spec.displayName,
    email: spec.email,
    procedure_type: spec.procedureType,
    graft_target: spec.graftTarget,
    quoted_graft_estimate: spec.quotedGraftEstimate,
    quoted_value: spec.quotedValue,
    invoice_graft_placeholder: spec.invoiceGraftPlaceholder,
    performance_profile: spec.performanceProfile,
  };
}

function buildBookingMetadata(
  spec: EnterpriseDemoSurgerySpec,
  surgeonFiUserId: string | null
): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_BOOKING_METADATA_FLAG]: true,
    enterprise_demo: true,
    [ENTERPRISE_DEMO_BOOKING_KEY_METADATA]: spec.demoBookingKey,
    demo_surgery_key: spec.demoSurgeryKey,
    demo_case_key: spec.demoCaseKey,
    demo_consultation_key: spec.demoConsultationKey,
    demo_patient_key: spec.demoPatientKey,
    demo_clinic_slug: spec.clinicSlug,
    procedure_type: spec.procedureType,
    graft_count_estimate: String(spec.graftTarget),
    hair_count_estimate: spec.hairCountEstimate,
    punch_size: spec.punchSize,
    extraction_technique: spec.extractionTechnique,
    implantation_method: spec.implantationMethod,
    day_count: spec.dayCount,
    technique: spec.extractionTechnique,
    surgeon_user_id: surgeonFiUserId,
    quoted_graft_estimate: spec.quotedGraftEstimate,
    quoted_value: spec.quotedValue,
    invoice_graft_placeholder: spec.invoiceGraftPlaceholder,
    performance_profile: spec.performanceProfile,
  };
}

function buildSurgeryMetadata(
  spec: EnterpriseDemoSurgerySpec,
  surgeonFiUserId: string | null
): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_SURGERY_METADATA_FLAG]: true,
    enterprise_demo: true,
    [ENTERPRISE_DEMO_SURGERY_KEY_METADATA]: spec.demoSurgeryKey,
    demo_case_key: spec.demoCaseKey,
    demo_booking_key: spec.demoBookingKey,
    demo_consultation_key: spec.demoConsultationKey,
    demo_patient_key: spec.demoPatientKey,
    demo_clinic_slug: spec.clinicSlug,
    lead_surgeon_staff_key: spec.leadSurgeonStaffKey,
    lead_surgeon_fi_user_id: surgeonFiUserId,
    procedure_type: spec.procedureType,
    hair_count_estimate: spec.hairCountEstimate,
    punch_size: spec.punchSize,
    extraction_technique: spec.extractionTechnique,
    implantation_method: spec.implantationMethod,
    day_count: spec.dayCount,
    transection_rate_percent: spec.transectionRatePercent,
    quoted_graft_estimate: spec.quotedGraftEstimate,
    quoted_value: spec.quotedValue,
    invoice_graft_placeholder: spec.invoiceGraftPlaceholder,
    performance_profile: spec.performanceProfile,
    technique: spec.extractionTechnique,
  };
}

function bookingStatusForSurgery(spec: EnterpriseDemoSurgerySpec): string {
  if (spec.surgeryStatus === "completed") return "completed";
  if (spec.surgeryStatus === "scheduled") return "confirmed";
  return "confirmed";
}

export async function seedEnterpriseDemoSurgeries(
  supabase: SupabaseClient,
  tenantId: string
): Promise<EnterpriseDemoSurgeriesSeedResult> {
  const warnings: string[] = [];
  let createdCases = 0;
  let existingCases = 0;
  let createdBookings = 0;
  let existingBookings = 0;
  let createdSurgeries = 0;
  let existingSurgeries = 0;
  let createdTeamAssignments = 0;
  let existingTeamAssignments = 0;
  let createdGraftSessions = 0;
  let existingGraftSessions = 0;
  let createdGraftEvents = 0;
  let existingGraftEvents = 0;
  let linkedConsultations = 0;
  let createdDemoUsers = 0;

  const specs = buildEnterpriseDemoSurgerySpecs();
  const validation = validateEnterpriseDemoSurgerySpecs(specs);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const clinicIdBySlug = await loadClinicIdBySlug(supabase, tenantId);
  const staffRows = await loadStaffRows(supabase, tenantId);
  const patientRows = await loadPatientRows(supabase, tenantId);
  const consultationRows = await loadConsultationRows(supabase, tenantId);
  const caseRows = await loadCaseRows(supabase, tenantId);
  const bookingRows = await loadBookingRows(supabase, tenantId);
  const surgeryRows = await loadSurgeryRows(supabase, tenantId);
  const now = new Date().toISOString();

  for (const spec of specs) {
    const clinicId = clinicIdBySlug.get(spec.clinicSlug);
    if (!clinicId) {
      warnings.push(`Clinic slug "${spec.clinicSlug}" not found; skipped surgery "${spec.demoSurgeryKey}".`);
      continue;
    }

    const patient = findPatientByDemoKey(patientRows, spec.demoPatientKey);
    if (!patient) {
      warnings.push(`Patient "${spec.demoPatientKey}" not found; skipped surgery "${spec.demoSurgeryKey}".`);
      continue;
    }

    const surgeonStaff = findStaffByDemoKey(staffRows, spec.leadSurgeonStaffKey);
    if (!surgeonStaff) {
      warnings.push(`Surgeon staff "${spec.leadSurgeonStaffKey}" not found for "${spec.demoSurgeryKey}".`);
    }

    let surgeonFiUserId: string | null = null;
    if (surgeonStaff) {
      const userResult = await ensureDemoFiUserForStaff(supabase, tenantId, surgeonStaff, now);
      surgeonFiUserId = userResult.fiUserId;
      if (userResult.created) createdDemoUsers += 1;
    }

    for (const member of spec.team) {
      const staff = findStaffByDemoKey(staffRows, member.demoStaffKey);
      if (!staff) continue;
      const userResult = await ensureDemoFiUserForStaff(supabase, tenantId, staff, now);
      if (userResult.created) createdDemoUsers += 1;
    }

    let caseId: string | null = null;
    const existingCase = findCaseByDemoKey(caseRows, spec.demoCaseKey);
    if (existingCase) {
      if (!isEnterpriseDemoCaseMetadata(existingCase.metadata)) {
        warnings.push(`Case key collision for "${spec.demoCaseKey}" on non-demo case; skipped surgery seed.`);
        continue;
      }
      existingCases += 1;
      caseId = existingCase.id;
    } else {
      const caseMetadata = buildCaseMetadata(spec);
      const { data: insertedCase, error: caseErr } = await supabase
        .from("fi_cases")
        .insert({
          tenant_id: tenantId,
          external_id: spec.demoCaseKey,
          clinic_id: clinicId,
          foundation_patient_id: patient.id,
          status: spec.surgeryStatus === "completed" ? "complete" : "processing",
          metadata: caseMetadata,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (caseErr) throw new Error(caseErr.message);
      caseId = String((insertedCase as { id: string }).id);
      caseRows.push({
        id: caseId,
        external_id: spec.demoCaseKey,
        metadata: caseMetadata,
      });
      createdCases += 1;
    }

    const consultation = findConsultationByDemoKey(consultationRows, spec.demoConsultationKey);
    if (consultation && caseId && consultation.case_id !== caseId) {
      const { error: linkErr } = await supabase
        .from("fi_consultations")
        .update({
          case_id: caseId,
          updated_at: now,
        })
        .eq("tenant_id", tenantId)
        .eq("id", consultation.id);
      if (linkErr) throw new Error(linkErr.message);
      consultation.case_id = caseId;
      linkedConsultations += 1;
    }

    let bookingId: string | null = null;
    const existingBooking = findBookingByDemoKey(bookingRows, spec.demoBookingKey);
    if (existingBooking) {
      if (!isEnterpriseDemoBookingMetadata(existingBooking.metadata)) {
        warnings.push(`Booking key collision for ${spec.demoBookingKey}; skipped.`);
        continue;
      }
      existingBookings += 1;
      bookingId = existingBooking.id;
    } else {
      const bookingMetadata = buildBookingMetadata(spec, surgeonFiUserId);
      const { data: insertedBooking, error: bookingErr } = await supabase
        .from("fi_bookings")
        .insert({
          tenant_id: tenantId,
          person_id: patient.person_id,
          patient_id: patient.id,
          case_id: caseId,
          clinic_id: clinicId,
          assigned_user_id: surgeonFiUserId,
          booking_type: "surgery",
          booking_status: bookingStatusForSurgery(spec),
          title: `${spec.displayName} - surgery day ${spec.dayCount}`,
          description: `${spec.extractionTechnique} procedure (${spec.implantationMethod})`,
          start_at: spec.scheduledStartAt,
          end_at: spec.scheduledEndAt,
          timezone: spec.timezone,
          location: spec.clinicSlug,
          metadata: bookingMetadata,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (bookingErr) throw new Error(bookingErr.message);
      bookingId = String((insertedBooking as { id: string }).id);
      bookingRows.push({ id: bookingId, metadata: bookingMetadata });
      createdBookings += 1;
    }

    let surgeryId: string | null = null;
    const existingSurgery = findSurgeryByDemoKey(surgeryRows, spec.demoSurgeryKey);
    if (existingSurgery) {
      if (!isEnterpriseDemoSurgeryMetadata(existingSurgery.metadata)) {
        warnings.push(`Surgery key collision for ${spec.demoSurgeryKey}; skipped graft seed.`);
        continue;
      }
      existingSurgeries += 1;
      surgeryId = existingSurgery.id;
    } else if (bookingId) {
      const surgeryMetadata = buildSurgeryMetadata(spec, surgeonFiUserId);
      const { data: insertedSurgery, error: surgeryErr } = await supabase
        .from("fi_surgeries")
        .insert({
          tenant_id: tenantId,
          patient_id: patient.id,
          case_id: caseId,
          booking_id: bookingId,
          clinic_id: clinicId,
          surgeon_fi_user_id: surgeonFiUserId,
          status: spec.surgeryStatus,
          live_status: spec.liveStatus,
          procedure_phase: spec.procedurePhase,
          target_grafts: spec.graftTarget,
          scheduled_date: spec.scheduledDate,
          scheduled_start_at: spec.scheduledStartAt,
          scheduled_end_at: spec.scheduledEndAt,
          actual_start_at:
            spec.surgeryStatus === "completed" || spec.surgeryStatus === "in_progress" || spec.surgeryStatus === "paused"
              ? spec.scheduledStartAt
              : null,
          actual_end_at: spec.surgeryStatus === "completed" ? spec.scheduledEndAt : null,
          readiness_percent: spec.surgeryStatus === "completed" ? 100 : spec.surgeryStatus === "scheduled" ? 40 : 75,
          readiness_risk_level:
            spec.performanceProfile === "elevated_transection" ? "high" : "low",
          metadata: surgeryMetadata,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (surgeryErr) throw new Error(surgeryErr.message);
      surgeryId = String((insertedSurgery as { id: string }).id);
      surgeryRows.push({ id: surgeryId, metadata: surgeryMetadata, booking_id: bookingId });
      createdSurgeries += 1;
    }

    if (!surgeryId) continue;

    for (const member of spec.team) {
      const staff = findStaffByDemoKey(staffRows, member.demoStaffKey);
      if (!staff?.fi_user_id) {
        warnings.push(
          `Team member "${member.demoStaffKey}" has no fi_user for surgery "${spec.demoSurgeryKey}".`
        );
        continue;
      }

      const { data: existingAssignment, error: assignFindErr } = await supabase
        .from("fi_surgery_team_assignments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("surgery_id", surgeryId)
        .eq("fi_user_id", staff.fi_user_id)
        .eq("role", member.role)
        .maybeSingle();
      if (assignFindErr) throw new Error(assignFindErr.message);

      if (existingAssignment?.id) {
        existingTeamAssignments += 1;
        continue;
      }

      const { error: assignErr } = await supabase.from("fi_surgery_team_assignments").insert({
        tenant_id: tenantId,
        surgery_id: surgeryId,
        fi_user_id: staff.fi_user_id,
        role: member.role,
        assignment_status: member.assignmentStatus,
        assigned_at: now,
        metadata: {
          enterprise_demo: true,
          demo_staff_key: member.demoStaffKey,
          demo_surgery_key: spec.demoSurgeryKey,
        },
        updated_at: now,
      });
      if (assignErr) throw new Error(assignErr.message);
      createdTeamAssignments += 1;
    }

    const graftSession = spec.graftSession;
    if (!graftSession) continue;

    const { data: existingSession, error: sessionFindErr } = await supabase
      .from("fi_surgery_graft_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("surgery_id", surgeryId)
      .maybeSingle();
    if (sessionFindErr) throw new Error(sessionFindErr.message);

    let sessionId: string;
    if (existingSession?.id) {
      existingGraftSessions += 1;
      sessionId = String((existingSession as { id: string }).id);
    } else {
      const { data: insertedSession, error: sessionErr } = await supabase
        .from("fi_surgery_graft_sessions")
        .insert({
          tenant_id: tenantId,
          surgery_id: surgeryId,
          phase: graftSession.phase,
          target_grafts: graftSession.targetGrafts,
          extracted_grafts: graftSession.extractedGrafts,
          implanted_grafts: graftSession.implantedGrafts,
          discarded_grafts: graftSession.discardedGrafts,
          remaining_grafts: graftSession.remainingGrafts,
          singles: graftSession.singles,
          doubles: graftSession.doubles,
          triples: graftSession.triples,
          multiples: graftSession.multiples,
          total_hairs: graftSession.totalHairs,
          average_hairs_per_graft: graftSession.averageHairsPerGraft,
          reconciliation_status: graftSession.reconciliationStatus,
          created_by_fi_user_id: surgeonFiUserId,
          reconciled_by_fi_user_id:
            graftSession.reconciliationStatus === "completed" ? surgeonFiUserId : null,
          reconciled_at:
            graftSession.reconciliationStatus === "completed" ? spec.scheduledEndAt : null,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (sessionErr) throw new Error(sessionErr.message);
      sessionId = String((insertedSession as { id: string }).id);
      createdGraftSessions += 1;
    }

    for (const event of graftSession.events) {
      const { data: existingEvent, error: eventFindErr } = await supabase
        .from("fi_surgery_graft_count_events")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("session_id", sessionId)
        .eq("client_submission_id", event.demoGraftEventKey)
        .maybeSingle();
      if (eventFindErr) throw new Error(eventFindErr.message);

      if (existingEvent?.id) {
        existingGraftEvents += 1;
        continue;
      }

      const { error: eventErr } = await supabase.from("fi_surgery_graft_count_events").insert({
        tenant_id: tenantId,
        surgery_id: surgeryId,
        session_id: sessionId,
        event_type: event.eventType,
        delta_extracted: event.deltaExtracted,
        delta_implanted: event.deltaImplanted,
        delta_discarded: event.deltaDiscarded,
        singles: event.singles,
        doubles: event.doubles,
        triples: event.triples,
        multiples: event.multiples,
        total_hairs: event.totalHairs,
        note: event.note,
        created_by_fi_user_id: surgeonFiUserId,
        client_submission_id: event.demoGraftEventKey,
        created_at: now,
      });
      if (eventErr) {
        if (eventErr.code === "23505") {
          existingGraftEvents += 1;
          continue;
        }
        throw new Error(eventErr.message);
      }
      createdGraftEvents += 1;
    }
  }

  return {
    createdCases,
    existingCases,
    createdBookings,
    existingBookings,
    createdSurgeries,
    existingSurgeries,
    createdTeamAssignments,
    existingTeamAssignments,
    createdGraftSessions,
    existingGraftSessions,
    createdGraftEvents,
    existingGraftEvents,
    linkedConsultations,
    createdDemoUsers,
    warnings,
  };
}
