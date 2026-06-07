/**
 * Dry-run planner: map IIOHR HR export rows onto FI `fi_users`, `fi_staff`, and `fi_staff_source_ids`.
 * No database I/O — callers load snapshots and execute returned actions separately.
 *
 * Action types `update_fi_user` / `update_staff_source_id` are included for executors; HR→FI user
 * email sync may emit `update_fi_user` in a later iteration.
 */

import {
  normalizeFiStaffSourceMetadata,
  normalizeFiStaffSourceStaffId,
  normalizeFiStaffSourceSystem,
  normalizeFiStaffSourceUrl,
} from "@/src/lib/staff/staffSourceIdsNormalize";

/** Canonical `source_system` for IIOHR HR rows in `fi_staff_source_ids`. */
export const IIOHR_HR_SOURCE_SYSTEM = normalizeFiStaffSourceSystem("iiohr_hr");

export type IiohrHrStaffImportRow = {
  external_staff_id: string;
  iiohr_user_id?: string | null;
  email: string;
  full_name: string;
  staff_role: string;
  employment_status: string;
  source_url?: string | null;
  default_timezone?: string | null;
  working_hours?: Record<string, unknown> | null;
};

export type IiohrHrImportExistingUser = {
  id: string;
  email: string | null;
  role?: string | null;
};

export type IiohrHrImportExistingStaff = {
  id: string;
  fi_user_id: string | null;
  full_name: string;
  staff_role: string;
  email: string | null;
  is_active: boolean;
  default_timezone?: string | null;
  working_hours?: Record<string, unknown>;
};

export type IiohrHrImportExistingSourceId = {
  id: string;
  staff_id: string;
  source_system: string;
  source_staff_id: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
};

export type IiohrHrStaffImportPlanInput = {
  tenantId: string;
  rows: IiohrHrStaffImportRow[];
  existingUsers: IiohrHrImportExistingUser[];
  existingStaff: IiohrHrImportExistingStaff[];
  existingStaffSourceIds: IiohrHrImportExistingSourceId[];
};

export type IiohrHrStaffImportMatchKind = "source_id" | "staff_email" | "user_email" | "none";

export type IiohrHrStaffImportAction =
  | {
      type: "create_fi_user";
      sourceRowIndex: number;
      payload: { email: string; role: string };
    }
  | {
      type: "update_fi_user";
      sourceRowIndex: number;
      payload: { userId: string; email?: string; role?: string };
    }
  | {
      type: "create_fi_staff";
      sourceRowIndex: number;
      payload: {
        full_name: string;
        staff_role: string;
        email: string | null;
        default_timezone: string | null;
        working_hours: Record<string, unknown>;
        is_active: boolean;
        fi_user_id: string | null;
        /**
         * When set, executor binds `fi_user_id` from the `create_fi_user` action on this import row
         * (same `sourceRowIndex`) after that user is inserted.
         */
        fi_user_id_from_same_row_index?: number | null;
      };
    }
  | {
      type: "update_fi_staff";
      sourceRowIndex: number;
      payload: {
        staffId: string;
        full_name?: string;
        staff_role?: string;
        email?: string | null;
        default_timezone?: string | null;
        working_hours?: Record<string, unknown>;
        is_active?: boolean;
      };
    }
  | {
      type: "link_staff_to_user";
      sourceRowIndex: number;
      payload: { staffId: string; fiUserId: string };
    }
  | {
      type: "create_staff_source_id";
      sourceRowIndex: number;
      payload: {
        staffId: string | null;
        /** Executor: apply after `create_fi_staff` for this `sourceRowIndex` when set. */
        staffFromRowIndex: number | null;
        source_system: string;
        source_staff_id: string;
        source_url: string | null;
        metadata: Record<string, unknown>;
      };
    }
  | {
      type: "update_staff_source_id";
      sourceRowIndex: number;
      payload: {
        id: string;
        source_url?: string | null;
        metadata?: Record<string, unknown>;
      };
    }
  | {
      type: "deactivate_staff";
      sourceRowIndex: number;
      payload: { staffId: string };
    };

