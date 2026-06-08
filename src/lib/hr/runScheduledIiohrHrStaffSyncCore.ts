import { z } from "zod";

import {
  scrubSecretFromMessage,
  type PushStaffSyncToFiInput,
  type PushStaffSyncToFiResult,
} from "@/src/lib/hr/iiohrFiStaffSyncClient";
import { parseFiOutboundStaffSyncDisplay } from "@/src/lib/hr/fiStaffSyncOutboundSummary";
import { mapIiohrHrStaffRecordsToFiSyncRows, type IiohrHrPortalStaffRecord } from "@/src/lib/hr/iiohrFiStaffSyncMapper";

export type ScheduledIiohrHrStaffSyncCoreResult = {
  ok: boolean;
  rowsSent: number;
  runId: string | null;
  created: number | null;
  updated: number | null;
  linked: number | null;
  skipped: number | null;
  warnings: string[];
  /** Present when ok is false or FI returned ok: false. */
  error?: string;
};

function scrubError(e: unknown, secret?: string): string {
  let msg = e instanceof Error ? e.message : "Scheduled staff sync failed.";
  const s = secret?.trim();
  if (s) msg = scrubSecretFromMessage(msg, s);
  return msg;
}

function summaryErrorLine(fi: PushStaffSyncToFiResult, secret?: string): string | undefined {
  const s = fi.raw.summary;
  if (!s || typeof s !== "object" || Array.isArray(s)) return undefined;
  const err = (s as { error?: unknown }).error;
  if (typeof err !== "string" || !err.trim()) return undefined;
  const t = err.trim();
  const sec = secret?.trim();
  return sec ? scrubSecretFromMessage(t, sec) : t;
}

/**
 * Evolved Perth HR → FI staff sync (commit). Injectable `loadHrStaff` / `pushFi` for tests.
 */
export async function runScheduledIiohrHrStaffSyncCore(input: {
  tenantId: string;
  allowEmptyFeed: boolean;
  loadHrStaff: () => Promise<IiohrHrPortalStaffRecord[]>;
  pushFi: (payload: PushStaffSyncToFiInput) => Promise<PushStaffSyncToFiResult>;
  /** Used only to scrub thrown / summary messages. */
  syncSecretForScrub?: string;
}): Promise<ScheduledIiohrHrStaffSyncCoreResult> {
  const tidParse = z.string().uuid().safeParse(input.tenantId.trim());
  if (!tidParse.success) {
    return { ok: false, error: "Invalid tenant id.", rowsSent: 0, runId: null, created: null, updated: null, linked: null, skipped: null, warnings: [] };
  }
  const tenantId = tidParse.data;
  const secret = input.syncSecretForScrub;

  let hrRows: IiohrHrPortalStaffRecord[];
  try {
    hrRows = await input.loadHrStaff();
  } catch (e) {
    return {
      ok: false,
      error: scrubError(e, secret),
      rowsSent: 0,
      runId: null,
      created: null,
      updated: null,
      linked: null,
      skipped: null,
      warnings: [],
    };
  }

  const rows = mapIiohrHrStaffRecordsToFiSyncRows(hrRows);
  if (rows.length === 0) {
    if (!input.allowEmptyFeed) {
      return {
        ok: false,
        error: "HR staff feed returned no rows; refusing sync (set ALLOW_EMPTY_HR_SYNC=true to allow no-op).",
        rowsSent: 0,
        runId: null,
        created: null,
        updated: null,
        linked: null,
        skipped: null,
        warnings: [],
      };
    }
    return {
      ok: true,
      rowsSent: 0,
      runId: null,
      created: null,
      updated: null,
      linked: null,
      skipped: null,
      warnings: ["No HR rows from feed; sync skipped (ALLOW_EMPTY_HR_SYNC)."],
    };
  }

  try {
    const fi = await input.pushFi({
      tenantId,
      rows,
      mode: "commit",
      confirm: true,
      syncTrigger: "cron",
    });
    const d = parseFiOutboundStaffSyncDisplay(fi);
    const fiError = !d.fiOk ? summaryErrorLine(fi, secret) ?? "FI staff sync reported failure." : undefined;
    return {
      ok: d.fiOk,
      rowsSent: d.rowsSent,
      runId: d.runId,
      created: d.created,
      updated: d.updated,
      linked: d.linked,
      skipped: d.skipped,
      warnings: d.warnings,
      ...(fiError ? { error: fiError } : {}),
    };
  } catch (e) {
    return {
      ok: false,
      error: scrubError(e, secret),
      rowsSent: rows.length,
      runId: null,
      created: null,
      updated: null,
      linked: null,
      skipped: null,
      warnings: [],
    };
  }
}
