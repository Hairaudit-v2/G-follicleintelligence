import type { HubspotSyncRunStatus } from "./hubspotConnectorTypes";

export const HUBSPOT_SECONDARY_OBJECTS = [
  "companies",
  "tickets",
  "owners",
  "calls",
  "tasks",
  "meetings",
] as const;

export type HubspotSecondaryObject = (typeof HUBSPOT_SECONDARY_OBJECTS)[number];

export type HubspotWorkspaceRun = {
  id: string;
  status: HubspotSyncRunStatus;
  contactsDiscovered: number;
  dealsDiscovered: number;
  startedAt: string;
  completedAt: string | null;
  detail: Record<string, unknown>;
  secondaryCounters?: Partial<Record<HubspotSecondaryObject, { active: number; archived: number; discovered: number; complete: boolean }>>;
  secondaryCapabilities?: Record<string, unknown> | null;
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
  return milestone.includes("SECONDARY") || Boolean(run.secondaryCapabilities && Object.keys(run.secondaryCapabilities).length);
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
  const primaryRuns = input.runs.filter((run) => !isSecondaryHubspotRun(run));
  const secondaryRuns = input.runs.filter(isSecondaryHubspotRun);
  const primaryState = newestTerminal(primaryRuns);
  const secondaryState = newestTerminal(secondaryRuns);
  const primaryCompleted = newestCompleted(primaryRuns);
  const secondaryCompleted = newestCompleted(secondaryRuns);
  const warnings: string[] = [];

  const primaryWarning = primaryState?.status === "partial" ? "Primary backup is partial." : primaryState?.status === "failed" ? "Primary backup failed." : null;
  const secondaryWarning = secondaryState?.status === "partial" ? "Secondary backup is partial." : secondaryState?.status === "failed" ? "Secondary backup failed." : null;
  if (primaryWarning) warnings.push(primaryWarning);
  if (secondaryWarning) warnings.push(secondaryWarning);

  const pending = Number(input.webhook?.pending ?? 0);
  const retrying = Number(input.webhook?.retrying ?? 0);
  const failed = Number(input.webhook?.failed ?? 0);
  const webhookStatus = failed > 0 || retrying > 0 ? "degraded" : input.webhook ? "healthy" : "unknown";
  if (webhookStatus === "degraded") warnings.push("Webhook processing is degraded.");

  const secondaryCounts = Object.fromEntries(
    HUBSPOT_SECONDARY_OBJECTS.map((kind) => {
      const counter = secondaryCompleted?.secondaryCounters?.[kind];
      const current = Number(counter?.active ?? 0);
      const archived = Number(counter?.archived ?? 0);
      return [kind, { current, archived, total: current + archived }];
    })
  ) as HubspotWorkspaceStatus["secondary"]["counts"];

  return {
    credential: { verified: input.authVerified, status: input.authVerified ? "verified" : "unverified" },
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
    webhook: { status: webhookStatus, pending, retrying, failed, lastWebhookAt: input.webhook?.lastWebhookAt ?? null },
    importReview: {
      staged: Number(input.importReview?.staged ?? 0),
      approved: Number(input.importReview?.approved ?? 0),
      rejected: Number(input.importReview?.rejected ?? 0),
      imported: Number(input.importReview?.imported ?? 0),
    },
    warnings,
  };
}
