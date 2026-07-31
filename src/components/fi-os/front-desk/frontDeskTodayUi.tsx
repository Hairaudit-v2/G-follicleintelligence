"use client";

/**
 * FI-UX-REBUILD-1 S3.3 — Front Desk Today presentational components.
 * Children receive only presentation slices + callbacks (no raw payload).
 */

import Link from "next/link";
import React, { useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { FiOsEmptyState } from "@/src/components/fi-admin/shared/FiOsEmptyState";
import {
  FRONT_DESK_OPERATIONAL_STATE_LABELS,
  FRONT_DESK_SEVERITY_LABELS,
  frontDeskCardActionLabel,
  isFrontDeskFlowActionId,
  orderFrontDeskCardActions,
  paymentNeedsAttention,
} from "@/src/lib/fiOs/frontDesk/frontDeskTodayUiHelpers";
import type {
  FrontDeskAttentionItem,
  FrontDeskCardActionId,
  FrontDeskMutationMode,
  FrontDeskPrepRiskItem,
  FrontDeskSeverity,
  FrontDeskTodayCard,
  FrontDeskTodayGlobalAction,
  FrontDeskTodayLane,
  FrontDeskTodayPresentation,
  FrontDeskTodaySummary,
} from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types";

// --- tokens -------------------------------------------------------------------

const btnBase =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-40";

const btnPrimary = cn(
  btnBase,
  "border border-cyan-500/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
);

const btnSecondary = cn(
  btnBase,
  "border border-white/[0.12] bg-white/[0.04] text-slate-200 hover:border-cyan-500/30"
);

const btnDanger = cn(
  btnBase,
  "border border-rose-500/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
);

// --- header -------------------------------------------------------------------

export function FrontDeskTodayHeader(props: {
  tenantName: string;
  todayYmd: string;
  calendarTimezone: string;
  loadTier: "shell" | "full";
  isRefreshing: boolean;
  lastRefreshedAt: Date | null;
  refreshError: string | null;
  onRefresh: () => void;
}) {
  const dateLabel = formatDayLabel(props.todayYmd, props.calendarTimezone);
  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1220] p-5 sm:p-7">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_280px_at_0%_0%,rgba(34,193,255,0.12),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400/90">
            Front desk
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Today
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {props.tenantName}
            {dateLabel ? ` · ${dateLabel}` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.isRefreshing ? (
            <span className="text-xs font-medium text-cyan-300/90" aria-live="polite">
              Updating…
            </span>
          ) : props.loadTier === "shell" ? (
            <span className="text-xs font-medium text-slate-500">Loading details…</span>
          ) : props.lastRefreshedAt ? (
            <span className="text-xs text-slate-500">
              Updated{" "}
              {props.lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
          {props.refreshError ? (
            <span className="text-xs text-amber-300/90" role="status">
              Couldn’t refresh — showing last update
            </span>
          ) : null}
          <button type="button" className={btnSecondary} onClick={props.onRefresh}>
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}

export function FrontDeskSessionBanner(props: { mutationMode: FrontDeskMutationMode }) {
  if (props.mutationMode === "full") return null;
  if (props.mutationMode === "pin_reception") {
    return (
      <div
        role="status"
        className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      >
        PIN session: you can check patients in and advance the day. Cancel is not available.
      </div>
    );
  }
  return (
    <div
      role="status"
      className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
    >
      Read-only: you can browse Today, but flow actions are unavailable. Sign in with full clinic
      access to check patients in.
    </div>
  );
}

export function FrontDeskTodaySummaryTiles(props: { summary: FrontDeskTodaySummary }) {
  const s = props.summary;
  const tiles = [
    { label: "Running late", value: s.runningLate, tone: "rose" as const },
    { label: "Waiting", value: s.waiting, tone: "amber" as const },
    { label: "Arriving soon", value: s.arrivingSoon + s.expected, tone: "cyan" as const },
    { label: "In care", value: s.inConsultation + s.inTreatment, tone: "cyan" as const },
    { label: "Payment due", value: s.paymentAttention, tone: "amber" as const },
    { label: "Blockers", value: s.blockers, tone: "rose" as const },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Day summary">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-white/[0.08] bg-[#0f1729]/80 px-3 py-3"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t.label}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              t.tone === "rose" && t.value > 0 && "text-rose-200",
              t.tone === "amber" && t.value > 0 && "text-amber-200",
              t.tone === "cyan" && "text-slate-50",
              t.value === 0 && "text-slate-400"
            )}
          >
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// --- prep risk strip (Smart Scheduling) ---------------------------------------

/**
 * Card grid for today's open scheduling_prep checklist items.
 * Warm, actionable — operational only.
 */
export function FrontDeskPrepRiskStrip(props: {
  items: FrontDeskPrepRiskItem[];
  loadTier: "shell" | "full";
  onLocateCard: (bookingId: string) => void;
}) {
  if (props.loadTier === "shell") return null;

  if (props.items.length === 0) {
    return (
      <section
        aria-label="Prep checklist"
        className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0b1220]/80 px-4 py-4 sm:px-5"
        data-testid="front-desk-prep-risk-strip"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200/90"
            aria-hidden
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-100">Prep for today</h2>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                All clear
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              No open prep items on today’s bookings. When you book with Smart Scheduling, gentle
              reminders (photos, consent, forms) show up here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const attentionN = props.items.filter((i) => i.severity === "action_needed").length;
  const visible = props.items.slice(0, 6);

  return (
    <section
      aria-label={`Prep for today, ${props.items.length} bookings with open items`}
      className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-950/35 to-[#0b1220]/90 px-4 py-4 shadow-lg shadow-black/20 sm:px-5"
      data-testid="front-desk-prep-risk-strip"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">
            Smart Scheduling
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-50">
            Prep for today
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
            Open operational checklists before the visit — photos, consent, forms. Not clinical
            advice.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {attentionN > 0 ? (
            <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-amber-100">
              {attentionN} need a look
            </span>
          ) : null}
          <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-cyan-100">
            {props.items.length} booking{props.items.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {visible.map((item) => (
          <li key={item.id} className="min-w-0">
            <PrepRiskCard item={item} onLocate={() => props.onLocateCard(item.bookingId)} />
          </li>
        ))}
      </ul>

      {props.items.length > 6 ? (
        <p className="mt-3 text-[11px] leading-snug text-slate-500">
          Showing 6 of {props.items.length}. Scroll the board or use{" "}
          <span className="text-slate-400">Needs attention</span> for the rest.
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500">
          Tap a card to jump to that patient on the board.
        </p>
      )}
    </section>
  );
}

function PrepRiskCard(props: {
  item: FrontDeskPrepRiskItem;
  onLocate: () => void;
}) {
  const { item } = props;
  const needsLook = item.severity === "action_needed";
  const chips = item.topLabels.slice(0, 4);
  const extra = Math.max(0, item.openCount - chips.length);

  return (
    <button
      type="button"
      onClick={props.onLocate}
      className={cn(
        "group flex h-full w-full min-h-[5.5rem] flex-col rounded-2xl border p-3 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220]",
        "hover:border-cyan-400/35 hover:bg-white/[0.04] active:scale-[0.99]",
        needsLook
          ? "border-amber-400/35 bg-amber-950/30 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.08)]"
          : "border-white/[0.1] bg-[#0f1729]/80"
      )}
      data-testid={`front-desk-prep-risk-${item.bookingId}`}
      aria-label={`${item.startTimeLabel}, ${item.patientName}, ${item.openCount} prep items open. Locate on board.`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex min-h-7 items-center rounded-lg px-2 text-xs font-bold tabular-nums",
                needsLook
                  ? "bg-amber-500/20 text-amber-50"
                  : "bg-cyan-500/15 text-cyan-100"
              )}
            >
              {item.startTimeLabel}
            </span>
            <span className="truncate text-sm font-semibold text-slate-50">
              {item.patientName}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            needsLook
              ? "bg-amber-500/20 text-amber-100"
              : "bg-white/[0.06] text-slate-400"
          )}
        >
          {item.openCount} open
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {chips.map((label) => (
          <span
            key={label}
            className={cn(
              "inline-flex max-w-full items-center truncate rounded-lg border px-2 py-1 text-[11px] font-medium",
              needsLook
                ? "border-amber-400/25 bg-amber-500/10 text-amber-50/95"
                : "border-white/[0.08] bg-white/[0.04] text-slate-300"
            )}
            title={label}
          >
            {label}
          </span>
        ))}
        {extra > 0 ? (
          <span className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-slate-500">
            +{extra} more
          </span>
        ) : null}
      </div>

      <span className="mt-auto pt-2 text-[10px] font-medium text-cyan-300/70 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        Locate on board →
      </span>
    </button>
  );
}

// --- attention ----------------------------------------------------------------

export function FrontDeskAttentionPanel(props: {
  items: FrontDeskAttentionItem[];
  attentionSummary: FrontDeskTodayPresentation["attentionSummary"];
  loadTier: "shell" | "full";
  onLocateCard: (bookingId: string) => void;
  tabletPreviewLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = props.tabletPreviewLimit ?? 6;
  const visible =
    expanded || props.items.length <= preview ? props.items : props.items.slice(0, preview);
  const moreLocal = props.items.length - visible.length;

  if (props.loadTier === "shell" && props.items.length === 0) {
    return (
      <section
        aria-label="Needs attention"
        className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/50 px-4 py-4"
      >
        <h2 className="text-sm font-semibold text-slate-200">Needs attention</h2>
        <p className="mt-2 text-sm text-slate-500">Loading day details…</p>
      </section>
    );
  }

  if (props.items.length === 0) {
    return (
      <section
        aria-label="Needs attention"
        className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/50 px-4 py-4"
      >
        <h2 className="text-sm font-semibold text-slate-200">Needs attention</h2>
        <p className="mt-2 text-sm text-slate-500">Nothing urgent for the desk right now.</p>
      </section>
    );
  }

  return (
    <section
      aria-label={`Needs attention, ${props.attentionSummary.total} items`}
      className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/70 px-4 py-4 sm:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Needs attention</h2>
        <p className="text-xs text-slate-500">
          Showing {props.attentionSummary.visible}
          {props.attentionSummary.hidden > 0
            ? ` · ${props.attentionSummary.hidden} more not shown`
            : null}
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {visible.map((item) => (
          <li key={item.id}>
            <AttentionRow item={item} onLocateCard={props.onLocateCard} />
          </li>
        ))}
      </ul>
      {moreLocal > 0 ? (
        <button
          type="button"
          className={cn(btnSecondary, "mt-3 w-full sm:w-auto")}
          aria-expanded={expanded}
          onClick={() => setExpanded(true)}
        >
          Show {moreLocal} more
        </button>
      ) : null}
      {props.attentionSummary.hidden > 0 ? (
        <p className="mt-2 text-xs text-slate-500" role="status">
          {props.attentionSummary.hidden} additional items are capped by the day board (max 12
          shown).
        </p>
      ) : null}
    </section>
  );
}

function AttentionRow(props: {
  item: FrontDeskAttentionItem;
  onLocateCard: (bookingId: string) => void;
}) {
  const { item } = props;
  const severityLabel = FRONT_DESK_SEVERITY_LABELS[item.severity];
  const className = cn(
    "flex w-full min-h-11 flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition",
    item.severity === "blocker" && "border-rose-500/30 bg-rose-500/10",
    item.severity === "action_needed" && "border-amber-500/30 bg-amber-500/10",
    item.severity === "information" && "border-white/[0.08] bg-white/[0.03]"
  );

  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <SeverityMark severity={item.severity} />
        {severityLabel}
      </span>
      <span className="text-sm font-semibold text-slate-100">{item.title}</span>
      <span className="text-xs text-slate-400">{item.detail}</span>
    </>
  );

  if (item.bookingId) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => props.onLocateCard(item.bookingId!)}
      >
        {body}
      </button>
    );
  }
  if (item.href) {
    return (
      <Link href={item.href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function SeverityMark({ severity }: { severity: FrontDeskSeverity }) {
  const symbol = severity === "blocker" ? "!" : severity === "action_needed" ? "•" : "i";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-bold",
        severity === "blocker" && "bg-rose-500/30 text-rose-100",
        severity === "action_needed" && "bg-amber-500/30 text-amber-100",
        severity === "information" && "bg-slate-500/30 text-slate-200"
      )}
    >
      {symbol}
    </span>
  );
}

