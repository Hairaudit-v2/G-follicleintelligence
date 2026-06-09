/**
 * Types for IIOHR HR → FI OS staff import (Stage 7D). Pure data shapes — no DB I/O.
 */

export type IiohrHrStaffImportRow = {
  external_staff_id: string;
  iiohr_user_id?: string | null;
  email?: string | null;
  full_name: string;
  staff_role?: string | null;
  employment_status?: string | null;
  source_url?: string | null;
  default_timezone?: string | null;
  working_hours?: unknown;
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
  /**
   * Maps each `rows[i]` to the original index in the caller’s array (e.g. after per-row JSON validation).
   * When omitted, defaults to `0 .. rows.length-1`.
   */
  sourceRowIndices?: number[];
};

export type IiohrHrStaffImportMatchKind = "source_id" | "staff_email" | "user_email" | "none";

export type IiohrHrStaffImportValidationIssue = {
  rowIndex: number;
  field?: string;
  message: string;
};

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
        mobile?: string | null;
        default_timezone: string | null;
        working_hours: Record<string, unknown>;
        is_active: boolean;
        fi_user_id: string | null;
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
        mobile?: string | null;
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
    }
  | {
      type: "skip_row";
      sourceRowIndex: number;
      payload: { reason: string };
    };

export type IiohrHrStaffImportRowPlan = {
  rowIndex: number;
  row: IiohrHrStaffImportRow;
  matchKind: IiohrHrStaffImportMatchKind;
  matchedStaffId: string | null;
  matchedUserId: string | null;
  actions: IiohrHrStaffImportAction[];
  skippedDuplicate: boolean;
  /** Set when the row failed planner validation (e.g. missing required fields). */
  skippedValidation: boolean;
};

/** Full planner output (alias for spec naming “plan”). */
export type IiohrHrStaffImportPlan = IiohrHrStaffImportPlanResult;

export type IiohrHrStaffImportPlanResult = {
  perRow: IiohrHrStaffImportRowPlan[];
  actions: IiohrHrStaffImportAction[];
  warnings: string[];
  validationIssues: IiohrHrStaffImportValidationIssue[];
};
