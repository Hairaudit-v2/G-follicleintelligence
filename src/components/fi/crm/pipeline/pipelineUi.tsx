"use client";

/**
 * FI-UX-REBUILD-1 S4.3B — presentation-only Pipeline UI.
 * Props are PipelinePresentation slices + callbacks only.
 */

import Link from "next/link";
import React, { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatPipelineDueLabel,
  pipelineCardActionLabel,
  pipelineConsultationLabel,
  pipelineHiddenLeadsNotice,
  pipelineSummaryTiles,
  type PipelineActiveFilters,
  type PipelineWorkspaceView,
} from "@/src/lib/crm/pipelineUiHelpers";
import { moreLog } from "@/src/lib/crm/pipelineMoreDiagnostic";
import { isOpenMenuLeadStillOnBoard } from "@/src/lib/crm/pipelineMenuDismiss";
import type {
  PipelineCardActionId,
  PipelineFilterOptions,
  PipelineFollowUpItem,
  PipelineFollowUpView,
  PipelineGlobalAction,
  PipelineLeadCard,
  PipelinePresentationColumn,
  PipelinePresentationDiagnostics,
  PipelinePresentationSummary,
  PipelineStaffColumnId,
} from "@/src/lib/crm/pipelinePresentation.types";

// --- tokens -------------------------------------------------------------------

const btnBase =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-40";

const btnPrimary = cn(
  btnBase,
  "border border-cyan-500/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
);

const btnSecondary = cn(
  btnBase,
  "border border-white/[0.12] bg-white/[0.04] text-slate-200 hover:border-cyan-500/30"
);

const btnGhost = cn(
  btnBase,
  "border border-transparent text-slate-300 hover:bg-white/[0.06]"
);

// --- Header -------------------------------------------------------------------

