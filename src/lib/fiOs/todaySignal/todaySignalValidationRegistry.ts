/**
 * FI-UX-REBUILD D6F — central registry for Today signal operational validation.
 * Defines what the D6 living-clinic layer must prove before prediction (D7).
 */

export type TodaySignalValidationStatus = "pass" | "watch" | "fail" | "not_applicable";

export type TodaySignalValidationDomain =
  | "refresh_behaviour"
  | "priority_scoring"
  | "signal_learning"
  | "workspace_sync"
  | "presence_context"
  | "privacy_safety"
  | "tenant_isolation"
  | "performance_budget"
  | "rollout_flag_consistency";

export type TodaySignalValidationOverallStatus = "pass" | "watch" | "fail" | "insufficient_data";

export type TodaySignalValidationCheckDefinition = {
  id: string;
  domain: TodaySignalValidationDomain;
  label: string;
  description: string;
  /** When false, a failing result contributes watch rather than fail. */
  critical: boolean;
};

export type TodaySignalValidationCheckResult = {
  checkId: string;
  domain: TodaySignalValidationDomain;
  status: TodaySignalValidationStatus;
  message?: string;
};

export type TodaySignalValidationDomainSummary = {
  domain: TodaySignalValidationDomain;
  label: string;
  status: TodaySignalValidationStatus;
  checks: TodaySignalValidationCheckResult[];
};

export type TodaySignalRolloutFlagsDetected = {
  todaySurface: boolean;
  revisionPolling: boolean;
  realtimeEnabled: boolean;
  signalLearning: boolean;
  workspaceSignalSync: boolean;
  presenceEngine: boolean;
};

export type TodaySignalValidationCounts = {
  todayFeedItemCount: number;
  workspaceSignalCount: number;
  presenceSnapshotCount: number;
  learningEnabled: boolean;
  revisionEndpointAvailable: boolean;
};

export type TodaySignalValidationReport = {
  overallStatus: TodaySignalValidationOverallStatus;
  timestamp: string;
  rolloutFlags: TodaySignalRolloutFlagsDetected;
  counts: TodaySignalValidationCounts;
  domains: TodaySignalValidationDomainSummary[];
  warnings: string[];
  recommendedNextAction: string;
  loaderElapsedMs: number;
};

const DOMAIN_LABELS: Record<TodaySignalValidationDomain, string> = {
  refresh_behaviour: "Feed integrity",
  priority_scoring: "Priority scoring",
  signal_learning: "Signal learning",
  workspace_sync: "Workspace sync",
  presence_context: "Presence safety",
  privacy_safety: "Privacy safety",
  tenant_isolation: "Tenant isolation",
  performance_budget: "Performance budget",
  rollout_flag_consistency: "Rollout consistency",
};

