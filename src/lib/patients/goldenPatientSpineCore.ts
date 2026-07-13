/**
 * FI-TRUST-LANDING-AND-SPINE-1 — canonical golden-patient persistence spine.
 *
 * Staff truth for a converted care journey (not a second data store):
 *   person → lead (enquiry) → patient → (optional) consultation / case
 *
 * After any conversion or create, reload must resolve the same patient id from
 * the patient workspace URL and from the lead’s patient_id when linked.
 */

export const GOLDEN_PATIENT_SPINE_STEPS = [
  "person",
  "lead",
  "patient",
  "consultation_optional",
  "case_optional",
] as const;

export type GoldenPatientSpineStep = (typeof GOLDEN_PATIENT_SPINE_STEPS)[number];

export type GoldenPatientSpineIds = {
  tenantId: string;
  personId: string | null;
  leadId: string | null;
  patientId: string | null;
  consultationId?: string | null;
  caseId?: string | null;
};

/** Staff-facing routes that must remain the single doors for each spine node. */
export function goldenPatientSpineRoutes(
  tenantId: string,
  ids: Pick<GoldenPatientSpineIds, "leadId" | "patientId" | "consultationId" | "caseId">
): {
  pipeline: string;
  leadDetail: string | null;
  patientsList: string;
  patientWorkspace: string | null;
  consultation: string | null;
  caseWorkspace: string | null;
} {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const leadId = ids.leadId?.trim() || null;
  const patientId = ids.patientId?.trim() || null;
  const consultationId = ids.consultationId?.trim() || null;
  const caseId = ids.caseId?.trim() || null;
  return {
    pipeline: `${base}/crm`,
    leadDetail: leadId ? `${base}/crm/leads/${leadId}` : null,
    patientsList: `${base}/patients`,
    patientWorkspace: patientId ? `${base}/patients/${patientId}` : null,
    consultation: consultationId ? `${base}/consultations/${consultationId}` : null,
    caseWorkspace: caseId ? `${base}/cases/${caseId}` : null,
  };
}

/**
 * Persistence integrity for the golden path after reload.
 * Lead→patient link is required when both ids are known.
 */
export function evaluateGoldenPatientPersistence(input: {
  before: GoldenPatientSpineIds;
  afterReload: GoldenPatientSpineIds;
  leadPatientIdAfterReload?: string | null;
}): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const b = input.before;
  const a = input.afterReload;

  if (!b.tenantId?.trim() || a.tenantId.trim() !== b.tenantId.trim()) {
    issues.push("tenant_id mismatch after reload");
  }
  if (b.patientId?.trim()) {
    if (!a.patientId?.trim()) {
      issues.push("patient_id missing after reload");
    } else if (a.patientId.trim() !== b.patientId.trim()) {
      issues.push("patient_id changed after reload");
    }
  }
  if (b.personId?.trim() && a.personId?.trim() && a.personId.trim() !== b.personId.trim()) {
    issues.push("person_id changed after reload");
  }
  if (b.leadId?.trim() && a.leadId?.trim() && a.leadId.trim() !== b.leadId.trim()) {
    issues.push("lead_id changed after reload");
  }
  if (b.patientId?.trim() && b.leadId?.trim()) {
    const linked = input.leadPatientIdAfterReload?.trim() || null;
    if (linked && linked !== b.patientId.trim()) {
      issues.push("lead.patient_id does not match converted patient after reload");
    }
    if (!linked) {
      issues.push("lead.patient_id not linked after conversion");
    }
  }

  return { ok: issues.length === 0, issues };
}

/** Minimum fields required to open a stable patient workspace after create/convert. */
export function goldenPatientWorkspaceReady(ids: GoldenPatientSpineIds): boolean {
  return Boolean(ids.tenantId?.trim() && ids.patientId?.trim());
}
