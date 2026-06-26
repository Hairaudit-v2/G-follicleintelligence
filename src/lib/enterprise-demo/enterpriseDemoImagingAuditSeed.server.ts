import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ENTERPRISE_DEMO_AUDIT_KEY_METADATA,
  ENTERPRISE_DEMO_CASE_KEY_METADATA,
  ENTERPRISE_DEMO_IMAGE_KEY_METADATA,
  ENTERPRISE_DEMO_PROTOCOL_SESSION_KEY_METADATA,
  ENTERPRISE_DEMO_SURGERY_KEY_METADATA,
} from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoImagingAuditBundles,
  ENTERPRISE_DEMO_IMAGING_PROTOCOL_TEMPLATE_SLUG,
  validateEnterpriseDemoImagingAuditBundles,
  type EnterpriseDemoImageSpec,
  type EnterpriseDemoImagingAuditBundleSpec,
  type EnterpriseDemoOutcomeAuditSpec,
  type EnterpriseDemoProtocolSessionSpec,
} from "./enterpriseDemoImagingAuditGenerator";
import { ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA } from "./enterpriseDemoPatientsSeed.server";
import {
  ENTERPRISE_DEMO_DEFAULT_VOLUME,
  type EnterpriseDemoVolumeOptions,
} from "./enterpriseDemoVolumeOptions";

export const ENTERPRISE_DEMO_IMAGE_METADATA_FLAG = "enterprise_demo_image";
export const ENTERPRISE_DEMO_AUDIT_METADATA_FLAG = "enterprise_demo_audit";
export const ENTERPRISE_DEMO_PROTOCOL_SESSION_METADATA_FLAG = "enterprise_demo_protocol_session";

export type EnterpriseDemoImagingAuditSeedResult = {
  createdImages: number;
  existingImages: number;
  createdProtocolSessions: number;
  existingProtocolSessions: number;
  createdOutcomeAudits: number;
  existingOutcomeAudits: number;
  warnings: string[];
};

type PatientRow = {
  id: string;
  person_id: string;
  metadata: Record<string, unknown> | null;
};

type CaseRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type SurgeryRow = {
  id: string;
  booking_id: string | null;
  metadata: Record<string, unknown> | null;
};

type ClinicRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type ConsultationRow = {
  id: string;
  structured_data: Record<string, unknown> | null;
};

type PatientImageRow = {
  id: string;
  metadata: Record<string, unknown> | null;
  storage_path: string;
};

type OutcomeMeasurementRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

function metadataKey(metadata: unknown, key: string): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEnterpriseDemoImageMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_IMAGE_METADATA_FLAG] === true;
}

function isEnterpriseDemoAuditMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_AUDIT_METADATA_FLAG] === true;
}

function clinicMetadataSlug(row: ClinicRow): string | null {
  const slug = row.metadata?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
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

async function loadCaseRows(supabase: SupabaseClient, tenantId: string): Promise<CaseRow[]> {
  const { data, error } = await supabase
    .from("fi_cases")
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
    .select("id, booking_id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; booking_id: string | null; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      booking_id: raw.booking_id != null ? String(raw.booking_id) : null,
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

async function loadDemoImageRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PatientImageRow[]> {
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("id, metadata, storage_path")
    .eq("tenant_id", tenantId)
    .contains("metadata", { [ENTERPRISE_DEMO_IMAGE_METADATA_FLAG]: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown; storage_path: string };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      metadata,
      storage_path: String(raw.storage_path),
    };
  });
}

async function loadDemoOutcomeRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<OutcomeMeasurementRow[]> {
  const { data, error } = await supabase
    .from("fi_patient_outcome_measurements")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .contains("metadata", { [ENTERPRISE_DEMO_AUDIT_METADATA_FLAG]: true });
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

function findPatientByDemoKey(rows: PatientRow[], key: string): PatientRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, "demo_patient_key") === key);
}

function findCaseByDemoKey(rows: CaseRow[], key: string): CaseRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, ENTERPRISE_DEMO_CASE_KEY_METADATA) === key);
}

