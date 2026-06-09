/**
 * Evolved payroll staff import runner: parse → plan → optional DB apply.
 */

import { z } from "zod";

import { buildEvolvedPayrollStaffImportPreview } from "@/src/lib/staffImport/evolvedPayrollStaffImportPreview";
import { planEvolvedPayrollStaffImport } from "@/src/lib/staffImport/evolvedPayrollStaffImportPlan";
import { parseEvolvedPayrollExportRows } from "@/src/lib/staffImport/evolvedPayrollStaffImportParse";
import type {
  EvolvedPayrollStaffImportPlanResult,
  EvolvedPayrollStaffImportPreviewBuckets,
  EvolvedPayrollStaffImportRow,
  EvolvedPayrollStaffParseResult,
} from "@/src/lib/staffImport/evolvedPayrollStaffImportTypes";
import {
  applyIiohrHrStaffImportPlan,
  assertIiohrHrStaffImportAllowed,
  type IiohrHrStaffImportCounts,
  loadSnapshotsForPlan as loadIiohrSnapshotsForPlan,
  resolveEvolvedHrPerthClinicForTenant,
} from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

export type { EvolvedPayrollStaffImportPreviewBuckets, EvolvedPayrollStaffImportRow } from "./evolvedPayrollStaffImportTypes";

const tenantIdSchema = z.string().uuid("tenantId must be a UUID.");

const payrollRowSchema = z.object({
  external_staff_id: z.coerce.string(),
  full_name: z.coerce.string(),
  email: z.union([z.string(), z.null()]).optional(),
  mobile: z.union([z.string(), z.null()]).optional(),
  employment_type: z.union([z.string(), z.null()]).optional(),
  start_date: z.union([z.string(), z.null()]).optional(),
  end_date: z.union([z.string(), z.null()]).optional(),
  hours_per_week: z.union([z.number(), z.null()]).optional(),
  hours_per_day: z.union([z.number(), z.null()]).optional(),
  source: z.literal("payroll_export"),
  source_system: z.literal("evolved_payroll"),
  clinic_display_name: z.string(),
  is_active: z.boolean(),
  staff_role: z.string(),
});

function emptyPlan(): EvolvedPayrollStaffImportPlanResult {
  return { perRow: [], actions: [], warnings: [], validationIssues: [] };
}

function emptyCounts(): IiohrHrStaffImportCounts {
  return {
    createdUsers: 0,
    updatedUsers: 0,
    createdStaff: 0,
    updatedStaff: 0,
    linkedStaff: 0,
    deactivatedStaff: 0,
    createdSourceIds: 0,
    updatedSourceIds: 0,
  };
}

function countFromPlan(plan: EvolvedPayrollStaffImportPlanResult): IiohrHrStaffImportCounts {
  const c = emptyCounts();
  for (const a of plan.actions) {
    switch (a.type) {
      case "create_fi_user":
        c.createdUsers += 1;
        break;
      case "update_fi_user":
        c.updatedUsers += 1;
        break;
      case "create_fi_staff":
        c.createdStaff += 1;
        break;
      case "update_fi_staff":
        c.updatedStaff += 1;
        break;
      case "link_staff_to_user":
        c.linkedStaff += 1;
        break;
      case "deactivate_staff":
        c.deactivatedStaff += 1;
        break;
      case "create_staff_source_id":
        c.createdSourceIds += 1;
        break;
      case "update_staff_source_id":
        c.updatedSourceIds += 1;
        break;
      default:
        break;
    }
  }
  return c;
}

function validatePackedPayrollRows(rows: EvolvedPayrollStaffImportRow[]): {
  rows: EvolvedPayrollStaffImportRow[];
  validationErrors: string[];
} {
  const validationErrors: string[] = [];
  const out: EvolvedPayrollStaffImportRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = payrollRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      validationErrors.push(`Row ${i}: ${parsed.error.errors[0]?.message ?? "Invalid row."}`);
      continue;
    }
    const r = parsed.data;
    out.push({
      ...r,
      external_staff_id: String(r.external_staff_id).trim(),
      full_name: String(r.full_name).trim(),
      email: r.email != null && String(r.email).trim() ? String(r.email).trim().toLowerCase() : null,
      mobile: r.mobile != null && String(r.mobile).trim() ? String(r.mobile).trim() : null,
      employment_type: r.employment_type != null ? String(r.employment_type).trim() : null,
      start_date: r.start_date != null ? String(r.start_date).trim() || null : null,
      end_date: r.end_date != null ? String(r.end_date).trim() || null : null,
      hours_per_week: r.hours_per_week ?? null,
      hours_per_day: r.hours_per_day ?? null,
      clinic_display_name: String(r.clinic_display_name).trim(),
      staff_role: String(r.staff_role).trim() || "needs_review",
    });
  }
  return { rows: out, validationErrors };
}

