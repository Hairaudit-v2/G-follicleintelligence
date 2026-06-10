"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  applyClinicSetupWizard,
  buildClinicSetupWizardPreview,
  loadClinicSetupWizardBootstrap,
} from "@/src/lib/clinicSetup/clinicSetupWizard.server";
import type {
  ApplyClinicSetupResult,
  ClinicSetupRoomCounts,
  ClinicSetupStaffInput,
} from "@/src/lib/clinicSetup/clinicSetupWizardCore";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const UUID = z.string().uuid();

const roomCountsSchema = z
  .object({
    consult: z.number().int().min(0).max(20),
    surgery: z.number().int().min(0).max(20),
    prp: z.number().int().min(0).max(20),
    patient: z.number().int().min(0).max(20),
  })
  .strict();

const staffRowSchema = z
  .object({
    staffId: UUID,
    performsConsultations: z.boolean(),
    performsPrp: z.boolean(),
    performsSurgery: z.boolean(),
    assistsSurgery: z.boolean(),
    showOnCalendar: z.boolean(),
  })
  .strict();

const previewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    clinicId: UUID,
    counts: roomCountsSchema,
    useStandardSecondRoomAliases: z.boolean(),
  })
  .strict();

const applyBodySchema = previewBodySchema.extend({
  staff: z.array(staffRowSchema),
});

export async function loadClinicSetupWizardBootstrapAction(
  tenantId: string,
  clinicId: string
): Promise<
  | { ok: true; data: Awaited<ReturnType<typeof loadClinicSetupWizardBootstrap>> }
  | { ok: false; error: string }
> {
  try {
    const tid = tenantId.trim();
    const cid = clinicId.trim();
    await assertCrmTenantWriteAllowed({ tenantId: tid, adminKey: undefined, request: undefined });
    const data = await loadClinicSetupWizardBootstrap({ tenantId: tid, clinicId: cid });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function previewClinicSetupWizardAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; preview: Awaited<ReturnType<typeof buildClinicSetupWizardPreview>> } | { ok: false; error: string }> {
  try {
    const parsed = previewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const preview = await buildClinicSetupWizardPreview({
      tenantId: tenantId.trim(),
      clinicId: parsed.clinicId.trim(),
      counts: parsed.counts as ClinicSetupRoomCounts,
      useStandardSecondRoomAliases: parsed.useStandardSecondRoomAliases,
    });
    return { ok: true, preview };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function applyClinicSetupWizardAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; result: Awaited<ReturnType<typeof applyClinicSetupWizard>> } | { ok: false; error: string }> {
  try {
    const parsed = applyBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const result = await applyClinicSetupWizard({
      tenantId: tid,
      clinicId: parsed.clinicId.trim(),
      counts: parsed.counts as ClinicSetupRoomCounts,
      useStandardSecondRoomAliases: parsed.useStandardSecondRoomAliases,
      staff: parsed.staff as ClinicSetupStaffInput[],
      dryRun: false,
    });
    revalidatePath(`/fi-admin/${tid}/rooms`);
    revalidatePath(`/fi-admin/${tid}/services`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    revalidatePath(`/fi-admin/${tid}/settings/clinic-setup`);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
