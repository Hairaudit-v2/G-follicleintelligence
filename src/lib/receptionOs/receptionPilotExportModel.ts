/**
 * ReceptionOS Phase 8 — safe JSON/CSV export for pilot metrics and owner reports.
 */

import type { ReceptionOwnerValueDashboard } from "@/src/lib/receptionOs/receptionOwnerValueModel";
import type { ReceptionPilotManagerScores } from "@/src/lib/receptionOs/receptionPilotMetricsModel";
import type { ReceptionPilotReviewReport } from "@/src/lib/receptionOs/receptionPilotReviewModel";
import { assertNoSensitiveExportKeys } from "@/src/lib/receptionOs/receptionOsDemoModeModel";

export type ReceptionPilotExportFormat = "json" | "csv";

export type ReceptionPilotExportBundle = {
  exportedAt: string;
  tenantId: string;
  tenantName: string;
  periodDays: number;
  pilotReview: ReceptionPilotReviewReport | null;
  ownerValue: ReceptionOwnerValueDashboard | null;
  managerScores: ReceptionPilotManagerScores | null;
};

export type BuildReceptionPilotExportInput = {
  tenantId: string;
  tenantName: string;
  periodDays: number;
  exportedAt?: string;
  pilotReview: ReceptionPilotReviewReport | null;
  ownerValue: ReceptionOwnerValueDashboard | null;
  managerScores: ReceptionPilotManagerScores | null;
};

export function buildReceptionPilotExportBundle(input: BuildReceptionPilotExportInput): ReceptionPilotExportBundle {
  const bundle: ReceptionPilotExportBundle = {
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    periodDays: input.periodDays,
    pilotReview: input.pilotReview,
    ownerValue: input.ownerValue,
    managerScores: input.managerScores,
  };
  assertNoSensitiveExportKeys(bundle);
  return bundle;
}

export function serializeReceptionPilotExportJson(bundle: ReceptionPilotExportBundle): string {
  assertNoSensitiveExportKeys(bundle);
  return JSON.stringify(bundle, null, 2);
}

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function flattenForCsv(prefix: string, obj: Record<string, unknown>): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value == null) {
      rows.push([path, ""]);
    } else if (Array.isArray(value)) {
      rows.push([path, JSON.stringify(value)]);
    } else if (typeof value === "object") {
      rows.push(...flattenForCsv(path, value as Record<string, unknown>));
    } else {
      rows.push([path, String(value)]);
    }
  }
  return rows;
}

export function serializeReceptionPilotExportCsv(bundle: ReceptionPilotExportBundle): string {
  assertNoSensitiveExportKeys(bundle);
  const header = "metric,value";
  const rows = flattenForCsv("", bundle as unknown as Record<string, unknown>);
  return [header, ...rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`)].join("\n");
}

export function parseReceptionPilotExportFormat(raw: string | null | undefined): ReceptionPilotExportFormat {
  const v = String(raw ?? "json").trim().toLowerCase();
  return v === "csv" ? "csv" : "json";
}
