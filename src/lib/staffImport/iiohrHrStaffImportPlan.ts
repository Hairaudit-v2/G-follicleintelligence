/**
 * Dry-run planner: map IIOHR HR export rows onto FI `fi_users`, `fi_staff`, and `fi_staff_source_ids`.
 * No database I/O — callers load snapshots and execute returned actions separately.
 */

import { isAllowedHrPortalUrl } from "@/src/lib/staff/myHrPortalSelection";
import {
  hrStaffSourceSystemRank,
  isHrStaffSourceSystem,
} from "@/src/lib/staff/hrStaffReadinessMetadata";
import {
  normalizeFiStaffSourceMetadata,
  normalizeFiStaffSourceStaffId,
  normalizeFiStaffSourceSystem,
  normalizeFiStaffSourceUrl,
} from "@/src/lib/staff/staffSourceIdsNormalize";
import {
  canonicaliseWorkforceSourceSystem,
  WORKFORCE_IDENTITY_SOURCE_SYSTEMS,
} from "@/src/lib/workforce-os/workforceIdentitySources";

import type {
  IiohrHrImportExistingSourceId,
  IiohrHrImportExistingStaff,
  IiohrHrImportExistingUser,
  IiohrHrStaffImportAction,
  IiohrHrStaffImportMatchKind,
  IiohrHrStaffImportPlanInput,
  IiohrHrStaffImportPlanResult,
  IiohrHrStaffImportRow,
  IiohrHrStaffImportRowPlan,
  IiohrHrStaffImportValidationIssue,
} from "./iiohrHrStaffImportTypes";

export type {
  IiohrHrImportExistingSourceId,
  IiohrHrImportExistingStaff,
  IiohrHrImportExistingUser,
  IiohrHrStaffImportAction,
  IiohrHrStaffImportMatchKind,
  IiohrHrStaffImportPlan,
  IiohrHrStaffImportPlanInput,
  IiohrHrStaffImportPlanResult,
  IiohrHrStaffImportRow,
  IiohrHrStaffImportRowPlan,
  IiohrHrStaffImportValidationIssue,
} from "./iiohrHrStaffImportTypes";

