import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { buildAttentionPriorities } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import {
  compareTodayFeedItems,
  coveredAggregateKeys,
  entityAttentionItems,
  type TodayEntityAttentionCategory,
  type TodayEntityAttentionSignal,
} from "@/src/lib/fiOs/todayFeedEntityAttention";
import type {
  DashboardReminderItem,
  ReceptionBoardCard,
  StaleLeadItem,
  TaskDueItem,
  TenantActionCentre,
  TenantOperationalDashboard,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

/**
 * FI-UX-REBUILD-1D / P0C — Today surface feed.
 *
 * Buckets named, human work items into Right now / Up next / Coming up.
 * Copy is operational language for humans — not backend terminology.
 */

export type TodayFeedBucket = "right_now" | "up_next" | "coming_up";
export type TodayFeedSeverity = "critical" | "warning" | "normal";

export type TodayFeedItem = {
  id: string;
  /** Empty string for aggregate (non-named) fallback items. */
  personLabel: string;
  actionLabel: string;
  /** Secondary human context shown below the primary line. */
  detailLine?: string;
  /** Short action affordance label (e.g. "Check in"). */
  actionHint?: string;
  href: string;
  severity: TodayFeedSeverity;
  bucket: TodayFeedBucket;
  priorityScore: number;
  /** True when the item disappears on its own once the underlying condition clears (no manual dismiss needed). */
  autoResolves: boolean;
  /** When set, presentation layer may collapse matching items into one group row. */
  groupKey?: string;
  /** Expanded members when this row represents a collapsed group. */
  groupMembers?: TodayFeedItem[];
};

export type TodayFeed = {
  rightNow: TodayFeedItem[];
  upNext: TodayFeedItem[];
  comingUp: TodayFeedItem[];
};

const RIGHT_NOW_WINDOW_MS = 30 * 60_000;
const DEFAULT_MAX_PER_BUCKET = 8;
/** P0C: Right now shows at most this many items before the rest collapse behind a queue. */
export const RIGHT_NOW_VISIBLE_CAP = 3;

type FeedCategory =
  | "reception"
  | "leads"
  | "tasks"
  | "reminders"
  | "surgery"
  | "financial"
  | "consultations"
  | "pathology"
  | "staff";

const ENTITY_CATEGORY: Record<TodayEntityAttentionCategory, FeedCategory> = {
  financial: "financial",
  surgery: "surgery",
  pathology: "pathology",
  consultation: "consultations",
  staff: "staff",
};

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

function firstName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "Patient";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function minutesUntil(nowMs: number, iso: string | null | undefined): number | null {
  const t = parseMs(iso);
  if (t == null) return null;
  return Math.max(0, Math.round((t - nowMs) / 60_000));
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

function receptionCopy(
  card: ReceptionBoardCard,
  bucket: TodayFeedBucket,
  nowMs: number
): Pick<TodayFeedItem, "actionLabel" | "detailLine" | "actionHint" | "groupKey"> {
  if (card.receptionColumn === "arrived") {
    return {
      actionLabel: `${firstName(card.displayName)} is waiting`,
      detailLine: card.statusLabel.trim() || "Checked in — ready to be seen",
      actionHint: "Check in",
      groupKey: "reception:waiting",
    };
  }
  if (card.receptionColumn === "in_treatment") {
    return {
      actionLabel: `${firstName(card.displayName)} is in treatment`,
      detailLine: card.typeLabel.trim() || undefined,
      actionHint: "View",
      groupKey: "reception:in_clinic",
    };
  }
  if (card.receptionColumn === "in_consultation") {
    return {
      actionLabel: `${firstName(card.displayName)} is in consultation`,
      detailLine: card.providerLabel.trim() || undefined,
      actionHint: "View",
      groupKey: "reception:in_clinic",
    };
  }

  const mins = minutesUntil(nowMs, card.startAt);
  if (bucket === "right_now" && mins != null) {
    const arrival =
      mins <= 1 ? "arriving now" : mins === 1 ? "arriving in 1 minute" : `arriving in ${mins} minutes`;
    return {
      actionLabel: `${firstName(card.displayName)} ${arrival}`,
      detailLine: card.typeLabel.trim() || "Appointment starting soon",
      actionHint: "Check in",
      groupKey: "reception:arriving_soon",
    };
  }

  return {
    actionLabel: `${firstName(card.displayName)} has an appointment later today`,
    detailLine: card.typeLabel.trim() || "Scheduled check-in expected",
    actionHint: "View",
  };
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

      const copy = receptionCopy(c, bucket, nowMs);

      return {
        id: `reception-${c.id}`,
        personLabel: c.displayName,
        ...copy,
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
    const name = firstName(l.title);
    const days = l.daysInStage;
    const dayLabel = days === 1 ? "1 day" : `${days} days`;

    return {
      id: `stale-lead-${l.leadId}`,
      personLabel: l.title,
      actionLabel: `Call ${name}`,
      detailLine:
        days === 1
          ? "No follow-up yet today"
          : days <= thresholdDays
            ? `No follow-up for ${dayLabel}`
            : `${name} has not been contacted for ${dayLabel}`,
      actionHint: "Call patient",
      href: `${base}/crm/leads/${l.leadId}`,
      severity: "warning",
      bucket: days > thresholdDays + 7 ? "right_now" : "up_next",
      priorityScore: (55 + Math.min(days, 30)) * weight,
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
    const name = firstName(t.title);

    return {
      id: `task-${t.id}`,
      personLabel: t.title,
      actionLabel: overdue ? `Follow up with ${name}` : `Task due for ${name}`,
      detailLine: overdue
        ? "This follow-up is overdue"
        : t.isUnassigned
          ? "Unassigned — needs an owner"
          : "Due later today",
      actionHint: "Follow up",
      href: `${base}/crm/leads/${t.leadId}`,
      severity: "warning",
      bucket: overdue ? "right_now" : bucket,
      priorityScore: (overdue ? 80 : 50) * weight,
      autoResolves: true,
    } satisfies TodayFeedItem;
  });
}

function humanizeReminderAction(r: DashboardReminderItem): { actionLabel: string; detailLine?: string } {
  const summary = r.clinicalSummaryLine?.trim();
  if (summary) {
    return { actionLabel: summary, detailLine: "Clinical reminder scheduled" };
  }
  const type = r.templateType.replace(/_/g, " ").toLowerCase();
  return {
    actionLabel: `Reminder for ${firstName(r.recipientLabel)}`,
    detailLine: type.charAt(0).toUpperCase() + type.slice(1),
  };
}

function reminderItems(
  reminders: readonly DashboardReminderItem[],
  opts: { nowMs: number; todayEndMs: number; profileKey?: FiWorkspaceProfileKey }
): TodayFeedItem[] {
  const { nowMs, todayEndMs, profileKey } = opts;
  const weight = categoryWeight(profileKey, "reminders");

  return reminders.map((r) => {
    const bucket = bucketForInstant(r.scheduled_at, { nowMs, todayEndMs });
    const copy = humanizeReminderAction(r);
    return {
      id: `reminder-${r.jobId}`,
      personLabel: r.recipientLabel,
      actionLabel: copy.actionLabel,
      detailLine: copy.detailLine,
      actionHint: "View",
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

/** Humanize aggregate labels from the legacy attention engine — presentation only. */
function humanizeAggregateLabel(id: string, label: string): { actionLabel: string; detailLine?: string; actionHint?: string } {
  switch (id) {
    case "financial_clearance":
      return {
        actionLabel: label.replace(/need payment clearance before procedure day/i, "need financial clearance"),
        detailLine: "Procedures cannot proceed until cleared",
        actionHint: "Review clearance",
      };
    case "surgery_readiness":
      return {
        actionLabel: label.replace(/blocked by missing preparation requirements/i, "need preparation completed"),
        detailLine: "Missing requirements before procedure day",
        actionHint: "Review cases",
      };
    case "surgery_payment":
      return {
        actionLabel: label.replace(/need payment follow-up/i, "need payment attention"),
        detailLine: "Deposits or balances require confirmation",
        actionHint: "Take payment",
      };
    case "consultations":
      return {
        actionLabel: label.replace(/require completion/i, "need to be completed"),
        detailLine: "Consultation workspaces awaiting closure",
        actionHint: "Complete",
      };
    case "follow_ups":
      return {
        actionLabel: label.replace(/require scheduling attention/i, "need scheduling"),
        detailLine: "Visits due within the next two weeks",
        actionHint: "Schedule",
      };
    case "leads":
      return {
        actionLabel: label.replace(/awaiting contact/i, "waiting for first contact"),
        detailLine: "New enquiries not yet worked",
        actionHint: "Contact",
      };
    default:
      return { actionLabel: label, actionHint: "Review" };
  }
}

function aggregateFallbackItems(opts: {
  base: string;
  actionCentre: TenantActionCentre;
  showCrmNav: boolean;
  profileKey?: FiWorkspaceProfileKey;
  suppressAggregateKeys?: ReadonlySet<string>;
}): TodayFeedItem[] {
  const { base, actionCentre, showCrmNav, profileKey, suppressAggregateKeys } = opts;
  const priorities = buildAttentionPriorities({ base, actionCentre, showCrmNav, maxItems: 8 });

  return priorities
    .filter((p) => !suppressAggregateKeys?.has(p.id))
    .map((p) => {
    const category = AGGREGATE_CATEGORY[p.id] ?? "financial";
    const weight = categoryWeight(profileKey, category);
    const bucket: TodayFeedBucket =
      p.severity === "critical" ? "right_now" : p.severity === "warning" ? "up_next" : "coming_up";
    const human = humanizeAggregateLabel(p.id, p.label);
    return {
      id: `aggregate-${p.id}`,
      personLabel: "",
      actionLabel: human.actionLabel,
      detailLine: human.detailLine,
      actionHint: human.actionHint,
      href: p.href,
      severity: p.severity,
      bucket,
      priorityScore: p.priorityScore * weight,
      autoResolves: true,
    } satisfies TodayFeedItem;
  });
}

function entityCategoryWeight(
  profileKey: FiWorkspaceProfileKey | undefined,
  category: TodayEntityAttentionCategory
): number {
  return categoryWeight(profileKey, ENTITY_CATEGORY[category]);
}

function entityAttentionFeedItems(
  signals: readonly TodayEntityAttentionSignal[],
  profileKey?: FiWorkspaceProfileKey
): TodayFeedItem[] {
  return entityAttentionItems(signals, {
    categoryWeight: (category) => entityCategoryWeight(profileKey, category),
  });
}

function byPriorityDesc(a: TodayFeedItem, b: TodayFeedItem): number {
  return compareTodayFeedItems(a, b);
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
    ...entityAttentionFeedItems(dashboard.entityAttention ?? [], profileKey),
    ...aggregateFallbackItems({
      base,
      actionCentre: dashboard.actionCentre,
      showCrmNav,
      profileKey,
      suppressAggregateKeys: coveredAggregateKeys(dashboard.entityAttention ?? []),
    }),
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

/** Count overdue CRM tasks for the Today header pulse line. */
export function countOverdueTasks(
  tasksDue: readonly TaskDueItem[],
  nowMs: number = Date.now()
): number {
  return tasksDue.filter((t) => {
    const due = parseMs(t.dueAt);
    return due != null && due < nowMs;
  }).length;
}

/** Patients booked today — consultations + surgeries + follow-ups + PRP. */
export function countPatientsBookedToday(clinicToday: TenantOperationalDashboard["clinicToday"]): number {
  return clinicToday.consultations + clinicToday.surgeries + clinicToday.followUps + clinicToday.prp;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstNameFromDisplayName(displayName: string | null | undefined): string | null {
  if (!displayName?.trim()) return null;
  return displayName.trim().split(/\s+/)[0] ?? null;
}
