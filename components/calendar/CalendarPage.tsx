"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Phone, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarRightPanel } from "@/components/calendar/CalendarRightPanel";
import { CalendarTopControls } from "@/components/calendar/CalendarTopControls";
import { MonthView } from "@/components/calendar/MonthView";
import { SidebarAgenda } from "@/components/calendar/SidebarAgenda";
import { calendarEaseOut } from "@/lib/calendar/calendarMotion";
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarRoute,
} from "@/src/lib/bookings/calendarQuery";
import type { OperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarTypes";
import { monthEmptyDayQuickCreateLocalStart } from "@/src/lib/calendar/operationalCalendarLayout";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { BookingCalendarDrawer } from "@/src/components/fi/bookings/calendar/BookingCalendarDrawer";
import { BookingEditDrawer } from "@/src/components/fi/bookings/operator/BookingEditDrawer";
import { QuickCallInBookingModal } from "@/src/components/fi/appointments/QuickCallInBookingModal";
import { CalendarQuickCreateDrawer, type CalendarQuickCreatePrefill } from "@/src/components/fi/calendar/CalendarQuickCreateDrawer";
import { CalendarSlotContextMenu } from "@/src/components/fi/calendar/CalendarSlotContextMenu";
import {
  calendarQuickTemplateById,
  type CalendarQuickTemplateId,
} from "@/src/lib/calendar/calendarQuickCreateTemplates";
import { useAppointmentSlideOverOptional } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { useCalendarAppointments } from "@/hooks/useCalendarAppointments";
import { cn } from "@/lib/utils";
import { FiOsCalendarQuickFilters } from "@/src/components/fi-admin/calendar/FiOsCalendarQuickFilters";
import { FiOsCalendarTodayCommandStrip } from "@/src/components/fi-admin/calendar/FiOsCalendarTodayCommandStrip";
import type { CrmShellSession } from "@/src/lib/crm/crmShellAccess";

const viewMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: calendarEaseOut },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

export type CalendarPageProps = {
  data: OperationalCalendarPageData;
  route?: CalendarRoute;
  /**
   * Force-merge demo appointments (overrides URL).
   * Normally use `?sample=1` on the calendar URL — parsed into {@link OperationalCalendarPageData.query.sampleMode}.
   */
  useSampleData?: boolean;
  /** When set, enables call-in FAB + appointment slide-over from the operational calendar. */
  crmShellSession?: CrmShellSession | null;
  /** FI Admin OS scheduling workspace — full-bleed chrome, OS drawer, and quick filters. */
  workspaceVariant?: "default" | "fiOs";
};