function findConsultationByDemoKey(rows: ConsultationRow[], key: string): ConsultationRow | undefined {
  return rows.find((row) => metadataKey(row.structured_data, ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA) === key);
}

function findImageByDemoKey(rows: PatientImageRow[], key: string): PatientImageRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, ENTERPRISE_DEMO_IMAGE_KEY_METADATA) === key);
}

function findOutcomeByDemoKey(rows: OutcomeMeasurementRow[], key: string): OutcomeMeasurementRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, ENTERPRISE_DEMO_AUDIT_KEY_METADATA) === key);
}

function buildImageMetadata(image: EnterpriseDemoImageSpec): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_IMAGE_METADATA_FLAG]: true,
    enterprise_demo: true,
    synthetic: true,
    [ENTERPRISE_DEMO_IMAGE_KEY_METADATA]: image.demoImageKey,
    demo_surgery_key: image.demoSurgeryKey,
    demo_case_key: image.demoCaseKey,
    demo_patient_key: image.demoPatientKey,
    demo_clinic_slug: image.clinicSlug,
    protocol_slot: image.slot,
    quality_status: image.qualityStatus,
    quality_flags: image.qualityFlags,
  };
}

function buildProtocolProgress(
  session: EnterpriseDemoProtocolSessionSpec,
  imageIdByKey: Map<string, string>
): Record<string, unknown> {
  const progress: Record<string, unknown> = {
    _demo: {
      [ENTERPRISE_DEMO_PROTOCOL_SESSION_METADATA_FLAG]: true,
      [ENTERPRISE_DEMO_PROTOCOL_SESSION_KEY_METADATA]: session.demoProtocolSessionKey,
      completion_profile: session.completionProfile,
      protocol_completion_status: session.protocolCompletionStatus,
      slots_expected: session.slotsExpected,
      slots_filled: session.slotsFilled,
      missing_slots: session.missingSlots,
      quality_flagged_slots: session.qualityFlaggedSlots,
    },
  };

  for (const [slot, demoImageKey] of Object.entries(session.slotImageKeys)) {
    const imageId = imageIdByKey.get(demoImageKey);
    if (imageId) progress[slot] = imageId;
  }

  return progress;
}

function buildOutcomeMetadata(audit: EnterpriseDemoOutcomeAuditSpec): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_AUDIT_METADATA_FLAG]: true,
    enterprise_demo: true,
    [ENTERPRISE_DEMO_AUDIT_KEY_METADATA]: audit.demoAuditKey,
    demo_surgery_key: audit.demoSurgeryKey,
    demo_case_key: audit.demoCaseKey,
    demo_patient_key: audit.demoPatientKey,
    demo_clinic_slug: audit.clinicSlug,
    audit_status: audit.auditStatus,
    warnings: audit.warnings,
    performance_profile: audit.clinicSlug,
  };
}

