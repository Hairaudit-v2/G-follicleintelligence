"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { CrmAccessError, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  type IiohrHrStaffImportRunResult,
  logIiohrHrStaffImportReport,
  runIiohrHrStaffImport,
} from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

const importIiohrHrStaffBodySchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID."),
  adminKey: z.string().optional(),
  /** When `true`, writes to the database. Omitted or `false` = dry-run only. */
  commit: z.boolean().optional(),
  rows: z.array(z.unknown()),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

/**
 * Tenant-scoped IIOHR HR staff import (dry-run by default).
 * Uses service role after `assertIiohrHrStaffImportAllowed` (FI admin API key, tenant admin/fi_admin, or OS fi_admin).
 *
 * Returns `{ ok: true, result }` when the action finished without throwing; inspect `result.ok` for
 * validation / execution success and `result.validationErrors` / `result.error` for details.
 */
export async function importIiohrHrStaffAction(
  body: unknown
): Promise<{ ok: true; result: IiohrHrStaffImportRunResult } | { ok: false; error: string }> {
  try {
    const parsed = importIiohrHrStaffBodySchema.parse(body);
    const authUserId = await resolveAuthUserId(null);
    const result = await runIiohrHrStaffImport({
      tenantId: parsed.tenantId,
      rows: parsed.rows,
      commit: parsed.commit === true,
      adminKey: parsed.adminKey,
      authUserId,
    });

    if (result.ok && result.commit) {
      const tid = parsed.tenantId.trim();
      revalidatePath(`/fi-admin/${tid}/staff`);
      revalidatePath(`/fi-admin/${tid}/calendar`);
      revalidatePath(`/fi-admin/${tid}`);
      revalidatePath(`/fi-admin/${tid}/appointments`);
      revalidatePath(`/fi-admin/${tid}/patients`);
    }

    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Server-side helper to print the same summary as the CLI (e.g. from a route handler). */
export function logIiohrHrStaffImportResultToConsole(result: IiohrHrStaffImportRunResult): void {
  logIiohrHrStaffImportReport(result);
}
