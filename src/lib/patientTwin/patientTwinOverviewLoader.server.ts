/**
 * FI-DEMO-DAY-2A.4 — Assemble Patient Intelligence Overview for the Health record route.
 */

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";
import type { PatientTwinV1 } from "./patientTwinTypes";
import { composePatientIntelligenceOverview } from "./patientTwinOverviewComposer";
import type { PatientIntelligenceOverviewModel } from "./patientTwinOverviewTypes";
import { loadPatientInvoiceSummary } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import { loadPatientTwinSurgicalStory } from "./patientTwinSurgicalStory.server";
import { loadPatientTwinWorkforceOnDate } from "./patientTwinWorkforce.server";
import type { OutcomeMeasurementComposeRow } from "./patientTwinOutcomesCore";

export type LoadPatientIntelligenceOverviewParams = {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
  presentationMode?: boolean;
};

async function loadPatientMetadata(
  tenantId: string,
  patientId: string
): Promise<{
  patientMetadata: Record<string, unknown>;
  personMetadata: Record<string, unknown>;
}> {
  const supabase = supabaseAdmin();
  const { data: patient, error } = await supabase
    .from("fi_patients")
    .select("metadata, person_id")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const patientMetadata =
    patient?.metadata &&
    typeof patient.metadata === "object" &&
    !Array.isArray(patient.metadata)
      ? (patient.metadata as Record<string, unknown>)
      : {};

  let personMetadata: Record<string, unknown> = {};
  const personId = String((patient as { person_id?: string } | null)?.person_id ?? "").trim();
  if (personId) {
    const { data: person, error: personError } = await supabase
      .from("fi_persons")
      .select("metadata")
      .eq("tenant_id", tenantId)
      .eq("id", personId)
      .maybeSingle();
    if (personError && !isSupabaseMissingRelationError(personError)) {
      throw new Error(personError.message);
    }
    if (
      person?.metadata &&
      typeof person.metadata === "object" &&
      !Array.isArray(person.metadata)
    ) {
      personMetadata = person.metadata as Record<string, unknown>;
    }
  }

  return { patientMetadata, personMetadata };
}

async function loadOutcomeMeasurementsWithMetadata(
  tenantId: string,
  patientId: string
): Promise<OutcomeMeasurementComposeRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_outcome_measurements")
    .select("id, checkpoint_key, measurement_date, metric_values, metadata, case_id")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("measurement_date", { ascending: true, nullsFirst: false })
    .limit(100);
  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      checkpoint_key: String(r.checkpoint_key ?? ""),
      measurement_date: r.measurement_date ? String(r.measurement_date) : null,
      metric_values:
        r.metric_values && typeof r.metric_values === "object" && !Array.isArray(r.metric_values)
          ? (r.metric_values as Record<string, unknown>)
          : {},
      metadata:
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {},
    };
  });
}

function projectedFromMetadata(
  patientMetadata: Record<string, unknown>,
  caseMetadata: Record<string, unknown> | null
): {
  status?: string | null;
  graftTarget?: number | null;
  generatedAt?: string | null;
} | null {
  const sources = [patientMetadata, caseMetadata ?? {}];
  for (const meta of sources) {
    const projected = meta.projected_outcome;
    if (projected && typeof projected === "object" && !Array.isArray(projected)) {
      const p = projected as Record<string, unknown>;
      return {
        status: typeof p.status === "string" ? p.status : null,
        graftTarget:
          typeof p.graft_target === "number"
            ? p.graft_target
            : typeof p.target_grafts === "number"
              ? p.target_grafts
              : null,
        generatedAt:
          typeof p.generated_at === "string"
            ? p.generated_at
            : typeof p.milestone === "string"
              ? p.milestone
              : null,
      };
    }
  }
  return null;
}

/**
 * Server composition for the Health record overview.
 * Tenant scope is enforced on every SoR query; Package A/B remain isolated.
 */
export async function loadPatientIntelligenceOverview(
  params: LoadPatientIntelligenceOverviewParams
): Promise<PatientIntelligenceOverviewModel> {
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const twin = params.twin;
  const caseId = twin.cases[0]?.case_id ?? null;

  const [{ patientMetadata, personMetadata }, invoiceSummary, surgical, outcomes] =
    await Promise.all([
      loadPatientMetadata(tid, pid),
      loadPatientInvoiceSummary(tid, pid).catch(() => ({
        invoices: [],
        outstandingCentsAud: 0,
        unpaidOpenCount: 0,
        overdueCount: 0,
      })),
      loadPatientTwinSurgicalStory({ tenantId: tid, caseId }),
      loadOutcomeMeasurementsWithMetadata(tid, pid),
    ]);

  const workforce = await loadPatientTwinWorkforceOnDate({
    tenantId: tid,
    caseId,
    procedureDate: surgical.surgery?.surgeryDate ?? null,
  });

  return composePatientIntelligenceOverview(twin, {
    patientMetadata,
    personMetadata,
    invoices: invoiceSummary.invoices,
    workforceMembers: workforce.members,
    plannedZones: surgical.plannedZones,
    surgeryPlan: surgical.surgeryPlan,
    surgery: surgical.surgery,
    outcomeMeasurements: outcomes,
    projectedOutcome: projectedFromMetadata(patientMetadata, null),
    presentationMode: Boolean(params.presentationMode),
  });
}
