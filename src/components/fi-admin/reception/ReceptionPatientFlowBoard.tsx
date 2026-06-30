"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { receptionBoardFlowAction } from "@/lib/actions/reception-board-flow-action";
import { cn } from "@/lib/utils";
import { useCalendarToastOptional } from "@/components/calendar/CalendarToast";
import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import {
  buildReceptionFlowBoardItems,
  RECEPTION_FLOW_LANES,
  type ReceptionFlowBoardItem,
} from "@/src/lib/fiAdmin/receptionBoardPresentation";

export type ReceptionMutationMode = "full" | "pin_reception" | "none";

export function ReceptionPatientFlowBoard(props: {
  tenantId: string;
  base: string;
  calendarTimezone: string;
  cards: ReceptionBoardCard[];
  mutationMode: ReceptionMutationMode;
}) {
  const { tenantId, base, calendarTimezone, cards, mutationMode } = props;
  const router = useRouter();
  const toast = useCalendarToastOptional();
  const [busyId, setBusyId] = useState<string | null>(null);

  const lanes = useMemo(() => buildReceptionFlowBoardItems(cards), [cards]);

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: calendarTimezone.trim() || undefined,
      }),
    [calendarTimezone]
  );

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    try {
      const r = await fn();
      if (!r.ok) {
        toast?.error(r.error ?? "Update failed.");
        return;
      }
      toast?.success("Updated.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const canFlo = mutationMode === "full" || mutationMode === "pin_reception";
  const canCancel = mutationMode === "full";
  const visibleLanes = RECEPTION_FLOW_LANES.filter((lane) => lanes[lane.id].length > 0);

  if (visibleLanes.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4 text-sm text-[#94A3B8]">
        No active patient flow for this operational day. Confirm visits are scheduled in{" "}
        <Link
          className="font-medium text-[#22C1FF]/90 underline-offset-2 hover:underline"
          href={`${base}/calendar`}
        >
          Calendar
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {visibleLanes.map((lane) => (
        <section
          key={lane.id}
          className="flex w-[min(100%,19rem)] shrink-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/75 shadow-inner shadow-black/25"
          aria-labelledby={`reception-lane-${lane.id}`}
        >
          <header className="border-b border-white/[0.06] px-3 py-2.5">
            <h3
              id={`reception-lane-${lane.id}`}
              className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]"
            >
              {lane.label}
            </h3>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#F8FAFC]">
              {lanes[lane.id].length}
            </p>
          </header>
          <ul className="flex max-h-[70vh] min-h-[10rem] flex-col gap-2 overflow-y-auto p-2">
            {lanes[lane.id].map((item) => (
              <li key={item.card.id}>
                <ReceptionFlowPatientCard
                  item={item}
                  tenantId={tenantId}
                  base={base}
                  timeLabel={timeFmt.format(new Date(item.card.startAt))}
                  busy={busyId === item.card.id}
                  canFlo={canFlo}
                  canCancel={canCancel}
                  onAction={(fn) => run(item.card.id, fn)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ReceptionFlowPatientCard(props: {
  item: ReceptionFlowBoardItem;
  tenantId: string;
  base: string;
  timeLabel: string;
  busy: boolean;
  canFlo: boolean;
  canCancel: boolean;
  onAction: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const { item, tenantId, base, timeLabel, busy, canFlo, canCancel, onAction } = props;
  const { card, missingItems, nextAction } = item;
  const apptHref = `${base}/appointments/${encodeURIComponent(card.id)}`;
  const terminal = card.receptionColumn === "complete";

  return (
    <article
      className={cn(
        "rounded-lg border px-2.5 py-2 text-left shadow-sm transition",
        terminal
          ? "border-white/[0.05] bg-white/[0.02]"
          : "border-cyan-500/15 bg-[#141c33]/90 hover:border-cyan-500/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#F8FAFC]">{card.displayName}</p>
        <span className="shrink-0 text-xs tabular-nums text-[#94A3B8]">{timeLabel}</span>
      </div>
      <p className="mt-1 text-xs text-[#64748B]">
        {card.typeLabel} · {card.statusLabel}
      </p>
      {missingItems.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {missingItems.slice(0, 2).map((m) => (
            <li key={m} className="text-[0.65rem] font-medium text-amber-200/90">
              {m}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[0.65rem] leading-snug text-[#64748B]">{nextAction}</p>

      <div className="mt-2 flex flex-wrap gap-1">
        {!terminal && canFlo && card.receptionColumn === "expected" ? (
          <ActionChip
            label="Check in"
            disabled={busy}
            onPress={() =>
              onAction(() =>
                receptionBoardFlowAction(tenantId, card.id, { action: "mark_arrived" })
              )
            }
          />
        ) : null}
        {!terminal && canFlo
          ? renderFlowActions(card, tenantId, busy, canCancel, canFlo, onAction)
          : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[0.65rem] font-semibold">
        <Link className="text-[#22C1FF]/90 hover:text-[#22C1FF] hover:underline" href={apptHref}>
          Open booking
        </Link>
        {card.patientId ? (
          <Link
            className="text-[#22C1FF]/90 hover:text-[#22C1FF] hover:underline"
            href={`${base}/patients/${encodeURIComponent(card.patientId)}`}
          >
            Open patient
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function renderFlowActions(
  card: ReceptionBoardCard,
  tenantId: string,
  busy: boolean,
  canCancel: boolean,
  canFlo: boolean,
  onAction: (fn: () => Promise<{ ok: boolean; error?: string }>) => void
): ReactNode[] {
  const col = card.receptionColumn;
  const chips: ReactNode[] = [];

  if (col === "expected" && canFlo) {
    chips.push(
      <ActionChip
        key="consult"
        label="Start consult"
        disabled={busy}
        onPress={() =>
          onAction(() =>
            receptionBoardFlowAction(tenantId, card.id, { action: "start_consultation" })
          )
        }
      />,
      <ActionChip
        key="treatment"
        label="Start treatment"
        disabled={busy}
        onPress={() =>
          onAction(() => receptionBoardFlowAction(tenantId, card.id, { action: "start_treatment" }))
        }
      />
    );
  }

  if (col === "arrived" && canFlo) {
    chips.push(
      <ActionChip
        key="consult"
        label="Start consult"
        disabled={busy}
        onPress={() =>
          onAction(() =>
            receptionBoardFlowAction(tenantId, card.id, { action: "start_consultation" })
          )
        }
      />,
      <ActionChip
        key="treatment"
        label="Start treatment"
        disabled={busy}
        onPress={() =>
          onAction(() => receptionBoardFlowAction(tenantId, card.id, { action: "start_treatment" }))
        }
      />
    );
  }

  if (col === "in_consultation" && canFlo) {
    chips.push(
      <ActionChip
        key="treatment"
        label="Start treatment"
        disabled={busy}
        onPress={() =>
          onAction(() => receptionBoardFlowAction(tenantId, card.id, { action: "start_treatment" }))
        }
      />,
      <ActionChip
        key="handoff"
        label="Mark ready"
        disabled={busy}
        onPress={() =>
          onAction(() => receptionBoardFlowAction(tenantId, card.id, { action: "complete" }))
        }
      />
    );
  }

  if (
    (col === "arrived" ||
      col === "in_consultation" ||
      col === "in_treatment" ||
      col === "expected") &&
    canFlo
  ) {
    chips.push(
      <ActionChip
        key="complete"
        label="Complete"
        disabled={busy}
        onPress={() =>
          onAction(() => receptionBoardFlowAction(tenantId, card.id, { action: "complete" }))
        }
      />
    );
  }

  if (
    (col === "expected" ||
      col === "arrived" ||
      col === "in_consultation" ||
      col === "in_treatment") &&
    canFlo
  ) {
    chips.push(
      <ActionChip
        key="no_show"
        label="No show"
        disabled={busy}
        onPress={() =>
          onAction(() => receptionBoardFlowAction(tenantId, card.id, { action: "mark_no_show" }))
        }
      />
    );
  }

  if (
    (col === "expected" ||
      col === "arrived" ||
      col === "in_consultation" ||
      col === "in_treatment") &&
    canCancel
  ) {
    chips.push(
      <ActionChip
        key="cancel"
        label="Cancel"
        disabled={busy}
        tone="danger"
        onPress={() =>
          onAction(() => receptionBoardFlowAction(tenantId, card.id, { action: "cancel" }))
        }
      />
    );
  }

  return chips;
}

function ActionChip(props: {
  label: string;
  disabled: boolean;
  tone?: "default" | "danger";
  onPress: () => void;
}) {
  const { label, disabled, tone = "default", onPress } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      className={cn(
        "rounded-md px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide transition disabled:opacity-40",
        tone === "danger"
          ? "border border-red-500/30 bg-red-500/10 text-red-100/95 hover:bg-red-500/15"
          : "border border-white/[0.08] bg-white/[0.04] text-slate-200 hover:border-cyan-500/25 hover:bg-cyan-500/10"
      )}
    >
      {label}
    </button>
  );
}
