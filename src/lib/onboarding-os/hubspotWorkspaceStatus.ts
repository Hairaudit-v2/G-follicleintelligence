import type { HubspotSyncRunStatus } from "./hubspotConnectorTypes";

function isEngagementMilestone(milestone: unknown): boolean {
  const value = String(milestone ?? "").toUpperCase();
  return value.includes("ENGAGEMENT-COMMUNICATIONS");
}

export const HUBSPOT_SECONDARY_OBJECTS = [
  "companies",
  "tickets",
  "owners",
  "calls",
  "tasks",
  "meetings",
] as const;

export type HubspotSecondaryObject = (typeof HUBSPOT_SECONDARY_OBJECTS)[number];

export const HUBSPOT_ENGAGEMENT_OBJECTS = [
  "notes",
  "emails",
  "conversation_threads",
  "conversation_messages",
  "files",
  "forms",
  "form_submissions",
] as const;

export type HubspotEngagementObject = (typeof HUBSPOT_ENGAGEMENT_OBJECTS)[number];

export type HubspotWorkspaceRun = {
  id: string;
  status: HubspotSyncRunStatus;
  contactsDiscovered: number;
  dealsDiscovered: number;
  startedAt: string;
  completedAt: string | null;
  detail: Record<string, unknown>;
  secondaryCounters?: Partial<
    Record<HubspotSecondaryObject, { active: number; archived: number; discovered: number; complete: boolean }>
  >;
  secondaryCapabilities?: Record<string, unknown> | null;
  engagementCounters?: Partial<
    Record<
      HubspotEngagementObject,
      {
        active: number;
        archived: number;
        discovered: number;
        staged?: number;
        complete: boolean;
        checkpointStatus?: string;
        reconciliationStatus?: string;
      }
    >
  >;
  engagementCapabilities?: Record<string, unknown> | null;
};

export type HubspotBackupStatus = {
  status: HubspotSyncRunStatus | null;
  completedAt: string | null;
  runId: string | null;
  warning: string | null;
};

export type HubspotWorkspaceStatus = {
  credential: { verified: boolean; status: "verified" | "unverified" };
  primary: HubspotBackupStatus & { counts: { contacts: number; deals: number } };
  secondary: HubspotBackupStatus & {
    counts: Record<HubspotSecondaryObject, { current: number; archived: number; total: number }>;
  };
  engagement: HubspotBackupStatus & {
    counts: Record<HubspotEngagementObject, { current: number; archived: number; total: number }>;
    missingScopeWarnings: string[];
  };
  webhook: {
    status: "healthy" | "degraded" | "unknown";
    pending: number;
    retrying: number;
    failed: number;
    lastWebhookAt: string | null;
  };
  importReview: { staged: number; approved: number; rejected: number; imported: number };
  warnings: string[];
};

export function isSecondaryHubspotRun(run: HubspotWorkspaceRun): boolean {
  const milestone = String(run.detail?.milestone ?? "").toUpperCase();
  return (
    milestone.includes("SECONDARY") ||
    Boolean(run.secondaryCapabilities && Object.keys(run.secondaryCapabilities).length)
  );
}

export function isEngagementHubspotRun(run: HubspotWorkspaceRun): boolean {
  return (
    isEngagementMilestone(run.detail?.milestone) ||
    Boolean(run.engagementCapabilities && Object.keys(run.engagementCapabilities).length)
  );
}

function newestTerminal(runs: readonly HubspotWorkspaceRun[]): HubspotWorkspaceRun | null {
  return runs.find((run) => run.status !== "started") ?? null;
}

function newestCompleted(runs: readonly HubspotWorkspaceRun[]): HubspotWorkspaceRun | null {
  return runs.find((run) => run.status === "completed") ?? null;
}

