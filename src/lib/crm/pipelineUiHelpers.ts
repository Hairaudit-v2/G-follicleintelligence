/**
 * FI-UX-REBUILD-1 S4.3 — pure Pipeline UI display helpers (no loaders, no mutations).
 */

import {
  cardMatchesActivityFilter,
  cardMatchesAgeBucket,
} from "@/src/lib/crm/pipelineOperationsFilters";
import type {
  PipelineOpsActivityFilter,
  PipelineOpsAgeBucket,
} from "@/src/lib/crm/pipelineOperationsQuery";
import type {
  PipelineCardActionId,
  PipelineFilterOption,
  PipelineFilterOptions,
  PipelineFollowUpItem,
  PipelineFollowUpView,
  PipelineLeadCard,
  PipelinePresentation,
  PipelinePresentationColumn,
  PipelinePresentationSummary,
  PipelineStaffColumnId,
} from "@/src/lib/crm/pipelinePresentation.types";

export type PipelineWorkspaceView = "board" | "follow_ups" | "inactive_review";

export type PipelineActiveFilters = {
  staffColumnIds: PipelineStaffColumnId[];
  backendStageIds: string[];
  ownerIds: string[];
  sources: string[];
  urgency: string[];
  lifecycle: string[];
  assignedToMe: boolean;
  unassignedOnly: boolean;
  overdue: boolean;
  dueToday: boolean;
  consultationDue: boolean;
  highValue: boolean;
  followUpBucket: string | null;
  /** Lead age bucket (created_at). */
  ageBucket: string | null;
  /** Activity filter key from ops query. */
  activity: string | null;
  /** Single owner UUID (canonical). */
  ownerId: string | null;
  /** Source key. */
  sourceKey: string | null;
};

export function emptyPipelineActiveFilters(): PipelineActiveFilters {
  return {
    staffColumnIds: [],
    backendStageIds: [],
    ownerIds: [],
    sources: [],
    urgency: [],
    lifecycle: [],
    assignedToMe: false,
    unassignedOnly: false,
    overdue: false,
    dueToday: false,
    consultationDue: false,
    highValue: false,
    followUpBucket: null,
    ageBucket: null,
    activity: null,
    ownerId: null,
    sourceKey: null,
  };
}

export function pipelineCardActionLabel(id: PipelineCardActionId): string {
  switch (id) {
    case "contact":
      return "Contact";
    case "log_outcome":
      return "Log outcome";
    case "schedule_follow_up":
      return "Schedule follow-up";
    case "complete_follow_up":
      return "Complete follow-up";
    case "assign_owner":
      return "Assign owner";
    case "move_stage":
      return "Move stage";
    case "book_consultation":
      return "Book consultation";
    case "mark_lost":
      return "Mark lost";
    case "reopen":
      return "Reopen";
    case "convert":
      return "Convert";
    case "open_lead":
      return "Open lead";
    case "open_patient":
      return "Open patient";
    default:
      return "Action";
  }
}

export function isPipelineDestructiveAction(id: PipelineCardActionId): boolean {
  return id === "mark_lost" || id === "convert";
}

export function formatPipelineDueLabel(
  dueAtIso: string | null,
  overdue: boolean,
  nowMs: number
): string | null {
  if (!dueAtIso?.trim()) return null;
  const ms = Date.parse(dueAtIso);
  if (!Number.isFinite(ms)) return null;
  const day = new Date(ms).toISOString().slice(0, 10);
  if (overdue) return `Overdue · ${day}`;
  const today = new Date(nowMs).toISOString().slice(0, 10);
  if (day === today) return `Due today · ${day}`;
  return `Due ${day}`;
}

export function pipelineConsultationLabel(
  state: PipelineLeadCard["consultation"]["state"]
): string | null {
  switch (state) {
    case "booked":
      return "Consultation booked";
    case "due_today":
      return "Consultation today";
    case "completed":
      return "Consultation completed";
    case "cancelled":
      return "Consultation cancelled";
    case "no_show":
      return "Consultation no-show";
    default:
      return null;
  }
}

