"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { createCertification, verifyCertification } from "@/src/lib/workforce/staffCertification.server";
import {
  createStaffCredential,
  updateStaffCredential,
} from "@/src/lib/workforce/staffCredentials.server";
import { runStaffComplianceAudit } from "@/src/lib/workforce/complianceAutomation.server";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";
import { STAFF_CREDENTIAL_TYPES } from "@/src/lib/workforce/workforceClinicalTypes";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateWorkforceClinicalSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  const paths = [
    `/fi-admin/${tid}/staff`,
    `/fi-admin/${tid}/hr-os`,
    `/fi-admin/${tid}/hr-os/credentials`,
    `/fi-admin/${tid}/hr-os/certifications`,
    `/fi-admin/${tid}/hr-os/compliance`,
  ];
  for (const p of paths) revalidatePath(p);
}

export async function createStaffCredentialAction(
  tenantId: string,
  input: {
    staffMemberId: string;
    credentialType: string;
    issuingBody?: string;
    credentialNumber?: string;
    issuedAt?: string;
    expiresAt?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    const type = input.credentialType.trim();
    if (!STAFF_CREDENTIAL_TYPES.includes(type as (typeof STAFF_CREDENTIAL_TYPES)[number])) {
      return { ok: false, error: "Invalid credential type." };
    }
    await createStaffCredential({
      tenantId,
      staffMemberId: input.staffMemberId,
      credentialType: type,
      issuingBody: input.issuingBody,
      credentialNumber: input.credentialNumber,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
    });
    revalidateWorkforceClinicalSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateStaffCredentialAction(
  tenantId: string,
  credentialId: string,
  input: {
    issuingBody?: string;
    credentialNumber?: string;
    expiresAt?: string;
    reminderSent?: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    await updateStaffCredential({ tenantId, credentialId, ...input });
    revalidateWorkforceClinicalSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createCertificationAction(
  tenantId: string,
  input: {
    staffMemberId: string;
    certificationName: string;
    certificationType?: string;
    issuingOrganization?: string;
    issuedAt?: string;
    expiresAt?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    await createCertification({ tenantId, ...input });
    revalidateWorkforceClinicalSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function verifyCertificationAction(
  tenantId: string,
  certificationId: string,
  verified: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    await verifyCertification({ tenantId, certificationId, verified });
    revalidateWorkforceClinicalSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function runComplianceAuditAction(
  tenantId: string
): Promise<
  | { ok: true; staffChecked: number; alertsGenerated: number }
  | { ok: false; error: string }
> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    const result = await runStaffComplianceAudit(tenantId);
    revalidateWorkforceClinicalSurfaces(tenantId);
    return {
      ok: true,
      staffChecked: result.staffChecked,
      alertsGenerated: result.alertsGenerated,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}