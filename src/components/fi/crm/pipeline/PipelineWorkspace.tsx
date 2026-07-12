"use client";

/**
 * FI-UX-REBUILD-1 S4.3 / S4.5A — Pipeline workspace adapter.
 *
 * Sole component allowed to own presentation state, refresh, and mutation runners.
 * Children receive presentation slices + callbacks only.
 *
 * S4.5A: mounted on `/crm` only for allowlisted tenants.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  completeCrmTaskAction,
  crmMoveLeadStageAction,
} from "@/lib/actions/fi-crm-actions";
import { NewEnquiryDialog } from "@/src/components/fi-admin/leadflow/NewEnquiryDialog";
import { useCrmLeadSlideOverOptional } from "@/src/components/fi/crm/LeadSlideOver";
import {
  PipelineBoard,
  PipelineEmptyState,
  PipelineFilterBar,
  PipelineFollowUps,
  PipelineHeader,
  PipelineLiveRegion,
  PipelineReadOnlyNotice,
  PipelineSummary,
  PipelineTruncationNotice,
  PipelineViewTabs,
} from "@/src/components/fi/crm/pipeline/pipelineUi";
import {
  comparePipelineTierIdentity,
  createPipelineRefreshCoordinator,
} from "@/src/lib/crm/pipelineLoader";
import { resolvePipelineDragDrop } from "@/src/lib/crm/pipelineDrag";
import {
  applyPipelineOpsToPresentation,
  collectInactiveReviewCards,
} from "@/src/lib/crm/pipelineOperationsApply";
import type { PipelineOpsSortMode } from "@/src/lib/crm/pipelineOperationsQuery";
import {
  pipelineMoveableStaffColumns,
  resolvePipelineColumnEntryStage,
  type PipelineMoveStageDefinition,
} from "@/src/lib/crm/pipelineMoveTarget";
import type {
  PipelineCardActionId,
  PipelineFollowUpItem,
  PipelineLeadCard,
  PipelinePresentation,
  PipelinePresentationPermissions,
  PipelineStaffColumnId,
} from "@/src/lib/crm/pipelinePresentation.types";
import {
  buildLeadCardMap,
  countActivePipelineFilters,
  emptyPipelineActiveFilters,
  filterPipelineColumns,
  filterPipelineFollowUps,
  type PipelineActiveFilters,
  type PipelineWorkspaceView,
} from "@/src/lib/crm/pipelineUiHelpers";
import { PIPELINE_STAFF_COLUMNS } from "@/src/lib/crm/pipelineStaffModel";

/** Share one in-flight shell→full request across Strict Mode remounts. */
const pendingFullHydrations = new Map<string, Promise<PipelinePresentation>>();

