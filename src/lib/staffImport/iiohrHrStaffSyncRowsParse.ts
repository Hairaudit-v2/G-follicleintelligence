import { z } from "zod";

import type { IiohrHrStaffSyncRow } from "./iiohrHrStaffSyncTypes";

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

export type ParseIiohrHrStaffSyncRowsResult =
  | { ok: true; rows: IiohrHrStaffSyncRow[] }
  | { ok: false; error: string };

/** Shared row validation for server actions and IIOHR HR sync API. */
export function parseIiohrHrStaffSyncRows(rawRows: unknown[]): ParseIiohrHrStaffSyncRowsResult {
  const rows: IiohrHrStaffSyncRow[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const parsed = syncRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "invalid row";
      return { ok: false, error: `Row ${i}: ${msg}` };
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
