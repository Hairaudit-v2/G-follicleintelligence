import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildEnterpriseDemoPatientConsultationSpecs,
  ENTERPRISE_DEMO_SOURCE_SYSTEM,
  type EnterpriseDemoPatientConsultationSpec,
  validateEnterpriseDemoPatientConsultationSpecs,
} from "./enterpriseDemoPatientsGenerator";

export const ENTERPRISE_DEMO_PATIENT_METADATA_FLAG = "enterprise_demo_patient";
export const ENTERPRISE_DEMO_PATIENT_KEY_METADATA = "demo_patient_key";
export const ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA = "demo_consultation_key";

export type EnterpriseDemoPatientsSeedResult = {
  createdPatients: number;
  existingPatients: number;
  createdConsultations: number;
  existingConsultations: number;
  createdClinicalDetails: number;
  existingClinicalDetails: number;
  warnings: string[];
};

type ClinicRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type PersonRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type PatientRow = {
  id: string;
  person_id: string;
  metadata: Record<string, unknown> | null;
};

type StaffRow = {
  id: string;
  staff_metadata: Record<string, unknown> | null;
};

type ConsultationRow = {
  id: string;
  structured_data: Record<string, unknown> | null;
};

function clinicMetadataSlug(row: ClinicRow): string | null {
  const slug = row.metadata?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

function isEnterpriseDemoPatientMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_PATIENT_METADATA_FLAG] === true;
}

function demoPatientKeyFromMetadata(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const key = (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_PATIENT_KEY_METADATA];
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function demoConsultationKeyFromStructured(data: unknown): string | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const key = (data as Record<string, unknown>)[ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA];
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function demoStaffKeyFromMetadata(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const key = (metadata as Record<string, unknown>).demo_staff_key;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function buildPersonMetadata(spec: EnterpriseDemoPatientConsultationSpec): Record<string, unknown> {
  return {
    display_name: spec.displayName,
    normalised_display_name: spec.displayName.toLowerCase(),
    email: spec.email,
    email_normalized: spec.email.toLowerCase(),
    gender: spec.gender,
    age_band: spec.ageBand,
    enterprise_demo_person: true,
    demo_patient_key: spec.demoPatientKey,
    demo_clinic_slug: spec.clinicSlug,
  };
}

function buildPatientMetadata(spec: EnterpriseDemoPatientConsultationSpec): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_PATIENT_METADATA_FLAG]: true,
    [ENTERPRISE_DEMO_PATIENT_KEY_METADATA]: spec.demoPatientKey,
    demo_clinic_slug: spec.clinicSlug,
    gender: spec.gender,
    age_band: spec.ageBand,
    lead_source: spec.leadSource,
    norwood_scale: spec.norwoodScale,
    ludwig_scale: spec.ludwigScale,
    savin_scale: spec.savinScale,
    diagnosis_summary: spec.diagnosis,
  };
}

function buildConsultationStructuredData(
  spec: EnterpriseDemoPatientConsultationSpec,
  clinicSlug: string
): Record<string, unknown> {
  return {
    enterprise_demo: true,
    [ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA]: spec.demoConsultationKey,
    demo_patient_key: spec.demoPatientKey,
    demo_clinic_slug: clinicSlug,
    lead_source: spec.leadSource,
    diagnosis_summary: spec.diagnosis,
    conversion_outcome: spec.conversionOutcome,
    gender: spec.gender,
    age_band: spec.ageBand,
    norwood_scale: spec.norwoodScale,
    ludwig_scale: spec.ludwigScale,
    savin_scale: spec.savinScale,
    quoted_treatment: spec.quotedTreatment,
    assessment: {
      pattern_summary: spec.diagnosis,
      norwood_scale: spec.norwoodScale,
      ludwig_scale: spec.ludwigScale,
      savin_scale: spec.savinScale,
    },
  };
}