export type IiohrHrStaffImportRowPlan = {
  rowIndex: number;
  row: IiohrHrStaffImportRow;
  matchKind: IiohrHrStaffImportMatchKind;
  matchedStaffId: string | null;
  matchedUserId: string | null;
  actions: IiohrHrStaffImportAction[];
  skippedDuplicate: boolean;
};

export type IiohrHrStaffImportPlanResult = {
  perRow: IiohrHrStaffImportRowPlan[];
  actions: IiohrHrStaffImportAction[];
  warnings: string[];
};

function emailKey(email: string | null | undefined): string | null {
  if (email == null) return null;
  const t = email.trim();
  if (!t) return null;
  return t.toLowerCase();
}

function jsonForCompare(v: unknown): string {
  return JSON.stringify(v === undefined ? null : v);
}

/** Exported for tests — maps HR employment strings to FI `is_active`. */
export function mapIiohrHrEmploymentToIsActive(employment_status: string): boolean {
  const s = employment_status.trim().toLowerCase();
  if (s === "terminated" || s === "inactive") return false;
  if (s === "active") return true;
  if (s === "resigned" || s === "dismissed" || s === "laid_off") return false;
  return true;
}

function buildStaffUpdatePayload(
  staff: IiohrHrImportExistingStaff,
  row: IiohrHrStaffImportRow,
  targetIsActive: boolean
): {
  staffId: string;
  full_name?: string;
  staff_role?: string;
  email?: string | null;
  default_timezone?: string | null;
  working_hours?: Record<string, unknown>;
  is_active?: boolean;
} | null {
  const emailNorm = emailKey(row.email);
  const nextEmail = emailNorm ? row.email.trim() : null;
  const wh =
    row.working_hours && typeof row.working_hours === "object" && !Array.isArray(row.working_hours)
      ? row.working_hours
      : {};
  const nextTz = row.default_timezone?.trim() || null;

  const patch: {
    staffId: string;
    full_name?: string;
    staff_role?: string;
    email?: string | null;
    default_timezone?: string | null;
    working_hours?: Record<string, unknown>;
    is_active?: boolean;
  } = { staffId: staff.id };

  if (row.full_name.trim() && row.full_name.trim() !== staff.full_name) patch.full_name = row.full_name.trim();
  const role = row.staff_role.trim() || "consultant";
  if (role !== staff.staff_role) patch.staff_role = role;
  const staffEmailKey = emailKey(staff.email);
  if (nextEmail !== staff.email && (nextEmail || staffEmailKey)) patch.email = nextEmail;
  const stz = staff.default_timezone ?? null;
  if (nextTz !== stz) patch.default_timezone = nextTz;

  const existingWh =
    staff.working_hours && typeof staff.working_hours === "object" && !Array.isArray(staff.working_hours)
      ? staff.working_hours
      : {};
  if (jsonForCompare(wh) !== jsonForCompare(existingWh)) patch.working_hours = wh;

  if (targetIsActive !== staff.is_active) patch.is_active = targetIsActive;

  return Object.keys(patch).length > 1 ? patch : null;
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
  return jsonForCompare(normalizeFiStaffSourceMetadata(existing.metadata)) !== jsonForCompare(nextMeta);
}

type UpdateFiStaffPayload = Extract<IiohrHrStaffImportAction, { type: "update_fi_staff" }>["payload"];

function pushStaffUpdatesForExisting(
  actions: IiohrHrStaffImportAction[],
  rowIndex: number,
  staff: IiohrHrImportExistingStaff,
  row: IiohrHrStaffImportRow,
  targetIsActive: boolean
): void {
  const deactivate = !targetIsActive && staff.is_active;

  if (deactivate) {
    actions.push({ type: "deactivate_staff", sourceRowIndex: rowIndex, payload: { staffId: staff.id } });
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
    actions.push({ type: "update_fi_staff", sourceRowIndex: rowIndex, payload });
  }
}