export type PipelineWorkspaceProps = {
  tenantId: string;
  initialPresentation: PipelinePresentation;
  permissions: PipelinePresentationPermissions;
  /** Tenant pipeline stages for move-target resolution. */
  tenantStages: readonly PipelineMoveStageDefinition[];
  /** Fetch full (or refreshed) presentation — single refresh owner. */
  onRefreshPresentation?: () => Promise<PipelinePresentation>;
  /** Optional full presentation available after mount hydration. */
  fullPresentation?: PipelinePresentation | null;
  /** Initial Board / Follow-ups view (legacy `?view=` compatibility). */
  initialView?: PipelineWorkspaceView;
  /** Current user id for "assigned to me" (optional). */
  currentUserId?: string | null;
  /** Injected for tests. */
  moveLeadStage?: (
    tenantId: string,
    leadId: string,
    body: { toStageId: string; reason?: string | null; source?: string }
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  completeTask?: (
    tenantId: string,
    leadId: string,
    taskId: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** When true, show New enquiry (canMutate). */
  canCreateEnquiry?: boolean;
};

function logPipelineIdentityMismatch(shell: PipelinePresentation, full: PipelinePresentation): void {
  const identity = comparePipelineTierIdentity(shell, full);
  if (identity.ok) return;
  // IDs/counts only — no PHI, no staff-facing lead lists.
  console.info(
    "[pipeline] shell/full identity mismatch",
    JSON.stringify({
      shell_count: shell.diagnostics.visibleLeadCount,
      full_count: full.diagnostics.visibleLeadCount,
      missing_count: identity.missingFromFull.length,
      extra_count: identity.extraInFull.length,
    })
  );
}

export function PipelineWorkspace(props: PipelineWorkspaceProps) {
  const {
    tenantId,
    permissions,
    tenantStages,
    canCreateEnquiry = permissions.canMutate,
    initialView = "board",
  } = props;

  const [presentation, setPresentation] = useState(props.initialPresentation);
  const [view, setView] = useState<PipelineWorkspaceView>(initialView);
  const [filters, setFilters] = useState<PipelineActiveFilters>(emptyPipelineActiveFilters);
  const [sortMode, setSortMode] = useState<PipelineOpsSortMode>("newest_first");
  const [userSortSelected, setUserSortSelected] = useState(false);
  const [desktopDragEnabled, setDesktopDragEnabled] = useState(false);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [newEnquiryOpen, setNewEnquiryOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    action: "mark_lost" | "convert";
    card: PipelineLeadCard;
    reason: string;
  } | null>(null);

  // Desktop fine-pointer only — never enable drag on tablet/phone
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: fine) and (min-width: 1024px)");
    const apply = () => setDesktopDragEnabled(mq.matches && permissions.canMutate);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [permissions.canMutate]);

  const slideOver = useCrmLeadSlideOverOptional();
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;

  const refreshFnRef = useRef(props.onRefreshPresentation);
  refreshFnRef.current = props.onRefreshPresentation;

  const coordinatorRef = useRef<ReturnType<typeof createPipelineRefreshCoordinator> | null>(
    null
  );
  if (!coordinatorRef.current) {
    coordinatorRef.current = createPipelineRefreshCoordinator(async () => {
      const fn = refreshFnRef.current;
      if (!fn) throw new Error("refresh_unavailable");
      return fn();
    });
  }

  const autoHydrateStartedRef = useRef(false);

  const announce = useCallback((msg: string) => {
    setLiveMessage(msg);
  }, []);

  const applyFullPresentation = useCallback(
    (next: PipelinePresentation, mode: "hydrate" | "refresh") => {
      if (mode === "hydrate") {
        const current = presentationRef.current;
        const identity = comparePipelineTierIdentity(current, next);
        if (!identity.ok) {
          logPipelineIdentityMismatch(current, next);
          setRefreshError("identity_mismatch");
          announce("Could not refresh. Showing the last update.");
          return false;
        }
      }
      setPresentation(next);
      setRefreshError(null);
      return true;
    },
    [announce]
  );

  // Parent-supplied full presentation (tests / alternate wiring)
  useEffect(() => {
    if (!props.fullPresentation) return;
    applyFullPresentation(props.fullPresentation, "hydrate");
  }, [props.fullPresentation, applyFullPresentation]);

  // One post-mount full hydration via the refresh owner (S4.5A live path).
  // No default poller. Strict-mode remounts share the same in-flight promise.
  useEffect(() => {
    if (!props.onRefreshPresentation) return;
    if (autoHydrateStartedRef.current) return;
    autoHydrateStartedRef.current = true;

    const hydrateKey = `${tenantId}:${props.initialPresentation.generatedAt}`;
    let cancelled = false;
    setIsRefreshing(true);

    let pending = pendingFullHydrations.get(hydrateKey);
    if (!pending) {
      pending = coordinatorRef.current!.refresh().finally(() => {
        pendingFullHydrations.delete(hydrateKey);
      });
      pendingFullHydrations.set(hydrateKey, pending);
    }

    void (async () => {
      try {
        const next = await pending;
        if (cancelled) return;
        applyFullPresentation(next, "hydrate");
      } catch {
        if (cancelled) return;
        // Retain shell / last valid presentation on full-load failure.
        setRefreshError("refresh_failed");
        announce("Could not refresh. Showing the last update.");
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    props.onRefreshPresentation,
    props.initialPresentation.generatedAt,
    tenantId,
    applyFullPresentation,
    announce,
  ]);

  const refresh = useCallback(async () => {
    if (!props.onRefreshPresentation) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const next = await coordinatorRef.current!.refresh();
      applyFullPresentation(next, "refresh");
    } catch {
      setRefreshError("refresh_failed");
      announce("Could not refresh. Showing the last update.");
    } finally {
      setIsRefreshing(false);
    }
  }, [props.onRefreshPresentation, applyFullPresentation, announce]);

  const moveDestinations = useMemo(() => {
    return pipelineMoveableStaffColumns().map((columnId) => {
      const col = PIPELINE_STAFF_COLUMNS.find((c) => c.id === columnId);
      const resolved = resolvePipelineColumnEntryStage(columnId, tenantStages);
      return {
        columnId,
        label: col?.label ?? columnId,
        disabled: !resolved.ok,
        reason: !resolved.ok
          ? resolved.error === "no_backend_stage_for_column"
            ? "No matching stage for this clinic"
            : resolved.error
          : undefined,
      };
    });
  }, [tenantStages]);

  const nowMs = Date.parse(presentation.generatedAt) || Date.now();

  const opsApplied = useMemo(() => {
    const lifecycleCol =
      filters.staffColumnIds.length === 1 ? filters.staffColumnIds[0]! : null;
    return applyPipelineOpsToPresentation(
      presentation,
      {
        view: view === "inactive_review" ? "inactive_review" : "board",
        sort: sortMode,
        lifecycle: lifecycleCol,
        stageSlug: null,
        age: (filters.ageBucket as never) ?? null,
        ownerId: filters.ownerId,
        sourceKey: filters.sourceKey,
        activity: (filters.activity as never) ?? null,
        inactiveAgeDays: 30,
        userSortSelected: userSortSelected || view === "inactive_review",
      },
      nowMs
    );
  }, [presentation, view, sortMode, filters, userSortSelected, nowMs]);

  const filteredColumns = useMemo(
    () => filterPipelineColumns(opsApplied.presentation.columns, filters, nowMs),
    [opsApplied.presentation.columns, filters, nowMs]
  );

  const cardMap = useMemo(() => buildLeadCardMap(presentation), [presentation]);

  const filteredFollowUps = useMemo(
    () => filterPipelineFollowUps(presentation.followUps, filters, cardMap),
    [presentation.followUps, filters, cardMap]
  );

  const inactiveCards = useMemo(
    () =>
      view === "inactive_review"
        ? collectInactiveReviewCards(presentation, nowMs, 30)
        : [],
    [view, presentation, nowMs]
  );

  // Tab badge only — never re-scan the full board on every menu open / pointer event.
  // When not on inactive review, show a lightweight placeholder count from summary holding+active aged signals if present; else 0 until opened.
  const inactiveCount = useMemo(() => {
    if (view === "inactive_review") return inactiveCards.length;
    // Avoid O(n) inactive scan on every board paint; badge fills when user opens the view.
    return 0;
  }, [view, inactiveCards.length]);

  const boardCount = filteredColumns.reduce((n, c) => n + c.count, 0);
  const followUpCount =
    filteredFollowUps.summary.overdue +
    filteredFollowUps.summary.dueToday +
    filteredFollowUps.summary.upcoming +
    filteredFollowUps.summary.noDueDate;

  const focusLead = (leadId: string) => {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-lead-id="${CSS.escape(leadId)}"]`
      );
      el?.focus?.();
      el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }, 50);
  };

  const runMove = async (card: PipelineLeadCard, columnId: PipelineStaffColumnId) => {
    const resolved = resolvePipelineColumnEntryStage(columnId, tenantStages);
    if (!resolved.ok) {
      announce(
        resolved.error === "terminal_column_requires_special_action"
          ? "Use Convert or Mark lost for that stage."
          : "Could not move lead. No matching stage."
      );
      return;
    }

    // Never pass staff-column id
    if (resolved.stageId === columnId) {
      announce("Could not move lead. Invalid stage destination.");
      return;
    }

    setBusyLeadId(card.leadId);
    try {
      const mover =
        props.moveLeadStage ??
        (async (tid, lid, body) => crmMoveLeadStageAction(tid, lid, body));
      const result = await mover(tenantId, card.leadId, {
        toStageId: resolved.stageId,
        source: "pipeline_workspace",
      });
      if (!result.ok) {
        announce("Could not move lead. No changes were made.");
        return;
      }
      await refresh();
      const label =
        PIPELINE_STAFF_COLUMNS.find((c) => c.id === columnId)?.label ?? columnId;
      announce(`Lead moved to ${label}.`);
      focusLead(card.leadId);
    } finally {
      setBusyLeadId(null);
    }
  };

  const runCompleteTask = async (item: PipelineFollowUpItem) => {
    setBusyTaskId(item.taskId);
    try {
      const runner =
        props.completeTask ??
        (async (tid, lid, taskId) => completeCrmTaskAction(tid, lid, taskId, {}));
      const result = await runner(tenantId, item.leadId, item.taskId);
      if (!result.ok) {
        announce("Could not complete follow-up. No changes were made.");
        return;
      }
      await refresh();
      announce("Follow-up completed.");
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleCardAction = async (action: PipelineCardActionId, card: PipelineLeadCard) => {
    switch (action) {
      case "open_lead":
        if (slideOver?.openLead) slideOver.openLead(card.leadId);
        else window.location.assign(card.links.lead);
        return;
      case "open_patient":
        if (card.links.patient) window.location.assign(card.links.patient);
        return;
      case "move_stage":
        // menu opens in card
        return;
      case "mark_lost":
        setConfirm({ action: "mark_lost", card, reason: "" });
        return;
      case "convert":
        setConfirm({ action: "convert", card, reason: "" });
        return;
      case "complete_follow_up":
        if (card.followUps.nextTaskId) {
          await runCompleteTask({
            taskId: card.followUps.nextTaskId,
            leadId: card.leadId,
            personDisplayName: card.person.displayName,
            title: card.nextAction.label,
            dueAtIso: card.nextAction.dueAtIso,
            assignee: { userId: null, displayName: null },
            status: "open",
            contact: card.contact,
            allowedActions: ["complete_follow_up"],
            links: { lead: card.links.lead },
          });
        }
        return;
      case "contact":
      case "log_outcome":
      case "schedule_follow_up":
      case "assign_owner":
      case "book_consultation":
      case "reopen":
        // Open lead workspace for richer flows (existing mutations live there)
        if (slideOver?.openLead) slideOver.openLead(card.leadId);
        else window.location.assign(card.links.lead);
        announce("Opened lead to finish this action.");
        return;
      default:
        return;
    }
  };

  const confirmDestructive = async () => {
    if (!confirm) return;
    const { action, card, reason } = confirm;
    setConfirm(null);
    setBusyLeadId(card.leadId);
    try {
      if (action === "mark_lost") {
        const lost = tenantStages.find((s) => s.isLost && !s.archived);
        if (!lost) {
          announce("Could not mark lost. No lost stage configured.");
          return;
        }
        const mover =
          props.moveLeadStage ??
          (async (tid, lid, body) => crmMoveLeadStageAction(tid, lid, body));
        const result = await mover(tenantId, card.leadId, {
          toStageId: lost.id,
          reason: reason.trim() || "Marked lost from Pipeline",
          source: "pipeline_workspace",
        });
        if (!result.ok) {
          announce("Could not mark lead as lost. No changes were made.");
          return;
        }
        await refresh();
        announce("Lead marked as lost.");
        focusLead(card.leadId);
      } else if (action === "convert") {
        // Conversion requires full existing workflow — open lead conversion surface
        if (slideOver?.openLead) slideOver.openLead(card.leadId);
        else window.location.assign(card.links.lead);
        announce("Open conversion on the lead to finish.");
      }
    } finally {
      setBusyLeadId(null);
    }
  };

  const lastUpdatedLabel = useMemo(() => {
    const t = Date.parse(presentation.generatedAt);
    if (!Number.isFinite(t)) return null;
    return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [presentation.generatedAt]);

  const hasFilters = countActivePipelineFilters(filters) > 0;

  const handleDesktopDrop = (
    leadId: string,
    fromColumnId: PipelineStaffColumnId,
    toColumnId: PipelineStaffColumnId
  ) => {
    const card = cardMap.get(leadId);
    if (!card) {
      announce("Could not move lead. No changes were made.");
      return;
    }
    const intent = resolvePipelineDragDrop({
      leadId,
      fromColumnId,
      toColumnId,
      tenantStages,
      canMutate: permissions.canMutate,
      desktopPointer: desktopDragEnabled,
      bookedRequiresWorkflow: true,
    });
    if (intent.kind === "reject") {
      announce(
        intent.reason === "read_only"
          ? "You do not have permission to move leads."
          : intent.reason === "tablet_or_touch"
            ? "Use Move stage on this device."
            : "Could not move lead. No changes were made."
      );
      return;
    }
    if (intent.kind === "open_lost_reason") {
      setConfirm({ action: "mark_lost", card, reason: "" });
      announce("Enter a lost reason to continue.");
      return;
    }
    if (intent.kind === "open_conversion") {
      setConfirm({ action: "convert", card, reason: "" });
      announce("Open conversion to continue.");
      return;
    }
    if (intent.kind === "open_booked_workflow") {
      if (slideOver?.openLead) slideOver.openLead(card.leadId);
      else window.location.assign(card.links.lead);
      announce("Opened lead to complete booking or deposit steps.");
      return;
    }
    // Safe move — real backend stage UUID only
    void (async () => {
      setBusyLeadId(card.leadId);
      try {
        const mover =
          props.moveLeadStage ??
          (async (tid, lid, body) => crmMoveLeadStageAction(tid, lid, body));
        const result = await mover(tenantId, card.leadId, {
          toStageId: intent.toStageId,
          source: "pipeline_workspace",
        });
        if (!result.ok) {
          announce("Could not move lead. No changes were made.");
          return;
        }
        await refresh();
        const label =
          PIPELINE_STAFF_COLUMNS.find((c) => c.id === toColumnId)?.label ?? toColumnId;
        announce(`Lead moved to ${label}.`);
        focusLead(card.leadId);
      } finally {
        setBusyLeadId(null);
      }
    })();
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PipelineLiveRegion message={liveMessage} />
      <PipelineHeader
        loadTier={presentation.loadTier}
        isRefreshing={isRefreshing}
        refreshError={refreshError}
        lastUpdatedLabel={lastUpdatedLabel}
        canCreate={canCreateEnquiry}
        onRefresh={() => void refresh()}
        onNewEnquiry={() => setNewEnquiryOpen(true)}
      />
      {!permissions.canMutate ? <PipelineReadOnlyNotice /> : null}
      <PipelineSummary summary={presentation.summary} />
      <PipelineTruncationNotice diagnostics={presentation.diagnostics} />
      <PipelineViewTabs
        view={view}
        boardCount={boardCount}
        followUpCount={followUpCount}
        inactiveCount={inactiveCount}
        onChange={setView}
      />
      <PipelineFilterBar
        filters={presentation.filters}
        active={filters}
        onChange={setFilters}
        view={view}
        sortMode={sortMode}
        lostMode={filters.staffColumnIds.includes("closed_lost")}
        onSortChange={(mode) => {
          setSortMode(mode as PipelineOpsSortMode);
          setUserSortSelected(true);
        }}
      />

      {view === "board" ? (
        boardCount === 0 ? (
          <PipelineEmptyState
            canCreate={canCreateEnquiry}
            onNewEnquiry={() => setNewEnquiryOpen(true)}
            hasFilters={hasFilters}
            onClearFilters={() => setFilters(emptyPipelineActiveFilters())}
          />
        ) : (
          <PipelineBoard
            columns={filteredColumns}
            busyLeadId={busyLeadId}
            loadTier={presentation.loadTier}
            nowMs={nowMs}
            onAction={(a, c) => void handleCardAction(a, c)}
            onMoveToColumn={(c, col) => void runMove(c, col)}
            moveDestinations={moveDestinations}
            // Identity for menu reset: real presentation swap or view change only.
            // sortMode is UI-only reordering of the same cards — do not remount menus on sort.
            presentationKey={`${presentation.generatedAt}:${view}`}
            desktopDragEnabled={desktopDragEnabled}
            onDesktopDrop={handleDesktopDrop}
          />
        )
      ) : view === "inactive_review" ? (
        inactiveCards.length === 0 ? (
          <PipelineEmptyState
            canCreate={false}
            onNewEnquiry={() => setNewEnquiryOpen(true)}
            hasFilters={true}
            onClearFilters={() => setView("board")}
          />
        ) : (
          <div className="space-y-2" aria-label="Inactive review">
            <p className="text-sm text-slate-400">
              {inactiveCards.length} inactive enquir
              {inactiveCards.length === 1 ? "y" : "ies"} — review without auto-changing status.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {inactiveCards.map((card) => (
                <div
                  key={card.leadId}
                  className="rounded-xl border border-white/[0.1] bg-[#0b1220]/90 p-3"
                  data-lead-id={card.leadId}
                >
                  <p className="text-sm font-semibold text-slate-100">
                    {card.person.displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {card.stage.staffColumnLabel}
                    {" · "}
                    {card.owner.unassigned ? "Unassigned" : card.owner.displayName ?? "Owner"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-white/[0.12] px-3 text-xs font-medium text-slate-200"
                      onClick={() => void handleCardAction("open_lead", card)}
                    >
                      Open lead
                    </button>
                    {permissions.canMutate ? (
                      <>
                        <button
                          type="button"
                          className="min-h-11 rounded-lg border border-white/[0.12] px-3 text-xs font-medium text-slate-200"
                          disabled={busyLeadId === card.leadId}
                          onClick={() => void runMove(card, "nurture")}
                        >
                          Move to Nurture
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-lg border border-white/[0.12] px-3 text-xs font-medium text-slate-200"
                          onClick={() => void handleCardAction("mark_lost", card)}
                        >
                          Mark lost
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-lg border border-white/[0.12] px-3 text-xs font-medium text-slate-200"
                          onClick={() => void handleCardAction("schedule_follow_up", card)}
                        >
                          Schedule follow-up
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-lg border border-white/[0.12] px-3 text-xs font-medium text-slate-200"
                          onClick={() => void handleCardAction("assign_owner", card)}
                        >
                          Assign owner
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 text-xs font-medium text-cyan-100"
                          onClick={() => announce("Kept active — no status change.")}
                        >
                          Keep active
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <PipelineFollowUps
          followUps={filteredFollowUps}
          busyTaskId={busyTaskId}
          onTaskAction={(a, item) => {
            if (a === "complete_follow_up") void runCompleteTask(item);
            else if (a === "open_lead") {
              if (slideOver?.openLead) slideOver.openLead(item.leadId);
              else window.location.assign(item.links.lead);
            } else if (a === "contact") {
              if (slideOver?.openLead) slideOver.openLead(item.leadId);
            }
          }}
          onOpenLead={(leadId) => {
            if (slideOver?.openLead) slideOver.openLead(leadId);
            else {
              const card = cardMap.get(leadId);
              if (card) window.location.assign(card.links.lead);
            }
          }}
        />
      )}

      {confirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            confirm.action === "mark_lost" ? "Confirm mark lost" : "Confirm convert"
          }
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0f1629] p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-50">
              {confirm.action === "mark_lost" ? "Mark as lost?" : "Convert this lead?"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {confirm.card.person.displayName}
            </p>
            {confirm.action === "mark_lost" ? (
              <label className="mt-4 block text-sm text-slate-300">
                Reason
                <input
                  className="mt-1 w-full min-h-11 rounded-xl border border-white/[0.12] bg-black/30 px-3 text-slate-100"
                  value={confirm.reason}
                  onChange={(e) =>
                    setConfirm({ ...confirm, reason: e.target.value })
                  }
                />
              </label>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Conversion continues in the lead workspace using the existing workflow.
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-white/[0.12] px-4 text-sm text-slate-200"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 text-sm font-semibold text-rose-100"
                onClick={() => void confirmDestructive()}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newEnquiryOpen ? (
        <NewEnquiryDialog
          tenantId={tenantId}
          open={newEnquiryOpen}
          showTrigger={false}
          onOpenChange={(open) => {
            setNewEnquiryOpen(open);
            if (!open) {
              void refresh();
            }
          }}
        />
      ) : null}
    </div>
  );
}