function buildConsultationQuoteData(spec: EnterpriseDemoPatientConsultationSpec): Record<string, unknown> {
  if (!spec.quotedTreatment || spec.quotedValue == null) return {};
  return {
    price_quoted: spec.quotedValue,
    graft_estimate: spec.graftEstimate,
    session_size: spec.quotedTreatment.includes("two-stage") ? "2" : "1",
    quote_status:
      spec.consultationStatus === "quoted"
        ? "issued"
        : spec.consultationStatus === "accepted" || spec.consultationStatus === "converted_to_case"
          ? "accepted"
          : "draft",
    quoted_treatment_label: spec.quotedTreatment,
  };
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

async function loadStaffIdByDemoKey(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, staff_metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const staff = row as StaffRow;
    const key = demoStaffKeyFromMetadata(staff.staff_metadata);
    if (key) map.set(key, String(staff.id));
  }
  return map;
}

async function loadExistingPersons(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PersonRow[]> {
  const { data, error } = await supabase
    .from("fi_persons")
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

async function loadExistingPatients(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PatientRow[]> {
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

async function loadExistingConsultations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ConsultationRow[]> {
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("id, structured_data")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; structured_data: unknown };
    const structured_data =
      raw.structured_data && typeof raw.structured_data === "object" && !Array.isArray(raw.structured_data)
        ? (raw.structured_data as Record<string, unknown>)
        : null;
    return { id: String(raw.id), structured_data };
  });
}

async function loadClinicalDetailsPatientIds(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("fi_patient_clinical_details")
    .select("patient_id")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return new Set((data ?? []).map((row) => String((row as { patient_id: string }).patient_id)));
}

function findPersonByDemoKey(rows: PersonRow[], key: string): PersonRow | undefined {
  return rows.find((row) => demoPatientKeyFromMetadata(row.metadata) === key);
}

function findPatientByDemoKey(rows: PatientRow[], key: string): PatientRow | undefined {
  return rows.find((row) => demoPatientKeyFromMetadata(row.metadata) === key);
}

function findConsultationByDemoKey(rows: ConsultationRow[], key: string): ConsultationRow | undefined {
  return rows.find((row) => demoConsultationKeyFromStructured(row.structured_data) === key);
}

export async function seedEnterpriseDemoPatientsAndConsultations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<EnterpriseDemoPatientsSeedResult> {
  const warnings: string[] = [];
  let createdPatients = 0;
  let existingPatients = 0;
  let createdConsultations = 0;
  let existingConsultations = 0;
  let createdClinicalDetails = 0;
  let existingClinicalDetails = 0;

  const specs = buildEnterpriseDemoPatientConsultationSpecs();
  const validation = validateEnterpriseDemoPatientConsultationSpecs(specs);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const clinicIdBySlug = await loadClinicIdBySlug(supabase, tenantId);
  const staffIdByKey = await loadStaffIdByDemoKey(supabase, tenantId);
  const personRows = await loadExistingPersons(supabase, tenantId);
  const patientRows = await loadExistingPatients(supabase, tenantId);
  const consultationRows = await loadExistingConsultations(supabase, tenantId);
  const clinicalDetailPatientIds = await loadClinicalDetailsPatientIds(supabase, tenantId);
  const patientIdByKey = new Map<string, string>();
  const now = new Date().toISOString();

  for (const spec of specs) {
    const clinicId = clinicIdBySlug.get(spec.clinicSlug);
    if (!clinicId) {
      warnings.push(`Clinic slug "${spec.clinicSlug}" not found; skipped patient "${spec.demoPatientKey}".`);
      continue;
    }

    let personId: string | null = null;
    let patientId: string | null = null;

    const existingPatient = findPatientByDemoKey(patientRows, spec.demoPatientKey);
    if (existingPatient) {
      if (!isEnterpriseDemoPatientMetadata(existingPatient.metadata)) {
        warnings.push(
          `Patient key collision for "${spec.demoPatientKey}" on non-demo patient; skipped.`
        );
        existingPatients += 1;
        patientIdByKey.set(spec.demoPatientKey, existingPatient.id);
        personId = existingPatient.person_id;
      } else {
        existingPatients += 1;
        patientIdByKey.set(spec.demoPatientKey, existingPatient.id);
        personId = existingPatient.person_id;
      }
    } else {
      const existingPerson = findPersonByDemoKey(personRows, spec.demoPatientKey);
      if (existingPerson) {
        personId = existingPerson.id;
      } else {
        const personMetadata = buildPersonMetadata(spec);
        const { data: insertedPerson, error: personErr } = await supabase
          .from("fi_persons")
          .insert({
            tenant_id: tenantId,
            metadata: personMetadata,
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();
        if (personErr) throw new Error(personErr.message);
        personId = String((insertedPerson as { id: string }).id);

        const { error: personSourceErr } = await supabase.from("fi_person_source_ids").insert({
          tenant_id: tenantId,
          person_id: personId,
          source_system: ENTERPRISE_DEMO_SOURCE_SYSTEM,
          source_person_id: spec.demoPatientKey,
        });
        if (personSourceErr && personSourceErr.code !== "23505") {
          throw new Error(personSourceErr.message);
        }

        personRows.push({ id: personId, metadata: personMetadata });
      }

      const patientMetadata = buildPatientMetadata(spec);
      const { data: insertedPatient, error: patientErr } = await supabase
        .from("fi_patients")
        .insert({
          tenant_id: tenantId,
          person_id: personId,
          primary_clinic_id: clinicId,
          metadata: patientMetadata,
          patient_status: "active",
          reminder_consent: true,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (patientErr) throw new Error(patientErr.message);
      patientId = String((insertedPatient as { id: string }).id);

      const { error: patientSourceErr } = await supabase.from("fi_patient_source_ids").insert({
        tenant_id: tenantId,
        patient_id: patientId,
        source_system: ENTERPRISE_DEMO_SOURCE_SYSTEM,
        source_patient_id: spec.demoPatientKey,
      });
      if (patientSourceErr && patientSourceErr.code !== "23505") {
        throw new Error(patientSourceErr.message);
      }

      patientRows.push({
        id: patientId,
        person_id: personId,
        metadata: patientMetadata,
      });
      createdPatients += 1;
      patientIdByKey.set(spec.demoPatientKey, patientId);
    }

    if (!patientId) continue;

    if (!clinicalDetailPatientIds.has(patientId)) {
      const { error: clinicalErr } = await supabase.from("fi_patient_clinical_details").insert({
        tenant_id: tenantId,
        patient_id: patientId,
        person_id: personId,
        primary_hair_concern: spec.diagnosis,
        treatment_interest: spec.quotedTreatment ?? "Initial consultation",
        norwood_scale: spec.norwoodScale,
        ludwig_scale: spec.ludwigScale,
        primary_concern: spec.diagnosis,
        metadata: {
          enterprise_demo: true,
          demo_patient_key: spec.demoPatientKey,
          savin_scale: spec.savinScale,
          lead_source: spec.leadSource,
        },
        created_at: now,
        updated_at: now,
      });
      if (clinicalErr) throw new Error(clinicalErr.message);
      clinicalDetailPatientIds.add(patientId);
      createdClinicalDetails += 1;
    } else {
      existingClinicalDetails += 1;
    }

    const existingConsultation = findConsultationByDemoKey(consultationRows, spec.demoConsultationKey);
    if (existingConsultation) {
      existingConsultations += 1;
      continue;
    }

    const consultantStaffId = staffIdByKey.get(spec.consultantStaffKey) ?? null;
    if (!consultantStaffId) {
      warnings.push(
        `Consultant staff key "${spec.consultantStaffKey}" not found for consultation "${spec.demoConsultationKey}".`
      );
    }

    const structuredData = buildConsultationStructuredData(spec, spec.clinicSlug);
    const quoteData = buildConsultationQuoteData(spec);

    const { error: consultationErr } = await supabase.from("fi_consultations").insert({
      tenant_id: tenantId,
      person_id: personId,
      patient_id: patientId,
      consultation_type: spec.consultationType,
      status: spec.consultationStatus,
      consultant_name: null,
      consultant_staff_id: consultantStaffId,
      consultation_date: spec.consultationDate,
      structured_data: structuredData,
      live_notes: null,
      recommendation_notes:
        spec.quotedTreatment ? `Recommended plan: ${spec.quotedTreatment}.` : "Consultation in progress.",
      quote_data: quoteData,
      created_at: now,
      updated_at: now,
    });
    if (consultationErr) throw new Error(consultationErr.message);

    consultationRows.push({
      id: "pending",
      structured_data: structuredData,
    });
    createdConsultations += 1;
  }

  return {
    createdPatients,
    existingPatients,
    createdConsultations,
    existingConsultations,
    createdClinicalDetails,
    existingClinicalDetails,
    warnings,
  };
}
