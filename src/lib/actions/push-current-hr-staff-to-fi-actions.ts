"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import type { PushStaffSyncToFiResult } from "@/src/lib/hr/iiohrFiStaffSyncClient";
import {
  parseFiOutboundStaffSyncDisplay,
  type FiOutboundStaffSyncDisplay,
} from "@/src/lib/hr/fiStaffSyncOutboundSummary";
import { mapIiohrHrStaffRecordsToFiSyncRows } from "@/src/lib/hr/iiohrFiStaffSyncMapper";
import { pushStaffSyncToFi } from "@/src/lib/hr/iiohrFiStaffSyncPush";
import { loadEvolvedPerthHrStaffRecordsForFiPush } from "@/src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server";

export type { FiOutboundStaffSyncDisplay } from "@/src/lib/hr/fiStaffSyncOutboundSummary";

const bodySchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID."),
  adminKey: z.string().optional(),
  mode: z.enum(["preview", "commit"]).optional().default("preview"),
  confirm: z.literal(true).optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateStaffOutboundSurfaces(tenantId: string): void {
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

export type PushCurrentHrStaffToFiActionResult =
  | {
      ok: true;
      fi: PushStaffSyncToFiResult;
      mappedRowCount: number;
      display: FiOutboundStaffSyncDisplay;
    }
  | { ok: false; error: string };

/**
 * Loads Evolved Perth staff from the configured IIOHR HR feed, maps to FI operational rows, and POSTs to FI staff-sync.
 * Preview by default; commit only when `confirm: true`.
 */
export async function pushCurrentHrStaffToFiAction(
  body: unknown
): Promise<PushCurrentHrStaffToFiActionResult> {
  try {
    const parsed = bodySchema.parse(body);
    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });

    if (parsed.mode === "commit" && parsed.confirm !== true) {
      return { ok: false, error: "commit requires confirm: true." };
    }

    const hrRows = await loadEvolvedPerthHrStaffRecordsForFiPush();
    const rows = mapIiohrHrStaffRecordsToFiSyncRows(hrRows);
    if (rows.length === 0) {
      return { ok: false, error: "HR staff feed returned no mappable rows." };
    }

    const fi = await pushStaffSyncToFi({
      tenantId: parsed.tenantId,
      rows,
      mode: parsed.mode,
      confirm: parsed.mode === "commit" ? parsed.confirm === true : undefined,
    });

    if (parsed.mode === "commit" && fi.ok) {
      const sum = fi.raw.summary;
      const committed =
        sum &&
        typeof sum === "object" &&
        !Array.isArray(sum) &&
        (sum as { commit?: unknown }).commit === true;
      if (committed) {
        revalidateStaffOutboundSurfaces(parsed.tenantId);
      }
    }

    return {
      ok: true,
      fi,
      mappedRowCount: rows.length,
      display: parseFiOutboundStaffSyncDisplay(fi),
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
