import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type {
  TodayFeedItem,
  TodayFeedSeverity,
} from "@/src/lib/fiOs/todayFeedDerive";

/** FI-UX-REBUILD D6B — weighted priority scoring for Today feed items. */

export type TodayPriorityBand = "critical" | "high" | "medium" | "low";

export type TodayPriorityDimension =
  | "urgency"
  | "timeSensitivity"
  | "clinicalRisk"
  | "workflowBlocking"
  | "patientImpact"
  | "revenueImpact"
  | "roleRelevance"
  | "freshness"
  | "escalation";

export type TodayPriorityDimensions = Record<TodayPriorityDimension, number>;

export type TodaySignalKind =
  | "arrival_intent"
  | "reception_waiting"
  | "reception_arriving_soon"
  | "reception_in_clinic"
  | "payment_blocker"
  | "financial_clearance"
  | "pathology_review"
  | "surgery_readiness"
  | "stale_lead"
  | "staff_compliance"
  | "consultation"
  | "task_due"
  | "reminder"
  | "aggregate";

/** Centralized dimension weights — sum to 100 for a direct weighted average. */
export const TODAY_PRIORITY_WEIGHTS: Readonly<Record<TodayPriorityDimension, number>> = {
  clinicalRisk: 20,
  workflowBlocking: 20,
  urgency: 15,
  timeSensitivity: 15,
  patientImpact: 10,
  revenueImpact: 10,
  roleRelevance: 7,
  freshness: 2,
  escalation: 1,
};

export type TodaySignalPriorityContext = {
  profileKey?: FiWorkspaceProfileKey;
  nowMs?: number;
};

export type TodaySignalPriorityResult = {
  priorityScore: number;
  priorityBand: TodayPriorityBand;
  priorityDimensions: TodayPriorityDimensions;
  priorityReasons: string[];
  severity: TodayFeedSeverity;
};