// --- lanes --------------------------------------------------------------------

export function FrontDeskLaneBoard(props: {
  lanes: FrontDeskTodayLane[];
  busyBookingId: string | null;
  highlightBookingId: string | null;
  paymentsHref: string;
  onAction: (action: FrontDeskCardActionId, bookingId: string) => void;
  laneRevealLimit?: number;
}) {
  const limit = props.laneRevealLimit ?? 8;
  const active = props.lanes.filter((l) => l.count > 0);
  if (active.length === 0) {
    return null;
  }
  return (
    <div className="space-y-4">
      {active.map((lane) => (
        <FrontDeskLane
          key={lane.id}
          lane={lane}
          busyBookingId={props.busyBookingId}
          highlightBookingId={props.highlightBookingId}
          paymentsHref={props.paymentsHref}
          onAction={props.onAction}
          revealLimit={limit}
        />
      ))}
    </div>
  );
}

export function FrontDeskLane(props: {
  lane: FrontDeskTodayLane;
  busyBookingId: string | null;
  highlightBookingId: string | null;
  paymentsHref: string;
  onAction: (action: FrontDeskCardActionId, bookingId: string) => void;
  revealLimit: number;
}) {
  const { lane } = props;
  const [collapsed, setCollapsed] = useState(lane.collapsedByDefault);
  const [revealed, setRevealed] = useState(false);
  const panelId = useId();
  const cards =
    revealed || lane.cards.length <= props.revealLimit
      ? lane.cards
      : lane.cards.slice(0, props.revealLimit);
  const hidden = lane.cards.length - cards.length;

  const accent =
    lane.id === "running_late"
      ? "border-rose-500/35"
      : lane.id === "waiting"
        ? "border-amber-500/30"
        : "border-white/[0.08]";

  return (
    <section
      aria-labelledby={`${panelId}-heading`}
      className={cn("rounded-2xl border bg-[#0c1424]/80", accent)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <h2 id={`${panelId}-heading`} className="text-sm font-semibold text-slate-100">
          {lane.label} <span className="tabular-nums text-slate-400">({lane.count})</span>
        </h2>
        {lane.collapsedByDefault ? (
          <button
            type="button"
            className={btnSecondary}
            aria-expanded={!collapsed}
            aria-controls={`${panelId}-body`}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? "Show" : "Hide"}
          </button>
        ) : null}
      </div>
      {!collapsed ? (
        <div id={`${panelId}-body`} className="space-y-3 p-3 sm:p-4">
          {cards.map((card) => (
            <FrontDeskPatientCard
              key={card.bookingId}
              card={card}
              busy={props.busyBookingId === card.bookingId}
              highlighted={props.highlightBookingId === card.bookingId}
              paymentsHref={props.paymentsHref}
              onAction={props.onAction}
            />
          ))}
          {hidden > 0 ? (
            <button
              type="button"
              className={cn(btnSecondary, "w-full")}
              onClick={() => setRevealed(true)}
            >
              Show all ({lane.count})
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function FrontDeskTerminalSection(props: {
  cancelled: FrontDeskTodayCard[];
  noShow: FrontDeskTodayCard[];
  busyBookingId: string | null;
  highlightBookingId: string | null;
  paymentsHref: string;
  onAction: (action: FrontDeskCardActionId, bookingId: string) => void;
}) {
  const total = props.cancelled.length + props.noShow.length;
  const [open, setOpen] = useState(false);
  const id = useId();
  if (total === 0) return null;

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-2xl border border-white/[0.06] bg-[#0a101c]/80"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 id={`${id}-heading`} className="text-sm font-semibold text-slate-300">
          Cancelled & no-show <span className="tabular-nums text-slate-500">({total})</span>
        </h2>
        <button
          type="button"
          className={btnSecondary}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? (
        <div id={`${id}-body`} className="space-y-3 border-t border-white/[0.06] p-3 sm:p-4">
          {[...props.cancelled, ...props.noShow].map((card) => (
            <FrontDeskPatientCard
              key={card.bookingId}
              card={card}
              busy={props.busyBookingId === card.bookingId}
              highlighted={props.highlightBookingId === card.bookingId}
              paymentsHref={props.paymentsHref}
              onAction={props.onAction}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// --- card ---------------------------------------------------------------------

export function FrontDeskPatientCard(props: {
  card: FrontDeskTodayCard;
  busy: boolean;
  highlighted: boolean;
  paymentsHref: string;
  onAction: (action: FrontDeskCardActionId, bookingId: string) => void;
}) {
  const { card } = props;
  const { primary, secondary } = useMemo(() => orderFrontDeskCardActions(card), [card]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const stateLabel = FRONT_DESK_OPERATIONAL_STATE_LABELS[card.operationalState];
  const paymentMuted = card.payment.state === "unknown";
  const secondaryCount = Math.max(0, card.blocker.items.length - 1);

  return (
    <article
      data-booking-id={card.bookingId}
      tabIndex={-1}
      className={cn(
        "rounded-xl border border-white/[0.09] bg-[#0f1729]/90 p-4 shadow-sm transition",
        card.runningLate && "border-rose-500/40",
        props.highlighted && "ring-2 ring-cyan-400/70",
        props.busy && "opacity-70"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {card.links.patient ? (
              <Link
                href={card.links.patient}
                className="truncate text-base font-semibold text-slate-50 underline-offset-2 hover:underline"
              >
                {card.patient.displayName}
              </Link>
            ) : (
              <p className="truncate text-base font-semibold text-slate-50">
                {card.patient.displayName}
              </p>
            )}
            <StateChip
              state={card.operationalState}
              label={stateLabel}
              runningLate={card.runningLate}
            />
          </div>
          <p className="text-sm text-slate-300">
            <span className="font-medium tabular-nums text-slate-100">
              {card.appointment.startTimeLabel}
            </span>
            {" · "}
            {card.appointment.typeLabel}
            {card.appointment.durationMinutes != null
              ? ` · ${card.appointment.durationMinutes} min`
              : null}
          </p>
          <p className="text-xs text-slate-500">
            {card.resource.clinicianLabel}
            {card.resource.roomLabel ? ` · ${card.resource.roomLabel}` : null}
          </p>
          <p
            className={cn(
              "text-xs font-medium",
              paymentMuted && "text-slate-500",
              paymentNeedsAttention(card.payment.state) && "text-amber-200",
              card.payment.state === "paid" && "text-emerald-300/90"
            )}
          >
            {paymentMuted ? "Payment —" : card.payment.label}
          </p>
          {card.blocker.summary ? (
            <p className="text-xs text-rose-200/90">
              <SeverityMark severity={card.blocker.highest ?? "information"} />{" "}
              {card.blocker.summary}
              {secondaryCount > 0 ? (
                <span className="text-slate-400"> · +{secondaryCount} more</span>
              ) : null}
            </p>
          ) : null}
          {card.waitingMinutes != null ? (
            <p className="text-xs text-slate-500">Waiting {card.waitingMinutes} min</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {primary ? (
            isFrontDeskFlowActionId(primary) ? (
              <button
                type="button"
                className={card.runningLate && primary === "check_in" ? btnDanger : btnPrimary}
                disabled={props.busy}
                onClick={() => props.onAction(primary, card.bookingId)}
              >
                {frontDeskCardActionLabel(primary)}
              </button>
            ) : (
              <NavActionButton
                action={primary}
                card={card}
                paymentsHref={props.paymentsHref}
                className={btnPrimary}
              />
            )
          ) : null}

          {secondary.some((a) => a === "take_payment") &&
          paymentNeedsAttention(card.payment.state) ? (
            <NavActionButton
              action="take_payment"
              card={card}
              paymentsHref={props.paymentsHref}
              className={btnSecondary}
            />
          ) : null}

          {secondary.filter(
            (a) => a !== "take_payment" || !paymentNeedsAttention(card.payment.state)
          ).length > 0 ? (
            <div className="relative">
              <button
                type="button"
                className={btnSecondary}
                aria-expanded={menuOpen}
                aria-controls={menuId}
                aria-haspopup="menu"
                disabled={props.busy}
                onClick={() => setMenuOpen((o) => !o)}
              >
                More actions
              </button>
              {menuOpen ? (
                <ul
                  id={menuId}
                  role="menu"
                  className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-xl border border-white/[0.12] bg-[#0b1220] py-1 shadow-xl"
                >
                  {secondary
                    .filter(
                      (a) => !(a === "take_payment" && paymentNeedsAttention(card.payment.state))
                    )
                    .map((action) => (
                      <li key={action} role="none">
                        {isFrontDeskFlowActionId(action) ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06]"
                            onClick={() => {
                              setMenuOpen(false);
                              props.onAction(action, card.bookingId);
                            }}
                          >
                            {frontDeskCardActionLabel(action)}
                          </button>
                        ) : (
                          <NavActionMenuItem
                            action={action}
                            card={card}
                            paymentsHref={props.paymentsHref}
                            onNavigate={() => setMenuOpen(false)}
                          />
                        )}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function NavActionButton(props: {
  action: FrontDeskCardActionId;
  card: FrontDeskTodayCard;
  paymentsHref: string;
  className: string;
}) {
  const href = hrefForNavAction(props.action, props.card, props.paymentsHref);
  if (!href) return null;
  return (
    <Link href={href} className={props.className}>
      {frontDeskCardActionLabel(props.action)}
    </Link>
  );
}

function NavActionMenuItem(props: {
  action: FrontDeskCardActionId;
  card: FrontDeskTodayCard;
  paymentsHref: string;
  onNavigate: () => void;
}) {
  const href = hrefForNavAction(props.action, props.card, props.paymentsHref);
  if (!href) return null;
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06]"
      onClick={props.onNavigate}
    >
      {frontDeskCardActionLabel(props.action)}
    </Link>
  );
}

function hrefForNavAction(
  action: FrontDeskCardActionId,
  card: FrontDeskTodayCard,
  paymentsHref: string
): string | null {
  switch (action) {
    case "take_payment":
      return paymentsHref;
    case "open_patient":
      return card.links.patient;
    case "open_calendar":
      return card.links.calendar;
    case "find_patient":
      return card.links.patient ?? null;
    default:
      return null;
  }
}

// Fix take_payment: always /payments for tenant — parent will pass correct global action.
// Card-level take_payment should use tenant payments path from links.
// We'll override in board when handling take_payment navigation.

function StateChip(props: {
  state: FrontDeskTodayCard["operationalState"];
  label: string;
  runningLate: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        props.runningLate && "border-rose-500/40 bg-rose-500/15 text-rose-100",
        props.state === "waiting" && "border-amber-500/35 bg-amber-500/10 text-amber-100",
        props.state === "arriving_soon" && "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
        props.state === "expected" && "border-white/15 bg-white/[0.04] text-slate-300",
        (props.state === "in_consultation" || props.state === "in_treatment") &&
          "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
        props.state === "complete" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
      )}
    >
      {props.runningLate ? <span aria-hidden>!</span> : null}
      {props.label}
    </span>
  );
}

// --- global actions -----------------------------------------------------------

export function FrontDeskTodayActionsBar(props: {
  actions: FrontDeskTodayGlobalAction[];
  paymentsHref: string;
  onFindPatient: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Desk actions">
      {props.actions.map((action) => {
        if (action.id === "find_patient") {
          return (
            <button
              key={action.id}
              type="button"
              className={btnPrimary}
              onClick={props.onFindPatient}
            >
              {action.label}
            </button>
          );
        }
        const href = action.id === "take_payment" ? props.paymentsHref : action.href;
        return (
          <Link
            key={action.id}
            href={href}
            className={action.id === "take_payment" ? btnPrimary : btnSecondary}
          >
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}

export function FrontDeskTodayEmptyDay(props: {
  actions: FrontDeskTodayGlobalAction[];
  paymentsHref: string;
  onFindPatient: () => void;
}) {
  const calendar = props.actions.find((a) => a.id === "open_calendar" || a.id === "new_booking");
  return (
    <FiOsEmptyState
      title="No patients on the board yet"
      description="When today’s bookings arrive, they’ll appear here by Running late, Waiting, and Arriving soon."
      action={
        calendar
          ? { label: "Open calendar", href: calendar.href }
          : { label: "Find patient", href: "#" }
      }
      secondaryAction={{ label: "Take payment", href: props.paymentsHref }}
    />
  );
}

// --- live region --------------------------------------------------------------

export function FrontDeskLiveRegion(props: { message: string }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {props.message}
    </div>
  );
}

function formatDayLabel(ymd: string, tz: string): string {
  if (!ymd) return "";
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return ymd;
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dt);
  } catch {
    return ymd;
  }
}