/**
 * Produces ordered dry-run actions for an IIOHR HR staff CSV (or API) import.
 *
 * Matching (first hit wins): `fi_staff_source_ids` (`iiohr_hr` + external id) → `fi_staff.email` → `fi_users.email` → new staff.
 */
export function planIiohrHrStaffImport(input: IiohrHrStaffImportPlanInput): IiohrHrStaffImportPlanResult {
  const warnings: string[] = [];
  const tid = input.tenantId.trim();
  if (!tid) warnings.push("tenantId is empty.");

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
    if (sys !== IIOHR_HR_SOURCE_SYSTEM) continue;
    const ext = normalizeFiStaffSourceStaffId(sid.source_staff_id);
    const staffId = sid.staff_id.trim();
    externalIdToStaffId.set(ext, staffId);
    staffIdToHrSource.set(staffId, sid);
  }

  const consumedStaffIds = new Set<string>();
  const perRow: IiohrHrStaffImportRowPlan[] = [];

  for (let rowIndex = 0; rowIndex < input.rows.length; rowIndex++) {
    const row = input.rows[rowIndex];
    const actions: IiohrHrStaffImportAction[] = [];
    let matchKind: IiohrHrStaffImportMatchKind = "none";
    let matchedStaffId: string | null = null;
    let matchedUserId: string | null = null;

    const extNorm = normalizeFiStaffSourceStaffId(row.external_staff_id);
    if (!extNorm) {
      warnings.push(`Row ${rowIndex}: empty external_staff_id; treated as no source-id match.`);
    }

    const emailK = emailKey(row.email);
    let staffFromSource = extNorm ? externalIdToStaffId.get(extNorm) : undefined;
    if (staffFromSource && !staffById.has(staffFromSource)) {
      warnings.push(`Row ${rowIndex}: source id maps to unknown staff_id ${staffFromSource}; ignoring.`);
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
      });
      continue;
    }

    if (matchedStaffId) consumedStaffIds.add(matchedStaffId);

    const targetIsActive = mapIiohrHrEmploymentToIsActive(row.employment_status);
    const nextUrl = normalizeFiStaffSourceUrl(row.source_url);

    if (matchKind === "source_id" || matchKind === "staff_email") {
      const staff = staffById.get(matchedStaffId!)!;
      const hrSource = staffIdToHrSource.get(staff.id);
      const nextMeta = mergeSourceMetadata(hrSource?.metadata ?? {}, row.iiohr_user_id);

      pushStaffUpdatesForExisting(actions, rowIndex, staff, row, targetIsActive);

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
        row.working_hours && typeof row.working_hours === "object" && !Array.isArray(row.working_hours)
          ? row.working_hours
          : {};
      const nextTz = row.default_timezone?.trim() || null;

      actions.push({
        type: "create_fi_staff",
        sourceRowIndex: rowIndex,
        payload: {
          full_name: row.full_name.trim() || "Staff",
          staff_role: row.staff_role.trim() || "consultant",
          email: emailK ? row.email.trim() : null,
          default_timezone: nextTz,
          working_hours: wh,
          is_active: targetIsActive,
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
            payload: { email: row.email.trim(), role: "member" },
          });
          fiUserIdFromSameRowIndex = rowIndex;
        }
      }

      const wh =
        row.working_hours && typeof row.working_hours === "object" && !Array.isArray(row.working_hours)
          ? row.working_hours
          : {};
      const nextTz = row.default_timezone?.trim() || null;

      actions.push({
        type: "create_fi_staff",
        sourceRowIndex: rowIndex,
        payload: {
          full_name: row.full_name.trim() || "Staff",
          staff_role: row.staff_role.trim() || "consultant",
          email: emailK ? row.email.trim() : null,
          default_timezone: nextTz,
          working_hours: wh,
          is_active: targetIsActive,
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
    });
  }

  const actions = perRow.flatMap((p) => p.actions);

  return { perRow, actions, warnings };
}
