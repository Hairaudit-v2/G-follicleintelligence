/**
 * FI-UX-REBUILD-1 S4.2 — pure Pipeline presentation builder.
 *
 * One card per leadId (mint from canonical leads only). Enrichment never mints cards.
 * S4.1 owns stage crosswalk, lifecycle, urgency type boundary, and base sort.
 */

import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { groupCrmTasksByBuckets } from "@/src/lib/crm/crmTaskBuckets";
import type { CrmKanbanLeadCard, FiCrmTaskRow } from "@/src/lib/crm/types";
import {
  PIPELINE_STAFF_COLUMNS,
  PIPELINE_STAFF_COLUMN_ORDER,
  comparePipelineSortableLeads,
  getPipelineStaffColumn,
  resolvePipelineLeadLifecycle,
  resolvePipelineStaffStage,
  type PipelineSortableLead,
  type PipelineStageDefinition,
  type PipelineStaffColumnId,
  type PipelineUrgencyFlag,
} from "@/src/lib/crm/pipelineStaffModel";
import {
  compareMostRecentlyLost,
  compareNewColumnDefault,
  maxMeaningfulActivityIso,
  pipelineCardToOpsSortable,
} from "@/src/lib/crm/pipelineOperationsSort";
import type {
  PipelineCardActionId,
  PipelineCardBlocker,
  PipelineCommunicationHintInput,
  PipelineConsultationInput,
  PipelineConsultationState,
  PipelineFilterOptions,
  PipelineFollowUpItem,
  PipelineFollowUpView,
  PipelineGlobalAction,
  PipelineLeadCard,
  PipelinePresentation,
  PipelinePresentationColumn,
  PipelinePresentationDiagnostics,
  PipelinePresentationPermissions,
  PipelinePresentationSummary,
  PipelineReminderInput,
  PipelineTaskInput,
  PipelineUrgencyLevel,
} from "@/src/lib/crm/pipelinePresentation.types";

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export type BuildPipelinePresentationInput = {
  leads: readonly CrmKanbanLeadCard[];
  tasksByLeadId?: ReadonlyMap<string, readonly PipelineTaskInput[]>;
  communicationsByLeadId?: ReadonlyMap<string, readonly PipelineCommunicationHintInput[]>;
  consultationsByLeadId?: ReadonlyMap<string, readonly PipelineConsultationInput[]>;
  reminderJobsByLeadId?: ReadonlyMap<string, readonly PipelineReminderInput[]>;
  nowMs: number;
  base: string;
  permissions: PipelinePresentationPermissions;
  /** Board loader total (may exceed leads.length when truncated). */
  sourceTotal?: number;
};

