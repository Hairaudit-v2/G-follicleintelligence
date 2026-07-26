import "server-only";

import { logStructured } from "@/src/lib/server/structuredLog";

import type { PatientGatewayAuditAction, PatientGatewayDenyCode } from "./patientGatewayTypes";

export type PatientGatewayAuditInput = {
  action: PatientGatewayAuditAction;
  outcome: "allow" | "deny";
  code?: PatientGatewayDenyCode;
  authUserId?: string | null;
  patientId?: string | null;
  tenantId?: string | null;
  resourceKind?: "patient" | "image" | "appointment" | "billing" | "document" | "me";
  resourceId?: string | null;
};

/**
 * Security/audit evidence for the patient gateway.
 * Never logs bearer tokens, secrets, PHI payloads, or signed URLs.
 */
export function writePatientGatewayAudit(input: PatientGatewayAuditInput): void {
  const level = input.outcome === "deny" ? "warn" : "info";
  logStructured(level, "patient_gateway_audit", {
    action: input.action,
    outcome: input.outcome,
    code: input.code ?? null,
    auth_user_id: input.authUserId?.trim() || null,
    patient_id: input.patientId?.trim() || null,
    tenant_id: input.tenantId?.trim() || null,
    resource_kind: input.resourceKind ?? null,
    resource_id: input.resourceId?.trim() || null,
  });
}