export function PipelineHeader(props: {
  loadTier: "shell" | "full";
  isRefreshing: boolean;
  refreshError: string | null;
  lastUpdatedLabel: string | null;
  canCreate: boolean;
  onRefresh: () => void;
  onNewEnquiry: () => void;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1220] p-5 sm:p-7">
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400/90">
            Pipeline
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Enquiries
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Board and follow-ups for the day&apos;s enquiry work.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.isRefreshing ? (
            <span className="text-xs font-medium text-cyan-300/90" aria-live="polite">
              Updating…
            </span>
          ) : props.loadTier === "shell" ? (
            <span className="text-xs font-medium text-slate-500">Loading details…</span>
          ) : props.lastUpdatedLabel ? (
            <span className="text-xs text-slate-500">Updated {props.lastUpdatedLabel}</span>
          ) : null}
          {props.refreshError ? (
            <span className="text-xs text-amber-300/90" role="status">
              Couldn&apos;t refresh — showing the last update.
            </span>
          ) : null}
          <button type="button" className={btnSecondary} onClick={props.onRefresh}>
            Refresh
          </button>
          {props.canCreate ? (
            <button type="button" className={btnPrimary} onClick={props.onNewEnquiry}>
              New enquiry
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// --- View tabs ----------------------------------------------------------------

export function PipelineViewTabs(props: {
  view: PipelineWorkspaceView;
  boardCount: number;
  followUpCount: number;
  inactiveCount?: number;
  onChange: (view: PipelineWorkspaceView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Pipeline views"
      className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-3"
    >
      {(
        [
          { id: "board" as const, label: "Board", count: props.boardCount },
          { id: "follow_ups" as const, label: "Follow-ups", count: props.followUpCount },
          {
            id: "inactive_review" as const,
            label: "Inactive review",
            count: props.inactiveCount ?? 0,
          },
        ] as const
      ).map((tab) => {
        const selected = props.view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition",
              selected
                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                : "border-white/[0.08] text-slate-400 hover:text-slate-200"
            )}
            onClick={() => props.onChange(tab.id)}
          >
            {tab.label}
            <span className="ml-2 text-xs opacity-80">({tab.count})</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Summary ------------------------------------------------------------------

export function PipelineSummary(props: { summary: PipelinePresentationSummary }) {
  const tiles = pipelineSummaryTiles(props.summary);
  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8"
      aria-label="Pipeline summary"
    >
      {tiles.map((t) => (
        <div
          key={t.id}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t.label}
          </p>
          <p className="mt-0.5 text-lg font-semibold text-slate-100">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

// --- Filters ------------------------------------------------------------------

export function PipelineFilterBar(props: {
  filters: PipelineFilterOptions;
  active: PipelineActiveFilters;
  onChange: (next: PipelineActiveFilters) => void;
  view: PipelineWorkspaceView;
  /** Ops sort mode (client presentation re-order). */
  sortMode?: string;
  onSortChange?: (mode: string) => void;
  /** Lost-column sort options when lifecycle is closed_lost. */
  lostMode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activeCount =
    props.active.staffColumnIds.length +
    props.active.ownerIds.length +
    props.active.sources.length +
    props.active.urgency.length +
    props.active.lifecycle.length +
    (props.active.unassignedOnly ? 1 : 0) +
    (props.active.overdue ? 1 : 0) +
    (props.active.dueToday ? 1 : 0) +
    (props.active.consultationDue ? 1 : 0) +
    (props.active.highValue ? 1 : 0) +
    (props.active.ageBucket ? 1 : 0) +
    (props.active.activity ? 1 : 0) +
    (props.active.ownerId ? 1 : 0) +
    (props.active.sourceKey ? 1 : 0);

  const clear = () =>
    props.onChange({
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
    });

  const toggleCol = (id: PipelineStaffColumnId) => {
    const has = props.active.staffColumnIds.includes(id);
    props.onChange({
      ...props.active,
      staffColumnIds: has
        ? props.active.staffColumnIds.filter((x) => x !== id)
        : [...props.active.staffColumnIds, id],
    });
  };

  const sortOptions = props.lostMode
    ? [
        { value: "most_recently_lost", label: "Most recently lost" },
        { value: "oldest_lost", label: "Oldest lost" },
        { value: "newest_created", label: "Newest created" },
        { value: "oldest_created", label: "Oldest created" },
      ]
    : [
        { value: "newest_first", label: "Newest first" },
        { value: "oldest_first", label: "Oldest first" },
        { value: "recently_updated", label: "Recently updated" },
        { value: "oldest_untouched", label: "Oldest untouched" },
        { value: "operational", label: "Operational urgency" },
      ];

  const ageOptions = [
    { value: "", label: "Any age" },
    { value: "today", label: "Today" },
    { value: "last_7_days", label: "Last 7 days" },
    { value: "8_30_days", label: "8–30 days" },
    { value: "31_60_days", label: "31–60 days" },
    { value: "61_90_days", label: "61–90 days" },
    { value: "over_90_days", label: "Over 90 days" },
  ];

  const activityOptions = [
    { value: "", label: "Any activity" },
    { value: "has_overdue_follow_up", label: "Has overdue follow-up" },
    { value: "has_upcoming_follow_up", label: "Has upcoming follow-up" },
    { value: "no_follow_up", label: "No follow-up" },
    { value: "no_recent_contact", label: "No recent contact" },
    { value: "has_consultation", label: "Has consultation" },
    { value: "no_consultation", label: "No consultation" },
    { value: "unassigned", label: "Unassigned" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0b1220]/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <span className="text-xs text-slate-500">Sort</span>
          <select
            className="min-h-11 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1.5 text-sm text-slate-100"
            value={props.sortMode ?? "newest_first"}
            onChange={(e) => props.onSortChange?.(e.target.value)}
            aria-label="Sort enquiries"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <span className="text-xs text-slate-500">Age</span>
          <select
            className="min-h-11 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1.5 text-sm text-slate-100"
            value={props.active.ageBucket ?? ""}
            onChange={(e) =>
              props.onChange({
                ...props.active,
                ageBucket: e.target.value || null,
              })
            }
            aria-label="Filter by lead age"
          >
            {ageOptions.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <span className="text-xs text-slate-500">Activity</span>
          <select
            className="min-h-11 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1.5 text-sm text-slate-100"
            value={props.active.activity ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              props.onChange({
                ...props.active,
                activity: v,
                unassignedOnly: v === "unassigned" ? true : props.active.unassignedOnly,
                overdue: v === "has_overdue_follow_up" ? true : props.active.overdue,
              });
            }}
            aria-label="Filter by activity"
          >
            {activityOptions.map((o) => (
              <option key={o.value || "any-act"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={btnSecondary}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        {activeCount > 0 ? (
          <button type="button" className={btnGhost} onClick={clear}>
            Clear filters
          </button>
        ) : null}
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={props.active.overdue}
            onChange={(e) =>
              props.onChange({ ...props.active, overdue: e.target.checked })
            }
          />
          Overdue
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={props.active.dueToday}
            onChange={(e) =>
              props.onChange({ ...props.active, dueToday: e.target.checked })
            }
          />
          Due today
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={props.active.unassignedOnly}
            onChange={(e) =>
              props.onChange({ ...props.active, unassignedOnly: e.target.checked })
            }
          />
          Unassigned
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={props.active.highValue}
            onChange={(e) =>
              props.onChange({ ...props.active, highValue: e.target.checked })
            }
          />
          High value
        </label>
      </div>
      {open ? (
        <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
          <div className="flex flex-wrap gap-2">
            <p className="w-full text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Stage
            </p>
            {props.filters.staffColumns.map((opt) => {
              const colId = opt.id.replace(/^col:/, "") as PipelineStaffColumnId;
              const on = props.active.staffColumnIds.includes(colId);
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-filter-id={opt.id}
                  className={cn(
                    "min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium",
                    on
                      ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                      : "border-white/[0.1] text-slate-400"
                  )}
                  onClick={() => toggleCol(colId)}
                >
                  {opt.label} ({opt.count})
                </button>
              );
            })}
          </div>
          {props.filters.owners.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <p className="w-full text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Owner
              </p>
              {props.filters.owners.slice(0, 24).map((opt) => {
                const rawId = opt.id.replace(/^owner:/, "");
                const on =
                  props.active.ownerId === rawId ||
                  props.active.ownerIds.includes(opt.id) ||
                  props.active.ownerIds.includes(rawId);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium",
                      on
                        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                        : "border-white/[0.1] text-slate-400"
                    )}
                    onClick={() =>
                      props.onChange({
                        ...props.active,
                        ownerId: on ? null : rawId === "unassigned" ? null : rawId,
                        unassignedOnly: rawId === "unassigned" ? !on : props.active.unassignedOnly,
                        ownerIds: on ? [] : rawId === "unassigned" ? ["unassigned"] : [opt.id],
                      })
                    }
                  >
                    {opt.label} ({opt.count})
                  </button>
                );
              })}
            </div>
          ) : null}
          {props.filters.sources.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <p className="w-full text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Source
              </p>
              {props.filters.sources.slice(0, 16).map((opt) => {
                const key = opt.id.replace(/^source:/, "");
                const on =
                  props.active.sourceKey === key || props.active.sources.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium",
                      on
                        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                        : "border-white/[0.1] text-slate-400"
                    )}
                    onClick={() =>
                      props.onChange({
                        ...props.active,
                        sourceKey: on ? null : key === "unknown" ? null : key,
                        sources: on ? [] : [opt.id],
                      })
                    }
                  >
                    {opt.label} ({opt.count})
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {props.view === "follow_ups" ? (
        <p className="mt-2 text-xs text-slate-500">
          Follow-ups filters apply to task buckets from the presentation.
        </p>
      ) : null}
      {props.view === "inactive_review" ? (
        <p className="mt-2 text-xs text-slate-500">
          Inactive review lists older enquiries with no upcoming work. Status is not changed
          automatically.
        </p>
      ) : null}
    </div>
  );
}

// --- Truncation notice --------------------------------------------------------

export function PipelineTruncationNotice(props: {
  diagnostics: Pick<
    PipelinePresentationDiagnostics,
    "visibleLeadCount" | "sourceLeadCount" | "hiddenLeadCount"
  >;
}) {
  const msg = pipelineHiddenLeadsNotice(
    props.diagnostics.visibleLeadCount,
    props.diagnostics.sourceLeadCount,
    props.diagnostics.hiddenLeadCount
  );
  if (!msg) return null;
  return (
    <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="status">
      {msg}
    </p>
  );
}

// --- Board --------------------------------------------------------------------

export type PipelineCardActionHandler = (
  action: PipelineCardActionId,
  card: PipelineLeadCard
) => void;

export function PipelineBoard(props: {
  columns: readonly PipelinePresentationColumn[];
  busyLeadId: string | null;
  loadTier: "shell" | "full";
  nowMs: number;
  onAction: PipelineCardActionHandler;
  onMoveToColumn?: (card: PipelineLeadCard, columnId: PipelineStaffColumnId) => void;
  moveDestinations?: Array<{
    columnId: PipelineStaffColumnId;
    label: string;
    disabled: boolean;
    reason?: string;
  }>;
  /** `${view}:${epoch}` — changes on view switch or deliberate refresh only. */
  menuDismissKey?: string;
  /**
   * Desktop-only stage drag (fine pointer + large viewport). Never required on tablet/phone.
   * Keyboard users continue to use Move stage.
   */
  desktopDragEnabled?: boolean;
  onDesktopDrop?: (leadId: string, fromColumnId: PipelineStaffColumnId, toColumnId: PipelineStaffColumnId) => void;
}) {
  const [openMenuLeadId, setOpenMenuLeadId] = useState<string | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);

  // Close menu only when menuDismissKey changes (view or deliberate refresh epoch).
  // loadTier / generatedAt / sort must not flow into this key.
  const menuDismissInitializedRef = useRef(false);
  useEffect(() => {
    if (!menuDismissInitializedRef.current) {
      menuDismissInitializedRef.current = true;
      return;
    }
    moreLog("menuDismissKey changed", {
      detail: props.menuDismissKey ?? "unset",
      dismissalReason: "menu-dismiss-key",
    });
    setOpenMenuLeadId(null);
  }, [props.menuDismissKey]);

  // Close if the open card left the board (move, filter, removal).
  useEffect(() => {
    if (!openMenuLeadId) return;
    if (isOpenMenuLeadStillOnBoard(openMenuLeadId, props.columns)) return;
    moreLog("openMenuLeadId cleared", {
      dismissalReason: "card-removed",
    });
    setOpenMenuLeadId(null);
  }, [openMenuLeadId, props.columns]);

  const active = props.columns.filter((c) => c.kind === "active");
  const rest = props.columns.filter((c) => c.kind !== "active");

  const columnProps = {
    busyLeadId: props.busyLeadId,
    loadTier: props.loadTier,
    desktopDragEnabled: Boolean(props.desktopDragEnabled),
    dragLeadId,
    onDragLeadStart: (leadId: string) => setDragLeadId(leadId),
    onDragLeadEnd: () => setDragLeadId(null),
    onDesktopDrop: props.onDesktopDrop,
    nowMs: props.nowMs,
    onAction: props.onAction,
    onMoveToColumn: props.onMoveToColumn,
    moveDestinations: props.moveDestinations,
    openMenuLeadId,
    onOpenMenuLeadIdChange: setOpenMenuLeadId,
  };

  return (
    <div className="space-y-4">
      {/* Desktop: horizontal board for active columns */}
      <div className="hidden lg:block">
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          aria-label="Active pipeline stages"
        >
          {active.map((col) => (
            <PipelineColumn
              key={col.id}
              column={col}
              {...columnProps}
              layout="desktop"
            />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {rest.map((col) => (
            <PipelineColumn
              key={col.id}
              column={col}
              {...columnProps}
              layout="desktop-section"
            />
          ))}
        </div>
      </div>

      {/* Tablet / phone: vertical stack */}
      <div className="space-y-3 lg:hidden" aria-label="Pipeline stages">
        {[...active, ...rest].map((col) => (
          <PipelineColumn
            key={col.id}
            column={col}
            {...columnProps}
            layout="stack"
          />
        ))}
      </div>
    </div>
  );
}

export function PipelineColumn(props: {
  column: PipelinePresentationColumn;
  busyLeadId: string | null;
  loadTier: "shell" | "full";
  nowMs: number;
  onAction: PipelineCardActionHandler;
  onMoveToColumn?: (card: PipelineLeadCard, columnId: PipelineStaffColumnId) => void;
  moveDestinations?: Array<{
    columnId: PipelineStaffColumnId;
    label: string;
    disabled: boolean;
    reason?: string;
  }>;
  openMenuLeadId?: string | null;
  onOpenMenuLeadIdChange?: (leadId: string | null) => void;
  layout: "desktop" | "desktop-section" | "stack";
  desktopDragEnabled?: boolean;
  dragLeadId?: string | null;
  onDragLeadStart?: (leadId: string) => void;
  onDragLeadEnd?: () => void;
  onDesktopDrop?: (
    leadId: string,
    fromColumnId: PipelineStaffColumnId,
    toColumnId: PipelineStaffColumnId
  ) => void;
}) {
  const { column } = props;
  const defaultCollapsed =
    column.collapsedByDefault ||
    props.layout === "desktop-section" ||
    (props.layout === "stack" && column.kind !== "active");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const headingId = useId();
  const cap = 12;
  const cards = showAll ? column.cards : column.cards.slice(0, cap);
  const hidden = Math.max(0, column.cards.length - cards.length);
  // Drag only on desktop board layout — never on tablet/phone stack
  const allowDrop =
    Boolean(props.desktopDragEnabled) &&
    props.layout === "desktop" &&
    Boolean(props.onDesktopDrop);

  if (
    (column.kind === "terminal_won" ||
      column.kind === "terminal_lost" ||
      column.kind === "holding") &&
    column.count === 0 &&
    props.layout !== "desktop"
  ) {
    return null;
  }

  const shell =
    props.layout === "desktop"
      ? "flex w-80 shrink-0 flex-col rounded-2xl border border-white/[0.08] bg-[#0b1220]/90"
      : "rounded-2xl border border-white/[0.08] bg-[#0b1220]/90";

  return (
    <section
      className={cn(shell, dropHover && allowDrop ? "ring-2 ring-cyan-500/40" : null)}
      aria-labelledby={headingId}
      data-pipeline-column={column.id}
      data-pipeline-drop={allowDrop ? "true" : undefined}
      onDragOver={
        allowDrop
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropHover(true);
            }
          : undefined
      }
      onDragLeave={allowDrop ? () => setDropHover(false) : undefined}
      onDrop={
        allowDrop
          ? (e) => {
              e.preventDefault();
              setDropHover(false);
              const raw = e.dataTransfer.getData("application/x-pipeline-lead");
              if (!raw) return;
              try {
                const parsed = JSON.parse(raw) as {
                  leadId?: string;
                  fromColumnId?: PipelineStaffColumnId;
                };
                if (!parsed.leadId || !parsed.fromColumnId) return;
                props.onDesktopDrop?.(parsed.leadId, parsed.fromColumnId, column.id);
              } catch {
                /* invalid payload — snap back by doing nothing */
              }
              props.onDragLeadEnd?.();
            }
          : undefined
      }
    >
      <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0b1220]/95 px-3 py-3 backdrop-blur">
        <h2 id={headingId} className="text-sm font-semibold text-slate-100">
          {column.label}
          <span className="ml-2 text-xs font-medium text-slate-500">
            ({column.count})
          </span>
        </h2>
        <button
          type="button"
          className={cn(btnGhost, "min-h-11 px-2 text-xs")}
          aria-expanded={!collapsed}
          aria-controls={`${headingId}-body`}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      {!collapsed ? (
        <div id={`${headingId}-body`} className="flex flex-col gap-2 p-3">
          {cards.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-slate-500">No enquiries</p>
          ) : (
            cards.map((card, cardIndex) => (
              <PipelineLeadCardView
                key={card.leadId}
                cardIndex={cardIndex}
                card={card}
                busy={props.busyLeadId === card.leadId}
                loadTier={props.loadTier}
                nowMs={props.nowMs}
                onAction={props.onAction}
                onMoveToColumn={props.onMoveToColumn}
                moveDestinations={props.moveDestinations}
                menuOpen={props.openMenuLeadId === card.leadId}
                onMenuOpenChange={(open) => {
                  props.onOpenMenuLeadIdChange?.(open ? card.leadId : null);
                }}
                desktopDragEnabled={allowDrop}
                isDragging={props.dragLeadId === card.leadId}
                onPipelineDragStart={() => props.onDragLeadStart?.(card.leadId)}
                onPipelineDragEnd={() => props.onDragLeadEnd?.()}
              />
            ))
          )}
          {hidden > 0 ? (
            <button
              type="button"
              className={cn(btnSecondary, "w-full text-xs")}
              onClick={() => setShowAll(true)}
            >
              Show all ({column.count})
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// --- Lead card ----------------------------------------------------------------

export function PipelineLeadCardView(props: {
  card: PipelineLeadCard;
  /** PHI-safe render position for live More diagnostics. */
  cardIndex?: number;
  busy: boolean;
  loadTier: "shell" | "full";
  nowMs: number;
  onAction: PipelineCardActionHandler;
  onMoveToColumn?: (card: PipelineLeadCard, columnId: PipelineStaffColumnId) => void;
  moveDestinations?: Array<{
    columnId: PipelineStaffColumnId;
    label: string;
    disabled: boolean;
    reason?: string;
  }>;
  /** Controlled More-menu open state (single open menu per board). */
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  /** Desktop fine-pointer drag only (not used on tablet stack). */
  desktopDragEnabled?: boolean;
  isDragging?: boolean;
  onPipelineDragStart?: () => void;
  onPipelineDragEnd?: () => void;
}) {
  const { card } = props;
  const instanceRef = useRef(
    `more-instance-${Math.random().toString(36).slice(2, 8)}`
  );
  const [uncontrolledMenuOpen, setUncontrolledMenuOpen] = useState(false);
  const menuOpen = props.menuOpen ?? uncontrolledMenuOpen;
  const setMenuOpen = (open: boolean) => {
    moreLog("controlled open state", {
      instance: instanceRef.current,
      cardIndex: props.cardIndex,
      open,
      loadTier: props.loadTier,
    });
    if (props.onMenuOpenChange) props.onMenuOpenChange(open);
    else setUncontrolledMenuOpen(open);
  };
  useEffect(() => {
    moreLog(menuOpen ? "portal-MOUNT" : "portal-UNMOUNT", {
      instance: instanceRef.current,
      cardIndex: props.cardIndex,
      open: menuOpen,
      loadTier: props.loadTier,
    });
  }, [menuOpen, props.cardIndex, props.loadTier]);

  const [moveOpen, setMoveOpen] = useState(false);
  const dueLabel =
    props.loadTier === "full"
      ? formatPipelineDueLabel(
          card.nextAction.dueAtIso,
          card.nextAction.overdue,
          props.nowMs
        )
      : null;
  const consultLabel = pipelineConsultationLabel(card.consultation.state);
  const primary = card.primaryAction;
  const secondary = card.secondaryActions;

  // Drag is handle-only — never put draggable on the whole card (breaks More / Contact).
  const canDrag = Boolean(props.desktopDragEnabled) && !props.busy;
  const preventNativeDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <article
      data-lead-id={card.leadId}
      data-pipeline-draggable={canDrag ? "handle" : undefined}
      tabIndex={-1}
      aria-busy={props.busy || undefined}
      // Card itself is NOT draggable — only the dedicated handle is.
      className={cn(
        "rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 shadow-sm",
        props.busy && "opacity-70",
        props.isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {canDrag ? (
            <button
              type="button"
              aria-label="Drag to move stage"
              title="Drag to move stage"
              data-pipeline-drag-handle="true"
              draggable
              className="mt-0.5 inline-flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 active:cursor-grabbing"
              onPointerDown={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData(
                  "application/x-pipeline-lead",
                  JSON.stringify({
                    leadId: card.leadId,
                    fromColumnId: card.stage.staffColumnId,
                  })
                );
                e.dataTransfer.effectAllowed = "move";
                props.onPipelineDragStart?.();
              }}
              onDragEnd={() => props.onPipelineDragEnd?.()}
            >
              <span aria-hidden className="text-xs leading-none tracking-tighter">
                ⋮⋮
              </span>
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <Link
              href={card.links.lead}
              className="block truncate text-sm font-semibold text-slate-50 hover:text-cyan-200"
              draggable={false}
              onDragStart={preventNativeDrag}
              onClick={(e) => {
                e.preventDefault();
                props.onAction("open_lead", card);
              }}
            >
              {card.person.displayName}
            </Link>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {card.source.label}
              {" · "}
              {card.owner.unassigned ? "Unassigned" : card.owner.displayName ?? "Owner"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md border border-white/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            {card.stage.staffColumnLabel}
          </span>
          {card.score.highValue ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
              High value
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
        {card.contact.hasEmail ? (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5">Email</span>
        ) : null}
        {card.contact.hasPhone ? (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5">Phone</span>
        ) : null}
        {card.stage.daysInStage != null ? (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5">
            {card.stage.daysInStage}d in stage
          </span>
        ) : null}
        {consultLabel ? (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5">{consultLabel}</span>
        ) : null}
      </div>

      {props.loadTier === "full" && card.nextAction.kind !== "none" ? (
        <p className="mt-2 text-xs text-slate-300">
          <span className="font-medium text-slate-200">{card.nextAction.label}</span>
          {dueLabel ? (
            <span
              className={cn(
                "mt-0.5 block",
                card.nextAction.overdue ? "text-amber-200" : "text-slate-500"
              )}
            >
              {dueLabel}
            </span>
          ) : null}
        </p>
      ) : props.loadTier === "shell" ? (
        <p className="mt-2 text-xs text-slate-600">Next action loading…</p>
      ) : null}

      {card.blockers[0] ? (
        <p className="mt-2 text-xs text-rose-200/90">
          <span className="font-medium">{card.blockers[0].label}</span>
          {card.blockers.length > 1 ? (
            <span className="text-slate-500"> +{card.blockers.length - 1}</span>
          ) : null}
        </p>
      ) : null}

      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        data-pipeline-card-actions="true"
        onDragStart={preventNativeDrag}
      >
        {primary ? (
          <button
            type="button"
            className={btnPrimary}
            disabled={props.busy}
            draggable={false}
            onClick={() => {
              if (primary === "move_stage") setMoveOpen((v) => !v);
              else props.onAction(primary, card);
            }}
          >
            {pipelineCardActionLabel(primary)}
          </button>
        ) : null}
        {secondary.length > 0 ? (
          <DropdownMenu
            // Non-modal: avoid Radix RemoveScroll fighting slide-over / body lock
            // (stuck pointer-events / frozen page after assign or hard refresh).
            modal={false}
            open={menuOpen}
            onOpenChange={(open) => {
              moreLog(open ? "onOpenChange:true" : "onOpenChange:false", {
                instance: instanceRef.current,
                cardIndex: props.cardIndex,
                open,
                loadTier: props.loadTier,
              });
              setMenuOpen(open);
              if (open) setMoveOpen(false);
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={btnSecondary}
                disabled={props.busy}
                draggable={false}
                aria-label="More actions"
                data-pipeline-more-trigger="true"
                onPointerDown={() => {
                  moreLog("trigger:pointerdown", {
                    instance: instanceRef.current,
                    cardIndex: props.cardIndex,
                    loadTier: props.loadTier,
                  });
                }}
                onClick={() => {
                  moreLog("trigger:click", {
                    instance: instanceRef.current,
                    cardIndex: props.cardIndex,
                    loadTier: props.loadTier,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    moreLog("trigger:keydown Enter", {
                      instance: instanceRef.current,
                      cardIndex: props.cardIndex,
                      loadTier: props.loadTier,
                    });
                  }
                }}
              >
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-[80] min-w-[11rem] border-white/[0.12] bg-[#0f1629] text-slate-100"
              onPointerDownOutside={(e) => {
                const orig = (e as { detail?: { originalEvent?: PointerEvent } }).detail
                  ?.originalEvent;
                moreLog("onPointerDownOutside", {
                  instance: instanceRef.current,
                  cardIndex: props.cardIndex,
                  dismissalReason: "outside-pointer",
                  detail: orig ? `trusted=${orig.isTrusted}` : undefined,
                });
              }}
              onInteractOutside={(e) => {
                const orig = (e as { detail?: { originalEvent?: Event } }).detail?.originalEvent;
                moreLog("onInteractOutside", {
                  instance: instanceRef.current,
                  cardIndex: props.cardIndex,
                  dismissalReason: "outside-interact",
                  detail: orig ? `type=${orig.type}` : undefined,
                });
              }}
              onEscapeKeyDown={() => {
                moreLog("onEscapeKeyDown", {
                  instance: instanceRef.current,
                  cardIndex: props.cardIndex,
                  dismissalReason: "escape",
                });
              }}
              onFocusOutside={() => {
                moreLog("focusOutside", {
                  instance: instanceRef.current,
                  cardIndex: props.cardIndex,
                });
              }}
              onCloseAutoFocus={(e) => {
                moreLog("onCloseAutoFocus", {
                  instance: instanceRef.current,
                  cardIndex: props.cardIndex,
                  dismissalReason: "close-auto-focus",
                });
                // Keep focus restoration predictable after action selection
                e.preventDefault();
                const t = document.querySelector<HTMLElement>(
                  `[data-lead-id="${CSS.escape(card.leadId)}"] [data-pipeline-more-trigger]`
                );
                t?.focus?.();
              }}
            >
              {secondary.map((a) => (
                <DropdownMenuItem
                  key={a}
                  className="min-h-11 cursor-pointer text-sm text-slate-200 focus:bg-white/[0.08] focus:text-slate-50"
                  onSelect={() => {
                    setMenuOpen(false);
                    if (a === "move_stage") setMoveOpen(true);
                    else props.onAction(a, card);
                  }}
                >
                  {pipelineCardActionLabel(a)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {moveOpen && props.moveDestinations && props.onMoveToColumn ? (
        <div
          className="mt-2 rounded-xl border border-white/[0.1] bg-[#0a1020] p-2"
          role="menu"
          aria-label="Move stage destinations"
        >
          {props.moveDestinations.map((d) => (
            <button
              key={d.columnId}
              type="button"
              role="menuitem"
              disabled={d.disabled || props.busy}
              title={d.reason}
              className="block w-full min-h-11 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06] disabled:opacity-40"
              onClick={() => {
                setMoveOpen(false);
                if (!d.disabled) props.onMoveToColumn?.(card, d.columnId);
              }}
            >
              {d.label}
              {d.disabled && d.reason ? (
                <span className="mt-0.5 block text-[11px] text-slate-500">{d.reason}</span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            className="mt-1 w-full min-h-11 text-xs text-slate-500"
            onClick={() => setMoveOpen(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </article>
  );
}

// --- Follow-ups ---------------------------------------------------------------

export function PipelineFollowUps(props: {
  followUps: PipelineFollowUpView;
  busyTaskId: string | null;
  onTaskAction: (action: PipelineCardActionId, item: PipelineFollowUpItem) => void;
  onOpenLead: (leadId: string) => void;
}) {
  const buckets: Array<{
    key: keyof PipelineFollowUpView["buckets"];
    label: string;
    defaultOpen: boolean;
    hideEmpty?: boolean;
  }> = [
    { key: "overdue", label: "Overdue", defaultOpen: true },
    { key: "dueToday", label: "Due today", defaultOpen: true },
    { key: "upcoming", label: "Upcoming", defaultOpen: false },
    { key: "noDueDate", label: "No due date", defaultOpen: false },
    { key: "completed", label: "Completed", defaultOpen: false, hideEmpty: true },
  ];

  const total =
    props.followUps.summary.overdue +
    props.followUps.summary.dueToday +
    props.followUps.summary.upcoming +
    props.followUps.summary.noDueDate;

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0b1220] p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-100">No follow-ups right now</h2>
        <p className="mt-2 text-sm text-slate-400">
          When open tasks are due, they will appear here by urgency.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-label="Follow-ups">
      {buckets.map((b) => {
        const items = props.followUps.buckets[b.key];
        if (b.hideEmpty && items.length === 0) return null;
        return (
          <FollowUpBucket
            key={b.key}
            label={b.label}
            items={items}
            defaultOpen={b.defaultOpen}
            busyTaskId={props.busyTaskId}
            onTaskAction={props.onTaskAction}
            onOpenLead={props.onOpenLead}
          />
        );
      })}
    </div>
  );
}

function FollowUpBucket(props: {
  label: string;
  items: readonly PipelineFollowUpItem[];
  defaultOpen: boolean;
  busyTaskId: string | null;
  onTaskAction: (action: PipelineCardActionId, item: PipelineFollowUpItem) => void;
  onOpenLead: (leadId: string) => void;
}) {
  const [open, setOpen] = useState(props.defaultOpen);
  const id = useId();
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0b1220]/90">
      <button
        type="button"
        className="flex w-full min-h-11 items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <h2 className="text-sm font-semibold text-slate-100">
          {props.label}
          <span className="ml-2 text-xs font-medium text-slate-500">
            ({props.items.length})
          </span>
        </h2>
        <span className="text-xs text-slate-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ul id={id} className="space-y-2 border-t border-white/[0.06] p-3">
          {props.items.length === 0 ? (
            <li className="py-4 text-center text-xs text-slate-500">None</li>
          ) : (
            props.items.map((item) => (
              <li key={item.taskId}>
                <PipelineFollowUpItemView
                  item={item}
                  busy={props.busyTaskId === item.taskId}
                  onTaskAction={props.onTaskAction}
                  onOpenLead={props.onOpenLead}
                />
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}

export function PipelineFollowUpItemView(props: {
  item: PipelineFollowUpItem;
  busy: boolean;
  onTaskAction: (action: PipelineCardActionId, item: PipelineFollowUpItem) => void;
  onOpenLead: (leadId: string) => void;
}) {
  const { item } = props;
  return (
    <div
      data-task-id={item.taskId}
      aria-busy={props.busy || undefined}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <button
            type="button"
            className="text-left text-sm font-semibold text-slate-100 hover:text-cyan-200"
            onClick={() => props.onOpenLead(item.leadId)}
          >
            {item.personDisplayName}
          </button>
          <p className="mt-0.5 text-xs text-slate-300">{item.title}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {item.dueAtIso
              ? `Due ${item.dueAtIso.slice(0, 10)}`
              : "No due date"}
            {" · "}
            {item.assignee.displayName ??
              (item.assignee.userId ? "Assigned" : "Unassigned task")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.allowedActions.map((a) => (
            <button
              key={a}
              type="button"
              className={a === "complete_follow_up" ? btnPrimary : btnSecondary}
              disabled={props.busy}
              onClick={() => {
                if (a === "open_lead") props.onOpenLead(item.leadId);
                else props.onTaskAction(a, item);
              }}
            >
              {pipelineCardActionLabel(a)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Empty --------------------------------------------------------------------

export function PipelineEmptyState(props: {
  canCreate: boolean;
  onNewEnquiry: () => void;
  onClearFilters?: () => void;
  hasFilters?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b1220] px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-100">No enquiries to show</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
        {props.hasFilters
          ? "Nothing matches the current filters. Clear filters or add a new enquiry."
          : "When new enquiries arrive, they will appear on the Pipeline board."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {props.canCreate ? (
          <button type="button" className={btnPrimary} onClick={props.onNewEnquiry}>
            New enquiry
          </button>
        ) : null}
        {props.hasFilters && props.onClearFilters ? (
          <button type="button" className={btnSecondary} onClick={props.onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PipelineReadOnlyNotice() {
  return (
    <p
      role="status"
      className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
    >
      Read-only: you can browse Pipeline and open leads, but changes are unavailable.
    </p>
  );
}

export function PipelineLiveRegion(props: { message: string }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {props.message}
    </div>
  );
}

export function PipelineGlobalActionsBar(props: {
  actions: readonly PipelineGlobalAction[];
}) {
  if (!props.actions.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Pipeline actions">
      {props.actions.map((a) =>
        a.href ? (
          <Link key={a.id} href={a.href} className={btnSecondary}>
            {a.label}
          </Link>
        ) : (
          <span key={a.id} className={btnSecondary}>
            {a.label}
          </span>
        )
      )}
    </div>
  );
}

// re-export types used by workspace for convenience
export type { PipelineLeadCard, PipelineCardActionId };