export function buildPipelinePresentation(
  input: BuildPipelinePresentationInput
): PipelinePresentation {
  const nowMs = input.nowMs;
  const now = new Date(nowMs);
  const base = normalizeBase(input.base);
  const perms = input.permissions;
  const loadTier = detectLoadTier(input);

  const { cardsById, duplicateLeadIds, uniqueSourceCount, createdAtByLeadId } =
    mintCanonicalCards(input.leads, base, nowMs);

  const orphanTaskIds: string[] = [];
  const allTasksForBuckets: PipelineTaskInput[] = [];

  if (input.tasksByLeadId) {
    for (const [leadId, tasks] of input.tasksByLeadId) {
      if (!cardsById.has(leadId)) {
        for (const t of dedupeTasks(tasks)) orphanTaskIds.push(t.taskId);
        continue;
      }
      for (const t of dedupeTasks(tasks)) {
        if (t.leadId && t.leadId !== leadId) {
          // mismatched leadId on task — treat as orphan if not mapped
        }
        allTasksForBuckets.push({ ...t, leadId });
      }
    }
  }

  // Enrichment for non-archived and archived cards (still build full card data)
  for (const [leadId, card] of cardsById) {
    const tasks = input.tasksByLeadId?.get(leadId) ?? [];
    const comms = input.communicationsByLeadId?.get(leadId) ?? [];
    const consults = input.consultationsByLeadId?.get(leadId) ?? [];
    const reminders = input.reminderJobsByLeadId?.get(leadId) ?? [];

    const dedupedTasks = dedupeTasks(tasks);
    const shellOnly = loadTier === "shell";

    if (!shellOnly) {
      enrichFollowUpCounts(card, dedupedTasks, nowMs);
      enrichNextAction(card, dedupedTasks, consults, reminders, comms, nowMs);
      enrichConsultation(card, consults, nowMs);
      enrichMeaningfulActivity(card, dedupedTasks, consults, comms);
    } else {
      // Shell: cheap overdue count from kanban aggregate only — no claimed due date
      const kanban = findKanbanLead(input.leads, leadId);
      if (kanban) {
        card.followUps.overdueCount = kanban.overdueTaskCount ?? 0;
        // Shell activity: lead timestamps + kanban lastActivity only (no passive refresh)
        card.timestamps.meaningfulActivityAtIso = maxMeaningfulActivityIso([
          card.timestamps.updatedAtIso,
          kanban.lastActivityAtIso,
        ]);
      }
      card.nextAction = {
        kind: "none",
        label: "Open lead for next action",
        dueAtIso: null,
        overdue: false,
        sourceId: null,
      };
    }

    enrichUrgencyAndBlockers(card, loadTier, nowMs);
    assignCardActions(card, perms);
  }

  // Collect conversion inconsistencies + unknown stages
  const unknownStageLeadIds: string[] = [];
  const conversionInconsistencies: Array<{ leadId: string; kind: string }> = [];
  for (const card of cardsById.values()) {
    if (
      card.stage.backendSlug &&
      resolvePipelineStaffStage(
        stageDefFromSlug(card.stage.backendSlug, card.stage.backendLabel)
      ).source === "fallback"
    ) {
      unknownStageLeadIds.push(card.leadId);
    }
    for (const code of card.lifecycle.warningCodes) {
      conversionInconsistencies.push({ leadId: card.leadId, kind: code });
    }
  }

  // Column placement: archived excluded from default board columns
  const columnBuckets = new Map<PipelineStaffColumnId, PipelineLeadCard[]>();
  for (const id of PIPELINE_STAFF_COLUMN_ORDER) columnBuckets.set(id, []);

  let archivedCount = 0;
  for (const card of cardsById.values()) {
    if (card.lifecycle.state === "archived") {
      archivedCount += 1;
      continue;
    }
    columnBuckets.get(card.stage.staffColumnId)?.push(card);
  }

  // Sort cards within columns (ops defaults: New = newest; Lost = most recently lost)
  for (const id of PIPELINE_STAFF_COLUMN_ORDER) {
    const list = columnBuckets.get(id) ?? [];
    const def = getPipelineStaffColumn(id);
    if (id === "new") {
      // created_at DESC → updated_at DESC → lead_id ASC
      list.sort((a, b) =>
        compareNewColumnDefault(pipelineCardToOpsSortable(a), pipelineCardToOpsSortable(b))
      );
    } else if (def?.lifecycle === "terminal_lost") {
      list.sort((a, b) =>
        compareMostRecentlyLost(pipelineCardToOpsSortable(a), pipelineCardToOpsSortable(b))
      );
    } else if (def?.lifecycle === "terminal_won") {
      list.sort(compareTerminalCards);
    } else {
      // Other active/holding: operational urgency ordering
      list.sort((a, b) =>
        comparePipelineSortableLeads(
          toSortable(a, createdAtByLeadId.get(a.leadId) ?? a.timestamps.createdAtIso),
          toSortable(b, createdAtByLeadId.get(b.leadId) ?? b.timestamps.createdAtIso)
        )
      );
    }
    columnBuckets.set(id, list);
  }

  const columns: PipelinePresentationColumn[] = PIPELINE_STAFF_COLUMNS.map((col) => {
    const cards = columnBuckets.get(col.id) ?? [];
    return {
      id: col.id,
      label: col.label,
      kind: col.lifecycle,
      cards,
      count: cards.length,
      collapsedByDefault:
        col.lifecycle === "terminal_won" ||
        col.lifecycle === "terminal_lost" ||
        col.lifecycle === "holding",
    };
  });

  const visibleLeadCount = columns.reduce((n, c) => n + c.count, 0);
  const sourceLeadCount =
    typeof input.sourceTotal === "number" && Number.isFinite(input.sourceTotal)
      ? Math.max(0, Math.floor(input.sourceTotal))
      : uniqueSourceCount;
  const hiddenLeadCount = Math.max(0, sourceLeadCount - uniqueSourceCount);

  const followUps = buildFollowUpsView({
    tasks: allTasksForBuckets,
    cardsById,
    permissions: perms,
    now,
    completedCap: 50,
  });

  const summary = buildSummary(columns, cardsById, archivedCount, followUps);
  const filters = buildFilters(columns, cardsById);
  const actions = buildGlobalActions(base, perms);

  const diagnostics: PipelinePresentationDiagnostics = {
    sourceLeadCount,
    visibleLeadCount,
    hiddenLeadCount,
    duplicateLeadIds: uniqueSorted(duplicateLeadIds),
    orphanTaskIds: uniqueSorted(orphanTaskIds),
    unknownStageLeadIds: uniqueSorted(unknownStageLeadIds),
    conversionInconsistencies: conversionInconsistencies
      .slice()
      .sort((a, b) =>
        a.leadId === b.leadId
          ? a.kind.localeCompare(b.kind)
          : a.leadId.localeCompare(b.leadId)
      ),
  };

  return {
    generatedAt: new Date(nowMs).toISOString(),
    loadTier,
    columns,
    followUps,
    summary,
    filters,
    actions,
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Mint + dedupe
// ---------------------------------------------------------------------------

function mintCanonicalCards(
  leads: readonly CrmKanbanLeadCard[],
  base: string,
  nowMs: number
): {
  cardsById: Map<string, PipelineLeadCard>;
  duplicateLeadIds: string[];
  uniqueSourceCount: number;
  createdAtByLeadId: Map<string, string | null>;
} {
  const winners = new Map<string, CrmKanbanLeadCard>();
  const duplicateLeadIds: string[] = [];
  const seenDup = new Set<string>();

  for (const row of leads) {
    const id = row.lead?.id?.trim();
    if (!id) continue;
    const existing = winners.get(id);
    if (!existing) {
      winners.set(id, row);
      continue;
    }
    if (!seenDup.has(id)) {
      duplicateLeadIds.push(id);
      seenDup.add(id);
    }
    if (preferKanbanWinner(row, existing) < 0) {
      winners.set(id, row);
    }
  }

  const cardsById = new Map<string, PipelineLeadCard>();
  const createdAtByLeadId = new Map<string, string | null>();
  for (const [id, row] of winners) {
    cardsById.set(id, buildBaseCard(row, base, nowMs));
    createdAtByLeadId.set(id, row.lead.created_at ?? null);
  }

  return {
    cardsById,
    duplicateLeadIds,
    uniqueSourceCount: winners.size,
    createdAtByLeadId,
  };
}

/**
 * Duplicate winner: newer updated_at wins; then newer created_at; then newer
 * lastActivityAtIso; then higher overdueTaskCount; never "last input wins".
 * Returns negative if a should replace b.
 */
function preferKanbanWinner(a: CrmKanbanLeadCard, b: CrmKanbanLeadCard): number {
  const ua = parseMs(a.lead.updated_at);
  const ub = parseMs(b.lead.updated_at);
  if (ua != null && ub != null && ua !== ub) return ub - ua; // prefer higher updated → a wins if ua > ub → return negative when a newer
  // Wait: if a is newer (ua > ub), we want a to win → return negative
  // ub - ua is negative when ua > ub. Good.

  const ca = parseMs(a.lead.created_at);
  const cb = parseMs(b.lead.created_at);
  if (ca != null && cb != null && ca !== cb) return cb - ca;

  const la = parseMs(a.lastActivityAtIso);
  const lb = parseMs(b.lastActivityAtIso);
  if (la != null && lb != null && la !== lb) return lb - la;

  if (a.overdueTaskCount !== b.overdueTaskCount) {
    return b.overdueTaskCount - a.overdueTaskCount;
  }

  // Deterministic tie: stage slug, then stable string of status
  const sa = a.stage?.slug ?? "";
  const sb = b.stage?.slug ?? "";
  if (sa !== sb) return sa.localeCompare(sb);

  const sta = a.lead.status ?? "";
  const stb = b.lead.status ?? "";
  return sta.localeCompare(stb);
}

function buildBaseCard(
  row: CrmKanbanLeadCard,
  base: string,
  _nowMs: number
): PipelineLeadCard {
  const lead = row.lead;
  const leadId = lead.id.trim();
  const personMeta = (row.person?.metadata ?? {}) as Record<string, unknown>;
  const displayName = personMetadataDisplayLabel(row.person?.metadata ?? null);
  const contactBits = contactFromPersonMeta(personMeta);

  const stageSlug = row.stage?.slug?.trim() || null;
  const stageDef = stageDefFromSlug(stageSlug, row.stage?.label ?? null);
  const resolved = resolvePipelineStaffStage(stageDef);
  const staffCol = getPipelineStaffColumn(resolved.columnId);

  const archived = (lead.status ?? "").toLowerCase() === "archived";
  const life = resolvePipelineLeadLifecycle({
    status: lead.status,
    columnId: resolved.columnId,
    convertedAtIso: lead.converted_at,
    patientId: lead.patient_id ?? row.patient?.id ?? null,
    archived,
  });

  const patientId = lead.patient_id ?? row.patient?.id ?? null;
  const ownerId = lead.primary_owner_user_id?.trim() || null;
  const ownerEmail = row.owner?.email?.trim() || null;
  const source = sourceFromLeadMeta(lead.metadata as Record<string, unknown>);
  const lostReason = lostReasonFromMeta(lead.metadata as Record<string, unknown>);

  const conversionState: PipelineLeadCard["conversion"]["state"] =
    life.state === "converted" || life.state === "lost" || life.state === "archived"
      ? life.state
      : "active";

  const createdAtIso = lead.created_at?.trim() || null;
  const updatedAtIso = lead.updated_at?.trim() || null;
  const stageEnteredAtIso = row.stageEnteredAtIso?.trim() || null;
  const lastActivityAtIso = row.lastActivityAtIso?.trim() || null;
  // Lost: prefer metadata lost_at, else stage enter for closed_lost, else updated
  const metaLostAt = lostAtFromMeta(lead.metadata as Record<string, unknown>);
  const lostAtIso =
    life.state === "lost" || resolved.columnId === "closed_lost"
      ? metaLostAt ?? stageEnteredAtIso ?? updatedAtIso
      : metaLostAt;

  return {
    leadId,
    person: {
      personId: row.person?.id ?? lead.person_id ?? null,
      displayName: displayName === "—" ? leadTitleFallback(lead.summary, leadId) : displayName,
      patientId,
    },
    contact: contactBits,
    owner: {
      userId: ownerId,
      displayName: ownerId ? ownerEmail : null,
      unassigned: !ownerId,
    },
    source,
    stage: {
      backendStageId: row.stage?.id ?? lead.current_stage_id ?? null,
      backendSlug: stageSlug,
      backendLabel: row.stage?.label ?? null,
      staffColumnId: resolved.columnId,
      staffColumnLabel: staffCol?.label ?? resolved.columnId,
      daysInStage: row.daysInStage,
    },
    lifecycle: {
      state: life.state,
      warningCodes: life.warningCodes.map(String),
    },
    urgency: { flags: [], highest: null, primaryLabel: null },
    nextAction: {
      kind: "none",
      label: "No open tasks or upcoming visits",
      dueAtIso: null,
      overdue: false,
      sourceId: null,
    },
    followUps: {
      openCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      nextTaskId: null,
    },
    consultation: {
      state: "none",
      nextBookingId: null,
      nextBookingAtIso: null,
      lastConsultationId: null,
    },
    conversion: {
      state: conversionState,
      convertedAtIso: lead.converted_at,
      patientId,
      lostReason,
    },
    timestamps: {
      createdAtIso,
      updatedAtIso,
      meaningfulActivityAtIso: maxMeaningfulActivityIso([updatedAtIso, lastActivityAtIso]),
      stageEnteredAtIso,
      lostAtIso,
    },
    score: {
      value: null,
      highValue: Boolean(row.isHighValue),
    },
    blockers: [],
    primaryAction: null,
    secondaryActions: [],
    links: {
      lead: `${base}/crm/leads/${leadId}`,
      patient: patientId ? `${base}/patients/${patientId}` : null,
      calendar: `${base}/calendar`,
      consultation: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Stage adapter
// ---------------------------------------------------------------------------

function stageDefFromSlug(
  slug: string | null,
  label: string | null
): PipelineStageDefinition | null {
  if (!slug?.trim()) return null;
  const s = slug.trim().toLowerCase();
  return {
    slug: s,
    label: label?.trim() || s,
    sortOrder: 0,
    isEntry: s === "new",
    isWon: s === "won_closed",
    isLost: s === "lost",
  };
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

function enrichFollowUpCounts(
  card: PipelineLeadCard,
  tasks: readonly PipelineTaskInput[],
  nowMs: number
): void {
  const now = new Date(nowMs);
  const rows = tasksToFiRows(tasks, card.leadId);
  const buckets = groupCrmTasksByBuckets(rows, now);
  const open =
    buckets.overdue.length +
    buckets.due_today.length +
    buckets.upcoming.length +
    buckets.no_due.length;
  card.followUps = {
    openCount: open,
    overdueCount: buckets.overdue.length,
    dueTodayCount: buckets.due_today.length,
    nextTaskId: null,
  };
}

function enrichNextAction(
  card: PipelineLeadCard,
  tasks: readonly PipelineTaskInput[],
  consults: readonly PipelineConsultationInput[],
  reminders: readonly PipelineReminderInput[],
  comms: readonly PipelineCommunicationHintInput[],
  nowMs: number
): void {
  const open = tasks.filter((t) => !t.completedAtIso);
  const withDue = open
    .filter((t) => parseMs(t.dueAtIso) != null)
    .sort((a, b) => {
      const da = parseMs(a.dueAtIso)!;
      const db = parseMs(b.dueAtIso)!;
      if (da !== db) return da - db;
      return a.taskId.localeCompare(b.taskId);
    });

  if (withDue[0]) {
    const t = withDue[0];
    const dueMs = parseMs(t.dueAtIso)!;
    card.nextAction = {
      kind: "task",
      label: t.title || "Follow-up",
      dueAtIso: t.dueAtIso,
      overdue: dueMs < startOfUtcDayMs(nowMs),
      sourceId: t.taskId,
    };
    card.followUps.nextTaskId = t.taskId;
    return;
  }

  // Match deriveCrmLeadNextAction: booking before undated task
  const futureBooking = pickFutureActiveConsultation(consults, nowMs);
  if (futureBooking) {
    card.nextAction = {
      kind: "appointment",
      label: "Upcoming consultation",
      dueAtIso: futureBooking.startAtIso,
      overdue: false,
      sourceId: futureBooking.bookingId,
    };
    return;
  }

  const undated = open
    .filter((t) => parseMs(t.dueAtIso) == null)
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
  if (undated[0]) {
    card.nextAction = {
      kind: "task_no_date",
      label: undated[0].title || "Follow-up",
      dueAtIso: null,
      overdue: false,
      sourceId: undated[0].taskId,
    };
    card.followUps.nextTaskId = undated[0].taskId;
    return;
  }

  const rem = reminders
    .filter((r) => (r.status ?? "").toLowerCase() === "pending")
    .filter((r) => {
      const t = parseMs(r.scheduledAtIso);
      return t != null && t >= nowMs - 120_000;
    })
    .sort((a, b) => {
      const da = parseMs(a.scheduledAtIso)!;
      const db = parseMs(b.scheduledAtIso)!;
      if (da !== db) return da - db;
      return a.reminderId.localeCompare(b.reminderId);
    });
  if (rem[0]) {
    card.nextAction = {
      kind: "reminder",
      label: rem[0].label?.trim() || "Scheduled reminder",
      dueAtIso: rem[0].scheduledAtIso,
      overdue: false,
      sourceId: rem[0].reminderId,
    };
    return;
  }

  const hint = pickCommunicationHint(comms, nowMs);
  if (hint) {
    const dueMs = parseMs(hint.nextFollowUpAtIso);
    card.nextAction = {
      kind: "communication_hint",
      label: "Follow-up suggested",
      dueAtIso: hint.nextFollowUpAtIso,
      overdue: dueMs != null && dueMs < startOfUtcDayMs(nowMs),
      sourceId: hint.communicationId,
    };
    return;
  }

  card.nextAction = {
    kind: "none",
    label: "No open tasks or upcoming visits",
    dueAtIso: null,
    overdue: false,
    sourceId: null,
  };
}

function enrichConsultation(
  card: PipelineLeadCard,
  consults: readonly PipelineConsultationInput[],
  nowMs: number
): void {
  const summary = resolveConsultationSummary(consults, nowMs);
  card.consultation = summary;
  if (summary.nextBookingId) {
    card.links.consultation = `${card.links.calendar}?bookingId=${encodeURIComponent(summary.nextBookingId)}`;
  } else if (summary.lastConsultationId) {
    card.links.consultation = null;
  }
}

export function resolveConsultationSummary(
  consults: readonly PipelineConsultationInput[],
  nowMs: number
): PipelineLeadCard["consultation"] {
  const dayStart = startOfUtcDayMs(nowMs);
  const activeStatuses = new Set(["scheduled", "confirmed", "arrived"]);

  const valid = consults
    .map((c) => ({ c, ms: parseMs(c.startAtIso) }))
    .filter((x): x is { c: PipelineConsultationInput; ms: number } => x.ms != null);

  const futureActive = valid
    .filter(({ c, ms }) => {
      if (c.cancelledAtIso) return false;
      const st = (c.status ?? "").toLowerCase();
      if (!activeStatuses.has(st)) return false;
      return ms >= dayStart;
    })
    .sort((a, b) => a.ms - b.ms || a.c.bookingId.localeCompare(b.c.bookingId));

  const lastCompleted = valid
    .filter(({ c }) => (c.status ?? "").toLowerCase() === "completed")
    .sort((a, b) => b.ms - a.ms || a.c.bookingId.localeCompare(b.c.bookingId))[0];

  if (futureActive[0]) {
    const f = futureActive[0];
    const onToday = utcYmd(f.ms) === utcYmd(nowMs);
    return {
      state: onToday ? "due_today" : "booked",
      nextBookingId: f.c.bookingId,
      nextBookingAtIso: f.c.startAtIso,
      lastConsultationId:
        f.c.consultationId ?? lastCompleted?.c.consultationId ?? lastCompleted?.c.bookingId ?? null,
    };
  }

  const terminals = valid
    .filter(({ c }) => {
      const st = (c.status ?? "").toLowerCase();
      return (
        st === "completed" ||
        st === "no_show" ||
        st === "cancelled" ||
        Boolean(c.cancelledAtIso)
      );
    })
    .sort((a, b) => b.ms - a.ms || a.c.bookingId.localeCompare(b.c.bookingId));

  if (terminals[0]) {
    const t = terminals[0];
    const st = (t.c.status ?? "").toLowerCase();
    let state: PipelineConsultationState = "cancelled";
    if (st === "completed") state = "completed";
    else if (st === "no_show") state = "no_show";
    else state = "cancelled";
    return {
      state,
      nextBookingId: null,
      nextBookingAtIso: null,
      lastConsultationId: t.c.consultationId ?? t.c.bookingId,
    };
  }

  return {
    state: "none",
    nextBookingId: null,
    nextBookingAtIso: null,
    lastConsultationId: null,
  };
}

// ---------------------------------------------------------------------------
// Urgency + blockers
// ---------------------------------------------------------------------------

const URGENCY_LABEL: Record<PipelineUrgencyFlag, string> = {
  blocked: "Blocked",
  overdue_follow_up: "Overdue follow-up",
  due_today: "Due today",
  untouched_new: "New, not contacted",
  unassigned: "Unassigned",
  stale: "Stale",
  consultation_due: "Consultation due",
  consultation_no_show: "Consultation no-show",
  high_value: "High value",
};

const URGENCY_LEVEL: Record<PipelineUrgencyFlag, PipelineUrgencyLevel> = {
  blocked: "blocker",
  overdue_follow_up: "action_needed",
  due_today: "action_needed",
  untouched_new: "action_needed",
  unassigned: "action_needed",
  stale: "information",
  consultation_due: "information",
  consultation_no_show: "action_needed",
  high_value: "information",
};

/** Flag priority for primaryLabel ties (matches S4.1 sort ranks + remaining). */
const FLAG_PRIMARY_ORDER: readonly PipelineUrgencyFlag[] = [
  "blocked",
  "overdue_follow_up",
  "due_today",
  "untouched_new",
  "consultation_no_show",
  "consultation_due",
  "unassigned",
  "stale",
  "high_value",
];

const BLOCKER_KIND_ORDER = [
  "no_contact",
  "no_owner",
  "overdue_follow_up",
  "consultation_no_show",
  "missing_next_action",
  "lifecycle_inconsistency",
  "duplicate_external_identity",
] as const;

function enrichUrgencyAndBlockers(
  card: PipelineLeadCard,
  loadTier: "shell" | "full",
  _nowMs: number
): void {
  const terminal =
    card.lifecycle.state === "converted" ||
    card.lifecycle.state === "lost" ||
    card.lifecycle.state === "archived";

  const blockers: PipelineCardBlocker[] = [];
  const leadHref = card.links.lead;

  if (!card.contact.hasEmail && !card.contact.hasPhone) {
    blockers.push({
      id: `${card.leadId}:no_contact`,
      kind: "no_contact",
      label: "No contact details",
      severity: "blocker",
      href: leadHref,
    });
  }
  if (card.owner.unassigned && !terminal) {
    blockers.push({
      id: `${card.leadId}:no_owner`,
      kind: "no_owner",
      label: "No owner",
      severity: "action_needed",
      href: leadHref,
    });
  }
  if (card.followUps.overdueCount > 0 && !terminal) {
    blockers.push({
      id: `${card.leadId}:overdue_follow_up`,
      kind: "overdue_follow_up",
      label: "Overdue follow-up",
      severity: "action_needed",
      href: leadHref,
    });
  }
  if (card.consultation.state === "no_show" && !terminal) {
    blockers.push({
      id: `${card.leadId}:consultation_no_show`,
      kind: "consultation_no_show",
      label: "Consultation no-show",
      severity: "action_needed",
      href: leadHref,
    });
  }
  if (
    loadTier === "full" &&
    card.nextAction.kind === "none" &&
    !terminal &&
    card.lifecycle.state === "active"
  ) {
    blockers.push({
      id: `${card.leadId}:missing_next_action`,
      kind: "missing_next_action",
      label: "Missing next action",
      severity: "information",
      href: leadHref,
    });
  }
  if (card.lifecycle.warningCodes.length > 0) {
    blockers.push({
      id: `${card.leadId}:lifecycle_inconsistency`,
      kind: "lifecycle_inconsistency",
      label: "Lifecycle needs review",
      severity: "action_needed",
      href: leadHref,
    });
  }

  blockers.sort(compareBlockers);
  card.blockers = blockers;

  if (terminal) {
    card.urgency = { flags: [], highest: null, primaryLabel: null };
    return;
  }

  const flags = new Set<PipelineUrgencyFlag>();
  if (blockers.some((b) => b.severity === "blocker")) flags.add("blocked");
  if (card.followUps.overdueCount > 0 || card.nextAction.overdue) {
    flags.add("overdue_follow_up");
  }
  if (card.followUps.dueTodayCount > 0) flags.add("due_today");
  if (card.owner.unassigned) flags.add("unassigned");
  if (card.score.highValue) flags.add("high_value");
  if (
    card.consultation.state === "due_today" ||
    card.consultation.state === "booked"
  ) {
    flags.add("consultation_due");
  }
  if (card.consultation.state === "no_show") flags.add("consultation_no_show");

  // untouched_new / stale: no canonical threshold in S4.1 pure model — deferred
  // unless stage is new and daysInStage is available we still omit inventing days threshold

  const flagList = FLAG_PRIMARY_ORDER.filter((f) => flags.has(f));
  let highest: PipelineUrgencyLevel | null = null;
  let primaryLabel: string | null = null;
  for (const f of flagList) {
    const level = URGENCY_LEVEL[f];
    if (
      !highest ||
      severityRank(level) < severityRank(highest)
    ) {
      highest = level;
      primaryLabel = URGENCY_LABEL[f];
    }
  }
  // if blockers have higher severity
  if (blockers[0]) {
    const bLevel = blockers[0].severity;
    if (!highest || severityRank(bLevel) < severityRank(highest)) {
      highest = bLevel;
      primaryLabel = blockers[0].label;
    }
  }

  card.urgency = {
    flags: flagList,
    highest,
    primaryLabel,
  };
}

function compareBlockers(a: PipelineCardBlocker, b: PipelineCardBlocker): number {
  const sr = severityRank(a.severity) - severityRank(b.severity);
  if (sr !== 0) return sr;
  const ia = BLOCKER_KIND_ORDER.indexOf(a.kind as (typeof BLOCKER_KIND_ORDER)[number]);
  const ib = BLOCKER_KIND_ORDER.indexOf(b.kind as (typeof BLOCKER_KIND_ORDER)[number]);
  const oa = ia === -1 ? 999 : ia;
  const ob = ib === -1 ? 999 : ib;
  if (oa !== ob) return oa - ob;
  return a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
}

function severityRank(s: PipelineUrgencyLevel): number {
  if (s === "blocker") return 0;
  if (s === "action_needed") return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function assignCardActions(
  card: PipelineLeadCard,
  perms: PipelinePresentationPermissions
): void {
  const nav: PipelineCardActionId[] = ["open_lead"];
  if (card.person.patientId || card.conversion.patientId) {
    nav.push("open_patient");
  }

  if (!perms.canMutate) {
    card.primaryAction = "open_lead";
    card.secondaryActions = nav.filter((a) => a !== "open_lead");
    return;
  }

  const life = card.lifecycle.state;
  const inconsistentTerminal =
    card.lifecycle.warningCodes.length > 0 &&
    (life === "converted" || life === "lost");

  const mut: PipelineCardActionId[] = [];

  if (life === "active" || life === "holding") {
    mut.push("contact", "log_outcome", "schedule_follow_up");
    if (card.followUps.openCount > 0 || card.followUps.nextTaskId) {
      mut.push("complete_follow_up");
    }
    mut.push("assign_owner", "move_stage");
    if (perms.canBookConsultation !== false) {
      mut.push("book_consultation");
    }
    mut.push("mark_lost");
    if (perms.canConvert && life === "active" && !inconsistentTerminal) {
      mut.push("convert");
    }
  } else if (life === "lost") {
    mut.push("reopen");
  } else if (life === "converted") {
    // suppress convert; allow open patient if linked
  } else if (life === "archived") {
    // navigation only for archived
    card.primaryAction = "open_lead";
    card.secondaryActions = nav.filter((a) => a !== "open_lead");
    return;
  }

  // Suppress risky actions on inconsistent records
  if (life === "converted" || card.conversion.state === "converted") {
    const filtered = mut.filter((a) => a !== "convert");
    mut.length = 0;
    mut.push(...filtered);
  }
  if (inconsistentTerminal && life === "lost") {
    mut.length = 0;
    mut.push("reopen");
  }

  const all = [...mut, ...nav];
  const unique = [...new Set(all)];
  card.primaryAction = unique[0] ?? "open_lead";
  card.secondaryActions = unique.slice(1);
}

// ---------------------------------------------------------------------------
// Follow-ups view
// ---------------------------------------------------------------------------

function buildFollowUpsView(opts: {
  tasks: readonly PipelineTaskInput[];
  cardsById: Map<string, PipelineLeadCard>;
  permissions: PipelinePresentationPermissions;
  now: Date;
  completedCap: number;
}): PipelineFollowUpView {
  const deduped = dedupeTasks(opts.tasks).filter((t) => opts.cardsById.has(t.leadId));
  const rows = tasksToFiRows(deduped, null);
  const grouped = groupCrmTasksByBuckets(rows, opts.now);

  const taskById = new Map(deduped.map((t) => [t.taskId, t]));

  const mapBucket = (list: FiCrmTaskRow[]): PipelineFollowUpItem[] => {
    const items = list
      .map((r) => {
        const t = taskById.get(r.id);
        if (!t) return null;
        const card = opts.cardsById.get(t.leadId);
        if (!card) return null;
        return toFollowUpItem(t, card, opts.permissions);
      })
      .filter((x): x is PipelineFollowUpItem => x != null);
    items.sort((a, b) => {
      const da = parseMs(a.dueAtIso) ?? Number.POSITIVE_INFINITY;
      const db = parseMs(b.dueAtIso) ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.taskId.localeCompare(b.taskId);
    });
    return items;
  };

  let completed = mapBucket(grouped.completed);
  if (completed.length > opts.completedCap) {
    completed = completed.slice(0, opts.completedCap);
  }

  const overdue = mapBucket(grouped.overdue);
  const dueToday = mapBucket(grouped.due_today);
  const upcoming = mapBucket(grouped.upcoming);
  const noDueDate = mapBucket(grouped.no_due);

  return {
    buckets: {
      overdue,
      dueToday,
      upcoming,
      noDueDate,
      completed,
    },
    summary: {
      overdue: overdue.length,
      dueToday: dueToday.length,
      upcoming: upcoming.length,
      noDueDate: noDueDate.length,
    },
  };
}

function toFollowUpItem(
  t: PipelineTaskInput,
  card: PipelineLeadCard,
  perms: PipelinePresentationPermissions
): PipelineFollowUpItem {
  const allowed: PipelineCardActionId[] = ["open_lead"];
  if (perms.canMutate && !t.completedAtIso) {
    allowed.unshift("complete_follow_up");
    allowed.push("contact");
  }
  return {
    taskId: t.taskId,
    leadId: t.leadId,
    personDisplayName: card.person.displayName,
    title: t.title,
    dueAtIso: t.dueAtIso,
    assignee: {
      userId: t.assigneeUserId,
      displayName: t.assigneeDisplayName ?? null,
    },
    status: t.status,
    contact: {
      hasEmail: card.contact.hasEmail,
      hasPhone: card.contact.hasPhone,
    },
    allowedActions: allowed,
    links: { lead: card.links.lead },
  };
}

// ---------------------------------------------------------------------------
// Summary + filters + global actions
// ---------------------------------------------------------------------------

function buildSummary(
  columns: PipelinePresentationColumn[],
  cardsById: Map<string, PipelineLeadCard>,
  archivedCount: number,
  followUps: PipelineFollowUpView
): PipelinePresentationSummary {
  const byColumn = {} as Record<PipelineStaffColumnId, number>;
  for (const id of PIPELINE_STAFF_COLUMN_ORDER) byColumn[id] = 0;

  let active = 0;
  let holding = 0;
  let converted = 0;
  let lost = 0;
  let unassigned = 0;
  let untouchedNew = 0;
  let totalVisible = 0;

  for (const col of columns) {
    byColumn[col.id] = col.count;
    totalVisible += col.count;
    for (const c of col.cards) {
      if (c.lifecycle.state === "active") active += 1;
      if (c.lifecycle.state === "holding") holding += 1;
      if (c.lifecycle.state === "converted") converted += 1;
      if (c.lifecycle.state === "lost") lost += 1;
      if (c.owner.unassigned) unassigned += 1;
      if (c.urgency.flags.includes("untouched_new")) untouchedNew += 1;
    }
  }

  // Also count archived from map (not in columns)
  for (const c of cardsById.values()) {
    if (c.lifecycle.state === "archived" && c.owner.unassigned) {
      // unassigned archived not counted in board unassigned
    }
  }

  return {
    totalLeads: totalVisible,
    active,
    holding,
    converted,
    lost,
    archived: archivedCount,
    unassigned,
    overdueFollowUps: followUps.summary.overdue,
    dueTodayFollowUps: followUps.summary.dueToday,
    untouchedNew,
    byColumn,
  };
}

function buildFilters(
  columns: PipelinePresentationColumn[],
  cardsById: Map<string, PipelineLeadCard>
): PipelineFilterOptions {
  const staffColumns = columns.map((c) => ({
    id: `col:${c.id}`,
    label: c.label,
    count: c.count,
  }));

  const stageCounts = new Map<string, { label: string; count: number }>();
  const ownerCounts = new Map<string, { label: string; count: number }>();
  const sourceCounts = new Map<string, { label: string; count: number }>();
  const urgencyCounts = new Map<string, number>();
  const lifeCounts = new Map<string, number>();

  for (const col of columns) {
    for (const card of col.cards) {
      const slug = card.stage.backendSlug ?? "unknown";
      const st = stageCounts.get(slug) ?? {
        label: card.stage.backendLabel ?? slug,
        count: 0,
      };
      st.count += 1;
      stageCounts.set(slug, st);

      const oid = card.owner.userId ?? "unassigned";
      const ol = ownerCounts.get(oid) ?? {
        label: card.owner.unassigned
          ? "Unassigned"
          : card.owner.displayName ?? "Owner",
        count: 0,
      };
      ol.count += 1;
      ownerCounts.set(oid, ol);

      const sk = card.source.key ?? "unknown";
      const sc = sourceCounts.get(sk) ?? {
        label: card.source.label,
        count: 0,
      };
      sc.count += 1;
      sourceCounts.set(sk, sc);

      for (const f of card.urgency.flags) {
        urgencyCounts.set(f, (urgencyCounts.get(f) ?? 0) + 1);
      }

      const lifeKey =
        card.lifecycle.state === "holding"
          ? "holding"
          : card.lifecycle.state === "converted" || card.lifecycle.state === "lost"
            ? "terminal"
            : "active";
      lifeCounts.set(lifeKey, (lifeCounts.get(lifeKey) ?? 0) + 1);
    }
  }

  void cardsById;

  return {
    staffColumns,
    backendStages: [...stageCounts.entries()]
      .map(([id, v]) => ({
        id: `stage:${id}`,
        label: staffSafeStageLabel(v.label),
        count: v.count,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    owners: [...ownerCounts.entries()]
      .map(([id, v]) => ({
        id: id === "unassigned" ? "unassigned" : `owner:${id}`,
        label: v.label,
        count: v.count,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    sources: [...sourceCounts.entries()]
      .map(([id, v]) => ({
        id: `source:${id}`,
        label: v.label,
        count: v.count,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    urgency: FLAG_PRIMARY_ORDER.filter((f) => urgencyCounts.has(f)).map((f) => ({
      id: f,
      label: URGENCY_LABEL[f],
      count: urgencyCounts.get(f) ?? 0,
    })),
    lifecycle: (["active", "holding", "terminal"] as const).map((k) => ({
      id: `life:${k}`,
      label: k === "terminal" ? "Terminal" : k === "holding" ? "Holding" : "Active",
      count: lifeCounts.get(k) ?? 0,
    })),
    assignedToMe: true,
    unassigned: (ownerCounts.get("unassigned")?.count ?? 0) > 0,
  };
}

function buildGlobalActions(
  base: string,
  perms: PipelinePresentationPermissions
): PipelineGlobalAction[] {
  const actions: PipelineGlobalAction[] = [
    {
      id: "open_board",
      label: "Board",
      href: `${base}/crm`,
    },
    {
      id: "open_follow_ups",
      label: "Follow-ups",
      href: `${base}/crm`,
    },
  ];
  if (perms.canMutate) {
    actions.unshift({
      id: "new_enquiry",
      label: "New enquiry",
      href: `${base}/crm`,
    });
  }
  return actions;
}

function staffSafeStageLabel(label: string): string {
  // Strip technical OS language if present; keep operational wording
  return label
    .replace(/\bLeadFlow\b/gi, "Pipeline")
    .replace(/\bCRM\b/g, "Pipeline")
    .trim();
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function toSortable(
  card: PipelineLeadCard,
  createdAtIso: string | null
): PipelineSortableLead {
  return {
    leadId: card.leadId,
    urgencyFlags: card.urgency.flags,
    nextFollowUpAtIso: card.nextAction.dueAtIso,
    createdAtIso,
    score: card.score.highValue ? 1 : card.score.value,
  };
}

/**
 * Terminal columns: newest conversion/activity first, then leadId.
 * Presentation-specific; does not conflict with S4.1 active-board sort.
 */
function compareTerminalCards(a: PipelineLeadCard, b: PipelineLeadCard): number {
  const aa = parseMs(a.conversion.convertedAtIso);
  const bb = parseMs(b.conversion.convertedAtIso);
  if (aa != null && bb != null && aa !== bb) return bb - aa;
  if (aa != null && bb == null) return -1;
  if (aa == null && bb != null) return 1;
  return a.leadId.localeCompare(b.leadId);
}

// ---------------------------------------------------------------------------
// Task / contact / source utils
// ---------------------------------------------------------------------------

function dedupeTasks(tasks: readonly PipelineTaskInput[]): PipelineTaskInput[] {
  const byId = new Map<string, PipelineTaskInput>();
  const sorted = [...tasks].sort((a, b) => {
    const da = parseMs(a.dueAtIso) ?? Number.POSITIVE_INFINITY;
    const db = parseMs(b.dueAtIso) ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.taskId.localeCompare(b.taskId);
  });
  for (const t of sorted) {
    const id = t.taskId.trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, t);
  }
  return [...byId.values()].sort((a, b) => {
    const da = parseMs(a.dueAtIso) ?? Number.POSITIVE_INFINITY;
    const db = parseMs(b.dueAtIso) ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.taskId.localeCompare(b.taskId);
  });
}

function tasksToFiRows(
  tasks: readonly PipelineTaskInput[],
  forceLeadId: string | null
): FiCrmTaskRow[] {
  return tasks.map((t) => ({
    id: t.taskId,
    tenant_id: "",
    lead_id: forceLeadId ?? t.leadId,
    patient_id: null,
    case_id: null,
    consultation_id: null,
    title: t.title,
    description: null,
    task_type: "follow_up",
    status: t.status,
    due_at: t.dueAtIso,
    completed_at: t.completedAtIso,
    assignee_user_id: t.assigneeUserId,
    metadata: {},
    created_at: t.dueAtIso ?? "1970-01-01T00:00:00.000Z",
    updated_at: t.dueAtIso ?? "1970-01-01T00:00:00.000Z",
  }));
}

function pickFutureActiveConsultation(
  consults: readonly PipelineConsultationInput[],
  nowMs: number
): PipelineConsultationInput | null {
  const dayStart = startOfUtcDayMs(nowMs);
  const active = new Set(["scheduled", "confirmed", "arrived"]);
  const list = consults
    .filter((c) => {
      if (c.cancelledAtIso) return false;
      if (!active.has((c.status ?? "").toLowerCase())) return false;
      const ms = parseMs(c.startAtIso);
      return ms != null && ms >= dayStart;
    })
    .sort((a, b) => {
      const da = parseMs(a.startAtIso)!;
      const db = parseMs(b.startAtIso)!;
      if (da !== db) return da - db;
      return a.bookingId.localeCompare(b.bookingId);
    });
  return list[0] ?? null;
}

function pickCommunicationHint(
  comms: readonly PipelineCommunicationHintInput[],
  _nowMs: number
): PipelineCommunicationHintInput | null {
  const withDue = comms
    .filter((c) => parseMs(c.nextFollowUpAtIso) != null)
    .sort((a, b) => {
      const da = parseMs(a.nextFollowUpAtIso)!;
      const db = parseMs(b.nextFollowUpAtIso)!;
      if (da !== db) return da - db;
      return a.communicationId.localeCompare(b.communicationId);
    });
  return withDue[0] ?? null;
}

function contactFromPersonMeta(meta: Record<string, unknown>): PipelineLeadCard["contact"] {
  // Lightweight read without pulling full identity module PHI into diagnostics
  const email =
    asStr(meta.email) ||
    asStr(meta.primary_email) ||
    asStr(meta.primaryEmail) ||
    asStr((meta.hubspot as Record<string, unknown> | undefined)?.email);
  const phone =
    asStr(meta.phone) ||
    asStr(meta.primary_phone) ||
    asStr(meta.primaryPhone) ||
    asStr((meta.hubspot as Record<string, unknown> | undefined)?.phone);
  const preferred = asStr(meta.preferred_contact_method) || asStr(meta.preferredContactMethod);
  let preferredChannel: PipelineLeadCard["contact"]["preferredChannel"] = null;
  if (preferred === "email") preferredChannel = "email";
  else if (preferred === "sms") preferredChannel = "sms";
  else if (preferred === "phone" || preferred === "call") preferredChannel = "phone";
  else if (preferred === "both") preferredChannel = phone ? "phone" : "email";
  else if (phone) preferredChannel = "phone";
  else if (email) preferredChannel = "email";

  return {
    hasEmail: Boolean(email),
    hasPhone: Boolean(phone),
    preferredChannel,
  };
}

function sourceFromLeadMeta(meta: Record<string, unknown> | null | undefined): PipelineLeadCard["source"] {
  const m = meta ?? {};
  const key =
    asStr(m.lead_source) ||
    asStr(m.source) ||
    asStr(m.source_key) ||
    asStr(m.external_source_system);
  const external =
    asStr(m.external_source_system) ||
    asStr(m.source_system) ||
    (m.hubspot ? "hubspot" : null);
  if (!key && !external) {
    return { key: null, label: "Unknown source", externalSystem: null };
  }
  const label = key
    ? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : external === "hubspot"
      ? "HubSpot"
      : "External";
  return {
    key: key ?? external,
    label,
    externalSystem: external,
  };
}

function lostReasonFromMeta(meta: Record<string, unknown> | null | undefined): string | null {
  const m = meta ?? {};
  return (
    asStr(m.lost_reason) ||
    asStr(m.crm_lost_reason) ||
    asStr(m.lostReason) ||
    null
  );
}

function lostAtFromMeta(meta: Record<string, unknown> | null | undefined): string | null {
  const m = meta ?? {};
  const raw =
    asStr(m.lost_at) ||
    asStr(m.lostAt) ||
    asStr(m.closed_at) ||
    asStr(m.closedAt) ||
    null;
  if (!raw) return null;
  return parseMs(raw) != null ? raw : null;
}

/**
 * Full-tier meaningful activity: max of lead updated, task due/completed, consult start, comm follow-up.
 * Never uses presentation generatedAt / passive refresh.
 */
function enrichMeaningfulActivity(
  card: PipelineLeadCard,
  tasks: readonly PipelineTaskInput[],
  consults: readonly PipelineConsultationInput[],
  comms: readonly PipelineCommunicationHintInput[]
): void {
  const parts: Array<string | null | undefined> = [
    card.timestamps.updatedAtIso,
    card.timestamps.meaningfulActivityAtIso,
  ];
  for (const t of tasks) {
    parts.push(t.dueAtIso, t.completedAtIso);
  }
  for (const c of consults) {
    parts.push(c.startAtIso, c.cancelledAtIso);
  }
  for (const h of comms) {
    parts.push(h.nextFollowUpAtIso);
  }
  card.timestamps.meaningfulActivityAtIso = maxMeaningfulActivityIso(parts);
}

function leadTitleFallback(summary: string | null | undefined, leadId: string): string {
  const s = summary?.trim();
  if (s) return s;
  return `Lead ${leadId.slice(0, 8)}…`;
}

function detectLoadTier(input: BuildPipelinePresentationInput): "shell" | "full" {
  if (
    input.tasksByLeadId ||
    input.communicationsByLeadId ||
    input.consultationsByLeadId ||
    input.reminderJobsByLeadId
  ) {
    return "full";
  }
  return "shell";
}

function findKanbanLead(
  leads: readonly CrmKanbanLeadCard[],
  leadId: string
): CrmKanbanLeadCard | undefined {
  // Prefer winner rule if duplicates: same as mint
  let best: CrmKanbanLeadCard | undefined;
  for (const row of leads) {
    if (row.lead?.id?.trim() !== leadId) continue;
    if (!best || preferKanbanWinner(row, best) < 0) best = row;
  }
  return best;
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function parseMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const t = Date.parse(String(iso).trim());
  return Number.isFinite(t) ? t : null;
}

function startOfUtcDayMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function utcYmd(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function asStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function uniqueSorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

// Re-export types for convenience
export type {
  PipelinePresentation,
  PipelineLeadCard,
  PipelinePresentationPermissions,
} from "@/src/lib/crm/pipelinePresentation.types";