export function aggregateHubspotWorkspaceStatus(input: {
  authVerified: boolean;
  runs: readonly HubspotWorkspaceRun[];
  webhook?: { pending?: number; retrying?: number; failed?: number; lastWebhookAt?: string | null };
  importReview?: { staged?: number; approved?: number; rejected?: number; imported?: number };
}): HubspotWorkspaceStatus {
  const primaryRuns = input.runs.filter(
    (run) => !isSecondaryHubspotRun(run) && !isEngagementHubspotRun(run)
  );
  const secondaryRuns = input.runs.filter(isSecondaryHubspotRun);
  const engagementRuns = input.runs.filter(isEngagementHubspotRun);
  const primaryState = newestTerminal(primaryRuns);
  const secondaryState = newestTerminal(secondaryRuns);
  const engagementState = newestTerminal(engagementRuns);
  const primaryCompleted = newestCompleted(primaryRuns);
  const secondaryCompleted = newestCompleted(secondaryRuns);
  const engagementCompleted = newestCompleted(engagementRuns);
  const warnings: string[] = [];

  const primaryWarning =
    primaryState?.status === "partial"
      ? "Primary backup is partial."
      : primaryState?.status === "failed"
        ? "Primary backup failed."
        : null;
  const secondaryWarning =
    secondaryState?.status === "partial"
      ? "Secondary backup is partial."
      : secondaryState?.status === "failed"
        ? "Secondary backup failed."
        : null;
  const engagementWarning =
    engagementState?.status === "partial"
      ? "Engagement communications backup is partial."
      : engagementState?.status === "failed"
        ? "Engagement communications backup failed."
        : null;
  if (primaryWarning) warnings.push(primaryWarning);
  if (secondaryWarning) warnings.push(secondaryWarning);
  if (engagementWarning) warnings.push(engagementWarning);

  const pending = Number(input.webhook?.pending ?? 0);
  const retrying = Number(input.webhook?.retrying ?? 0);
  const failed = Number(input.webhook?.failed ?? 0);
  const webhookStatus =
    failed > 0 || retrying > 0 ? "degraded" : input.webhook ? "healthy" : "unknown";
  if (webhookStatus === "degraded") warnings.push("Webhook processing is degraded.");

  const secondaryCounts = Object.fromEntries(
    HUBSPOT_SECONDARY_OBJECTS.map((kind) => {
      const counter = secondaryCompleted?.secondaryCounters?.[kind];
      const current = Number(counter?.active ?? 0);
      const archived = Number(counter?.archived ?? 0);
      return [kind, { current, archived, total: current + archived }];
    })
  ) as HubspotWorkspaceStatus["secondary"]["counts"];

  // Prefer a completed run for counts; fall back to newest terminal (partial/failed)
  // so operators still see privacy-safe object totals after a partial engagement backup.
  const engagementCountSource = engagementCompleted ?? engagementState;
  const engagementCounts = Object.fromEntries(
    HUBSPOT_ENGAGEMENT_OBJECTS.map((kind) => {
      const counter = engagementCountSource?.engagementCounters?.[kind];
      const current = Number(counter?.active ?? 0);
      const archived = Number(counter?.archived ?? 0);
      return [kind, { current, archived, total: current + archived }];
    })
  ) as HubspotWorkspaceStatus["engagement"]["counts"];

  const missingScopeWarnings: string[] = [];
  const caps = engagementState?.engagementCapabilities ?? engagementCompleted?.engagementCapabilities;
  if (caps && typeof caps === "object") {
    for (const [kind, value] of Object.entries(caps)) {
      const entry = value as { granted?: boolean; result?: string; requiredScope?: string };
      if (entry?.granted === false || entry?.result === "MISSING_SCOPE") {
        missingScopeWarnings.push(
          `${kind}: ${entry.requiredScope ?? "required read scope"} missing`
        );
      }
    }
  }
  for (const warning of missingScopeWarnings) warnings.push(warning);

  return {
    credential: {
      verified: input.authVerified,
      status: input.authVerified ? "verified" : "unverified",
    },
    primary: {
      status: primaryState?.status ?? null,
      completedAt: primaryCompleted?.completedAt ?? null,
      runId: primaryCompleted?.id ?? null,
      warning: primaryWarning,
      counts: {
        contacts: Number(primaryCompleted?.contactsDiscovered ?? 0),
        deals: Number(primaryCompleted?.dealsDiscovered ?? 0),
      },
    },
    secondary: {
      status: secondaryState?.status ?? null,
      completedAt: secondaryCompleted?.completedAt ?? null,
      runId: secondaryCompleted?.id ?? null,
      warning: secondaryWarning,
      counts: secondaryCounts,
    },
    engagement: {
      status: engagementState?.status ?? null,
      completedAt: engagementCompleted?.completedAt ?? null,
      runId: engagementCompleted?.id ?? null,
      warning: engagementWarning,
      counts: engagementCounts,
      missingScopeWarnings,
    },
    webhook: {
      status: webhookStatus,
      pending,
      retrying,
      failed,
      lastWebhookAt: input.webhook?.lastWebhookAt ?? null,
    },
    importReview: {
      staged: Number(input.importReview?.staged ?? 0),
      approved: Number(input.importReview?.approved ?? 0),
      rejected: Number(input.importReview?.rejected ?? 0),
      imported: Number(input.importReview?.imported ?? 0),
    },
    warnings,
  };
}