export function pipelineHiddenLeadsNotice(
  visible: number,
  source: number,
  hidden: number
): string | null {
  if (hidden <= 0) return null;
  return `Showing ${visible} of ${source} enquiries. Narrow the filters to see a smaller set.`;
}

export function countActivePipelineFilters(f: PipelineActiveFilters): number {
  let n = 0;
  n += f.staffColumnIds.length;
  n += f.backendStageIds.length;
  n += f.ownerIds.length;
  n += f.sources.length;
  n += f.urgency.length;
  n += f.lifecycle.length;
  if (f.assignedToMe) n += 1;
  if (f.unassignedOnly) n += 1;
  if (f.overdue) n += 1;
  if (f.dueToday) n += 1;
  if (f.consultationDue) n += 1;
  if (f.highValue) n += 1;
  if (f.followUpBucket) n += 1;
  if (f.ageBucket) n += 1;
  if (f.activity) n += 1;
  if (f.ownerId) n += 1;
  if (f.sourceKey) n += 1;
  return n;
}

/** Client-side filter over already-built presentation cards (does not re-derive business state). */
export function filterPipelineColumns(
  columns: readonly PipelinePresentationColumn[],
  filters: PipelineActiveFilters,
  nowMs: number = Date.now()
): PipelinePresentationColumn[] {
  return columns.map((col) => {
    if (filters.staffColumnIds.length > 0 && !filters.staffColumnIds.includes(col.id)) {
      return { ...col, cards: [], count: 0 };
    }
    const cards = col.cards.filter((card) => cardMatchesFilters(card, filters, nowMs));
    return { ...col, cards, count: cards.length };
  });
}

export function filterPipelineFollowUps(
  followUps: PipelineFollowUpView,
  filters: PipelineActiveFilters,
  cardsByLeadId: ReadonlyMap<string, PipelineLeadCard>
): PipelineFollowUpView {
  const filterItems = (items: readonly PipelineFollowUpItem[]) =>
    items.filter((item) => {
      if (filters.followUpBucket) {
        // bucket filter applied at higher level
      }
      if (filters.assignedToMe) {
        // Caller must pass current user; without it, skip this gate here
      }
      const card = cardsByLeadId.get(item.leadId);
      if (!card) return false;
      if (filters.sources.length > 0) {
        const key = card.source.key ? `source:${card.source.key}` : null;
        if (!key || !filters.sources.includes(key)) return false;
      }
      if (filters.ownerIds.length > 0) {
        const oid = card.owner.userId ? `owner:${card.owner.userId}` : "unassigned";
        if (
          !filters.ownerIds.includes(oid) &&
          !filters.ownerIds.includes(card.owner.userId ?? "")
        ) {
          return false;
        }
      }
      return true;
    });

  const overdue = filterItems(followUps.buckets.overdue);
  const dueToday = filterItems(followUps.buckets.dueToday);
  const upcoming = filterItems(followUps.buckets.upcoming);
  const noDueDate = filterItems(followUps.buckets.noDueDate);
  const completed = filterItems(followUps.buckets.completed);

  return {
    buckets: { overdue, dueToday, upcoming, noDueDate, completed },
    summary: {
      overdue: overdue.length,
      dueToday: dueToday.length,
      upcoming: upcoming.length,
      noDueDate: noDueDate.length,
    },
  };
}

