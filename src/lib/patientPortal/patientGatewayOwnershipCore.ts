/**
 * FI-PATIENT-APP-1B — reusable ownership guards (pure).
 * Future clinical/image/appointment/billing/document routes must call these.
 */

import { patientGatewayDeny } from "./patientGatewayGateCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

export type OwnedTenantPatientRow = {
  tenant_id: string;
  patient_id: string | null | undefined;
};

function ownedOrDeny(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow,
  label: string
): PatientGatewayDeny | null {
  const tid = String(row.tenant_id ?? "").trim();
  const pid = String(row.patient_id ?? "").trim();
  if (!tid || tid !== ctx.tenantId) {
    return patientGatewayDeny("wrong_tenant", 403, `Not authorized for this ${label}.`);
  }
  if (!pid || pid !== ctx.patientId) {
    return patientGatewayDeny("ownership_denied", 403, `Not authorized for this ${label}.`);
  }
  return null;
}

/** Guard for any patient-scoped clinical row (tenant_id + patient_id). */
export function assertOwnedClinicalRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow
): PatientGatewayDeny | null {
  return ownedOrDeny(ctx, row, "clinical record");
}

export function assertOwnedImageRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow
): PatientGatewayDeny | null {
  return ownedOrDeny(ctx, row, "image");
}

export function assertOwnedAppointmentRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow
): PatientGatewayDeny | null {
  return ownedOrDeny(ctx, row, "appointment");
}

export function assertOwnedBillingRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow
): PatientGatewayDeny | null {
  return ownedOrDeny(ctx, row, "billing record");
}

export function assertOwnedDocumentRow(
  ctx: PatientGatewayContext,
  row: OwnedTenantPatientRow
): PatientGatewayDeny | null {
  return ownedOrDeny(ctx, row, "document");
}

/** Explicit patient id check — never treat client-supplied id as authoritative alone. */
export function assertOwnedPatientId(
  ctx: PatientGatewayContext,
  patientId: string | null | undefined
): PatientGatewayDeny | null {
  const pid = patientId?.trim() || "";
  if (!pid || pid !== ctx.patientId) {
    return patientGatewayDeny(
      "ownership_denied",
      403,
      "Patient identity mismatch. Canonical patient is resolved server-side."
    );
  }
  return null;
}

export function assertOwnedTenantId(
  ctx: PatientGatewayContext,
  tenantId: string | null | undefined
): PatientGatewayDeny | null {
  const tid = tenantId?.trim() || "";
  if (!tid || tid !== ctx.tenantId) {
    return patientGatewayDeny("wrong_tenant", 403, "Not authorized for this clinic.");
  }
  return null;
}
