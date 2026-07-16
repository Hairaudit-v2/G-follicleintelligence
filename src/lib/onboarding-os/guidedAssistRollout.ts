/**
 * Clinic guide rollout checklist — admin one-time launch steps (tenant-scoped).
 * Status lives on tenant default prefs: metadata.guided_assist_rollout_status
 */

import type {
  GuidedAssistRolloutItemView,
  GuidedAssistRolloutSnapshot,
  GuidedAssistRolloutStatus,
} from "./guidedAssistTypes";

export const GUIDED_ASSIST_ROLLOUT_METADATA_KEY = "guided_assist_rollout_status";

export const GUIDED_ASSIST_ROLLOUT_ITEMS = [
  {
    id: "deployed_latest",
    label: "Deployed latest version",
    description: "Latest Clinic guide code is live for this clinic (prod deploy confirmed).",
  },
  {
    id: "trained_reception",
    label: "Trained reception",
    description: "Front desk has tried the guide on Today and Front desk — and knows how to re-enable it.",
  },
  {
    id: "checked_nurse_flow",
    label: "Checked nurse flow",
    description: "A nurse walked a patient-day path with quick actions and tips (operational only).",
  },
  {
    id: "checked_doctor_flow",
    label: "Checked doctor / consultant flow",
    description: "Clinical staff opened imaging, consult prep, or scales shortcuts without confusion.",
  },
  {
    id: "reviewed_first_week_metrics",
    label: "Reviewed first-week metrics",
    description: "Admin opened Guide Health (7 or 30 days) and glanced at adoption + pain points.",
  },
  {
    id: "enabled_for_team",
    label: "Guide on for the team",
    description: "Clinic default or “enable for all staff” is set so new people land with help nearby.",
  },
  {
    id: "shared_safety_boundary",
    label: "Shared the safety boundary",
    description: "Team knows the guide is operational only — never clinical advice or treatment plans.",
  },
] as const;

export type GuidedAssistRolloutItemId = (typeof GUIDED_ASSIST_ROLLOUT_ITEMS)[number]["id"];

export function emptyGuidedAssistRolloutStatus(): GuidedAssistRolloutStatus {
  return {
    completed: {},
    completedAtIso: null,
    updatedAtIso: null,
  };
}

export function parseGuidedAssistRolloutStatus(
  raw: unknown
): GuidedAssistRolloutStatus {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyGuidedAssistRolloutStatus();
  }
  const o = raw as Record<string, unknown>;
  const completedRaw =
    o.completed && typeof o.completed === "object" && !Array.isArray(o.completed)
      ? (o.completed as Record<string, unknown>)
      : {};
  const completed: Record<string, string> = {};
  for (const [k, v] of Object.entries(completedRaw)) {
    const id = String(k).trim();
    if (!id) continue;
    if (v === true) {
      completed[id] = new Date(0).toISOString();
      continue;
    }
    const iso = String(v ?? "").trim();
    if (iso) completed[id] = iso;
  }
  const completedAtIso =
    o.completedAtIso != null && String(o.completedAtIso).trim()
      ? String(o.completedAtIso).trim()
      : null;
  const updatedAtIso =
    o.updatedAtIso != null && String(o.updatedAtIso).trim()
      ? String(o.updatedAtIso).trim()
      : null;
  return { completed, completedAtIso, updatedAtIso };
}

export function parseRolloutStatusFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): GuidedAssistRolloutStatus {
  if (!metadata || typeof metadata !== "object") return emptyGuidedAssistRolloutStatus();
  return parseGuidedAssistRolloutStatus(metadata[GUIDED_ASSIST_ROLLOUT_METADATA_KEY]);
}

export function withRolloutStatusMetadata(
  metadata: Record<string, unknown> | null | undefined,
  status: GuidedAssistRolloutStatus
): Record<string, unknown> {
  return {
    ...(metadata && typeof metadata === "object" ? metadata : {}),
    [GUIDED_ASSIST_ROLLOUT_METADATA_KEY]: status,
  };
}

export function isValidRolloutItemId(id: string): id is GuidedAssistRolloutItemId {
  return GUIDED_ASSIST_ROLLOUT_ITEMS.some((item) => item.id === id);
}

export function buildGuidedAssistRolloutSnapshot(
  tenantId: string,
  status: GuidedAssistRolloutStatus
): GuidedAssistRolloutSnapshot {
  const items: GuidedAssistRolloutItemView[] = GUIDED_ASSIST_ROLLOUT_ITEMS.map((item) => {
    const at = status.completed[item.id] ?? null;
    return {
      id: item.id,
      label: item.label,
      description: item.description,
      completed: Boolean(at),
      completedAtIso: at,
    };
  });
  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const percent =
    totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;
  const isComplete = completedCount >= totalCount && totalCount > 0;
  return {
    tenantId: tenantId.trim(),
    items,
    completedCount,
    totalCount,
    percent,
    isComplete,
    completedAtIso: isComplete ? status.completedAtIso : null,
  };
}

/** Apply toggle; returns next status (pure). */
export function applyRolloutItemToggle(
  status: GuidedAssistRolloutStatus,
  itemId: string,
  completed: boolean,
  now: Date = new Date()
): GuidedAssistRolloutStatus {
  if (!isValidRolloutItemId(itemId)) return status;
  const nextCompleted = { ...status.completed };
  if (completed) {
    nextCompleted[itemId] = now.toISOString();
  } else {
    delete nextCompleted[itemId];
  }
  const allDone = GUIDED_ASSIST_ROLLOUT_ITEMS.every((i) => Boolean(nextCompleted[i.id]));
  return {
    completed: nextCompleted,
    completedAtIso: allDone
      ? status.completedAtIso ?? now.toISOString()
      : null,
    updatedAtIso: now.toISOString(),
  };
}