export const TODAY_SIGNAL_VALIDATION_CHECKS: readonly TodaySignalValidationCheckDefinition[] = [
  {
    id: "feed.missing_id",
    domain: "refresh_behaviour",
    label: "Feed items have ids",
    description: "Every Today feed item exposes a stable id for refresh and learning.",
    critical: true,
  },
  {
    id: "feed.missing_href",
    domain: "refresh_behaviour",
    label: "Actionable items have href",
    description: "Actionable feed rows link to a workspace or route target.",
    critical: true,
  },
  {
    id: "feed.invalid_bucket",
    domain: "refresh_behaviour",
    label: "Feed buckets are valid",
    description: "Items stay within right_now / up_next / coming_up.",
    critical: true,
  },
  {
    id: "feed.invalid_priority_score",
    domain: "priority_scoring",
    label: "Priority scores are bounded",
    description: "Priority scores remain within 0–100 after D6B scoring.",
    critical: true,
  },
  {
    id: "feed.priority_band_mismatch",
    domain: "priority_scoring",
    label: "Priority bands match scores",
    description: "priorityBand is consistent with classifyTodaySignalPriority().",
    critical: true,
  },
  {
    id: "privacy.forbidden_keys",
    domain: "privacy_safety",
    label: "Client payloads exclude PHI-like keys",
    description: "Revision, workspace sync, and learning exports omit forbidden fields.",
    critical: true,
  },
  {
    id: "presence.actor_id_exposed",
    domain: "presence_context",
    label: "Presence summaries hide actor ids",
    description: "Operational presence copy never exposes actorId in client-safe payloads.",
    critical: true,
  },
  {
    id: "presence.banned_wording",
    domain: "presence_context",
    label: "Presence copy avoids banned wording",
    description: "Uncertain states use careful operational language only.",
    critical: true,
  },
  {
    id: "workspace.calendar_mapping",
    domain: "workspace_sync",
    label: "Workspace signals avoid calendar targets",
    description: "Cross-workspace sync must not map signals to the calendar subsystem.",
    critical: true,
  },
  {
    id: "workspace.phi_payload",
    domain: "workspace_sync",
    label: "Workspace signal payloads stay non-PHI",
    description: "Workspace sync exports omit names, amounts, and clinical text.",
    critical: true,
  },
  {
    id: "workspace.count_bounded",
    domain: "workspace_sync",
    label: "Workspace signal volume is bounded",
    description: "Active workspace signals should remain within operational budget.",
    critical: false,
  },
  {
    id: "workspace.refresh_dedupe",
    domain: "workspace_sync",
    label: "Revision dedupe is active",
    description: "Workspace refresh skips duplicate revision ticks.",
    critical: false,
  },
  {
    id: "learning.disabled_clean",
    domain: "signal_learning",
    label: "Learning disabled is clean",
    description: "When learning is off, validation treats the layer as intentionally inactive.",
    critical: false,
  },
  {
    id: "learning.metadata_sanitized",
    domain: "signal_learning",
    label: "Learning metadata stays sanitized",
    description: "Observations store aggregate-safe metadata only.",
    critical: true,
  },
  {
    id: "rollout.independent_fail_soft",
    domain: "rollout_flag_consistency",
    label: "Capabilities fail soft independently",
    description: "Today surface can run while learning, sync, or presence sub-features are off.",
    critical: false,
  },
  {
    id: "rollout.realtime_polling_fallback",
    domain: "rollout_flag_consistency",
    label: "Realtime fallback uses polling",
    description: "When Realtime is off, revision polling remains a safe refresh path.",
    critical: false,
  },
  {
    id: "rollout.flag_consistency",
    domain: "rollout_flag_consistency",
    label: "Rollout flags are coherent",
    description: "Detected rollout flags reflect an intentional bake configuration.",
    critical: false,
  },
  {
    id: "tenant.isolation",
    domain: "tenant_isolation",
    label: "Presence data is tenant-scoped",
    description: "Derived presence snapshots remain scoped to the requested tenant.",
    critical: true,
  },
  {
    id: "performance.validation_loader_budget",
    domain: "performance_budget",
    label: "Validation loader stays lightweight",
    description: "Bake report loader should complete within 500ms target.",
    critical: false,
  },
  {
    id: "performance.workspace_signal_count",
    domain: "performance_budget",
    label: "Workspace signal count within budget",
    description: "Warn when active workspace signals exceed 50.",
    critical: false,
  },
  {
    id: "performance.revision_payload_size",
    domain: "performance_budget",
    label: "Revision payload stays bounded",
    description: "Revision fingerprint JSON remains compact and non-PHI.",
    critical: false,
  },
] as const;

const CHECK_BY_ID = new Map(TODAY_SIGNAL_VALIDATION_CHECKS.map((check) => [check.id, check]));

export function getTodaySignalValidationChecks(): readonly TodaySignalValidationCheckDefinition[] {
  return TODAY_SIGNAL_VALIDATION_CHECKS;
}

export function getTodaySignalValidationCheck(
  checkId: string
): TodaySignalValidationCheckDefinition | undefined {
  return CHECK_BY_ID.get(checkId);
}

function domainStatusFromChecks(
  checks: TodaySignalValidationCheckResult[]
): TodaySignalValidationStatus {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "watch")) return "watch";
  if (checks.every((c) => c.status === "not_applicable")) return "not_applicable";
  return "pass";
}

