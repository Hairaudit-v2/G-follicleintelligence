import type { FiOsNexusRoleCode } from "@/src/lib/nexus/fiOsNexusRoles";

export type FiNexusExternalProfessionalRow = {
  id: string;
  global_professional_id: string;
  source_system: string;
  email: string;
  name: string | null;
  professional_type: string;
  certification_level: string | null;
  deployment_ready: boolean;
  nexus_created: boolean;
  created_at: string;
  updated_at: string;
};

export type FiNexusTenantMembershipRow = {
  id: string;
  global_professional_id: string;
  tenant_id: string;
  site_id: string | null;
  membership_status: string;
  nexus_created: boolean;
  created_at: string;
  updated_at: string;
};

export type FiNexusStaffProfileRow = {
  id: string;
  global_professional_id: string;
  tenant_id: string;
  site_id: string | null;
  staff_type: string;
  display_name: string | null;
  email: string;
  active: boolean;
  nexus_created: boolean;
  created_at: string;
  updated_at: string;
};

export type FiNexusRoleAssignmentRow = {
  id: string;
  global_professional_id: string;
  tenant_id: string;
  role_code: string;
  assigned_by: string;
  active: boolean;
  nexus_created: boolean;
  created_at: string;
  revoked_at: string | null;
};

export type NexusProvisionPayload = {
  globalProfessionalId: string;
  email: string;
  name?: string | null;
  professionalType: string;
  certificationLevel?: string | null;
  deploymentReady?: boolean;
  sourceSystem?: string;
  tenantId: string;
  siteId?: string | null;
  staffType: string;
  displayName?: string | null;
  approvedRoles: string[];
  membershipStatus?: string;
};

export type NexusRollbackPayload = {
  globalProfessionalId: string;
  tenantId: string;
  reason: string;
};

export type ExternalProfessionalState = {
  professional: FiNexusExternalProfessionalRow | null;
  memberships: FiNexusTenantMembershipRow[];
  staffProfiles: FiNexusStaffProfileRow[];
  activeRoles: FiNexusRoleAssignmentRow[];
  auditCount: number;
  reconciliationWarnings: string[];
};

export type ProvisionResult =
  | { ok: true; state: ExternalProfessionalState }
  | { ok: false; error: string; httpStatus: number };

export type RollbackResult =
  | { ok: true; state: ExternalProfessionalState }
  | { ok: false; error: string; httpStatus: number };

export type ReadStateResult =
  | { ok: true; state: ExternalProfessionalState }
  | { ok: false; error: string; httpStatus: number };

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GLOBAL_PROFESSIONAL_ID_RE = /^[a-zA-Z0-9._:-]{3,128}$/;

export function normalizeApprovedRolesForState(roles: FiOsNexusRoleCode[]): FiOsNexusRoleCode[] {
  return [...roles];
}
