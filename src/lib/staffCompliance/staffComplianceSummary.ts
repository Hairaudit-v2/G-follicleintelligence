/**
 * Temporary read model: training / compliance rows are read from `fi_staff_source_ids.metadata`
 * until AcademyOS / IIOHR API sync provides a dedicated pipeline. FI is not the source of truth
 * for Academy or HR records — treat this as a denormalised snapshot for Staff Twin / My HR only.
 */

import { isAllowedHrPortalUrl } from "@/src/lib/staff/myHrPortalSelection";

import type {
  StaffComplianceCounts,
  StaffComplianceItem,
  StaffComplianceStatus,
  StaffComplianceSummary,
} from "./staffComplianceTypes";

export type StaffComplianceSourceRow = {
  source_system: string;
  metadata: Record<string, unknown> | null | undefined;
};

const STATUS_PRIORITY: Record<StaffComplianceStatus, number> = {
  expired: 0,
  missing: 1,
  due_soon: 2,
  unknown: 3,
  current: 4,
};

const MS_DAY = 86_400_000;

function parseIsoDate(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function normalizeStatusString(raw: unknown): StaffComplianceStatus | null {
  if (raw == null || typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (s === "current" || s === "due_soon" || s === "expired" || s === "missing" || s === "unknown") {
    return s as StaffComplianceStatus;
  }
  return null;
}

function safeSourceUrl(raw: unknown): string | null {
  if (raw == null) return null;
  const u = String(raw).trim();
  if (!u) return null;
  return isAllowedHrPortalUrl(u) ? u : null;
}

/**
 * Infer compliance/training row status when `status` is absent in metadata.
 * Rules: expired if `expires_at` is in the past; else due_soon if `expires_at` is within 30 days;
 * else current if `completed_at` is set (including when expiry is far in the future); else missing
 * when there is a future expiry but no completion; else missing when there is no completion date.
 * (A declared `unknown` in metadata is still handled by {@link resolveStaffComplianceStatus}.)
 */
export function inferStaffComplianceStatus(
  entry: Record<string, unknown>,
  now: Date
): StaffComplianceStatus {
  const exp = parseIsoDate(entry.expires_at);
  const comp = parseIsoDate(entry.completed_at);
  const nowMs = now.getTime();

  if (exp && exp.getTime() < nowMs) {
    return "expired";
  }
  if (exp) {
    const days = (exp.getTime() - nowMs) / MS_DAY;
    if (days >= 0 && days <= 30) {
      return "due_soon";
    }
    if (comp) {
      return "current";
    }
    return "missing";
  }
  if (comp) {
    return "current";
  }
  return "missing";
}

/** Reconcile declared status with dates (expired / due_soon override optimistic labels). */
export function resolveStaffComplianceStatus(
  declared: StaffComplianceStatus | null,
  entry: Record<string, unknown>,
  now: Date
): StaffComplianceStatus {
  const inferred = inferStaffComplianceStatus(entry, now);
  if (!declared) return inferred;

  const exp = parseIsoDate(entry.expires_at);
  const nowMs = now.getTime();
  if (exp && exp.getTime() < nowMs) {
    return "expired";
  }
  if (exp) {
    const days = (exp.getTime() - nowMs) / MS_DAY;
    if (days >= 0 && days <= 30 && inferred !== "expired") {
      if (declared === "current" || declared === "unknown") return "due_soon";
    }
  }
  return declared;
}

function asObjectArray(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
}

function pickLastSyncedAt(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return ta >= tb ? a : b;
}

function emptyCounts(): StaffComplianceCounts {
  return { current: 0, due_soon: 0, expired: 0, missing: 0, unknown: 0 };
}

function rollOverallFromStatuses(statuses: StaffComplianceStatus[]): StaffComplianceStatus {
  if (statuses.length === 0) return "unknown";
  let best: StaffComplianceStatus = "current";
  let bestRank = STATUS_PRIORITY.current;
  for (const s of statuses) {
    const r = STATUS_PRIORITY[s];
    if (r < bestRank) {
      bestRank = r;
      best = s;
    }
  }
  return best;
}

/**
 * Build a read-only summary from `fi_staff_source_ids` rows (metadata only — same query as Twin / HR).
 * Merges `training` and `compliance` arrays across all rows; later rows override earlier entries with the same id.
 */
export function buildStaffComplianceSummaryFromSourceRows(
  rows: StaffComplianceSourceRow[],
  options?: { now?: Date }
): StaffComplianceSummary {
  const now = options?.now ?? new Date();
  const mergedById = new Map<string, { entry: Record<string, unknown>; sourceSystem: string; bucket: "training" | "compliance" }>();

  let lastSyncedAt: string | null = null;

  for (const row of rows) {
    const sys = String(row.source_system ?? "").trim() || "unknown";
    const md = row.metadata;
    if (!md || typeof md !== "object" || Array.isArray(md)) continue;

    const sync = (md as Record<string, unknown>).last_synced_at;
    if (sync != null && String(sync).trim()) {
      const s = String(sync).trim();
      lastSyncedAt = pickLastSyncedAt(lastSyncedAt, s);
    }

    for (const entry of asObjectArray((md as Record<string, unknown>).training)) {
      const id = String(entry.id ?? "").trim();
      if (!id) continue;
      mergedById.set(`training:${id}`, { entry, sourceSystem: sys, bucket: "training" });
    }
    for (const entry of asObjectArray((md as Record<string, unknown>).compliance)) {
      const id = String(entry.id ?? "").trim();
      if (!id) continue;
      mergedById.set(`compliance:${id}`, { entry, sourceSystem: sys, bucket: "compliance" });
    }
  }

  const items: StaffComplianceItem[] = [];
  for (const [, wrap] of Array.from(mergedById.entries())) {
    const { entry, sourceSystem } = wrap;
    const id = String(entry.id ?? "").trim();
    const label = String(entry.label ?? id).trim() || id;
    const declared = normalizeStatusString(entry.status);
    const status = resolveStaffComplianceStatus(declared, entry, now);
    const completedAt = entry.completed_at != null ? String(entry.completed_at).trim() || null : null;
    const expiresAt = entry.expires_at != null ? String(entry.expires_at).trim() || null : null;
    const sourceUrl = safeSourceUrl(entry.source_url);
    const meta =
      entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
        ? (entry.metadata as Record<string, unknown>)
        : undefined;

    items.push({
      id,
      label,
      status,
      sourceSystem,
      completedAt: completedAt || null,
      expiresAt: expiresAt || null,
      sourceUrl: sourceUrl ?? null,
      metadata: meta,
    });
  }

  const counts = emptyCounts();
  for (const it of items) {
    counts[it.status] += 1;
  }

  const overallStatus = rollOverallFromStatuses(items.map((i) => i.status));

  items.sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status];
    const pb = STATUS_PRIORITY[b.status];
    if (pa !== pb) return pa - pb;
    const ea = parseIsoDate(a.expiresAt)?.getTime() ?? 0;
    const eb = parseIsoDate(b.expiresAt)?.getTime() ?? 0;
    return ea - eb;
  });

  return {
    overallStatus,
    items,
    counts,
    lastSyncedAt: lastSyncedAt || null,
  };
}