export function CalendarPage({
  data,
  route = "fi-admin",
  useSampleData = false,
  crmShellSession = null,
  workspaceVariant = "default",
}: CalendarPageProps) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<FiBookingRow | null>(null);
  const [editing, setEditing] = useState<FiBookingRow | null>(null);
  const [callInOpen, setCallInOpen] = useState(false);
  const [callInPrefill, setCallInPrefill] = useState<{
    localStart?: string;
    clinicId?: string;
    assignedUserId?: string;
  }>({});
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreatePrefill, setQuickCreatePrefill] = useState<CalendarQuickCreatePrefill | null>(null);
  const [slotContextMenu, setSlotContextMenu] = useState<{
    x: number;
    y: number;
    dayKey: string;
    columnId: string;
    localStart: string;
  } | null>(null);
  const [fiOsAgendaOpen, setFiOsAgendaOpen] = useState(false);
  const [fiOsInsightsOpen, setFiOsInsightsOpen] = useState(false);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const slide = useAppointmentSlideOverOptional();

  const sampleMode = Boolean(useSampleData || data.query.sampleMode);

  const { bookings, bookingDisplay, buckets, rescheduleBooking, refresh, pendingIds, upsertBooking } = useCalendarAppointments(
    data,
    { useSampleData: sampleMode }
  );

  const slotPrefillLocal = useMemo(() => `${data.query.dateAnchor.trim()}T09:00`, [data.query.dateAnchor]);

  const quickCreateColumnIdFromFilters = useMemo(() => {
    if (data.query.staffId?.trim()) return `s:${data.query.staffId.trim()}`;
    if (data.query.assignedUserId?.trim()) return `u:${data.query.assignedUserId.trim()}`;
    if (data.query.clinicId?.trim()) return `c:${data.query.clinicId.trim()}`;
    return undefined;
  }, [data.query.staffId, data.query.assignedUserId, data.query.clinicId]);

  const quickCallInEnabled = Boolean(
    data.canMutateBookings && crmShellSession && (crmShellSession.canUseClinicFeatures ?? true)
  );
  /** Any user who can mutate bookings server-side can open quick-create from slots. */
  const quickCreateEnabled = data.canMutateBookings;
  const isFiOsWorkspace = workspaceVariant === "fiOs";

  useEffect(() => {
    if (!highlightedBookingId) return;
    const t = window.setTimeout(() => setHighlightedBookingId(null), 6000);
    return () => window.clearTimeout(t);
  }, [highlightedBookingId]);

  const dismissFiOsCalendarDrawers = useCallback(() => {
    setFiOsAgendaOpen(false);
    setFiOsInsightsOpen(false);
  }, []);

  useEffect(() => {
    if (!isFiOsWorkspace) return;
    if (!fiOsAgendaOpen && !fiOsInsightsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismissFiOsCalendarDrawers();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissFiOsCalendarDrawers, fiOsAgendaOpen, fiOsInsightsOpen, isFiOsWorkspace]);

  const openQuickCreateFromSlot = useCallback(
    (p: { dayKey: string; columnId?: string; localStart: string }, templateId?: CalendarQuickTemplateId) => {
      setSlotContextMenu(null);
      setQuickCreatePrefill({
        localStart: p.localStart.trim(),
        ...(p.columnId ? { columnId: p.columnId } : {}),
        dayKey: p.dayKey,
        templateId,
        defaultClinicId: data.query.clinicId?.trim() || undefined,
      });
      setQuickCreateOpen(true);
    },
    [data.query.clinicId]
  );

  const openQuickCreateFromMonthEmptyDay = useCallback(
    (dayKey: string) => {
      const localStart = monthEmptyDayQuickCreateLocalStart(dayKey, data.gridConfig);
      openQuickCreateFromSlot(
        {
          dayKey,
          localStart,
          ...(quickCreateColumnIdFromFilters ? { columnId: quickCreateColumnIdFromFilters } : {}),
        },
        "consultation"
      );
    },
    [data.gridConfig, openQuickCreateFromSlot, quickCreateColumnIdFromFilters]
  );

  const quickCreateFabPrefill = useMemo(
    () => ({
      localStart: slotPrefillLocal,
      templateId: "consultation" as const,
      defaultClinicId: data.query.clinicId?.trim() || undefined,
      columnId: quickCreateColumnIdFromFilters,
    }),
    [data.query.clinicId, quickCreateColumnIdFromFilters, slotPrefillLocal]
  );

  const base = `/fi-admin/${data.tenantId.trim()}`;
  const isMonthView = data.query.view === "month";

  const onSearchSubmit = useCallback(
    (q: string) => {
      router.push(
        buildCalendarHref(
          data.tenantId,
          mergeCalendarHrefQuery(data.query, { q: q || undefined }),
          { route }
        )
      );
    },
    [data.query, data.tenantId, route, router]
  );

  const sidebar = useMemo(
    () => (
      <SidebarAgenda
        bookings={bookings}
        bookingDisplay={bookingDisplay}
        calendarTimezone={data.calendarTimezone}
        addAppointmentHref={`${base}/appointments`}
        onSelectBooking={(b) => setDrawer(b)}
        draggableWaitlist={data.canMutateBookings}
        disableMobileOverlay={isFiOsWorkspace}
        className={cn(
          "border-r-0 dark:border-[#1e2937]",
          isFiOsWorkspace && "h-full min-h-0 overflow-hidden rounded-none border-[#1e2937]"
        )}
      />
    ),
    [base, bookingDisplay, bookings, data.calendarTimezone, data.canMutateBookings, isFiOsWorkspace]
  );

  const rightPanel = useMemo(
    () => (
      <CalendarRightPanel
        bookings={bookings}
        bookingDisplay={bookingDisplay}
        dayKey={data.query.dateAnchor}
        calendarTimezone={data.calendarTimezone}
        searchQuery={data.query.search ?? ""}
        onSearchSubmit={onSearchSubmit}
        forceOsDrawer={isFiOsWorkspace}
        {...(isFiOsWorkspace ? { defaultCollapsed: false } : {})}
      />
    ),
    [
      bookingDisplay,
      bookings,
      data.calendarTimezone,
      data.query.dateAnchor,
      data.query.search,
      isFiOsWorkspace,
      onSearchSubmit,
    ]
  );

  const sidebarForGrid = isFiOsWorkspace ? (fiOsAgendaOpen ? sidebar : null) : sidebar;
  const rightPanelForGrid = isFiOsWorkspace ? (fiOsInsightsOpen ? rightPanel : null) : rightPanel;

  return (
    <div
      className={cn(
        "flex flex-col",
        isFiOsWorkspace
          ? "min-h-0 flex-1 overflow-hidden bg-[#050a14] text-slate-100"
          : "-mx-3 min-h-[calc(100dvh-8rem)] bg-[#0f172a] sm:-mx-4 lg:-mx-6"
      )}
    >
      <CalendarTopControls
        tenantId={data.tenantId}
        query={data.query}
        rangeTitle={data.rangeTitle}
        staffDirectory={data.staffDirectory}
        clinics={data.clinics}
        canMutateBookings={data.canMutateBookings}
        bookingMutationBlockedReason={data.bookingMutationBlockedReason}
        route={route}
        variant={isFiOsWorkspace ? "fiOs" : "default"}
        fiOsPanelControls={
          isFiOsWorkspace
            ? {
                agendaOpen: fiOsAgendaOpen,
                insightsOpen: fiOsInsightsOpen,
                onToggleAgenda: () => setFiOsAgendaOpen((v) => !v),
                onToggleInsights: () => setFiOsInsightsOpen((v) => !v),
              }
            : undefined
        }
      />

      {isFiOsWorkspace ? (
        <FiOsCalendarQuickFilters tenantId={data.tenantId} query={data.query} clinics={data.clinics} route={route} />
      ) : null}

      {isFiOsWorkspace ? (
        <FiOsCalendarTodayCommandStrip tenantId={data.tenantId} query={data.query} bookings={bookings} lanes={data.lanes} route={route} />
      ) : null}

      {sampleMode ? (
        <p
          className="border-b border-sky-500/25 bg-sky-950/35 px-4 py-2 text-xs font-medium text-sky-200"
          role="status"
        >
          Demo mode — sample consults, PRP, and transplant appointments merged. Drag-and-drop updates locally; real
          bookings PATCH to the server with optimistic UI and rollback on error.
        </p>
      ) : null}

      {data.listTruncated ? (
        <p
          className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-xs font-medium text-amber-100"
          role="status"
        >
          Results truncated at {bookings.length} rows. Narrow staff, location, or date range.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {isMonthView ? (
            <motion.div key="month" className="flex min-h-0 flex-1 flex-col" {...viewMotion}>
              <MonthView
                sidebar={sidebarForGrid}
                rightPanel={rightPanelForGrid}
                monthAnchor={data.query.dateAnchor}
                bookings={bookings}
                bookingDisplay={bookingDisplay}
                resourceColumns={data.resourceColumns}
                gridConfig={data.gridConfig}
                canMutateBookings={data.canMutateBookings}
                onSelectBooking={(b) => setDrawer(b)}
                onRescheduleBooking={rescheduleBooking}
                pendingAppointmentIds={pendingIds}
                tenantId={data.tenantId}
                query={data.query}
                calendarRoute={route}
                calendarShellMode={isFiOsWorkspace ? "fiOs" : "default"}
                fiOsDrawerDismiss={isFiOsWorkspace ? dismissFiOsCalendarDrawers : undefined}
                onEmptyDayQuickCreate={quickCreateEnabled ? openQuickCreateFromMonthEmptyDay : undefined}
              />
            </motion.div>
          ) : (
            <motion.div key={data.query.view} className="flex min-h-0 flex-1 flex-col" {...viewMotion}>
              <CalendarGrid
                sidebar={sidebarForGrid}
                rightPanel={rightPanelForGrid}
                view={data.query.view as "day" | "3day" | "week"}
                lanes={data.lanes}
                buckets={buckets}
                gridConfig={data.gridConfig}
                bookingDisplay={bookingDisplay}
                resourceColumns={data.resourceColumns}
                canMutateBookings={data.canMutateBookings}
                bookings={bookings}
                highlightedColumnId={
                  data.query.staffId
                    ? `s:${data.query.staffId}`
                    : data.query.assignedUserId
                      ? `u:${data.query.assignedUserId}`
                      : null
                }
                onSelectBooking={(b) => setDrawer(b)}
                onRescheduleBooking={rescheduleBooking}
                pendingAppointmentIds={pendingIds}
                shortcuts={{
                  tenantId: data.tenantId,
                  query: data.query,
                  addAppointmentHref: `${base}/bookings/new`,
                }}
                highlightedBookingId={highlightedBookingId}
                onEmptySlotClick={
                  quickCreateEnabled ? (info) => openQuickCreateFromSlot(info, "consultation") : undefined
                }
                onEmptySlotContextMenu={
                  quickCreateEnabled
                    ? (info) =>
                        setSlotContextMenu({
                          x: info.clientX,
                          y: info.clientY,
                          dayKey: info.dayKey,
                          columnId: info.columnId,
                          localStart: info.localStart,
                        })
                    : undefined
                }
                calendarShellMode={isFiOsWorkspace ? "fiOs" : "default"}
                fiOsDrawerDismiss={isFiOsWorkspace ? dismissFiOsCalendarDrawers : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {slotContextMenu && quickCreateEnabled ? (
        <CalendarSlotContextMenu
          open
          x={slotContextMenu.x}
          y={slotContextMenu.y}
          onClose={() => setSlotContextMenu(null)}
          items={[
            { id: "phone", label: "Phone Consultation", onSelect: () => openQuickCreateFromSlot({ dayKey: slotContextMenu.dayKey, columnId: slotContextMenu.columnId, localStart: slotContextMenu.localStart }, "phone_consult") },
            { id: "consult", label: "Consultation", onSelect: () => openQuickCreateFromSlot({ dayKey: slotContextMenu.dayKey, columnId: slotContextMenu.columnId, localStart: slotContextMenu.localStart }, "consultation") },
            { id: "prp", label: "PRP", onSelect: () => openQuickCreateFromSlot({ dayKey: slotContextMenu.dayKey, columnId: slotContextMenu.columnId, localStart: slotContextMenu.localStart }, "prp") },
            { id: "exo", label: "Exosomes", onSelect: () => openQuickCreateFromSlot({ dayKey: slotContextMenu.dayKey, columnId: slotContextMenu.columnId, localStart: slotContextMenu.localStart }, "exosomes") },
            { id: "follow", label: "Follow Up", onSelect: () => openQuickCreateFromSlot({ dayKey: slotContextMenu.dayKey, columnId: slotContextMenu.columnId, localStart: slotContextMenu.localStart }, "follow_up") },
            { id: "review", label: "Surgery Review", onSelect: () => openQuickCreateFromSlot({ dayKey: slotContextMenu.dayKey, columnId: slotContextMenu.columnId, localStart: slotContextMenu.localStart }, "surgery_review") },
            { id: "surg", label: "Surgery", onSelect: () => openQuickCreateFromSlot({ dayKey: slotContextMenu.dayKey, columnId: slotContextMenu.columnId, localStart: slotContextMenu.localStart }, "surgery") },
          ]}
        />
      ) : null}

      {quickCreateEnabled ? (
        <CalendarQuickCreateDrawer
          tenantId={data.tenantId}
          open={quickCreateOpen}
          onClose={() => {
            setQuickCreateOpen(false);
            setQuickCreatePrefill(null);
          }}
          calendarTimezone={data.calendarTimezone}
          prefill={quickCreatePrefill}
          clinics={data.clinics}
          assignees={data.assignees}
          staffDirectory={data.staffDirectory}
          setupRecommendations={data.setupRecommendations}
          services={data.services}
          workflowVariant={isFiOsWorkspace ? "fiOs" : "default"}
          onCreated={(booking, displayLabel) => {
            const tpl = calendarQuickTemplateById(
              (booking.metadata?.quick_template_id as CalendarQuickTemplateId | undefined) ?? "consultation"
            );
            upsertBooking(booking, {
              anchorLabel: displayLabel.trim() || booking.title?.trim() || tpl?.label || "Booking",
              scalesSummary: null,
              durationMin: Math.max(
                1,
                Math.round((Date.parse(booking.end_at) - Date.parse(booking.start_at)) / 60000) || tpl?.durationMinutes || 30
              ),
              reminderHint: null,
              procedureCatalogName: tpl?.label ?? null,
            });
            setHighlightedBookingId(booking.id);
            refresh();
          }}
        />
      ) : null}

      <BookingCalendarDrawer
        tenantId={data.tenantId}
        booking={drawer}
        assignees={data.assignees}
        clinics={data.clinics}
        adminKey=""
        calendarTimezone={data.calendarTimezone}
        onClose={() => setDrawer(null)}
        onChanged={refresh}
        onEdit={(b) => setEditing(b)}
        variant={isFiOsWorkspace ? "fiOs" : "default"}
        patientSummary={drawer ? data.bookingDisplay[drawer.id]?.anchorLabel ?? null : null}
        staffDirectory={data.staffDirectory}
        canMutateBookings={data.canMutateBookings}
        procedureLabel={drawer ? data.bookingDisplay[drawer.id]?.procedureCatalogName ?? null : null}
        patientContactEmail={drawer ? data.bookingDisplay[drawer.id]?.patientEmail ?? null : null}
        patientContactPhone={drawer ? data.bookingDisplay[drawer.id]?.patientPhone ?? null : null}
        onBookingUpdated={(b) => {
          upsertBooking(b);
          setDrawer(b);
        }}
      />

      <BookingEditDrawer
        tenantId={data.tenantId}
        booking={editing}
        reminderJobs={editing ? data.reminderJobsByBookingId[editing.id] ?? [] : []}
        assignees={data.assignees}
        clinics={data.clinics}
        adminKey=""
        clinicCalendarTimezone={data.calendarTimezone}
        services={data.services}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />

      {quickCreateEnabled ? (
        <button
          type="button"
          onClick={() => {
            setQuickCreatePrefill({ ...quickCreateFabPrefill });
            setQuickCreateOpen(true);
          }}
          className={cn(
            "fixed z-[120] inline-flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-2 transition focus:outline-none focus-visible:ring-4 sm:h-14 sm:w-14",
            isFiOsWorkspace
              ? "bottom-28 right-4 bg-cyan-400 text-[#041018] shadow-cyan-950/50 ring-cyan-300/40 hover:bg-cyan-300 focus-visible:ring-cyan-200 sm:bottom-32 sm:right-6"
              : "bottom-28 right-4 bg-sky-500 text-white shadow-sky-950/40 ring-sky-300/50 hover:bg-sky-400 focus-visible:ring-sky-200 sm:bottom-32 sm:right-6"
          )}
          aria-label="New appointment"
          title="New appointment"
        >
          <Plus className="h-7 w-7" aria-hidden strokeWidth={2.25} />
        </button>
      ) : null}

      {quickCallInEnabled ? (
        <>
          <button
            type="button"
            onClick={() => {
              setCallInPrefill({ localStart: slotPrefillLocal });
              setCallInOpen(true);
            }}
            className={cn(
              "fixed bottom-4 right-4 z-[110] inline-flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-2 transition focus:outline-none focus-visible:ring-4 sm:bottom-6 sm:right-6",
              isFiOsWorkspace
                ? "border border-white/[0.12] bg-[#0a1424]/95 text-cyan-100 shadow-black/40 ring-white/[0.08] backdrop-blur-md hover:bg-[#0d1829] focus-visible:ring-cyan-300/40"
                : "bg-sky-500 text-white shadow-sky-950/40 ring-sky-300/50 hover:bg-sky-400 focus-visible:ring-sky-200"
            )}
            aria-label="New call-in booking"
            title="New call-in booking"
          >
            <Phone className="h-6 w-6" aria-hidden />
          </button>
          <QuickCallInBookingModal
            tenantId={data.tenantId}
            open={callInOpen}
            onClose={() => {
              setCallInOpen(false);
              setCallInPrefill({});
            }}
            calendarTimezone={data.calendarTimezone}
            initialLocalStart={callInPrefill.localStart ?? slotPrefillLocal}
            initialClinicId={callInPrefill.clinicId ?? null}
            initialAssignedUserId={callInPrefill.assignedUserId ?? null}
            clinics={data.clinics}
            assignees={data.assignees}
            services={data.services}
            onCreated={({ booking }) => {
              upsertBooking(booking);
              refresh();
            }}
            onOpenBooking={(id) => slide?.openAppointment(id)}
          />
        </>
      ) : null}
    </div>
  );
}
