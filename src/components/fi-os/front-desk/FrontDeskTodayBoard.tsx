"use client";

/**
 * FI-UX-REBUILD-1 S3.3 — Front Desk Today board (raw-payload adapter).
 *
 * Only this component holds ReceptionBoardCommandCenterPayload.
 * Children receive presentation slices + callbacks only.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCalendarToast } from "@/components/calendar/CalendarToast";
import { ClinicOsGlobalSearch } from "@/src/components/fi-admin/search/ClinicOsGlobalSearch";
import { useReceptionBoardRefresh } from "@/src/components/fi-admin/reception-board/useReceptionBoardRefresh";
import {
  FrontDeskAttentionPanel,
  FrontDeskLaneBoard,
  FrontDeskLiveRegion,
  FrontDeskSessionBanner,
  FrontDeskTerminalSection,
  FrontDeskTodayActionsBar,
  FrontDeskTodayEmptyDay,
  FrontDeskTodayHeader,
  FrontDeskTodaySummaryTiles,
} from "@/src/components/fi-os/front-desk/frontDeskTodayUi";
import { buildFrontDeskTodayPresentation } from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation";
import type { FrontDeskMutationMode } from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types";
import type { FrontDeskCardActionId } from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types";
import {
  frontDeskFlowActionSuccessLabel,
  frontDeskPaymentsHref,
  isFrontDeskFlowActionId,
  mapFrontDeskCardActionToFlowAction,
} from "@/src/lib/fiOs/frontDesk/frontDeskTodayUiHelpers";
import { receptionBoardTransitionPatient } from "@/src/lib/receptionBoard/receptionBoardActions";
import type { ReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoardTypes";

const CLOCK_TICK_MS = 30_000;

export type FrontDeskTodayBoardProps = {
  initialData: ReceptionBoardCommandCenterPayload;
  mutationMode: FrontDeskMutationMode;
  /** Optional: default true when shell tier. */
  hydrateFullOnMount?: boolean;
};

export function FrontDeskTodayBoard(props: FrontDeskTodayBoardProps) {
  const { mutationMode } = props;
  const router = useRouter();
  const toast = useCalendarToast();

  const initialNowMs = useMemo(() => {
    const t = Date.parse(props.initialData.loadedAt);
    return Number.isFinite(t) ? t : Date.now();
  }, [props.initialData.loadedAt]);

  const [nowMs, setNowMs] = useState(initialNowMs);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightBookingId, setHighlightBookingId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const { data, lastRefreshedAt, isRefreshing, refreshError, refresh } = useReceptionBoardRefresh({
    tenantId: props.initialData.tenantId,
    initialData: props.initialData,
    hydrateFullOnMount: props.hydrateFullOnMount ?? props.initialData.loadTier === "shell",
  });

  // After mount: live clock; re-run presentation for arriving soon / running late.
  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const base = `/fi-admin/${data.tenantId}`;
  const paymentsHref = frontDeskPaymentsHref(data.tenantId);

  const presentation = useMemo(
    () =>
      buildFrontDeskTodayPresentation(data, {
        base,
        nowMs,
        mutationMode,
      }),
    [data, base, nowMs, mutationMode]
  );

  // Global actions: force take_payment href to /payments
  const globalActions = useMemo(
    () =>
      presentation.actions.map((a) => (a.id === "take_payment" ? { ...a, href: paymentsHref } : a)),
    [presentation.actions, paymentsHref]
  );

  const totalCards = presentation.summary.total;
  const canMutate = mutationMode === "full" || mutationMode === "pin_reception";

  const announce = useCallback((msg: string) => {
    setLiveMessage(msg);
  }, []);

  const locateCard = useCallback(
    (bookingId: string) => {
      const el = document.querySelector<HTMLElement>(
        `[data-booking-id="${CSS.escape(bookingId)}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
        setHighlightBookingId(bookingId);
        window.setTimeout(() => setHighlightBookingId(null), 2500);
        announce("Located patient on the board");
      } else {
        announce("Patient card not on the board");
      }
    },
    [announce]
  );

  const runFlowAction = useCallback(
    async (action: FrontDeskCardActionId, bookingId: string) => {
      if (action === "take_payment") {
        router.push(paymentsHref);
        return;
      }
      if (action === "open_patient" || action === "open_calendar" || action === "find_patient") {
        return; // handled as links in card
      }
      if (!canMutate) return;
      if (!isFrontDeskFlowActionId(action)) return;
      if (mutationMode === "pin_reception" && action === "cancel") return;

      const flow = mapFrontDeskCardActionToFlowAction(action);
      if (!flow) return;

      setBusyBookingId(bookingId);
      try {
        const result = await receptionBoardTransitionPatient(data.tenantId, bookingId, {
          action: flow,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Could not update patient status.");
          announce(result.error ?? "Update failed");
          return;
        }
        const label = frontDeskFlowActionSuccessLabel(action);
        toast.success(`${label} — saved`);
        announce(`${label} saved`);
        router.refresh();
        void refresh();
      } finally {
        setBusyBookingId(null);
      }
    },
    [canMutate, data.tenantId, mutationMode, paymentsHref, refresh, router, toast, announce]
  );

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-5 pb-14 sm:space-y-6">
      <FrontDeskLiveRegion message={liveMessage} />

      <FrontDeskTodayHeader
        tenantName={data.tenantName}
        todayYmd={presentation.operationalDay.todayYmd}
        calendarTimezone={presentation.operationalDay.calendarTimezone}
        loadTier={presentation.loadTier}
        isRefreshing={isRefreshing}
        lastRefreshedAt={lastRefreshedAt}
        refreshError={refreshError}
        onRefresh={() => void refresh()}
      />

      <FrontDeskSessionBanner mutationMode={mutationMode} />

      <FrontDeskTodayActionsBar
        actions={globalActions}
        paymentsHref={paymentsHref}
        onFindPatient={() => setSearchOpen(true)}
      />

      <FrontDeskTodaySummaryTiles summary={presentation.summary} />

      <FrontDeskAttentionPanel
        items={presentation.attentionItems}
        attentionSummary={presentation.attentionSummary}
        loadTier={presentation.loadTier}
        onLocateCard={locateCard}
      />

      {totalCards === 0 ? (
        <FrontDeskTodayEmptyDay
          actions={globalActions}
          paymentsHref={paymentsHref}
          onFindPatient={() => setSearchOpen(true)}
        />
      ) : (
        <>
          <FrontDeskLaneBoard
            lanes={presentation.lanes}
            busyBookingId={busyBookingId}
            highlightBookingId={highlightBookingId}
            paymentsHref={paymentsHref}
            onAction={runFlowAction}
          />
          <FrontDeskTerminalSection
            cancelled={presentation.exceptionCards.cancelled}
            noShow={presentation.exceptionCards.noShow}
            busyBookingId={busyBookingId}
            highlightBookingId={highlightBookingId}
            paymentsHref={paymentsHref}
            onAction={runFlowAction}
          />
        </>
      )}

      <ClinicOsGlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        tenantId={data.tenantId}
        base={base}
        showCrmNav={false}
        showBookingsBoard={true}
      />
    </div>
  );
}
