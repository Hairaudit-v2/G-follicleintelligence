/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — authenticated role-matrix acceptance model (pure).
 * Records expected browser proof outcomes; does not substitute for live E2E.
 */

import type { PilotControlRoleKey } from "../pilotControlContracts";
import { PILOT_CONTROL_ROLE_SCOPES } from "../pilotControlContracts";

export type RoleAcceptanceDimension =
  | "sign_in"
  | "route_access"
  | "navigation_visibility"
  | "overview_access"
  | "patient_register_access"
  | "patient_detail_access"
  | "blocker_visibility"
  | "hidden_fields"
  | "source_link_permissions"
  | "export_permissions"
  | "direct_api_denial"
  | "sign_out_or_session_expiry";

export type RoleAcceptanceResult = {
  role: PilotControlRoleKey | "unauthorised" | "wrong_tenant" | "wrong_programme";
  expectedAccess: "full" | "role_projected" | "denied";
  dimensions: Record<RoleAcceptanceDimension, "pass" | "fail" | "pending" | "n_a">;
  notes?: string;
};

export const PILOT_1B_ROLE_ACCEPTANCE_MATRIX: readonly RoleAcceptanceResult[] = [
  {
    role: "director",
    expectedAccess: "full",
    dimensions: basePass(),
    notes: "Full scopes including export and pause recommendation",
  },
  {
    role: "clinic_manager",
    expectedAccess: "role_projected",
    dimensions: {
      ...basePass(),
      export_permissions: "n_a",
    },
  },
  {
    role: "reception",
    expectedAccess: "role_projected",
    dimensions: {
      ...basePass(),
      export_permissions: "n_a",
      hidden_fields: "pass",
    },
    notes: "No full clinical/financial detail",
  },
  {
    role: "consultant",
    expectedAccess: "role_projected",
    dimensions: basePass(),
  },
  {
    role: "clinical",
    expectedAccess: "role_projected",
    dimensions: {
      ...basePass(),
      hidden_fields: "pass",
    },
    notes: "No financial detail",
  },
  {
    role: "finance",
    expectedAccess: "role_projected",
    dimensions: {
      ...basePass(),
      hidden_fields: "pass",
    },
    notes: "No clinical detail",
  },
  {
    role: "technical",
    expectedAccess: "role_projected",
    dimensions: {
      ...basePass(),
      export_permissions: "n_a",
      hidden_fields: "pass",
    },
  },
  {
    role: "unauthorised",
    expectedAccess: "denied",
    dimensions: deniedAll(),
  },
  {
    role: "wrong_tenant",
    expectedAccess: "denied",
    dimensions: deniedAll(),
  },
  {
    role: "wrong_programme",
    expectedAccess: "denied",
    dimensions: deniedAll(),
  },
];

function basePass(): Record<RoleAcceptanceDimension, "pass" | "fail" | "pending" | "n_a"> {
  return {
    sign_in: "pending",
    route_access: "pending",
    navigation_visibility: "pending",
    overview_access: "pending",
    patient_register_access: "pending",
    patient_detail_access: "pending",
    blocker_visibility: "pending",
    hidden_fields: "pending",
    source_link_permissions: "pending",
    export_permissions: "pending",
    direct_api_denial: "n_a",
    sign_out_or_session_expiry: "pending",
  };
}

function deniedAll(): Record<RoleAcceptanceDimension, "pass" | "fail" | "pending" | "n_a"> {
  return {
    sign_in: "pending",
    route_access: "pending",
    navigation_visibility: "pending",
    overview_access: "pending",
    patient_register_access: "pending",
    patient_detail_access: "pending",
    blocker_visibility: "pending",
    hidden_fields: "n_a",
    source_link_permissions: "n_a",
    export_permissions: "n_a",
    direct_api_denial: "pending",
    sign_out_or_session_expiry: "pending",
  };
}

/** Pure contract check: role scopes are non-empty for authorised roles. */
export function roleMatrixContractHolds(role: PilotControlRoleKey): boolean {
  return (PILOT_CONTROL_ROLE_SCOPES[role]?.length ?? 0) > 0;
}

export function summariseRoleMatrixAcceptance(
  results: readonly RoleAcceptanceResult[] = PILOT_1B_ROLE_ACCEPTANCE_MATRIX
): {
  proven: boolean;
  pendingCount: number;
  failedCount: number;
  blockers: string[];
} {
  let pendingCount = 0;
  let failedCount = 0;
  const blockers: string[] = [];

  for (const row of results) {
    for (const [dim, status] of Object.entries(row.dimensions)) {
      if (status === "pending") pendingCount += 1;
      if (status === "fail") {
        failedCount += 1;
        blockers.push(`role_matrix_fail:${row.role}:${dim}`);
      }
    }
  }

  return {
    proven: failedCount === 0 && pendingCount === 0,
    pendingCount,
    failedCount,
    blockers,
  };
}
