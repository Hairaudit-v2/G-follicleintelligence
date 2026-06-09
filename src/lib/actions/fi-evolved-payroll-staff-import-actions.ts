"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { parseEvolvedPayrollExportXlsxBuffer } from "@/src/lib/staffImport/evolvedPayrollStaffImportParse";
import type { EvolvedPayrollStaffImportRow } from "@/src/lib/staffImport/evolvedPayrollStaffImportTypes";
import {
  type EvolvedPayrollStaffImportRunResult,
  runEvolvedPayrollStaffImport,
} from "@/src/lib/staffImport/evolvedPayrollStaffImportRunner";

const previewBodySchema = z
  .object({
    tenantId: z.string().uuid("tenantId must be a UUID."),
    adminKey: z.string().optional(),
    rows: z.array(z.unknown()).optional(),
    packedRows: z.array(z.unknown()).optional(),
    sourceRowIndices: z.array(z.number()).optional(),
    skippedSensitiveFields: z.array(z.string()).optional(),
  })
  .refine((d) => (d.rows?.length ?? 0) > 0 || (d.packedRows?.length ?? 0) > 0, {
    message: "Provide payroll export rows or packedRows from a prior parse.",
  });

const commitBodySchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID."),
  adminKey: z.string().optional(),
  confirm: z.literal(true),
  packedRows: z.array(z.unknown()),
  sourceRowIndices: z.array(z.number()).optional(),
  skippedSensitiveFields: z.array(z.string()).optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePayrollStaffImportSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/staff`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-import`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-import/payroll`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}`);
}

export async function parseEvolvedPayrollXlsxAction(
  body: unknown
): Promise<
  | {
      ok: true;
      rows: EvolvedPayrollStaffImportRow[];
      sourceRowIndices: number[];
      validationErrors: string[];
      skippedSensitiveFields: string[];
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = z
      .object({
        tenantId: z.string().uuid(),
        adminKey: z.string().optional(),
        fileBase64: z.string().min(1),
      })
      .parse(body);
    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const buffer = Buffer.from(parsed.fileBase64, "base64");
    const result = parseEvolvedPayrollExportXlsxBuffer(buffer);
    if (!result.isPayrollExport && result.rows.length === 0) {
      return { ok: false, error: "File does not look like an Evolved payroll EmployeeData export." };
    }
    return {
      ok: true,
      rows: result.rows,
      sourceRowIndices: result.sourceRowIndices,
      validationErrors: result.validationErrors,
      skippedSensitiveFields: result.skippedSensitiveFields,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function previewEvolvedPayrollStaffImportAction(
  body: unknown
): Promise<
  | {
      ok: true;
      result: EvolvedPayrollStaffImportRunResult;
      validatedPackedRows: NonNullable<EvolvedPayrollStaffImportRunResult["validatedPackedRows"]>;
      sourceRowIndices: number[];
      skippedSensitiveFields: string[];
    }
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
    const result = await runEvolvedPayrollStaffImport({
      tenantId: parsed.tenantId,
      rows: parsed.rows ?? [],
      packedRows: parsed.packedRows as EvolvedPayrollStaffImportRow[] | undefined,
      sourceRowIndices: parsed.sourceRowIndices,
      skippedSensitiveFields: parsed.skippedSensitiveFields as EvolvedPayrollStaffImportRunResult["skippedSensitiveFields"],
      commit: false,
      adminKey: parsed.adminKey,
      authUserId,
      skipImportAuthCheck: true,
    });
    return {
      ok: true,
      result,
      validatedPackedRows: result.validatedPackedRows ?? [],
      sourceRowIndices: result.plan.perRow.map((p) => p.rowIndex),
      skippedSensitiveFields: result.skippedSensitiveFields,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function commitEvolvedPayrollStaffImportAction(
  body: unknown
): Promise<{ ok: true; result: EvolvedPayrollStaffImportRunResult } | { ok: false; error: string }> {
  try {
    const parsed = commitBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const authUserId = await resolveAuthUserId(null);
    const result = await runEvolvedPayrollStaffImport({
      tenantId: parsed.tenantId,
      rows: [],
      packedRows: parsed.packedRows as EvolvedPayrollStaffImportRow[],
      sourceRowIndices: parsed.sourceRowIndices,
      skippedSensitiveFields: parsed.skippedSensitiveFields as EvolvedPayrollStaffImportRunResult["skippedSensitiveFields"],
      commit: true,
      confirm: true,
      adminKey: parsed.adminKey,
      authUserId,
      skipImportAuthCheck: true,
    });

    if (result.ok && result.commit) {
      revalidatePayrollStaffImportSurfaces(parsed.tenantId);
    }

    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