export async function seedEnterpriseDemoImagingAndAudit(
  supabase: SupabaseClient,
  tenantId: string,
  volume: EnterpriseDemoVolumeOptions = ENTERPRISE_DEMO_DEFAULT_VOLUME
): Promise<EnterpriseDemoImagingAuditSeedResult> {
  const warnings: string[] = [];
  let createdImages = 0;
  let existingImages = 0;
  let createdProtocolSessions = 0;
  let existingProtocolSessions = 0;
  let createdOutcomeAudits = 0;
  let existingOutcomeAudits = 0;

  const bundles = buildEnterpriseDemoImagingAuditBundles(undefined, volume);
  const validation = validateEnterpriseDemoImagingAuditBundles(bundles, volume);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const clinicIdBySlug = await loadClinicIdBySlug(supabase, tenantId);
  const patientRows = await loadPatientRows(supabase, tenantId);
  const caseRows = await loadCaseRows(supabase, tenantId);
  const surgeryRows = await loadSurgeryRows(supabase, tenantId);
  const consultationRows = await loadConsultationRows(supabase, tenantId);
  const imageRows = await loadDemoImageRows(supabase, tenantId);
  const outcomeRows = await loadDemoOutcomeRows(supabase, tenantId);
  const now = new Date().toISOString();

  for (const bundle of bundles) {
    await seedBundle({
      supabase,
      tenantId,
      bundle,
      clinicIdBySlug,
      patientRows,
      caseRows,
      surgeryRows,
      consultationRows,
      imageRows,
      outcomeRows,
      now,
      stats: {
        createdImages: () => {
          createdImages += 1;
        },
        existingImages: () => {
          existingImages += 1;
        },
        createdProtocolSessions: () => {
          createdProtocolSessions += 1;
        },
        existingProtocolSessions: () => {
          existingProtocolSessions += 1;
        },
        createdOutcomeAudits: () => {
          createdOutcomeAudits += 1;
        },
        existingOutcomeAudits: () => {
          existingOutcomeAudits += 1;
        },
      },
      warnings,
    });
  }

  return {
    createdImages,
    existingImages,
    createdProtocolSessions,
    existingProtocolSessions,
    createdOutcomeAudits,
    existingOutcomeAudits,
    warnings,
  };
}