const SEVERITY_RANK: Record<TodayFeedSeverity, number> = {
  critical: 3,
  warning: 2,
  normal: 1,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function emptyDimensions(): TodayPriorityDimensions {
  return {
    urgency: 0,
    timeSensitivity: 0,
    clinicalRisk: 0,
    workflowBlocking: 0,
    patientImpact: 0,
    revenueImpact: 0,
    roleRelevance: 0,
    freshness: 0,
    escalation: 0,
  };
}

function surgeryIsTodayOrTomorrow(item: TodayFeedItem): boolean {
  const text = `${item.detailLine ?? ""} ${item.actionLabel}`.toLowerCase();
  return (
    /\bprocedure today\b/.test(text) ||
    /\bprocedure tomorrow\b/.test(text) ||
    /\bsurgery scheduled today\b/.test(text) ||
    /\bsurgery scheduled tomorrow\b/.test(text) ||
    /\btoday —/.test(text) ||
    /\btomorrow —/.test(text)
  );
}

export function inferTodaySignalKind(item: TodayFeedItem): TodaySignalKind {
  const groupKey = item.groupKey ?? "";
  const id = item.id;

  if (groupKey === "reception:arrival_intent") return "arrival_intent";
  if (groupKey === "reception:waiting") return "reception_waiting";
  if (groupKey === "reception:arriving_soon") return "reception_arriving_soon";
  if (groupKey === "reception:in_clinic") return "reception_in_clinic";

  if (id.startsWith("stale-lead-")) return "stale_lead";
  if (id.startsWith("task-")) return "task_due";
  if (id.startsWith("reminder-")) return "reminder";

  if (groupKey === "entity:pathology_review" || id.startsWith("entity-pathology-")) {
    return "pathology_review";
  }
  if (
    groupKey === "entity:surgery_readiness" ||
    id.startsWith("entity-surgery-readiness-") ||
    id === "aggregate-surgery_readiness"
  ) {
    return "surgery_readiness";
  }
  if (
    groupKey === "entity:payment_overdue" ||
    groupKey === "entity:surgery_payment" ||
    id.startsWith("entity-payment-overdue-") ||
    id.startsWith("entity-surgery-payment-") ||
    id === "aggregate-surgery_payment"
  ) {
    return "payment_blocker";
  }
  if (groupKey === "entity:financial_clearance" || id.startsWith("entity-financial-clearance-")) {
    return "financial_clearance";
  }
  if (groupKey === "entity:staff_compliance" || id.startsWith("entity-staff-")) {
    return "staff_compliance";
  }
  if (groupKey === "entity:consultation" || id.startsWith("entity-consultation-")) {
    return "consultation";
  }

  if (id.startsWith("aggregate-")) return "aggregate";

  if (id.startsWith("reception-")) {
    if (/says they're here/i.test(item.actionLabel)) return "arrival_intent";
    if (/waiting/i.test(item.actionLabel)) return "reception_waiting";
    if (/arriving/i.test(item.actionLabel)) return "reception_arriving_soon";
    return "reception_in_clinic";
  }

  return "aggregate";
}

function roleRelevanceForSignal(
  kind: TodaySignalKind,
  profileKey: FiWorkspaceProfileKey | undefined
): number {
  const profile = profileKey ?? "default";

  const byKind: Partial<Record<TodaySignalKind, Partial<Record<FiWorkspaceProfileKey, number>>>> = {
    arrival_intent: {
      reception: 95,
      nurse: 70,
      doctor: 45,
      surgeon: 35,
      consultant: 25,
      clinic_manager: 60,
      director: 40,
      default: 50,
      platform_admin: 40,
      academy_trainer: 20,
      auditor: 15,
    },
    reception_waiting: {
      reception: 92,
      nurse: 78,
      doctor: 80,
      surgeon: 55,
      consultant: 35,
      clinic_manager: 65,
      default: 55,
    },
    reception_arriving_soon: {
      reception: 88,
      nurse: 70,
      doctor: 50,
      default: 55,
    },
    payment_blocker: {
      reception: 65,
      consultant: 55,
      clinic_manager: 82,
      director: 85,
      default: 60,
    },
    financial_clearance: {
      clinic_manager: 88,
      director: 85,
      reception: 60,
      consultant: 50,
      default: 65,
    },
    pathology_review: {
      doctor: 90,
      surgeon: 88,
      nurse: 55,
      reception: 28,
      consultant: 35,
      clinic_manager: 50,
      default: 45,
    },
    surgery_readiness: {
      surgeon: 95,
      clinic_manager: 90,
      reception: 72,
      nurse: 68,
      doctor: 60,
      default: 65,
    },
    stale_lead: {
      consultant: 92,
      clinic_manager: 80,
      director: 75,
      reception: 45,
      doctor: 30,
      surgeon: 22,
      nurse: 25,
      default: 50,
    },
    staff_compliance: {
      clinic_manager: 92,
      director: 85,
      reception: 52,
      surgeon: 58,
      nurse: 48,
      default: 55,
    },
    consultation: {
      consultant: 85,
      doctor: 78,
      clinic_manager: 60,
      reception: 45,
      default: 55,
    },
    task_due: {
      consultant: 75,
      reception: 65,
      clinic_manager: 70,
      default: 60,
    },
  };

  const table = byKind[kind];
  if (!table) return 50;
  return table[profile] ?? table.default ?? 50;
}

function baseDimensionsForSignal(
  kind: TodaySignalKind,
  item: TodayFeedItem,
  context: TodaySignalPriorityContext
): { dimensions: TodayPriorityDimensions; reasons: string[] } {
  const dimensions = emptyDimensions();
  const reasons: string[] = [];
  const surgerySoon = surgeryIsTodayOrTomorrow(item);

  switch (kind) {
    case "arrival_intent":
      dimensions.urgency = 95;
      dimensions.timeSensitivity = 92;
      dimensions.patientImpact = 55;
      dimensions.clinicalRisk = 15;
      dimensions.freshness = 85;
      reasons.push("Patient is here now");
      break;

    case "reception_waiting":
      dimensions.urgency = 78;
      dimensions.timeSensitivity = 82;
      dimensions.patientImpact = 62;
      dimensions.clinicalRisk = 20;
      reasons.push("Patient waiting to be seen");
      break;

    case "reception_arriving_soon":
      dimensions.urgency = 72;
      dimensions.timeSensitivity = 88;
      dimensions.patientImpact = 50;
      reasons.push("Appointment starting soon");
      break;

    case "reception_in_clinic":
      dimensions.urgency = 35;
      dimensions.timeSensitivity = 40;
      dimensions.patientImpact = 45;
      break;

    case "payment_blocker":
      dimensions.workflowBlocking = surgerySoon ? 98 : 78;
      dimensions.revenueImpact = surgerySoon ? 95 : 72;
      dimensions.urgency = surgerySoon ? 95 : 62;
      dimensions.timeSensitivity = surgerySoon ? 92 : 50;
      dimensions.patientImpact = surgerySoon ? 72 : 40;
      dimensions.clinicalRisk = surgerySoon ? 55 : 20;
      if (surgerySoon) {
        reasons.push("Surgery tomorrow");
        reasons.push("Blocking procedure readiness");
      } else {
        reasons.push("Revenue follow-up overdue");
      }
      break;

    case "financial_clearance":
      dimensions.workflowBlocking = surgerySoon ? 95 : 80;
      dimensions.revenueImpact = 82;
      dimensions.clinicalRisk = surgerySoon ? 55 : 35;
      dimensions.urgency = surgerySoon ? 90 : 68;
      if (surgerySoon) reasons.push("Surgery tomorrow");
      reasons.push("Blocking procedure readiness");
      break;

    case "pathology_review":
      dimensions.clinicalRisk = 72;
      dimensions.workflowBlocking = 58;
      dimensions.urgency = 55;
      dimensions.patientImpact = 60;
      reasons.push("Awaiting doctor review");
      break;

    case "surgery_readiness":
      dimensions.clinicalRisk = surgerySoon ? 88 : 65;
      dimensions.workflowBlocking = surgerySoon ? 92 : 70;
      dimensions.urgency = surgerySoon ? 90 : 58;
      dimensions.timeSensitivity = surgerySoon ? 88 : 45;
      dimensions.patientImpact = surgerySoon ? 75 : 50;
      dimensions.escalation = item.severity === "critical" ? 80 : 40;
      if (surgerySoon) reasons.push("Surgery tomorrow");
      else reasons.push("Blocking procedure readiness");
      break;

    case "stale_lead": {
      const daysMatch = item.detailLine?.match(/(\d+)\s+day/i);
      const days = daysMatch ? Number.parseInt(daysMatch[1] ?? "0", 10) : 7;
      dimensions.urgency = clampScore(45 + Math.min(days, 20));
      dimensions.revenueImpact = clampScore(50 + Math.min(days, 15));
      dimensions.timeSensitivity = clampScore(40 + Math.min(days, 10));
      dimensions.escalation = days > 14 ? 70 : 35;
      reasons.push("Revenue follow-up overdue");
      break;
    }

    case "staff_compliance": {
      const surgeryLinked = /surgery|procedure|theatre|operating/i.test(
        `${item.detailLine ?? ""} ${item.actionLabel}`
      );
      dimensions.clinicalRisk = surgeryLinked ? 85 : 58;
      dimensions.workflowBlocking = surgeryLinked ? 88 : 65;
      dimensions.urgency = item.severity === "critical" ? 85 : 58;
      dimensions.escalation = item.severity === "critical" ? 80 : 42;
      dimensions.timeSensitivity = surgeryLinked ? 70 : 45;
      reasons.push("Staff compliance needs attention");
      break;
    }

    case "consultation":
      dimensions.workflowBlocking = 58;
      dimensions.urgency = /in progress|awaiting closure|quoted/i.test(item.actionLabel) ? 62 : 48;
      dimensions.revenueImpact = /quoted|payment|quote/i.test(
        `${item.actionLabel} ${item.detailLine ?? ""}`
      )
        ? 68
        : 35;
      if (/quoted|payment/i.test(item.actionHint ?? "")) {
        reasons.push("Quote or payment follow-up");
      } else {
        reasons.push("Consultation next action");
      }
      break;

    case "task_due":
      dimensions.urgency = /overdue/i.test(item.detailLine ?? "") ? 75 : 52;
      dimensions.workflowBlocking = 55;
      dimensions.revenueImpact = 45;
      if (/overdue/i.test(item.detailLine ?? "")) reasons.push("Follow-up overdue");
      break;

    case "reminder":
      dimensions.clinicalRisk = /clinical/i.test(item.detailLine ?? "") ? 55 : 30;
      dimensions.urgency = 40;
      break;

    case "aggregate":
      dimensions.workflowBlocking = item.severity === "critical" ? 75 : 55;
      dimensions.urgency = item.severity === "critical" ? 70 : item.severity === "warning" ? 55 : 35;
      dimensions.revenueImpact = /payment|financial|clearance/i.test(item.actionLabel) ? 65 : 40;
      if (item.id.includes("surgery_readiness")) reasons.push("Blocking procedure readiness");
      if (item.id.includes("surgery_payment")) reasons.push("Revenue follow-up overdue");
      break;

    default:
      break;
  }

  dimensions.roleRelevance = roleRelevanceForSignal(kind, context.profileKey);

  if (item.severity === "critical" && dimensions.escalation < 70) {
    dimensions.escalation = 70;
  }

  return { dimensions, reasons };
}

function weightedPriorityScore(dimensions: TodayPriorityDimensions): number {
  let total = 0;
  for (const [key, weight] of Object.entries(TODAY_PRIORITY_WEIGHTS) as [
    TodayPriorityDimension,
    number,
  ][]) {
    total += dimensions[key] * weight;
  }
  return clampScore(total / 100);
}

export function classifyTodaySignalPriority(score: number): TodayPriorityBand {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function severityFromBand(
  currentSeverity: TodayFeedSeverity,
  band: TodayPriorityBand
): TodayFeedSeverity {
  const fromBand: TodayFeedSeverity =
    band === "critical" ? "critical" : band === "high" ? "warning" : "normal";
  return SEVERITY_RANK[currentSeverity] >= SEVERITY_RANK[fromBand]
    ? currentSeverity
    : fromBand;
}

export function scoreTodaySignalPriority(
  item: TodayFeedItem,
  context: TodaySignalPriorityContext = {}
): TodaySignalPriorityResult {
  const kind = inferTodaySignalKind(item);
  const { dimensions, reasons } = baseDimensionsForSignal(kind, item, context);
  const priorityScore = weightedPriorityScore(dimensions);
  const priorityBand = classifyTodaySignalPriority(priorityScore);
  const severity = severityFromBand(item.severity, priorityBand);

  return {
    priorityScore,
    priorityBand,
    priorityDimensions: dimensions,
    priorityReasons: reasons,
    severity,
  };
}

export function explainTodaySignalPriority(
  item: TodayFeedItem,
  context: TodaySignalPriorityContext = {}
): string[] {
  return scoreTodaySignalPriority(item, context).priorityReasons;
}

export function comparePrioritisedTodaySignals(
  a: TodayFeedItem,
  b: TodayFeedItem,
  _context: TodaySignalPriorityContext = {}
): number {
  const aNamed = a.personLabel.trim() ? 1 : 0;
  const bNamed = b.personLabel.trim() ? 1 : 0;
  if (aNamed !== bNamed) return bNamed - aNamed;

  const sevDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (sevDiff !== 0) return sevDiff;

  const scoreDiff = b.priorityScore - a.priorityScore;
  if (scoreDiff !== 0) return scoreDiff;

  return a.id.localeCompare(b.id);
}

export function applyTodaySignalPriority(
  items: readonly TodayFeedItem[],
  context: TodaySignalPriorityContext = {}
): TodayFeedItem[] {
  return items.map((item) => {
    const result = scoreTodaySignalPriority(item, context);
    return {
      ...item,
      priorityScore: result.priorityScore,
      severity: result.severity,
      priorityBand: result.priorityBand,
      priorityReasons: result.priorityReasons,
      priorityDimensions: result.priorityDimensions,
    } satisfies TodayFeedItem;
  });
}
