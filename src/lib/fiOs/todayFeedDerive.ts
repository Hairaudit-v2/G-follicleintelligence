import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { buildAttentionPriorities } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import type {
  DashboardReminderItem,
  ReceptionBoardCard,
  StaleLeadItem,
  TaskDueItem,
  TenantActionCentre,
  TenantOperationalDashboard,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

/**
 * FI-UX-REBUILD-1D — Today surface feed.
 *
 * Buckets named, human work items into Right now / Up next / Coming up.
 * Deliberately reuses `buildAttentionPriorities` for the handful of signal
 * categories that don't have a named source yet (see Phase 7 in the plan —
 * expanding those to named items is a later, separate change).
 */

export type TodayFeedBucket = "right_now" | "up_next" | "coming_up";
export type TodayFeedSeverity = "critical" | "warning" | "normal";

export type TodayFeedItem = {
  id: string;
  /** Empty string for aggregate (non-named) fallback items. */
  personLabel: string;
  actionLabel: string;
  href: string;
  severity: TodayFeedSeverity;
  bucket: TodayFeedBucket;
  priorityScore: number;
  /** True when the item disappears on its own once the underlying condition clears (no manual dismiss needed). */
  autoResolves: boolean;
};

export type TodayFeed = {
  rightNow: TodayFeedItem[];
  upNext: TodayFeedItem[];
  comingUp: TodayFeedItem[];
};

const RIGHT_NOW_WINDOW_MS = 30 * 60_000;
const DEFAULT_MAX_PER_BUCKET = 8;

type FeedCategory =
  | "reception"
  | "leads"
  | "tasks"
  | "reminders"
  | "surgery"
  | "financial"
  | "consultations";

/** Best-effort role weighting — reuses `FiWorkspaceProfileKey`, does not modify `fiWorkspaceProfiles.ts`. */
const ROLE_CATEGORY_WEIGHT: Partial<Record<FiWorkspaceProfileKey, Partial<Record<FeedCategory, number>>>> = {
  reception: { reception: 1.5, leads: 1.2 },
  nurse: { reception: 1.3, consultations: 1.1 },
  doctor: { consultations: 1.4, surgery: 1.2 },
  surgeon: { surgery: 1.6, consultations: 1.1 },
  consultant: { leads: 1.5, consultations: 1.3 },
  clinic_manager: { reception: 1.2, financial: 1.2, surgery: 1.2 },
  director: { financial: 1.3, surgery: 1.1 },
};

function categoryWeight(profileKey: FiWorkspaceProfileKey | undefined, category: FeedCategory): number {
  if (!profileKey) return 1;
  return ROLE_CATEGORY_WEIGHT[profileKey]?.[category] ?? 1;
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function bucketForInstant(
  iso: string | null | undefined,
  opts: { nowMs: number; todayEndMs: number }
): TodayFeedBucket {
  const t = parseMs(iso);
  if (t == null) return "up_next";
  if (t <= opts.nowMs + RIGHT_NOW_WINDOW_MS) return "right_now";
  if (t <= opts.todayEndMs) return "up_next";
  return "coming_up";
}

function receptionActionLabel(card: ReceptionBoardCard, bucket: TodayFeedBucket): string {
  if (card.receptionColumn === "arrived") return `waiting — ${card.statusLabel.toLowerCase()}`;
  if (card.receptionColumn === "in_treatment") return "in treatment";
  if (card.receptionColumn === "in_consultation") return "in consultation";
  return bucket === "right_now" ? "arriving soon" : "check-in expected";
}

function receptionHref(base: string, card: ReceptionBoardCard): string {
  if (card.patientId) return `${base}/patients/${card.patientId}`;
  if (card.leadId) return `${base}/crm/leads/${card.leadId}`;
  return `${base}/reception`;
}

const RECEPTION_TERMINAL_COLUMNS = new Set(["complete", "no_show", "cancelled"]);

function receptionItems(
  cards: readonly ReceptionBoardCard[],
  opts: { base: string; nowMs: number; todayEndMs: number; profileKey?: FiWorkspaceProfileKey }
): TodayFeedItem[] {
  const { base, nowMs, todayEndMs, profileKey } = opts;
  const weight = categoryWeight(profileKey, "reception");

  return cards
    .filter((c) => !RECEPTION_TERMINAL_COLUMNS.has(c.receptionColumn))
    .map((c) => {
      let bucket: TodayFeedBucket;
      let severity: TodayFeedSeverity;
      let priorityScore: number;

      if (c.receptionColumn === "arrived") {
        bucket = "right_now";
        severity = "warning";
        priorityScore = 92;
      } else if (c.receptionColumn === "in_consultation" || c.receptionColumn === "in_treatment") {
        bucket = "right_now";
        severity = "normal";
        priorityScore = 40;
      } else {
        bucket = bucketForInstant(c.startAt, { nowMs, todayEndMs });
        severity = bucket === "right_now" ? "warning" : "normal";
        priorityScore = bucket === "right_now" ? 85 : 30;
      }

      return {
        id: `reception-${c.id}`,
        personLabel: c.displayName,
        actionLabel: receptionActionLabel(c, bucket),
        href: receptionHref(base, c),
        severity,
        bucket,
        priorityScore: priorityScore * weight,
        autoResolves: true,
      } satisfies TodayFeedItem;
    });
}

function staleLeadItems(
  staleLeads: readonly StaleLeadItem[],
  opts: { base: string; thresholdDays: number; profileKey?: FiWorkspaceProfileKey }
): TodayFeedItem[] {
  const { base, thresholdDays, profileKey } = opts;
  const weight = categoryWeight(profileKey, "leads");

  return staleLeads.map((l) => {
    const overBy = l.daysInStage - thresholdDays;
    const severity: TodayFeedSeverity = overBy >= thresholdDays ? "critical" : "warning";
    return {
      id: `stale-lead-${l.leadId}`,
      personLabel: l.title,
      actionLabel: `stale in ${l.stageLabel} — ${l.daysInStage}d`,
      href: `${base}/crm/leads/${l.leadId}`,
      severity,
      bucket: severity === "critical" ? "right_now" : "up_next",
      priorityScore: (55 + Math.min(l.daysInStage, 30)) * weight,
      autoResolves: true,
    } satisfies TodayFeedItem;
  });
}

function taskDueItems(
  tasksDue: readonly TaskDueItem[],
  opts: { base: string; nowMs: number; todayEndMs: number; profileKey?: FiWorkspaceProfileKey }
): TodayFeedItem[] {
  const { base, nowMs, todayEndMs, profileKey } = opts;
  const weight = categoryWeight(profileKey, "tasks");

  return tasksDue.map((t) => {
    const bucket = bucketForInstant(t.dueAt, { nowMs, todayEndMs });
    const overdue = parseMs(t.dueAt) != null && (parseMs(t.dueAt) as number) < nowMs;
    return {
      id: `task-${t.id}`,
      personLabel: t.title,
      actionLabel: overdue
        ? "follow-up overdue"
        : t.isUnassigned
          ? "unassigned follow-up"
          : "follow-up due",
      href: `${base}/crm/leads/${t.leadId}`,
      severity: overdue ? "critical" : "warning",
      bucket: overdue ? "right_now" : bucket,
      priorityScore: (overdue ? 80 : 50) * weight,
      autoResolves: true,
    } satisfies TodayFeedItem;
  });
}

function reminderItems(
  reminders: readonly DashboardReminderItem[],
  opts: { nowMs: number; todayEndMs: number; profileKey?: FiWorkspaceProfileKey }
): TodayFeedItem[] {
  const { nowMs, todayEndMs, profileKey } = opts;
  const weight = categoryWeight(profileKey, "reminders");

  return reminders.map((r) => {
    const bucket = bucketForInstant(r.scheduled_at, { nowMs, todayEndMs });
    return {
      id: `reminder-${r.jobId}`,
      personLabel: r.recipientLabel,
      actionLabel: r.clinicalSummaryLine?.trim() || `reminder — ${r.templateType}`,
      href: r.detailHref,
      severity: "normal",
      bucket,
      priorityScore: 35 * weight,
      autoResolves: true,
    } satisfies TodayFeedItem;
  });
}

const AGGREGATE_CATEGORY: Record<string, FeedCategory> = {
  financial_clearance: "financial",
  surgery_readiness: "surgery",
  surgery_payment: "surgery",
  consultations: "consultations",
  follow_ups: "tasks",
  leads: "leads",
  pathway_tasks: "financial",
  finance_applications: "financial",
};

function aggregateFallbackItems(opts: {
  base: string;
  actionCentre: TenantActionCentre;
  showCrmNav: boolean;
  profileKey?: FiWorkspaceProfileKey;
}): TodayFeedItem[] {
  const { base, actionCentre, showCrmNav, profileKey } = opts;
  const priorities = buildAttentionPriorities({ base, actionCentre, showCrmNav, maxItems: 8 });

  return priorities.map((p) => {
    const category = AGGREGATE_CATEGORY[p.id] ?? "financial";
    const weight = categoryWeight(profileKey, category);
    const bucket: TodayFeedBucket =
      p.severity === "critical" ? "right_now" : p.severity === "warning" ? "up_next" : "coming_up";
    return {
      id: `aggregate-${p.id}`,
      personLabel: "",
      actionLabel: p.label,
      href: p.href,
      severity: p.severity,
      bucket,
      priorityScore: p.priorityScore * weight,
      autoResolves: true,
    } satisfies TodayFeedItem;
  });
}

function byPriorityDesc(a: TodayFeedItem, b: TodayFeedItem): number {
  return b.priorityScore - a.priorityScore;
}

export function buildTodayFeed(input: {
  base: string;
  dashboard: TenantOperationalDashboard;
  showCrmNav: boolean;
  profileKey?: FiWorkspaceProfileKey;
  now?: Date;
  maxPerBucket?: number;
}): TodayFeed {
  const { base, dashboard, showCrmNav, profileKey, now = new Date(), maxPerBucket = DEFAULT_MAX_PER_BUCKET } =
    input;

  const nowMs = now.getTime();
  const parsedTodayEnd = parseMs(dashboard.operationalDay.localEndIso);
  const todayEndMs = parsedTodayEnd ?? nowMs + 24 * 60 * 60_000;

  const all: TodayFeedItem[] = [
    ...receptionItems(dashboard.receptionBoard.cards, { base, nowMs, todayEndMs, profileKey }),
    ...staleLeadItems(dashboard.staleLeads, {
      base,
      thresholdDays: dashboard.staleLeadThresholdDays,
      profileKey,
    }),
    ...taskDueItems(dashboard.tasksDue, { base, nowMs, todayEndMs, profileKey }),
    ...reminderItems(dashboard.upcomingReminders, { nowMs, todayEndMs, profileKey }),
    ...aggregateFallbackItems({ base, actionCentre: dashboard.actionCentre, showCrmNav, profileKey }),
  ];

  const byBucket = (bucket: TodayFeedBucket): TodayFeedItem[] =>
    all
      .filter((i) => i.bucket === bucket)
      .sort(byPriorityDesc)
      .slice(0, maxPerBucket);

  return {
    rightNow: byBucket("right_now"),
    upNext: byBucket("up_next"),
    comingUp: byBucket("coming_up"),
  };
}
