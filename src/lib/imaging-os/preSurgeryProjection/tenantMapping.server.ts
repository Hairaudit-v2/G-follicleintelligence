/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Server-controlled HairAudit → FiOS tenant mapping.
 * Never trust tenant/clinic IDs supplied solely by the external request.
 */

import "server-only";

import { resolveProjectionGatewayConfig, type ProjectionGatewayConfig } from "./config.server";
import { ProjectionGatewayError } from "./errors";
import type { ProjectionTenantProvenance } from "./types";

export function resolveHairAuditTenantProvenance(input: {
  externalCaseId: string;
  externalProjectionId?: string | null;
  config?: ProjectionGatewayConfig;
}): ProjectionTenantProvenance {
  const config = input.config ?? resolveProjectionGatewayConfig();
  if (!config.hairauditTenantId || !config.hairauditClinicId) {
    throw new ProjectionGatewayError(
      "tenant_mapping_missing",
      "HairAudit projection integration tenant/clinic mapping is not configured",
      503
    );
  }
  return {
    sourceChannel: "hairaudit_service",
    tenantId: config.hairauditTenantId,
    clinicId: config.hairauditClinicId,
    patientId: null,
    caseId: null,
    procedureId: null,
    externalCaseId: input.externalCaseId,
    externalProjectionId: input.externalProjectionId ?? null,
    externalOrgKey: "hairaudit",
  };
}

/**
 * 1B clinic channel entry — validates feature flag + returns provenance from authenticated session.
 * Full clinic UI is out of scope for 1A.
 */
export function resolveClinicTenantProvenance(input: {
  tenantId: string;
  clinicId: string;
  patientId?: string | null;
  caseId?: string | null;
  procedureId?: string | null;
  config?: ProjectionGatewayConfig;
}): ProjectionTenantProvenance {
  const config = input.config ?? resolveProjectionGatewayConfig();
  if (!config.enabled || !config.clinicEnabled) {
    throw new ProjectionGatewayError(
      "clinic_channel_disabled",
      "Native FiOS clinic projection channel is disabled",
      503
    );
  }
  return {
    sourceChannel: "fios_clinic",
    tenantId: input.tenantId,
    clinicId: input.clinicId,
    patientId: input.patientId ?? null,
    caseId: input.caseId ?? null,
    procedureId: input.procedureId ?? null,
    externalCaseId: null,
    externalProjectionId: null,
    externalOrgKey: null,
  };
}
