import "server-only";

import { readdir } from "fs/promises";
import { join } from "path";
import { loadCalendarResources, loadCalendarViewData } from "@/src/lib/bookings/calendarLoader";
import { runSystemStatusDbQueries } from "./systemStatusChecks";
import { assembleSystemStatusPayload } from "./systemStatusSummary";
import type { SystemStatusPayload } from "./systemStatusTypes";

async function readLatestMigrationFilename(): Promise<{ latest: string | null; ok: boolean }> {
  try {
    const dir = join(process.cwd(), "supabase", "migrations");
    const files = await readdir(dir);
    const sql = files.filter((f) => f.endsWith(".sql")).sort();
    const last = sql.length ? sql[sql.length - 1]! : null;
    return { latest: last, ok: true };
  } catch {
    return { latest: null, ok: false };
  }
}

/**
 * Full tenant system status for `/fi-admin/[tenantId]/system-status`.
 * Never throws for migration metadata failures — surfaces `Unknown` in the payload instead.
 */
export async function loadSystemStatus(tenantId: string): Promise<SystemStatusPayload> {
  const [db, migration] = await Promise.all([
    runSystemStatusDbQueries(tenantId),
    readLatestMigrationFilename(),
  ]);

  const calendarLoadersAvailable =
    typeof loadCalendarViewData === "function" && typeof loadCalendarResources === "function";

  const snap = {
    ...db,
    calendarLoadersAvailable,
    migrationLatestFilename: migration.latest,
    migrationMetadataAvailable: migration.ok,
  };

  return assembleSystemStatusPayload(snap);
}
