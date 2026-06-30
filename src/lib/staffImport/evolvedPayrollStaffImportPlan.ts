/**
 * Dry-run planner: Evolved payroll export → `fi_staff` + `fi_staff_source_ids` (`evolved_payroll`).
 */

import {
  normalizeFiStaffSourceMetadata,
  normalizeFiStaffSourceStaffId,
  normalizeFiStaffSourceSystem,
} from "@/src/lib/staff/staffSourceIdsNormalize";

import {
  EVOLVED_PAYROLL_SOURCE_SYSTEM,
  PAYROLL_DEFAULT_STAFF_ROLE,
  PAYROLL_IMPORT_SOURCE,
} from "./evolvedPayrollStaffImportConstants";
import { isValidPayrollEmail } from "./evolvedPayrollStaffImportParse";
import type {
  EvolvedPayrollImportExistingStaff,
  EvolvedPayrollStaffImportPlanInput,
  EvolvedPayrollStaffImportPlanResult,
  EvolvedPayrollStaffImportRow,
  EvolvedPayrollStaffImportRowPlan,
} from "./evolvedPayrollStaffImportTypes";
import type {
  IiohrHrImportExistingSourceId,
  IiohrHrImportExistingUser,
  IiohrHrStaffImportAction,
  IiohrHrStaffImportMatchKind,
  IiohrHrStaffImportValidationIssue,
} from "./iiohrHrStaffImportTypes";

export const EVOLVED_PAYROLL_SOURCE_SYSTEM_NORMALIZED = normalizeFiStaffSourceSystem(
  EVOLVED_PAYROLL_SOURCE_SYSTEM
);

function emailKey(email: string | null | undefined): string | null {
  if (email == null) return null;
  const t = email.trim();
  if (!t) return null;
  return t.toLowerCase();
}

function jsonForCompare(v: unknown): string {
  return JSON.stringify(v === undefined ? null : v);
}

function resolveSourceRowIndex(
  input: EvolvedPayrollStaffImportPlanInput,
  packedIndex: number
): number {
  const map = input.sourceRowIndices;
  if (map) {
    if (map.length !== input.rows.length)
      throw new Error("sourceRowIndices length must match rows length.");
    return map[packedIndex]!;
  }
  return packedIndex;
}

export function buildPayrollSourceMetadata(
  row: EvolvedPayrollStaffImportRow,
  primaryFiClinicId: string | null
): Record<string, unknown> {
  return normalizeFiStaffSourceMetadata({
    source: PAYROLL_IMPORT_SOURCE,
    source_system: EVOLVED_PAYROLL_SOURCE_SYSTEM,
    employment_type: row.employment_type,
    start_date: row.start_date,
    end_date: row.end_date,
    hours_per_week: row.hours_per_week,
    hours_per_day: row.hours_per_day,
    clinic_display_name: row.clinic_display_name,
    ...(primaryFiClinicId ? { primary_fi_clinic_id: primaryFiClinicId } : {}),
  });
}

function sourceIdNeedsUpdate(
  existing: IiohrHrImportExistingSourceId,
  nextMeta: Record<string, unknown>
): boolean {
  return (
    jsonForCompare(normalizeFiStaffSourceMetadata(existing.metadata)) !== jsonForCompare(nextMeta)
  );
}

type UpdateFiStaffPayload = Extract<
  IiohrHrStaffImportAction,
  { type: "update_fi_staff" }
>["payload"];

function buildStaffUpdatePayload(
  staff: EvolvedPayrollImportExistingStaff,
  row: EvolvedPayrollStaffImportRow
): UpdateFiStaffPayload | null {
  const patch: UpdateFiStaffPayload = { staffId: staff.id };

  if (row.full_name.trim() && row.full_name.trim() !== staff.full_name)
    patch.full_name = row.full_name.trim();

  /** Never overwrite an assigned role from payroll — only fill when still `needs_review`. */
  if (staff.staff_role === PAYROLL_DEFAULT_STAFF_ROLE && staff.staff_role !== row.staff_role) {
    patch.staff_role = row.staff_role;
  }

  const staffHasEmail = Boolean(staff.email?.trim());
  const nextEmail = row.email;
  if (!staffHasEmail && nextEmail !== (staff.email ?? null)) patch.email = nextEmail;

  const staffHasMobile = Boolean(staff.mobile?.trim());
  if (!staffHasMobile && row.mobile !== (staff.mobile ?? null)) patch.mobile = row.mobile;

  if (row.is_active !== staff.is_active) patch.is_active = row.is_active;

  return Object.keys(patch).length > 1 ? patch : null;
}

