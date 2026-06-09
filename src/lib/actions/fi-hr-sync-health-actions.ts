"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { mapIiohrHrStaffRecordsToFiSyncRows } from "@/src/lib/hr/iiohrFiStaffSyncMapper";
import { loadEvolvedPerthHrStaffRecordsForFiPush } from "@/src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server";
import { buildRelinkSyncRowsByEmail, buildRelinkSyncRowsBySourceStaffId } from "@/src/lib/hr/hrStaffRelink";
import { pushStaffSyncToFi } from "@/src/lib/hr/iiohrFiStaffSyncPush";
import { runScheduledIiohrHrStaffSyncCore } from "@/src/lib/hr/runScheduledIiohrHrStaffSyncCore";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { isHrStaffSourceSystem } from "@/src/lib/staff/hrStaffReadinessMetadata";
import { syncIiohrHrStaffForTenant } from "@/src/lib/staffImport/iiohrHrStaffSync.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const tenantBodySchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID."),
  adminKey: z.string().optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateHrSyncHealthSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/hr/sync-health`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-readiness`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-import`);
  revalidatePath(`/fi-admin/${tid}/staff`);
  revalidatePath(`/fi-admin/${tid}/staff/role-review`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}`);
}

async function assertHrSyncHealthAdmin(body: unknown): Promise<{ tenantId: string; adminKey?: string }> {
  const parsed = tenantBodySchema.parse(body);
  await assertCrmTenantWriteAllowed({
    tenantId: parsed.tenantId,
    adminKey: parsed.adminKey,
    request: undefined,
  });
  return { tenantId: parsed.tenantId, adminKey: parsed.adminKey };
}

export type RunHrStaffSyncNowActionResult =
  | { ok: true; rowsSent: number; runId: string | null; message: string }
  | { ok: false; error: string };