async function seedBundle(ctx: {
  supabase: SupabaseClient;
  tenantId: string;
  bundle: EnterpriseDemoImagingAuditBundleSpec;
  clinicIdBySlug: Map<string, string>;
  patientRows: PatientRow[];
  caseRows: CaseRow[];
  surgeryRows: SurgeryRow[];
  consultationRows: ConsultationRow[];
  imageRows: PatientImageRow[];
  outcomeRows: OutcomeMeasurementRow[];
  now: string;
  stats: {
    createdImages: () => void;
    existingImages: () => void;
    createdProtocolSessions: () => void;
    existingProtocolSessions: () => void;
    createdOutcomeAudits: () => void;
    existingOutcomeAudits: () => void;
  };
  warnings: string[];
}): Promise<void> {
  const { bundle, supabase, tenantId, now, stats, warnings } = ctx;
  const spec = bundle.surgery;

  const clinicId = ctx.clinicIdBySlug.get(spec.clinicSlug);
  if (!clinicId) {
    warnings.push(`Clinic "${spec.clinicSlug}" not found; skipped imaging for "${spec.demoSurgeryKey}".`);
    return;
  }

  const patient = findPatientByDemoKey(ctx.patientRows, spec.demoPatientKey);
  if (!patient) {
    warnings.push(`Patient "${spec.demoPatientKey}" not found; skipped imaging for "${spec.demoSurgeryKey}".`);
    return;
  }

  const caseRow = findCaseByDemoKey(ctx.caseRows, spec.demoCaseKey);
  if (!caseRow) {
    warnings.push(`Case "${spec.demoCaseKey}" not found; skipped imaging for "${spec.demoSurgeryKey}".`);
    return;
  }

  const surgeryRow = ctx.surgeryRows.find(
    (row) => metadataKey(row.metadata, ENTERPRISE_DEMO_SURGERY_KEY_METADATA) === spec.demoSurgeryKey
  );
  const consultation = findConsultationByDemoKey(ctx.consultationRows, spec.demoConsultationKey);

  const imageIdByKey = new Map<string, string>();

  for (const image of bundle.images) {
    const existing = findImageByDemoKey(ctx.imageRows, image.demoImageKey);
    if (existing) {
      if (!isEnterpriseDemoImageMetadata(existing.metadata)) {
        warnings.push(`Image key collision for "${image.demoImageKey}"; skipped.`);
        continue;
      }
      stats.existingImages();
      imageIdByKey.set(image.demoImageKey, existing.id);
      continue;
    }

    const imageMetadata = buildImageMetadata(image);
    const { data: inserted, error } = await supabase
      .from("fi_patient_images")
      .insert({
        tenant_id: tenantId,
        patient_id: patient.id,
        person_id: patient.person_id,
        case_id: caseRow.id,
        booking_id: surgeryRow?.booking_id ?? null,
        consultation_id: consultation?.id ?? null,
        clinic_id: clinicId,
        image_category: image.imageCategory,
        image_status: "active",
        imaging_library_axis: image.imagingLibraryAxis,
        anatomical_region: image.anatomicalRegion,
        visit_type: image.visitType,
        follow_up_interval: image.followUpInterval,
        imaging_protocol_template_slug: ENTERPRISE_DEMO_IMAGING_PROTOCOL_TEMPLATE_SLUG,
        imaging_protocol_slot_slug: image.slot,
        storage_bucket: "patient-images",
        storage_path: image.storagePath,
        original_filename: image.originalFilename,
        content_type: "image/jpeg",
        file_size_bytes: 0,
        caption: `TITAN demo — ${image.slot}`,
        taken_at: image.takenAt,
        metadata: imageMetadata,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        stats.existingImages();
        const retry = findImageByDemoKey(ctx.imageRows, image.demoImageKey);
        if (retry) imageIdByKey.set(image.demoImageKey, retry.id);
        continue;
      }
      throw new Error(error.message);
    }

    const imageId = String((inserted as { id: string }).id);
    imageIdByKey.set(image.demoImageKey, imageId);
    ctx.imageRows.push({ id: imageId, metadata: imageMetadata, storage_path: image.storagePath });
    stats.createdImages();
  }

  if (bundle.protocolSession && imageIdByKey.size > 0) {
    const session = bundle.protocolSession;
    const { data: existingSession, error: sessionFindErr } = await supabase
      .from("fi_imaging_protocol_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("case_id", caseRow.id)
      .eq("template_slug", ENTERPRISE_DEMO_IMAGING_PROTOCOL_TEMPLATE_SLUG)
      .maybeSingle();
    if (sessionFindErr) throw new Error(sessionFindErr.message);

    if (existingSession?.id) {
      stats.existingProtocolSessions();
    } else {
      const progress = buildProtocolProgress(session, imageIdByKey);
      const { error: sessionErr } = await supabase.from("fi_imaging_protocol_sessions").insert({
        tenant_id: tenantId,
        patient_id: patient.id,
        case_id: caseRow.id,
        consultation_id: consultation?.id ?? null,
        template_slug: ENTERPRISE_DEMO_IMAGING_PROTOCOL_TEMPLATE_SLUG,
        progress,
        created_at: now,
        updated_at: now,
      });
      if (sessionErr) throw new Error(sessionErr.message);
      stats.createdProtocolSessions();
    }
  }

  for (const audit of bundle.outcomeAudits) {
    if (audit.auditStatus === "not_applicable") continue;

    const existing = findOutcomeByDemoKey(ctx.outcomeRows, audit.demoAuditKey);
    if (existing) {
      if (!isEnterpriseDemoAuditMetadata(existing.metadata)) {
        warnings.push(`Audit key collision for "${audit.demoAuditKey}"; skipped.`);
        continue;
      }
      stats.existingOutcomeAudits();
      continue;
    }

    const outcomeMetadata = buildOutcomeMetadata(audit);
    const { error: outcomeErr } = await supabase.from("fi_patient_outcome_measurements").insert({
      tenant_id: tenantId,
      patient_id: patient.id,
      case_id: caseRow.id,
      checkpoint_key: audit.checkpointKey,
      measurement_date: audit.measurementDate,
      metric_values: audit.metricValues,
      imaging_refs: audit.imagingRefs,
      audit_refs: [],
      confidence_level: audit.confidenceLevel,
      visibility_scope: "tenant_clinical",
      metadata: outcomeMetadata,
      created_at: now,
      updated_at: now,
    });

    if (outcomeErr) {
      if (outcomeErr.code === "23505") {
        stats.existingOutcomeAudits();
        continue;
      }
      throw new Error(outcomeErr.message);
    }

    ctx.outcomeRows.push({ id: "pending", metadata: outcomeMetadata });
    stats.createdOutcomeAudits();
  }
}