function cardMatchesFilters(
  card: PipelineLeadCard,
  f: PipelineActiveFilters,
  nowMs: number = Date.now()
): boolean {
  if (f.unassignedOnly && !card.owner.unassigned) return false;
  if (f.overdue && card.followUps.overdueCount <= 0 && !card.nextAction.overdue) {
    return false;
  }
  if (f.dueToday && card.followUps.dueTodayCount <= 0) return false;
  if (
    f.consultationDue &&
    card.consultation.state !== "due_today" &&
    card.consultation.state !== "booked"
  ) {
    return false;
  }
  if (f.highValue && !card.score.highValue) return false;
  if (f.backendStageIds.length > 0) {
    const slug = card.stage.backendSlug;
    const id = slug ? `stage:${slug}` : null;
    if (!id || !f.backendStageIds.includes(id)) return false;
  }
  if (f.ownerIds.length > 0) {
    const oid = card.owner.userId ? `owner:${card.owner.userId}` : "unassigned";
    if (!f.ownerIds.includes(oid) && !f.ownerIds.includes("unassigned")) {
      return false;
    }
  }
  if (f.ownerId && (card.owner.userId ?? "") !== f.ownerId) return false;
  if (f.sourceKey) {
    const key = (card.source.key ?? "").toLowerCase();
    if (key !== f.sourceKey.toLowerCase()) return false;
  }
  if (f.sources.length > 0) {
    const key = card.source.key ? `source:${card.source.key}` : "source:unknown";
    if (!f.sources.includes(key)) return false;
  }
  if (f.urgency.length > 0) {
    if (!card.urgency.flags.some((flag) => f.urgency.includes(flag))) return false;
  }
  if (f.lifecycle.length > 0) {
    const life =
      card.lifecycle.state === "holding"
        ? "life:holding"
        : card.lifecycle.state === "converted" || card.lifecycle.state === "lost"
          ? "life:terminal"
          : "life:active";
    // Also accept staff-column ids in lifecycle chips
    const colLife = card.stage.staffColumnId;
    const ok =
      f.lifecycle.includes(life) ||
      f.lifecycle.includes(colLife) ||
      f.lifecycle.includes(`col:${colLife}`);
    if (!ok) return false;
  }
  if (f.ageBucket) {
    if (!cardMatchesAgeBucket(card, f.ageBucket as PipelineOpsAgeBucket, nowMs)) {
      return false;
    }
  }
  if (f.activity) {
    if (!cardMatchesActivityFilter(card, f.activity as PipelineOpsActivityFilter, nowMs)) {
      return false;
    }
  }
  return true;
}

export function buildLeadCardMap(
  presentation: PipelinePresentation
): Map<string, PipelineLeadCard> {
  const m = new Map<string, PipelineLeadCard>();
  for (const col of presentation.columns) {
    for (const c of col.cards) m.set(c.leadId, c);
  }
  return m;
}

export function pipelineSummaryTiles(
  summary: PipelinePresentationSummary
): Array<{ id: string; label: string; value: number }> {
  return [
    { id: "visible", label: "Visible", value: summary.totalLeads },
    { id: "active", label: "Active", value: summary.active },
    { id: "holding", label: "Holding", value: summary.holding },
    { id: "converted", label: "Converted", value: summary.converted },
    { id: "lost", label: "Lost", value: summary.lost },
    { id: "unassigned", label: "Unassigned", value: summary.unassigned },
    { id: "overdue", label: "Overdue", value: summary.overdueFollowUps },
    { id: "due_today", label: "Due today", value: summary.dueTodayFollowUps },
  ];
}

export function filterOptionToggle(
  options: readonly PipelineFilterOption[],
  activeIds: readonly string[],
  optionId: string
): string[] {
  if (activeIds.includes(optionId)) {
    return activeIds.filter((id) => id !== optionId);
  }
  return [...activeIds, optionId];
}

/** Ensure presentation filter labels stay free of banned staff terms (display guard). */
export function assertStaffSafePipelineLabel(label: string): string {
  return label
    .replace(/\bLeadFlow\b/gi, "Pipeline")
    .replace(/\bCRM\b/g, "Pipeline")
    .replace(/\bKanban\b/gi, "Board");
}

export function mergeFilterOptionsForDisplay(
  filters: PipelineFilterOptions
): PipelineFilterOptions {
  return {
    ...filters,
    staffColumns: filters.staffColumns.map((o) => ({
      ...o,
      label: assertStaffSafePipelineLabel(o.label),
    })),
    backendStages: filters.backendStages.map((o) => ({
      ...o,
      label: assertStaffSafePipelineLabel(o.label),
    })),
  };
}
