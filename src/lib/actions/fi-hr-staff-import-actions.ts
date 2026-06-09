"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  type IiohrHrStaffImportRunResult,
  runIiohrHrStaffImport,
} from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

const previewBodySchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID."),
  adminKey: z.string().optional(),
  rows: z.array(z.unknown()),
});

const commitBodySchema = previewBodySchema.extend({
  confirm: z.literal(true),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateStaffImportSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/staff`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-import`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-import/payroll`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}`);
  revalidatePath(`/fi-admin/${tid}/appointments`);
  revalidatePath(`/fi-admin/${tid}/patients`);
}

/**
 * Dry-run HR staff import for Evolved / IIOHR rows. Gated by `assertCrmTenantWriteAllowed`.
 */
export async function previewHrStaffImportAction(
  body: unknown
): Promise<
  | { ok: true; result: IiohrHrStaffImportRunResult; validatedPackedRows: NonNullable<IiohrHrStaffImportRunResult["validatedPackedRows"]> }
  | { ok: false; error: string }
> {
  try {
    const parsed = previewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const authUserId = await resolveAuthUserId(null);
    const result = await runIiohrHrStaffImport({
      tenantId: parsed.tenantId,
      rows: parsed.rows,
      commit: false,
      adminKey: parsed.adminKey,
      authUserId,
      skipImportAuthCheck: true,
    });
    return {
      ok: true,
      result,
      validatedPackedRows: result.validatedPackedRows ?? [],
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Apply HR staff import. Same `rows` payload must match the last successful preview (`validatedPackedRows`).
 */
export async function commitHrStaffImportAction(
  body: unknown
): Promise<{ ok: true; result: IiohrHrStaffImportRunResult } | { ok: false; error: string }> {
  try {
    const parsed = commitBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const authUserId = await resolveAuthUserId(null);
    const result = await runIiohrHrStaffImport({
      tenantId: parsed.tenantId,
      rows: parsed.rows,
      commit: true,
      confirm: true,
      adminKey: parsed.adminKey,
      authUserId,
      skipImportAuthCheck: true,
    });

    if (result.ok && result.commit) {
      revalidateStaffImportSurfaces(parsed.tenantId);
    }

    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