/** Sets `payroll_last_imported_at` on payroll source-id actions at commit time. */
export function stampPayrollImportTimestampOnPlan(plan: EvolvedPayrollStaffImportPlanResult): void {
  const at = new Date().toISOString();
  for (const pr of plan.perRow) {
    for (const a of pr.actions) {
      if (a.type === "create_staff_source_id") {
        a.payload.metadata = { ...(a.payload.metadata ?? {}), payroll_last_imported_at: at };
      } else if (a.type === "update_staff_source_id") {
        a.payload.metadata = { ...(a.payload.metadata ?? {}), payroll_last_imported_at: at };
      }
    }
  }
  plan.actions = plan.perRow.flatMap((p) => p.actions);
}

export type EvolvedPayrollStaffImportRunResult = {
  ok: boolean;
  commit: boolean;
  validationErrors: string[];
  warnings: string[];
  skippedRowCount: number;
  plan: EvolvedPayrollStaffImportPlanResult;
  preview: EvolvedPayrollStaffImportPreviewBuckets;
  skippedSensitiveFields: EvolvedPayrollStaffParseResult["skippedSensitiveFields"];
  dryRunCounts: IiohrHrStaffImportCounts;
  appliedCounts?: IiohrHrStaffImportCounts;
  error?: string;
  validatedPackedRows?: EvolvedPayrollStaffImportRow[];
  perthClinicId: string | null;
  perthClinicDisplayName: string | null;
};

export type RunEvolvedPayrollStaffImportParams = {
  tenantId: string;
  rows: unknown;
  commit?: boolean;
  confirm?: boolean;
  adminKey?: string | null;
  authUserId?: string | null;
  skipImportAuthCheck?: boolean;
  packedRows?: EvolvedPayrollStaffImportRow[];
  sourceRowIndices?: number[];
  skippedSensitiveFields?: EvolvedPayrollStaffParseResult["skippedSensitiveFields"];
};

async function loadPayrollSnapshots(tenantId: string) {
  const base = await loadIiohrSnapshotsForPlan(tenantId);
  return {
    existingUsers: base.existingUsers,
    existingStaff: base.existingStaff.map((s) => ({
      ...s,
      mobile: (s as { mobile?: string | null }).mobile ?? null,
    })),
    existingStaffSourceIds: base.existingStaffSourceIds,
  };
}

