import "server-only";

import {
  buildApprovedServicesImportPlan,
  type ApprovedServiceImportPlanEntry,
} from "@/src/lib/timelyImport/approvedFiServicesImportPlan";
import { defaultClinicServicesAsImportRows } from "@/src/lib/services/defaultClinicServices";
import { insertFiService, loadFiServicesForTenant, updateFiService } from "@/src/lib/services/fiServices.server";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export type DefaultClinicServicesSeedResult = {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
};

async function applySeedEntry(
  tenantId: string,
  entry: ApprovedServiceImportPlanEntry,
  existingById: Map<string, FiServiceRow>
): Promise<"created" | "updated" | "skipped"> {
  if (entry.action === "skip") return "skipped";

  const row = entry.approved;

  if (entry.action === "create") {
    await insertFiService(tenantId, {
      name: row.name,
      duration_minutes: row.duration_minutes,
      base_price: row.base_price,
      color: row.color,
      category: row.category,
      is_active: row.is_active,
      booking_type: row.booking_type,
    });
    return "created";
  }

  const existingId = entry.existingId?.trim();
  if (!existingId) return "skipped";
  const existing = existingById.get(existingId);
  if (!existing) return "skipped";

  await updateFiService(tenantId, existingId, {
    name: row.name,
    duration_minutes: row.duration_minutes,
    color: row.color ?? null,
    category: row.category,
    is_active: true,
    booking_type: row.booking_type ?? existing.booking_type,
    // Preserve tenant-customised pricing — never overwrite base_price on update.
  });
  return "updated";
}

/**
 * Idempotent default clinic catalog seed. Creates missing rows; updates metadata on matches
 * without changing existing `base_price`. Safe to run multiple times.
 */
export async function seedDefaultClinicServicesForTenant(tenantId: string): Promise<DefaultClinicServicesSeedResult> {
  const tid = tenantId.trim();
  const existing = await loadFiServicesForTenant(tid);
  const existingById = new Map(existing.map((r) => [r.id, r]));

  const plan = buildApprovedServicesImportPlan(
    defaultClinicServicesAsImportRows(),
    existing.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      booking_type: r.booking_type,
    }))
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of plan.entries) {
    const outcome = await applySeedEntry(tid, entry, existingById);
    if (outcome === "created") created++;
    else if (outcome === "updated") updated++;
    else skipped++;
  }

  return { created, updated, skipped, warnings: plan.warnings };
}