export function classifyTodaySignalValidationStatus(
  results: readonly TodaySignalValidationCheckResult[]
): TodaySignalValidationOverallStatus {
  if (results.length === 0) return "insufficient_data";

  let hasCriticalFail = false;
  let hasFail = false;
  let hasWatch = false;
  let applicableCount = 0;

  for (const result of results) {
    if (result.status === "not_applicable") continue;
    applicableCount += 1;

    const definition = getTodaySignalValidationCheck(result.checkId);
    if (result.status === "fail") {
      if (definition?.critical ?? true) hasCriticalFail = true;
      else hasFail = true;
    }
    if (result.status === "watch") hasWatch = true;
  }

  if (applicableCount === 0) return "insufficient_data";
  if (hasCriticalFail) return "fail";
  if (hasFail || hasWatch) return "watch";
  return "pass";
}

export function summarizeTodaySignalValidationResults(
  results: readonly TodaySignalValidationCheckResult[]
): TodaySignalValidationDomainSummary[] {
  const grouped = new Map<TodaySignalValidationDomain, TodaySignalValidationCheckResult[]>();

  for (const result of results) {
    const list = grouped.get(result.domain) ?? [];
    list.push(result);
    grouped.set(result.domain, list);
  }

  return [...grouped.entries()]
    .map(([domain, checks]) => ({
      domain,
      label: DOMAIN_LABELS[domain],
      status: domainStatusFromChecks(checks),
      checks,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildTodaySignalValidationWarnings(input: {
  results: readonly TodaySignalValidationCheckResult[];
  rolloutFlags: TodaySignalRolloutFlagsDetected;
  counts: TodaySignalValidationCounts;
}): string[] {
  const warnings: string[] = [];
  const { rolloutFlags, counts, results } = input;

  if (!rolloutFlags.realtimeEnabled && rolloutFlags.revisionPolling) {
    warnings.push("Realtime is disabled; polling fallback is active.");
  } else if (!rolloutFlags.realtimeEnabled && !rolloutFlags.revisionPolling && rolloutFlags.todaySurface) {
    warnings.push("Neither Realtime nor revision polling is enabled; Today refresh may require manual navigation.");
  }

  if (rolloutFlags.signalLearning && counts.todayFeedItemCount > 0 && counts.learningEnabled) {
    const learningWatch = results.find(
      (r) => r.checkId === "learning.disabled_clean" && r.status === "watch"
    );
    if (learningWatch) {
      warnings.push("Signal learning is enabled but has limited observations.");
    }
  }

  if (rolloutFlags.workspaceSignalSync && counts.workspaceSignalCount === 0) {
    warnings.push("Workspace sync is enabled; no active workspace signals detected yet.");
  }

  const presenceWatch = results.some(
    (r) => r.domain === "presence_context" && r.status === "watch"
  );
  if (presenceWatch) {
    warnings.push("Presence is derived from weak sources.");
  }

  for (const result of results) {
    if (result.status === "watch" && result.message && !warnings.includes(result.message)) {
      warnings.push(result.message);
    }
  }

  return warnings.slice(0, 8);
}

export function recommendTodaySignalValidationNextAction(
  overallStatus: TodaySignalValidationOverallStatus,
  rolloutFlags: TodaySignalRolloutFlagsDetected,
  results: readonly TodaySignalValidationCheckResult[]
): string {
  if (overallStatus === "fail") {
    return "Do not proceed to D7 until fail checks are cleared.";
  }
  if (overallStatus === "insufficient_data") {
    return rolloutFlags.todaySurface
      ? "Continue bake for this tenant once operational data is available."
      : "Enable the Today surface before live validation.";
  }
  if (!rolloutFlags.revisionPolling && rolloutFlags.todaySurface) {
    return "Enable revision polling before live validation.";
  }
  if (rolloutFlags.realtimeEnabled) {
    return "Keep validating refresh behaviour while Realtime is enabled.";
  }
  if (results.some((r) => r.checkId === "feed.priority_band_mismatch" && r.status === "watch")) {
    return "Review priority scoring for arrival-intent items.";
  }
  if (overallStatus === "watch") {
    return "Continue bake for this tenant.";
  }
  return "Continue bake for this tenant.";
}

export { DOMAIN_LABELS as TODAY_SIGNAL_VALIDATION_DOMAIN_LABELS };