export async function runEvolvedPayrollStaffImport(
  params: RunEvolvedPayrollStaffImportParams
): Promise<EvolvedPayrollStaffImportRunResult> {
  const tenantParse = tenantIdSchema.safeParse(params.tenantId?.trim());
  if (!tenantParse.success) {
    return {
      ok: false,
      commit: params.commit === true,
      validationErrors: [tenantParse.error.errors[0]?.message ?? "Invalid tenantId."],
      warnings: [],
      skippedRowCount: 0,
      plan: emptyPlan(),
      preview: buildEvolvedPayrollStaffImportPreview(emptyPlan(), []),
      skippedSensitiveFields: [],
      dryRunCounts: emptyCounts(),
      error: "Validation failed.",
      perthClinicId: null,
      perthClinicDisplayName: null,
    };
  }
  const tenantId = tenantParse.data;

  if (!params.skipImportAuthCheck) {
    try {
      await assertIiohrHrStaffImportAllowed({
        tenantId,
        adminKey: params.adminKey,
        authUserId: params.authUserId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        commit: params.commit === true,
        validationErrors: [],
        warnings: [],
        skippedRowCount: 0,
        plan: emptyPlan(),
        preview: buildEvolvedPayrollStaffImportPreview(emptyPlan(), []),
        skippedSensitiveFields: [],
        dryRunCounts: emptyCounts(),
        error: msg,
        perthClinicId: null,
        perthClinicDisplayName: null,
      };
    }
  }

  let packedRows: EvolvedPayrollStaffImportRow[];
  let sourceRowIndices: number[];
  let parseValidationErrors: string[] = [];
  let skippedSensitiveFields = params.skippedSensitiveFields ?? [];

  if (params.packedRows) {
    const v = validatePackedPayrollRows(params.packedRows);
    packedRows = v.rows;
    parseValidationErrors = v.validationErrors;
    sourceRowIndices = params.sourceRowIndices ?? packedRows.map((_, i) => i);
  } else {
    const parsed = parseEvolvedPayrollExportRows(Array.isArray(params.rows) ? params.rows : []);
    skippedSensitiveFields = parsed.skippedSensitiveFields;
    parseValidationErrors = parsed.validationErrors;
    packedRows = parsed.rows;
    sourceRowIndices = parsed.sourceRowIndices;
  }

  const { clinicId, displayName } = await resolveEvolvedHrPerthClinicForTenant(tenantId);
  const snapshots = packedRows.length > 0 ? await loadPayrollSnapshots(tenantId) : null;

  const plan =
    packedRows.length === 0 || !snapshots
      ? emptyPlan()
      : planEvolvedPayrollStaffImport({
          tenantId,
          rows: packedRows,
          sourceRowIndices,
          existingUsers: snapshots.existingUsers,
          existingStaff: snapshots.existingStaff,
          existingStaffSourceIds: snapshots.existingStaffSourceIds,
          primaryFiClinicId: clinicId,
        });

  if (!clinicId && packedRows.length > 0) {
    plan.warnings.push(
      "No Perth clinic record matched for this tenant (expected “Evolved Hair Restoration Perth”). Staff import proceeds at tenant level; payroll metadata stores clinic display name only."
    );
  }

  const preview = buildEvolvedPayrollStaffImportPreview(plan, skippedSensitiveFields);
  const skippedRowCount = plan.perRow.filter((p) => p.skippedDuplicate || p.skippedValidation).length;
  const dryRunCounts = countFromPlan(plan);
  const validationErrors = parseValidationErrors;

  const commit = params.commit === true;
  if (!commit) {
    return {
      ok: true,
      commit: false,
      validationErrors,
      warnings: plan.warnings,
      skippedRowCount,
      plan,
      preview,
      skippedSensitiveFields,
      dryRunCounts,
      validatedPackedRows: packedRows,
      perthClinicId: clinicId,
      perthClinicDisplayName: displayName,
    };
  }

  if (params.confirm !== true) {
    return {
      ok: false,
      commit: true,
      validationErrors,
      warnings: plan.warnings,
      skippedRowCount,
      plan,
      preview,
      skippedSensitiveFields,
      dryRunCounts,
      error: "commit requires confirm: true",
      validatedPackedRows: packedRows,
      perthClinicId: clinicId,
      perthClinicDisplayName: displayName,
    };
  }

  if (packedRows.length === 0) {
    return {
      ok: false,
      commit: true,
      validationErrors,
      warnings: plan.warnings,
      skippedRowCount,
      plan,
      preview,
      skippedSensitiveFields,
      dryRunCounts: emptyCounts(),
      error: "Nothing to commit — no valid rows.",
      validatedPackedRows: packedRows,
      perthClinicId: clinicId,
      perthClinicDisplayName: displayName,
    };
  }

  const applied = emptyCounts();
  stampPayrollImportTimestampOnPlan(plan);
  try {
    await applyIiohrHrStaffImportPlan(tenantId, plan, applied);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      commit: true,
      validationErrors,
      warnings: plan.warnings,
      skippedRowCount,
      plan,
      preview,
      skippedSensitiveFields,
      dryRunCounts,
      appliedCounts: applied,
      error: msg,
      validatedPackedRows: packedRows,
      perthClinicId: clinicId,
      perthClinicDisplayName: displayName,
    };
  }

  return {
    ok: true,
    commit: true,
    validationErrors,
    warnings: plan.warnings,
    skippedRowCount,
    plan,
    preview,
    skippedSensitiveFields,
    dryRunCounts,
    appliedCounts: applied,
    validatedPackedRows: packedRows,
    perthClinicId: clinicId,
    perthClinicDisplayName: displayName,
  };
}

export function logEvolvedPayrollStaffImportReport(result: EvolvedPayrollStaffImportRunResult): void {
  const counts = result.commit && result.appliedCounts ? result.appliedCounts : result.dryRunCounts;
  console.log(`\n=== Evolved payroll staff import (${result.commit ? "COMMIT" : "DRY-RUN"}) ===\n`);
  console.log(`OK: ${result.ok}${result.error ? ` — ${result.error}` : ""}`);
  console.log(`Rows: ${result.validatedPackedRows?.length ?? 0}`);
  console.log(`New staff: ${result.preview.new_staff.length}`);
  console.log(`Matched existing: ${result.preview.matched_existing_staff.length}`);
  console.log(`Needs role assignment: ${result.preview.needs_role_assignment.length}`);
  if (result.skippedSensitiveFields.length) {
    console.log(`Sensitive columns stripped (names only): ${result.skippedSensitiveFields.join(", ")}`);
  }
  console.log(`\nPlanned/applied fi_staff creates: ${counts.createdStaff}`);
  console.log(`Source id creates: ${counts.createdSourceIds}\n`);
}
