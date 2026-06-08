"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { syncIiohrHrStaffForTenant } from "@/src/lib/staffImport/iiohrHrStaffSync.server";
import type { IiohrHrStaffSyncPayload, IiohrHrStaffSyncRow, IiohrHrStaffSyncSummary } from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";

const syncRowSchema = z.object({
  external_staff_id: z.coerce.string(),
  full_name: z.coerce.string(),
  email: z.union([z.string(), z.null()]).optional(),
  staff_role: z.union([z.string(), z.null()]).optional(),
  employment_status: z.union([z.string(), z.null()]).optional(),
  source_url: z.union([z.string(), z.null()]).optional(),
  default_timezone: z.union([z.string(), z.null()]).optional(),
  working_hours: z.union([z.record(z.unknown()), z.null()]).optional(),
  iiohr_user_id: z.union([z.string(), z.number(), z.null()]).optional(),
  metadata_snapshot: z.record(z.unknown()).nullable().optional(),
});

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
  revalidatePath(`/fi-admin/${tid}/staff/import/iiohr-hr`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}`);
  revalidatePath(`/fi-admin/${tid}/appointments`);
  revalidatePath(`/fi-admin/${tid}/patients`);
}

function parseSyncRows(rawRows: unknown[]): { ok: true; rows: IiohrHrStaffSyncRow[] } | { ok: false; error: string } {
  const rows: IiohrHrStaffSyncRow[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const parsed = syncRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "invalid row";
      return { ok: false, error: `Sync row ${i}: ${msg}` };
    }
    const r = parsed.data;
    rows.push({
      external_staff_id: String(r.external_staff_id).trim(),
      full_name: String(r.full_name ?? "").trim(),
      email: r.email != null && String(r.email).trim() ? String(r.email).trim().toLowerCase() : null,
      staff_role: r.staff_role != null ? String(r.staff_role).trim() : null,
      employment_status: r.employment_status != null ? String(r.employment_status).trim() : null,
      source_url: r.source_url != null ? String(r.source_url) : null,
      default_timezone: r.default_timezone != null ? String(r.default_timezone).trim() : null,
      working_hours: r.working_hours ?? undefined,
      iiohr_user_id: r.iiohr_user_id != null ? String(r.iiohr_user_id).trim() : null,
      metadata_snapshot:
        r.metadata_snapshot && typeof r.metadata_snapshot === "object" && !Array.isArray(r.metadata_snapshot)
          ? r.metadata_snapshot
          : null,
    });
  }
  return { ok: true, rows };
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
export async function syncIiohrHrStaffPayloadAction(body: unknown): Promise<SyncIiohrHrStaffPayloadActionResult> {
  try {
    const parsed = syncActionBodySchema.parse(body);
    const rawRows = parsed.rows ?? parsed.payload?.rows;
    if (!rawRows || !Array.isArray(rawRows)) {
      return { ok: false, error: "Provide `rows` (array) or `payload.rows`." };
    }

    const rowParse = parseSyncRows(rawRows);
    if (!rowParse.ok) return { ok: false, error: rowParse.error };

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
