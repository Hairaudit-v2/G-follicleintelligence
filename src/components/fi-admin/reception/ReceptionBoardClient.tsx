"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { cancelBookingAction, completeBookingAction, updateBookingAction } from "@/lib/actions/fi-booking-actions";
import { useCalendarToastOptional } from "@/components/calendar/CalendarToast";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import type { ReceptionBoardColumnId } from "@/src/lib/fiOs/receptionBoardModel";
import { RECEPTION_BOARD_COLUMN_IDS, withReceptionFlowPhase } from "@/src/lib/fiOs/receptionBoardModel";

const COLUMN_LABELS: Record<ReceptionBoardColumnId, string> = {
  expected: "Expected",
  arrived: "Arrived",
  in_consultation: "In consultation",
  in_treatment: "In treatment",
  complete: "Complete",
  no_show: "No show",
  cancelled: "Cancelled",
};

export type ReceptionMutationMode = "full" | "complete_only" | "none";

export function ReceptionBoardClient(props: {
  tenantId: string;
  base: string;
  calendarTimezone: string;
  todayYmd: string;
  cards: ReceptionBoardCard[];
  mutationMode: ReceptionMutationMode;
}) {
  const { tenantId, base, calendarTimezone, todayYmd, cards, mutationMode } = props;
  const router = useRouter();
  const toast = useCalendarToastOptional();
  const [busyId, setBusyId] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const m = new Map<ReceptionBoardColumnId, ReceptionBoardCard[]>();
    for (const id of RECEPTION_BOARD_COLUMN_IDS) m.set(id, []);
    for (const c of cards) {
      m.get(c.receptionColumn)?.push(c);
    }
    return m;
  }, [cards]);

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

  const canPatch = mutationMode === "full";
  const canCompleteOnly = mutationMode === "complete_only" || mutationMode === "full";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">ClinicOS · Reception</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Reception board</h1>
          <p className="mt-1 text-sm text-slate-500">
            Operational day <span className="font-mono text-slate-400">{todayYmd}</span> ·{" "}
            <span className="font-mono text-slate-400">{calendarTimezone}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/operations`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Operations centre
          </Link>
          <Link
            href={`${base}/calendar`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Calendar
          </Link>
        </div>
      </div>

      {mutationMode === "complete_only" ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-100/95">
          PIN session: you can mark visits complete. Other status changes need a full team login.
        </p>
      ) : null}
      {mutationMode === "none" ? (
        <p className="rounded-lg border border-slate-600/40 bg-slate-900/40 px-3 py-2 text-sm text-slate-400">
          Sign in with clinic access to update booking statuses from this board.
        </p>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {RECEPTION_BOARD_COLUMN_IDS.map((colId) => (
          <section
            key={colId}
            className="flex w-[min(100%,18rem)] shrink-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/75 shadow-inner shadow-black/25"
            aria-labelledby={`reception-col-${colId}`}
          >
            <header className="border-b border-white/[0.06] px-3 py-2.5">
              <h2 id={`reception-col-${colId}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {COLUMN_LABELS[colId]}
              </h2>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-100">
                {(byColumn.get(colId) ?? []).length}
              </p>
            </header>
            <ul className="flex max-h-[70vh] min-h-[12rem] flex-col gap-2 overflow-y-auto p-2">
              {(byColumn.get(colId) ?? []).map((c) => (
                <li key={c.id}>
                  <ReceptionBookingCard
                    card={c}
                    tenantId={tenantId}
                    base={base}
                    timeLabel={timeFmt.format(new Date(c.startAt))}
                    busy={busyId === c.id}
                    canPatch={canPatch}
                    canCompleteOnly={canCompleteOnly}
                    onAction={(fn) => run(c.id, fn)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function ReceptionBookingCard(props: {
  card: ReceptionBoardCard;
  tenantId: string;
  base: string;
  timeLabel: string;
  busy: boolean;
  canPatch: boolean;
  canCompleteOnly: boolean;
  onAction: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const { card, tenantId, base, timeLabel, busy, canPatch, canCompleteOnly, onAction } = props;
  const apptHref = `${base}/calendar`;

  const terminal = card.receptionColumn === "complete" || card.receptionColumn === "cancelled" || card.receptionColumn === "no_show";

  return (
    <article
      className={cn(
        "rounded-lg border px-2.5 py-2 text-left shadow-sm transition",
        terminal ? "border-white/[0.05] bg-white/[0.02]" : "border-cyan-500/15 bg-[#141c33]/90 hover:border-cyan-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-cyan-200/95">{timeLabel}</p>
        <Link href={apptHref} className="shrink-0 text-[0.65rem] font-medium uppercase tracking-wide text-cyan-400/80 hover:underline">
          Open
        </Link>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-slate-50">{card.displayName}</p>
      <p className="mt-0.5 text-[0.7rem] text-slate-500">
        {card.typeLabel} · <span className="text-slate-400">{card.statusLabel}</span>
      </p>
      {card.providerLabel !== "Unassigned" ? (
        <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">Provider: {card.providerLabel}</p>
      ) : null}
      {(card.clinicLabel || card.roomLabel) && (
        <p className="mt-0.5 text-[0.7rem] leading-snug text-slate-500">
          {[card.clinicLabel, card.roomLabel].filter(Boolean).join(" · ")}
        </p>
      )}

      {!terminal ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.receptionColumn === "expected" && canPatch ? (
            <>
              <ActionChip
                label="Mark arrived"
                disabled={busy}
                onPress={() =>
                  onAction(() =>
                    updateBookingAction(tenantId, card.id, {
                      adminKey: "",
                      bookingStatus: "arrived",
                      metadata: withReceptionFlowPhase(card.metadata, null),
                    })
                  )
                }
              />
              <ActionChip
                label="Start consult"
                disabled={busy}
                onPress={() =>
                  onAction(() =>
                    updateBookingAction(tenantId, card.id, {
                      adminKey: "",
                      bookingStatus: "arrived",
                      metadata: withReceptionFlowPhase(card.metadata, "consultation"),
                    })
                  )
                }
              />
              <ActionChip
                label="Start treatment"
                disabled={busy}
                onPress={() =>
                  onAction(() =>
                    updateBookingAction(tenantId, card.id, {
                      adminKey: "",
                      bookingStatus: "arrived",
                      metadata: withReceptionFlowPhase(card.metadata, "treatment"),
                    })
                  )
                }
              />
            </>
          ) : null}

          {card.receptionColumn === "arrived" && canPatch ? (
            <>
              <ActionChip
                label="Start consult"
                disabled={busy}
                onPress={() =>
                  onAction(() =>
                    updateBookingAction(tenantId, card.id, {
                      adminKey: "",
                      metadata: withReceptionFlowPhase(card.metadata, "consultation"),
                    })
                  )
                }
              />
              <ActionChip
                label="Start treatment"
                disabled={busy}
                onPress={() =>
                  onAction(() =>
                    updateBookingAction(tenantId, card.id, {
                      adminKey: "",
                      metadata: withReceptionFlowPhase(card.metadata, "treatment"),
                    })
                  )
                }
              />
            </>
          ) : null}

          {card.receptionColumn === "in_consultation" && canPatch ? (
            <ActionChip
              label="Start treatment"
              disabled={busy}
              onPress={() =>
                onAction(() =>
                  updateBookingAction(tenantId, card.id, {
                    adminKey: "",
                    metadata: withReceptionFlowPhase(card.metadata, "treatment"),
                  })
                )
              }
            />
          ) : null}

          {(card.receptionColumn === "arrived" ||
            card.receptionColumn === "in_consultation" ||
            card.receptionColumn === "in_treatment" ||
            card.receptionColumn === "expected") &&
          canCompleteOnly ? (
            <ActionChip
              label="Complete"
              disabled={busy}
              onPress={() => onAction(() => completeBookingAction(tenantId, card.id, { adminKey: "" }))}
            />
          ) : null}

          {(card.receptionColumn === "expected" ||
            card.receptionColumn === "arrived" ||
            card.receptionColumn === "in_consultation" ||
            card.receptionColumn === "in_treatment") &&
          canPatch ? (
            <>
              <ActionChip
                label="No show"
                disabled={busy}
                onPress={() =>
                  onAction(() =>
                    updateBookingAction(tenantId, card.id, {
                      adminKey: "",
                      bookingStatus: "no_show",
                      metadata: withReceptionFlowPhase(card.metadata, null),
                    })
                  )
                }
              />
              <ActionChip
                label="Cancel"
                disabled={busy}
                tone="danger"
                onPress={() => onAction(() => cancelBookingAction(tenantId, card.id, { adminKey: "" }))}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
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
          : "border border-white/[0.08] bg-white/[0.04] text-slate-200 hover:border-cyan-500/25 hover:bg-cyan-500/10",
      )}
    >
      {label}
    </button>
  );
}