/** Fetch HR feed and commit sync to FI (same pipeline as scheduled cron). */
export async function runHrStaffSyncNowAction(body: unknown): Promise<RunHrStaffSyncNowActionResult> {
  try {
    const { tenantId } = await assertHrSyncHealthAdmin(body);
    const allowEmptyFeed = process.env.ALLOW_EMPTY_HR_SYNC?.trim() === "true";
    const result = await runScheduledIiohrHrStaffSyncCore({
      tenantId,
      allowEmptyFeed,
      loadHrStaff: loadEvolvedPerthHrStaffRecordsForFiPush,
      pushFi: pushStaffSyncToFi,
      syncSecretForScrub: process.env.IIOHR_HR_SYNC_SECRET?.trim(),
    });
    if (!result.ok) {
      return { ok: false, error: result.error ?? "Sync failed." };
    }
    revalidateHrSyncHealthSurfaces(tenantId);
    return {
      ok: true,
      rowsSent: result.rowsSent,
      runId: result.runId,
      message:
        result.rowsSent === 0
          ? "Sync completed with no rows (empty feed allowed)."
          : `Sync committed ${result.rowsSent} staff row${result.rowsSent === 1 ? "" : "s"}. Stale HR warnings clear when staff metadata is refreshed.`,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type PreviewHrStaffFeedActionResult =
  | {
      ok: true;
      feedRowCount: number;
      sample: Array<{
        external_staff_id: string;
        full_name: string;
        email: string | null;
        onboarding_status: string | null;
        training_required_count: number | null;
      }>;
    }
  | { ok: false; error: string };

/** Preview latest HR feed — safe operational fields only. */
export async function previewHrStaffFeedAction(body: unknown): Promise<PreviewHrStaffFeedActionResult> {
  try {
    await assertHrSyncHealthAdmin(body);
    const hrRows = await loadEvolvedPerthHrStaffRecordsForFiPush();
    const syncRows = mapIiohrHrStaffRecordsToFiSyncRows(hrRows);
    const sample = syncRows.slice(0, 8).map((r) => ({
      external_staff_id: r.external_staff_id,
      full_name: r.full_name,
      email: r.email ?? null,
      onboarding_status:
        r.onboarding_status != null
          ? String(r.onboarding_status)
          : r.metadata_snapshot?.onboarding_status != null
            ? String(r.metadata_snapshot.onboarding_status)
            : null,
      training_required_count:
        typeof r.training_required_count === "number"
          ? r.training_required_count
          : typeof r.metadata_snapshot?.training_required_count === "number"
            ? (r.metadata_snapshot.training_required_count as number)
            : null,
    }));
    return { ok: true, feedRowCount: syncRows.length, sample };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type RelinkHrStaffActionResult =
  | { ok: true; matchedCount: number; rowsSent: number; summaryMessage: string }
  | { ok: false; error: string };

async function loadTenantStaffAndFeed(tenantId: string) {
  const [staff, hrRows] = await Promise.all([
    loadAllStaffForTenant(tenantId),
    loadEvolvedPerthHrStaffRecordsForFiPush(),
  ]);
  const feedRows = mapIiohrHrStaffRecordsToFiSyncRows(hrRows);
  return {
    staff: staff.filter((s) => s.is_active).map((s) => ({ id: s.id, email: s.email })),
    feedRows,
  };
}

async function loadHrSourceIdsForTenant(tenantId: string) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_system, source_staff_id")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => {
      const row = r as { staff_id: string; source_system: string; source_staff_id: string };
      return {
        staff_id: String(row.staff_id),
        source_system: String(row.source_system),
        source_staff_id: String(row.source_staff_id),
      };
    })
    .filter((r) => isHrStaffSourceSystem(r.source_system));
}

async function commitRelinkRows(
  tenantId: string,
  rows: ReturnType<typeof mapIiohrHrStaffRecordsToFiSyncRows>
): Promise<RelinkHrStaffActionResult | { ok: true; rowsSent: number; summaryMessage: string }> {
  if (rows.length === 0) {
    return { ok: false, error: "No matching HR feed rows for re-link." };
  }
  const summary = await syncIiohrHrStaffForTenant({
    tenantId,
    payload: { rows },
    mode: "commit",
    confirm: true,
    skipImportAuthCheck: true,
  });
  if (!summary.result.ok || !summary.result.commit) {
    const err =
      summary.result.error ??
      (summary.result.validationErrors.length ? summary.result.validationErrors.join("; ") : "Re-link sync failed.");
    return { ok: false, error: err };
  }
  revalidateHrSyncHealthSurfaces(tenantId);
  return {
    ok: true,
    rowsSent: rows.length,
    summaryMessage: `Re-linked ${rows.length} staff row${rows.length === 1 ? "" : "s"}. HR metadata refreshed; stale warnings clear after successful sync.`,
  };
}

export async function relinkHrStaffByEmailAction(body: unknown): Promise<RelinkHrStaffActionResult> {
  try {
    const { tenantId } = await assertHrSyncHealthAdmin(body);
    const { staff, feedRows } = await loadTenantStaffAndFeed(tenantId);
    const { rows, matchedStaffIds } = buildRelinkSyncRowsByEmail({ staff, feedRows });
    const result = await commitRelinkRows(tenantId, rows);
    if (!result.ok) return result;
    return {
      ok: true,
      matchedCount: matchedStaffIds.length,
      rowsSent: result.rowsSent,
      summaryMessage: result.summaryMessage,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function relinkHrStaffBySourceStaffIdAction(body: unknown): Promise<RelinkHrStaffActionResult> {
  try {
    const { tenantId } = await assertHrSyncHealthAdmin(body);
    const [staffFeed, sourceIds] = await Promise.all([
      loadTenantStaffAndFeed(tenantId),
      loadHrSourceIdsForTenant(tenantId),
    ]);
    const { rows, matchedStaffIds } = buildRelinkSyncRowsBySourceStaffId({
      staff: staffFeed.staff,
      sourceIds,
      feedRows: staffFeed.feedRows,
    });
    const result = await commitRelinkRows(tenantId, rows);
    if (!result.ok) return result;
    return {
      ok: true,
      matchedCount: matchedStaffIds.length,
      rowsSent: result.rowsSent,
      summaryMessage: result.summaryMessage,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
