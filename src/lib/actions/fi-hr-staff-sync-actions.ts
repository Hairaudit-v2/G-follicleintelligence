"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import { syncIiohrHrStaffForTenant } from "@/src/lib/staffImport/iiohrHrStaffSync.server";
import { parseIiohrHrStaffSyncRows } from "@/src/lib/staffImport/iiohrHrStaffSyncRowsParse";
import type {
  IiohrHrStaffSyncPayload,
  IiohrHrStaffSyncSummary,
} from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";

const syncActionBodySchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID."),
  adminKey: z.string().optional(),
  mode: z.enum(["preview", "commit"]),
  confirm: z.literal(true).optional(),
  /** Top-level rows (same shape as staff import). */
  rows: z.array(z.unknown()).optional(),
  /** Wrapped `{ rows }` from IIOHR HR webhook/export. */
  payload: z.object({ rows: z.array(z.unknown()) }).optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateStaffSyncSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/staff`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-import`);
  revalidatePath(`/fi-admin/${tid}/hr/sync-health`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-readiness`);
  revalidatePath(`/fi-admin/${tid}/staff/import/iiohr-hr`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}`);
  revalidatePath(`/fi-admin/${tid}/appointments`);
  revalidatePath(`/fi-admin/${tid}/patients`);
}

export type SyncIiohrHrStaffPayloadActionPreviewOk = {
  ok: true;
  summary: IiohrHrStaffSyncSummary;
  /** Row set used for this preview — pass back unchanged for commit. */
  validatedPayload: IiohrHrStaffSyncPayload;
};

export type SyncIiohrHrStaffPayloadActionResult =
  | SyncIiohrHrStaffPayloadActionPreviewOk
  | { ok: true; summary: IiohrHrStaffSyncSummary }
  | { ok: false; error: string };

/**
 * Manual IIOHR HR → FI staff sync (preview or commit). Same access gate as HR staff import.
 * Accepts pasted JSON: an array of rows, or `{ "rows": [ ... ] }`.
 */
export async function syncIiohrHrStaffPayloadAction(
  body: unknown
): Promise<SyncIiohrHrStaffPayloadActionResult> {
  try {
    const parsed = syncActionBodySchema.parse(body);
    const rawRows = parsed.rows ?? parsed.payload?.rows;
    if (!rawRows || !Array.isArray(rawRows)) {
      return { ok: false, error: "Provide `rows` (array) or `payload.rows`." };
    }

    const rowParse = parseIiohrHrStaffSyncRows(rawRows);
    if (!rowParse.ok) {
      return { ok: false, error: rowParse.error.replace(/^Row /, "Sync row ") };
    }
    const payload: IiohrHrStaffSyncPayload = { rows: rowParse.rows };

    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const authUserId = await resolveAuthUserId(null);

    if (parsed.mode === "commit" && parsed.confirm !== true) {
      return { ok: false, error: "commit requires confirm: true" };
    }

    const summary = await syncIiohrHrStaffForTenant({
      tenantId: parsed.tenantId,
      payload,
      mode: parsed.mode,
      confirm: parsed.mode === "commit" ? parsed.confirm === true : undefined,
      adminKey: parsed.adminKey,
      authUserId,
      skipImportAuthCheck: true,
    });

    if (parsed.mode === "commit" && summary.result.ok && summary.result.commit) {
      revalidateStaffSyncSurfaces(parsed.tenantId);
    }

    if (parsed.mode === "preview") {
      return { ok: true, summary, validatedPayload: payload };
    }
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
