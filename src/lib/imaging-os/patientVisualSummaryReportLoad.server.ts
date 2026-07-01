import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { loadPatientImagesProfileBundle } from "@/src/lib/patientImages/patientImagesServer";
import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import { loadGraftSessionsForSurgeries } from "@/src/lib/surgeryOs/surgeryGraftMutations.server";
import {
  buildPatientVisualSummaryReport,
  readPatientVisualSummaryStaffRecord,
  type PatientVisualSummaryGraftCompositionInput,
  type PatientVisualSummaryReportBuildInput,
} from "./patientVisualSummaryReportCore";
import type {
  PatientVisualSummaryReport,
  PatientVisualSummaryReportType,
} from "./patientVisualSummaryReportTypes";

export type LoadPatientVisualSummaryReportInput = {
  tenantId: string;
  patientId: string;
  reportType: PatientVisualSummaryReportType;
  caseId?: string | null;
  surgeryId?: string | null;
  useInitials?: boolean;
  client?: SupabaseClient;
};

async function loadCaseContext(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string
): Promise<{
  metadata: Record<string, unknown>;
  recipientStrategyNotes: string | null;
  surgicalPlanSummary: string | null;
  procedureDate: string | null;
}> {
  const { data: caseRow } = await supabase
    .from("fi_cases")
    .select("metadata, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", caseId)
    .maybeSingle();

  const meta =
    caseRow?.metadata && typeof caseRow.metadata === "object" && !Array.isArray(caseRow.metadata)
      ? (caseRow.metadata as Record<string, unknown>)
      : {};

  const { data: planRow } = await supabase
    .from("fi_case_surgery_plans")
    .select(
      "recipient_strategy_notes, surgical_plan_summary, updated_at, created_at"
    )
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId)
    .maybeSingle();

  return {
    metadata: meta,
    recipientStrategyNotes:
      typeof planRow?.recipient_strategy_notes === "string"
        ? planRow.recipient_strategy_notes
        : null,
    surgicalPlanSummary:
      typeof planRow?.surgical_plan_summary === "string" ? planRow.surgical_plan_summary : null,
    procedureDate: planRow?.updated_at ?? planRow?.created_at ?? caseRow?.created_at ?? null,
  };
}

async function loadSurgeryProcedureDate(
  supabase: SupabaseClient,
  tenantId: string,
  surgeryId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("fi_surgeries")
    .select("scheduled_date, actual_start_at, metadata")
    .eq("tenant_id", tenantId)
    .eq("id", surgeryId)
    .maybeSingle();
  if (!data) return null;
  return (
    (typeof data.actual_start_at === "string" ? data.actual_start_at : null) ??
    (typeof data.scheduled_date === "string" ? data.scheduled_date : null)
  );
}

async function loadPatientName(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<string> {
  const { data: patient } = await supabase
    .from("fi_patients")
    .select("person_id, metadata")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();

  if (!patient?.person_id) return "Patient";

  const { data: person } = await supabase
    .from("fi_persons")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("id", patient.person_id)
    .maybeSingle();

  const personMeta =
    person?.metadata && typeof person.metadata === "object" && !Array.isArray(person.metadata)
      ? (person.metadata as Record<string, unknown>)
      : {};
  const patientMeta =
    patient.metadata && typeof patient.metadata === "object" && !Array.isArray(patient.metadata)
      ? (patient.metadata as Record<string, unknown>)
      : {};

  return displayFromPersonMetadata(personMeta, patientMeta).name;
}

async function loadClinicName(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("fi_tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  const name = typeof data?.name === "string" ? data.name : null;
  return name?.trim() || null;
}

function filterImagesForContext(
  images: PatientImageRow[],
  input: { caseId?: string | null; surgeryId?: string | null; reportType: PatientVisualSummaryReportType }
): PatientImageRow[] {
  let filtered = images;
  if (input.caseId?.trim()) {
    filtered = filtered.filter((img) => img.case_id === input.caseId!.trim());
  }
  if (input.reportType === "hairaudit_visual_summary") {
    const audit = filtered.filter(
      (img) => img.metadata?.upload_source === "hairaudit"
    );
    if (audit.length > 0) filtered = audit;
  }
  return filtered;
}

export async function loadPatientVisualSummaryReport(
  input: LoadPatientVisualSummaryReportInput
): Promise<PatientVisualSummaryReport> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const caseId = input.caseId?.trim() || null;
  const surgeryId = input.surgeryId?.trim() || null;

  const [bundle, patientName, clinicName, caseCtx] = await Promise.all([
    loadPatientImagesProfileBundle(tid, pid, supabase),
    loadPatientName(supabase, tid, pid),
    loadClinicName(supabase, tid),
    caseId ? loadCaseContext(supabase, tid, caseId) : Promise.resolve(null),
  ]);

  const signedById = new Map(
    bundle.activeWithSignedUrls.map((t) => [t.image.id, t.signed.url] as const)
  );

  const images = filterImagesForContext(
    bundle.activeWithSignedUrls.map((t) => t.image),
    { caseId, surgeryId, reportType: input.reportType }
  );

  const imageInputs: PatientVisualSummaryReportBuildInput["images"] = images.map((image) => ({
    image,
    previewSignedUrl: signedById.get(image.id) ?? null,
  }));

  let graftComposition: PatientVisualSummaryGraftCompositionInput = null;
  let procedureDate = caseCtx?.procedureDate ?? null;

  if (surgeryId) {
    const sessions = await loadGraftSessionsForSurgeries(tid, [surgeryId]);
    const session = sessions.get(surgeryId);
    if (session) {
      graftComposition = {
        singles: session.singles,
        doubles: session.doubles,
        triples: session.triples,
        multiples: session.multiples,
      };
    }
    const surgeryDate = await loadSurgeryProcedureDate(supabase, tid, surgeryId);
    if (surgeryDate) procedureDate = surgeryDate;
  }

  const staffRecord = readPatientVisualSummaryStaffRecord(caseCtx?.metadata ?? null);

  const buildInput: PatientVisualSummaryReportBuildInput = {
    reportType: input.reportType,
    patientName,
    useInitials: input.useInitials,
    clinicName,
    procedureOrAuditDate: procedureDate,
    images: imageInputs,
    graftComposition,
    staffRecord,
    recipientStrategyNotes: caseCtx?.recipientStrategyNotes ?? null,
    surgicalPlanSummary: caseCtx?.surgicalPlanSummary ?? null,
    caseMetadata: caseCtx?.metadata ?? null,
    surgeryId,
    longitudinalComparisonAvailable: images.length >= 2,
  };

  return buildPatientVisualSummaryReport(buildInput);
}