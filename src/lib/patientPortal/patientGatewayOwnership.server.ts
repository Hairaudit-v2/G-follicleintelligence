import "server-only";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import {
  assertOwnedAppointmentRow,
  assertOwnedBillingRow,
  assertOwnedClinicalRow,
  assertOwnedDocumentRow,
  assertOwnedImageRow,
  assertOwnedPatientId,
  assertOwnedTenantId,
  type OwnedTenantPatientRow,
} from "./patientGatewayOwnershipCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

function withOwnershipAudit(
  ctx: PatientGatewayContext,
  deny: PatientGatewayDeny | null,
  resourceKind: "patient" | "image" | "appointment" | "billing" | "document",
  resourceId?: string | null
): PatientGatewayDeny | null {
  if (!deny) return null;
  const action =
    resourceKind === "appointment"
      ? ("appointment_ownership_denied" as const)
      : resourceKind === "billing"
        ? ("invoice_ownership_denied" as const)
        : deny.code === "wrong_tenant"
          ? ("wrong_tenant" as const)
          : ("ownership_denied" as const);
  writePatientGatewayAudit({
    action,
    outcome: "deny",
    code: deny.code,
    authUserId: ctx.authUserId,
    patientId: ctx.patientId,
    tenantId: ctx.tenantId,
    resourceKind,
    resourceId: resourceId ?? null,
  });
  return deny;
}

/** Audited ownership wrappers for future patient v1 domain routes. */
export function requireOwnedClinicalRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow,
  resourceId?: string | null
): PatientGatewayDeny | null {
  return withOwnershipAudit(ctx, assertOwnedClinicalRow(ctx, row), "patient", resourceId);
}

export function requireOwnedImageRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow,
  resourceId?: string | null
): PatientGatewayDeny | null {
  return withOwnershipAudit(ctx, assertOwnedImageRow(ctx, row), "image", resourceId);
}

export function requireOwnedAppointmentRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow,
  resourceId?: string | null
): PatientGatewayDeny | null {
  return withOwnershipAudit(ctx, assertOwnedAppointmentRow(ctx, row), "appointment", resourceId);
}

export function requireOwnedBillingRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow,
  resourceId?: string | null
): PatientGatewayDeny | null {
  return withOwnershipAudit(ctx, assertOwnedBillingRow(ctx, row), "billing", resourceId);
}

export function requireOwnedDocumentRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow,
  resourceId?: string | null
): PatientGatewayDeny | null {
  return withOwnershipAudit(ctx, assertOwnedDocumentRow(ctx, row), "document", resourceId);
}

export function requireOwnedPatientId(
  ctx: PatientGatewayContext,
  patientId: string | null | undefined
): PatientGatewayDeny | null {
  return withOwnershipAudit(ctx, assertOwnedPatientId(ctx, patientId), "patient", patientId);
}

export function requireOwnedTenantId(
  ctx: PatientGatewayContext,
  tenantId: string | null | undefined
): PatientGatewayDeny | null {
  return withOwnershipAudit(ctx, assertOwnedTenantId(ctx, tenantId), "patient", tenantId);
}

export {
  assertOwnedAppointmentRow,
  assertOwnedBillingRow,
  assertOwnedClinicalRow,
  assertOwnedDocumentRow,
  assertOwnedImageRow,
  assertOwnedPatientId,
  assertOwnedTenantId,
};