function pushStaffUpdatesForExisting(
  actions: IiohrHrStaffImportAction[],
  sourceRowIndex: number,
  staff: EvolvedPayrollImportExistingStaff,
  row: EvolvedPayrollStaffImportRow
): void {
  if (!row.is_active && staff.is_active) {
    actions.push({ type: "deactivate_staff", sourceRowIndex, payload: { staffId: staff.id } });
  }

  const patch = buildStaffUpdatePayload(staff, row);
  if (!patch) return;

  const { staffId, is_active: patchIsActive, ...rest } = patch;
  const hasFieldUpdates = Object.keys(rest).length > 0;
  const deactivate = !row.is_active && staff.is_active;

  if (!hasFieldUpdates && patchIsActive === undefined) return;

  const payload: UpdateFiStaffPayload = { staffId, ...rest };
  if (patchIsActive !== undefined && !deactivate) payload.is_active = patchIsActive;

  if (Object.keys(payload).length > 1) {
    actions.push({ type: "update_fi_staff", sourceRowIndex, payload });
  }
}

function createStaffAndSourceActions(
  actions: IiohrHrStaffImportAction[],
  sourceRowIndex: number,
  row: EvolvedPayrollStaffImportRow,
  emailK: string | null,
  emailToUser: Map<string, IiohrHrImportExistingUser>,
  matchedUserId: { value: string | null },
  nextMeta: Record<string, unknown>
): void {
  let fiUserId: string | null = null;
  let fiUserIdFromSameRowIndex: number | null = null;

  if (emailK) {
    if (emailToUser.has(emailK)) {
      fiUserId = emailToUser.get(emailK)!.id;
      matchedUserId.value = fiUserId;
    } else {
      actions.push({
        type: "create_fi_user",
        sourceRowIndex,
        payload: { email: String(row.email).trim(), role: "member" },
      });
      fiUserIdFromSameRowIndex = sourceRowIndex;
    }
  }

  actions.push({
    type: "create_fi_staff",
    sourceRowIndex,
    payload: {
      full_name: row.full_name.trim() || "Staff",
      staff_role: row.staff_role,
      email: emailK ? String(row.email).trim() : null,
      mobile: row.mobile,
      default_timezone: null,
      working_hours: {},
      is_active: row.is_active,
      fi_user_id: fiUserId,
      fi_user_id_from_same_row_index: fiUserIdFromSameRowIndex,
    },
  });

  actions.push({
    type: "create_staff_source_id",
    sourceRowIndex,
    payload: {
      staffId: null,
      staffFromRowIndex: sourceRowIndex,
      source_system: EVOLVED_PAYROLL_SOURCE_SYSTEM_NORMALIZED,
      source_staff_id: normalizeFiStaffSourceStaffId(row.external_staff_id),
      source_url: null,
      metadata: nextMeta,
    },
  });
}

/**
 * Matching (first hit wins): `fi_staff_source_ids` (`evolved_payroll` + EmployeeId) → `fi_staff.email` → new staff.
 */