/** Canonical `source_system` for IIOHR HR rows in `fi_staff_source_ids`. */
export const IIOHR_HR_SOURCE_SYSTEM = canonicaliseWorkforceSourceSystem(
  WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR
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

/**
 * Maps HR `employment_status` to FI `is_active`.
 * - `active` / `current` / `employed` → `true`
 * - `inactive` / `terminated` / `resigned` → `false`
 * - unknown or empty → `null` (do not change existing staff active flag)
 */
export function resolveEmploymentIsActive(
  employment_status: string | null | undefined
): boolean | null {
  const s = String(employment_status ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === "active" || s === "current" || s === "employed") return true;
  if (s === "inactive" || s === "terminated" || s === "resigned") return false;
  return null;
}

/** Default `is_active` for newly created `fi_staff` when employment is unknown. */
export function defaultIsActiveForNewStaff(employment_status: string | null | undefined): boolean {
  return resolveEmploymentIsActive(employment_status) !== false;
}

function resolveSourceUrlForRow(
  rowIndex: number,
  row: IiohrHrStaffImportRow,
  warnings: string[]
): string | null {
  const raw = row.source_url;
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (!isAllowedHrPortalUrl(t)) {
    warnings.push(
      `Row ${rowIndex}: invalid source_url ignored (only http:// or https:// allowed).`
    );
    return null;
  }
  return normalizeFiStaffSourceUrl(t);
}

function mergeSourceMetadata(
  existing: Record<string, unknown>,
  iiohrUserId: string | null | undefined
): Record<string, unknown> {
  const base = normalizeFiStaffSourceMetadata(existing);
  if (iiohrUserId != null && String(iiohrUserId).trim()) {
    return { ...base, iiohr_user_id: String(iiohrUserId).trim() };
  }
  return { ...base };
}

function sourceIdNeedsUpdate(
  existing: IiohrHrImportExistingSourceId,
  nextUrl: string | null,
  nextMeta: Record<string, unknown>
): boolean {
  const url = existing.source_url ?? null;
  if (nextUrl !== url) return true;
  return (
    jsonForCompare(normalizeFiStaffSourceMetadata(existing.metadata)) !== jsonForCompare(nextMeta)
  );
}

type UpdateFiStaffPayload = Extract<
  IiohrHrStaffImportAction,
  { type: "update_fi_staff" }
>["payload"];

function buildStaffUpdatePayload(
  staff: IiohrHrImportExistingStaff,
  row: IiohrHrStaffImportRow,
  targetIsActive: boolean | null
): UpdateFiStaffPayload | null {
  const emailNorm = emailKey(row.email);
  const nextEmail = emailNorm ? String(row.email).trim() : null;
  const wh =
    row.working_hours && typeof row.working_hours === "object" && !Array.isArray(row.working_hours)
      ? (row.working_hours as Record<string, unknown>)
      : {};
  const nextTz = row.default_timezone?.trim() || null;

  const patch: UpdateFiStaffPayload = { staffId: staff.id };

  if (row.full_name.trim() && row.full_name.trim() !== staff.full_name)
    patch.full_name = row.full_name.trim();
  const role = (row.staff_role?.trim() || "consultant").trim() || "consultant";
  if (role !== staff.staff_role) patch.staff_role = role;
  /** Do not overwrite an existing staff email from HR import; only set when the FI row has no email yet. */
  const staffHasEmail = Boolean(staff.email?.trim());
  if (!staffHasEmail && nextEmail !== (staff.email ?? null)) {
    patch.email = nextEmail;
  }
  const stz = staff.default_timezone ?? null;
  if (nextTz !== stz) patch.default_timezone = nextTz;

  const existingWh =
    staff.working_hours &&
    typeof staff.working_hours === "object" &&
    !Array.isArray(staff.working_hours)
      ? staff.working_hours
      : {};
  if (jsonForCompare(wh) !== jsonForCompare(existingWh)) patch.working_hours = wh;

  if (targetIsActive !== null && targetIsActive !== staff.is_active) {
    patch.is_active = targetIsActive;
  }

  return Object.keys(patch).length > 1 ? patch : null;
}

function pushStaffUpdatesForExisting(
  actions: IiohrHrStaffImportAction[],
  sourceRowIndex: number,
  staff: IiohrHrImportExistingStaff,
  row: IiohrHrStaffImportRow,
  targetIsActive: boolean | null
): void {
  const deactivate = targetIsActive === false && staff.is_active;

  if (deactivate) {
    actions.push({ type: "deactivate_staff", sourceRowIndex, payload: { staffId: staff.id } });
  }

  const patch = buildStaffUpdatePayload(staff, row, targetIsActive);
  if (!patch) return;

  const { staffId, is_active: patchIsActive, ...rest } = patch;
  const hasFieldUpdates = Object.keys(rest).length > 0;
  const isActiveChanged = patchIsActive !== undefined && patchIsActive !== staff.is_active;

  if (!hasFieldUpdates && (!isActiveChanged || deactivate)) return;

  const payload: UpdateFiStaffPayload = { staffId };
  Object.assign(payload, rest);
  if (patchIsActive !== undefined && !deactivate) {
    payload.is_active = patchIsActive;
  }

  if (Object.keys(payload).length > 1) {
    actions.push({ type: "update_fi_staff", sourceRowIndex, payload });
  }
}

function resolveSourceRowIndex(input: IiohrHrStaffImportPlanInput, packedIndex: number): number {
  const map = input.sourceRowIndices;
  if (map) {
    if (map.length !== input.rows.length) {
      throw new Error("sourceRowIndices length must match rows length.");
    }
    return map[packedIndex]!;
  }
  return packedIndex;
}

/**
 * Produces ordered dry-run actions for an IIOHR HR staff import.
 *
 * Matching (first hit wins): `fi_staff_source_ids` (`iiohr_hr` + external id) → `fi_staff.email` → `fi_users.email` → new staff.
 */
export function planIiohrHrStaffImport(
  input: IiohrHrStaffImportPlanInput
): IiohrHrStaffImportPlanResult {
  const warnings: string[] = [];
  const validationIssues: IiohrHrStaffImportValidationIssue[] = [];
  const tid = input.tenantId.trim();
  if (!tid) warnings.push("tenantId is empty.");

  if (input.sourceRowIndices && input.sourceRowIndices.length !== input.rows.length) {
    throw new Error("sourceRowIndices must have the same length as rows.");
  }

  const staffById = new Map<string, IiohrHrImportExistingStaff>();
  for (const s of input.existingStaff) staffById.set(s.id.trim(), s);

  const emailToStaff = new Map<string, IiohrHrImportExistingStaff>();
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
  const staffIdToHrSource = new Map<string, IiohrHrImportExistingSourceId>();

  for (const sid of input.existingStaffSourceIds) {
    const sys = normalizeFiStaffSourceSystem(sid.source_system);
    if (sys === IIOHR_HR_SOURCE_SYSTEM) {
      const ext = normalizeFiStaffSourceStaffId(sid.source_staff_id);
      const staffId = sid.staff_id.trim();
      externalIdToStaffId.set(ext, staffId);
    }
    if (!isHrStaffSourceSystem(sys)) continue;
    const staffId = sid.staff_id.trim();
    const existing = staffIdToHrSource.get(staffId);
    if (
      !existing ||
      hrStaffSourceSystemRank(sys) < hrStaffSourceSystemRank(existing.source_system)
    ) {
      staffIdToHrSource.set(staffId, sid);
    }
  }

  const consumedStaffIds = new Set<string>();
  const perRow: IiohrHrStaffImportRowPlan[] = [];

  for (let packedIndex = 0; packedIndex < input.rows.length; packedIndex++) {
    const row = input.rows[packedIndex]!;
    const rowIndex = resolveSourceRowIndex(input, packedIndex);
    const actions: IiohrHrStaffImportAction[] = [];
    let matchKind: IiohrHrStaffImportMatchKind = "none";
    let matchedStaffId: string | null = null;
    let matchedUserId: string | null = null;

    const extNorm = normalizeFiStaffSourceStaffId(row.external_staff_id);
    if (!extNorm) {
      const msg = "external_staff_id is required.";
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
      });
      continue;
    }

    const emailK = emailKey(row.email);
    let staffFromSource = externalIdToStaffId.get(extNorm);
    if (staffFromSource && !staffById.has(staffFromSource)) {
      warnings.push(
        `Row ${rowIndex}: source id maps to unknown staff_id ${staffFromSource}; ignoring.`
      );
      staffFromSource = undefined;
    }

    if (staffFromSource) {
      matchKind = "source_id";
      matchedStaffId = staffFromSource;
    } else if (emailK && emailToStaff.has(emailK)) {
      matchKind = "staff_email";
      matchedStaffId = emailToStaff.get(emailK)!.id;
    } else if (emailK && emailToUser.has(emailK)) {
      matchKind = "user_email";
      matchedUserId = emailToUser.get(emailK)!.id;
    }

    if (matchedStaffId && consumedStaffIds.has(matchedStaffId)) {
      warnings.push(
        `Row ${rowIndex}: duplicate match for staff ${matchedStaffId} (already claimed by a prior import row); skipping actions.`
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
      });
      continue;
    }

    if (matchedStaffId) consumedStaffIds.add(matchedStaffId);

    const employmentResolved = resolveEmploymentIsActive(row.employment_status);
    const nextUrl = resolveSourceUrlForRow(rowIndex, row, warnings);

    if (matchKind === "source_id" || matchKind === "staff_email") {
      const staff = staffById.get(matchedStaffId!)!;
      const hrSource = staffIdToHrSource.get(staff.id);
      const nextMeta = mergeSourceMetadata(hrSource?.metadata ?? {}, row.iiohr_user_id);

      pushStaffUpdatesForExisting(actions, rowIndex, staff, row, employmentResolved);

      const userForEmail = emailK ? emailToUser.get(emailK) : undefined;
      if (!staff.fi_user_id && userForEmail) {
        actions.push({
          type: "link_staff_to_user",
          sourceRowIndex: rowIndex,
          payload: { staffId: staff.id, fiUserId: userForEmail.id },
        });
      }

      if (hrSource) {
        if (sourceIdNeedsUpdate(hrSource, nextUrl, nextMeta)) {
          actions.push({
            type: "update_staff_source_id",
            sourceRowIndex: rowIndex,
            payload: {
              id: hrSource.id,
              source_url: nextUrl ?? undefined,
              metadata: nextMeta,
            },
          });
        }
      } else {
        actions.push({
          type: "create_staff_source_id",
          sourceRowIndex: rowIndex,
          payload: {
            staffId: staff.id,
            staffFromRowIndex: null,
            source_system: IIOHR_HR_SOURCE_SYSTEM,
            source_staff_id: extNorm,
            source_url: nextUrl,
            metadata: nextMeta,
          },
        });
      }
    } else if (matchKind === "user_email") {
      const user = emailToUser.get(emailK!)!;
      const nextMeta = mergeSourceMetadata({}, row.iiohr_user_id);

      const wh =
        row.working_hours &&
        typeof row.working_hours === "object" &&
        !Array.isArray(row.working_hours)
          ? (row.working_hours as Record<string, unknown>)
          : {};
      const nextTz = row.default_timezone?.trim() || null;
      const isActiveNew = defaultIsActiveForNewStaff(row.employment_status);

      actions.push({
        type: "create_fi_staff",
        sourceRowIndex: rowIndex,
        payload: {
          full_name: row.full_name.trim() || "Staff",
          staff_role: (row.staff_role?.trim() || "consultant").trim() || "consultant",
          email: emailK ? String(row.email).trim() : null,
          default_timezone: nextTz,
          working_hours: wh,
          is_active: isActiveNew,
          fi_user_id: user.id,
        },
      });
      actions.push({
        type: "create_staff_source_id",
        sourceRowIndex: rowIndex,
        payload: {
          staffId: null,
          staffFromRowIndex: rowIndex,
          source_system: IIOHR_HR_SOURCE_SYSTEM,
          source_staff_id: extNorm,
          source_url: nextUrl,
          metadata: nextMeta,
        },
      });
    } else {
      matchKind = "none";
      const nextMeta = mergeSourceMetadata({}, row.iiohr_user_id);
      let fiUserId: string | null = null;
      let fiUserIdFromSameRowIndex: number | null = null;

      if (emailK) {
        if (emailToUser.has(emailK)) {
          fiUserId = emailToUser.get(emailK)!.id;
          matchedUserId = fiUserId;
        } else {
          actions.push({
            type: "create_fi_user",
            sourceRowIndex: rowIndex,
            payload: { email: String(row.email).trim(), role: "member" },
          });
          fiUserIdFromSameRowIndex = rowIndex;
        }
      }

      const wh =
        row.working_hours &&
        typeof row.working_hours === "object" &&
        !Array.isArray(row.working_hours)
          ? (row.working_hours as Record<string, unknown>)
          : {};
      const nextTz = row.default_timezone?.trim() || null;
      const isActiveNew = defaultIsActiveForNewStaff(row.employment_status);

      actions.push({
        type: "create_fi_staff",
        sourceRowIndex: rowIndex,
        payload: {
          full_name: row.full_name.trim() || "Staff",
          staff_role: (row.staff_role?.trim() || "consultant").trim() || "consultant",
          email: emailK ? String(row.email).trim() : null,
          default_timezone: nextTz,
          working_hours: wh,
          is_active: isActiveNew,
          fi_user_id: fiUserId,
          fi_user_id_from_same_row_index: fiUserIdFromSameRowIndex,
        },
      });

      actions.push({
        type: "create_staff_source_id",
        sourceRowIndex: rowIndex,
        payload: {
          staffId: null,
          staffFromRowIndex: rowIndex,
          source_system: IIOHR_HR_SOURCE_SYSTEM,
          source_staff_id: extNorm,
          source_url: nextUrl,
          metadata: nextMeta,
        },
      });
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
    });
  }

  const actions = perRow.flatMap((p) => p.actions);

  return { perRow, actions, warnings, validationIssues };
}