export function planEvolvedPayrollStaffImport(
  input: EvolvedPayrollStaffImportPlanInput
): EvolvedPayrollStaffImportPlanResult {
  const warnings: string[] = [];
  const validationIssues: IiohrHrStaffImportValidationIssue[] = [];
  const tid = input.tenantId.trim();
  if (!tid) warnings.push("tenantId is empty.");

  if (input.sourceRowIndices && input.sourceRowIndices.length !== input.rows.length) {
    throw new Error("sourceRowIndices must have the same length as rows.");
  }

  const staffById = new Map<string, EvolvedPayrollImportExistingStaff>();
  for (const s of input.existingStaff) staffById.set(s.id.trim(), s);

  const emailToStaff = new Map<string, EvolvedPayrollImportExistingStaff>();
  for (const s of input.existingStaff) {
    const k = emailKey(s.email);
    if (k && !emailToStaff.has(k)) emailToStaff.set(k, s);
  }

  const emailToUser = new Map<string, IiohrHrImportExistingUser>();
  for (const u of input.existingUsers) {
    const k = emailKey(u.email);
    if (k && !emailToUser.has(k)) emailToUser.set(k, u);
  }

  const externalIdToStaffId = new Map<string, string>();
  const staffIdToPayrollSource = new Map<string, IiohrHrImportExistingSourceId>();

  for (const sid of input.existingStaffSourceIds) {
    const sys = normalizeFiStaffSourceSystem(sid.source_system);
    if (sys !== EVOLVED_PAYROLL_SOURCE_SYSTEM_NORMALIZED) continue;
    const ext = normalizeFiStaffSourceStaffId(sid.source_staff_id);
    externalIdToStaffId.set(ext, sid.staff_id.trim());
    staffIdToPayrollSource.set(sid.staff_id.trim(), sid);
  }

  const consumedStaffIds = new Set<string>();
  const consumedNewEmails = new Set<string>();
  const perRow: EvolvedPayrollStaffImportRowPlan[] = [];

  for (let packedIndex = 0; packedIndex < input.rows.length; packedIndex++) {
    const row = input.rows[packedIndex]!;
    const rowIndex = resolveSourceRowIndex(input, packedIndex);
    const actions: IiohrHrStaffImportAction[] = [];
    let matchKind: IiohrHrStaffImportMatchKind = "none";
    let matchedStaffId: string | null = null;
    let matchedUserId: string | null = null;

    const missingEmail = !row.email?.trim();
    const invalidEmail = !missingEmail && !isValidPayrollEmail(row.email);
    const needsRoleAssignment = row.staff_role === PAYROLL_DEFAULT_STAFF_ROLE;

    const extNorm = normalizeFiStaffSourceStaffId(row.external_staff_id);
    if (!extNorm) {
      const msg = "external_staff_id (EmployeeId) is required.";
      validationIssues.push({ rowIndex, field: "external_staff_id", message: msg });
      actions.push({ type: "skip_row", sourceRowIndex: rowIndex, payload: { reason: msg } });
      perRow.push({
        rowIndex,
        row,
        matchKind: "none",
        matchedStaffId: null,
        matchedUserId: null,
        actions,
        skippedDuplicate: false,
        skippedValidation: true,
        missingEmail,
        invalidEmail,
        needsRoleAssignment,
      });
      continue;
    }

    if (!row.full_name?.trim()) {
      const msg = "full_name is required.";
      validationIssues.push({ rowIndex, field: "full_name", message: msg });
      actions.push({ type: "skip_row", sourceRowIndex: rowIndex, payload: { reason: msg } });
      perRow.push({
        rowIndex,
        row,
        matchKind: "none",
        matchedStaffId: null,
        matchedUserId: null,
        actions,
        skippedDuplicate: false,
        skippedValidation: true,
        missingEmail,
        invalidEmail,
        needsRoleAssignment,
      });
      continue;
    }

    if (invalidEmail) {
      const msg = "Invalid email address — row skipped.";
      validationIssues.push({ rowIndex, field: "email", message: msg });
      actions.push({ type: "skip_row", sourceRowIndex: rowIndex, payload: { reason: msg } });
      perRow.push({
        rowIndex,
        row,
        matchKind: "none",
        matchedStaffId: null,
        matchedUserId: null,
        actions,
        skippedDuplicate: false,
        skippedValidation: true,
        missingEmail,
        invalidEmail,
        needsRoleAssignment,
      });
      continue;
    }

    const emailK = emailKey(row.email);
    let staffFromSource = externalIdToStaffId.get(extNorm);
    if (staffFromSource && !staffById.has(staffFromSource)) {
      warnings.push(
        `Row ${rowIndex}: payroll EmployeeId maps to unknown staff_id ${staffFromSource}; ignoring.`
      );
      staffFromSource = undefined;
    }

    if (staffFromSource) {
      matchKind = "source_id";
      matchedStaffId = staffFromSource;
    } else if (emailK && emailToStaff.has(emailK)) {
      matchKind = "staff_email";
      matchedStaffId = emailToStaff.get(emailK)!.id;
    }

    if (matchedStaffId && consumedStaffIds.has(matchedStaffId)) {
      warnings.push(
        `Row ${rowIndex}: duplicate match for staff ${matchedStaffId} (email already claimed by a prior import row); skipping actions.`
      );
      perRow.push({
        rowIndex,
        row,
        matchKind,
        matchedStaffId,
        matchedUserId,
        actions: [],
        skippedDuplicate: true,
        skippedValidation: false,
        missingEmail,
        invalidEmail,
        needsRoleAssignment,
      });
      continue;
    }

    if (!matchedStaffId && emailK && consumedNewEmails.has(emailK)) {
      warnings.push(
        `Row ${rowIndex}: duplicate email ${emailK} in this import file; skipping to avoid duplicate staff.`
      );
      perRow.push({
        rowIndex,
        row,
        matchKind: "none",
        matchedStaffId: null,
        matchedUserId: null,
        actions: [],
        skippedDuplicate: true,
        skippedValidation: false,
        missingEmail,
        invalidEmail,
        needsRoleAssignment,
      });
      continue;
    }

    if (matchedStaffId) consumedStaffIds.add(matchedStaffId);
    if (!matchedStaffId && emailK) consumedNewEmails.add(emailK);

    const nextMeta = buildPayrollSourceMetadata(row, input.primaryFiClinicId);

    if (matchKind === "source_id" || matchKind === "staff_email") {
      const staff = staffById.get(matchedStaffId!)!;
      const payrollSource = staffIdToPayrollSource.get(staff.id);

      pushStaffUpdatesForExisting(actions, rowIndex, staff, row);

      const userForEmail = emailK ? emailToUser.get(emailK) : undefined;
      if (!staff.fi_user_id && userForEmail) {
        actions.push({
          type: "link_staff_to_user",
          sourceRowIndex: rowIndex,
          payload: { staffId: staff.id, fiUserId: userForEmail.id },
        });
      }

      if (payrollSource) {
        if (sourceIdNeedsUpdate(payrollSource, nextMeta)) {
          actions.push({
            type: "update_staff_source_id",
            sourceRowIndex: rowIndex,
            payload: { id: payrollSource.id, metadata: nextMeta },
          });
        }
      } else {
        actions.push({
          type: "create_staff_source_id",
          sourceRowIndex: rowIndex,
          payload: {
            staffId: staff.id,
            staffFromRowIndex: null,
            source_system: EVOLVED_PAYROLL_SOURCE_SYSTEM_NORMALIZED,
            source_staff_id: extNorm,
            source_url: null,
            metadata: nextMeta,
          },
        });
      }
    } else if (emailK && emailToUser.has(emailK)) {
      matchKind = "user_email";
      matchedUserId = emailToUser.get(emailK)!.id;
      actions.push({
        type: "create_fi_staff",
        sourceRowIndex: rowIndex,
        payload: {
          full_name: row.full_name.trim() || "Staff",
          staff_role: row.staff_role,
          email: String(row.email).trim(),
          mobile: row.mobile,
          default_timezone: null,
          working_hours: {},
          is_active: row.is_active,
          fi_user_id: matchedUserId,
        },
      });
      actions.push({
        type: "create_staff_source_id",
        sourceRowIndex: rowIndex,
        payload: {
          staffId: null,
          staffFromRowIndex: rowIndex,
          source_system: EVOLVED_PAYROLL_SOURCE_SYSTEM_NORMALIZED,
          source_staff_id: extNorm,
          source_url: null,
          metadata: nextMeta,
        },
      });
    } else {
      const matchedUserRef = { value: matchedUserId };
      createStaffAndSourceActions(
        actions,
        rowIndex,
        row,
        emailK,
        emailToUser,
        matchedUserRef,
        nextMeta
      );
      matchedUserId = matchedUserRef.value;
    }

    perRow.push({
      rowIndex,
      row,
      matchKind,
      matchedStaffId,
      matchedUserId,
      actions,
      skippedDuplicate: false,
      skippedValidation: false,
      missingEmail,
      invalidEmail,
      needsRoleAssignment,
    });
  }

  return { perRow, actions: perRow.flatMap((p) => p.actions), warnings, validationIssues };
}
