"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { calendarQuickCreateBookingAction, loadServiceResourceRequirementsAction, suggestResourceAssignmentsAction } from "@/lib/actions/fi-calendar-quick-create-actions";
import { findNextAvailableBookingSlotsAction } from "@/lib/actions/fi-next-available-booking-slots-actions";
import { loadRoomPickerOptionsAction } from "@/lib/actions/fi-rooms-actions";
import { previewBookingConflictsAction } from "@/lib/actions/fi-booking-conflict-preview-actions";
import { BookingConflictPreview } from "@/src/components/calendar/BookingConflictPreview";
import { NextAvailableBookingSlots } from "@/src/components/calendar/NextAvailableBookingSlots";
import type { BookingConflictPreviewResult } from "@/src/lib/calendar/bookingConflictPreview.server";
import type { NextAvailableBookingSlot } from "@/src/lib/calendar/findNextAvailableBookingSlots.server";
import { BOOKING_CONFLICT_PREVIEW_CALM_INCOMPLETE_MESSAGE } from "@/src/lib/calendar/bookingConflictPreviewConstants";
import { useCalendarToastOptional } from "@/components/calendar/CalendarToast";
import {
  addUtcMinutesToIso,
  displayCalendarTimezoneSubtitle,
  fromDatetimeLocalValueInTimezone,
  logFiCalendarTimezoneDebug,
  parseIsoUtcMs,
  toDatetimeLocalValueInTimezone,
} from "@/src/lib/calendar/calendarTimezone";
import {
  formatClinicDate,
  formatClinicLongDate,
  formatClinicTime as formatClinicTimeForLocale,
  resolveClinicLocale,
} from "@/src/lib/calendar/calendarLocaleFormatting";
import {
  buildQuickBookTimeSummary,
  deriveQuickBookEndLocal,
  normalizeQuickBookDatetimeLocal,
} from "@/src/lib/calendar/quickBookTime";
import {
  CALENDAR_QUICK_TEMPLATES,
  calendarQuickTemplateById,
  type CalendarQuickTemplateId,
} from "@/src/lib/calendar/calendarQuickCreateTemplates";
import type { ConsultationLinkSearchLeadHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import type { ConsultationLinkSearchPatientHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import { quickTemplateDurationMinutes, serviceForBookingType } from "@/src/lib/bookings/servicesCatalog";
import type {
  FiServiceResourceRequirementRow,
  SuggestResourceAssignmentsResult,
} from "@/src/lib/calendar/bookingResourceRequirements.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import type { RoomPickerOption } from "@/src/lib/rooms/roomTypes";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type { OperationalCalendarResourceColumn } from "@/src/lib/calendar/operationalCalendarTypes";
import { isCalendarVisibleClinicalStaff } from "@/src/lib/staff/calendarVisibleStaff";
import {
  buildStaffUserLinkIndex,
  columnPrefillAssignment,
} from "@/src/lib/calendar/operationalCalendarColumns";
import {
  canSelectStaffForClinicalPicker,
  type ClinicalStaffPickerOption,
} from "@/src/lib/staff/clinicalStaffPicker";
import { StaffClinicalSelect } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import {
  fiButtonVariantClassNames,
  fiPageHeaderVariantClassNames,
  fiSurfaceVariantClassNames,
} from "@/src/components/fi-design/fiDesignTokens";
import { cn } from "@/lib/utils";
import { resolveQuickBookClinicId } from "@/src/lib/calendar/quickBookResolveClinic";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export type CalendarQuickCreatePrefill = {
  localStart: string;
  columnId?: string;
  dayKey?: string;
  templateId?: CalendarQuickTemplateId;
  /**
   * Month empty-day quick book: start time uses clinic open hour but appointment type is unset until
   * reception picks one (duration then updates from the catalog).
   */
  appointmentTypeUnset?: boolean;
  /** When the slot column does not imply a clinic (e.g. staff column), seed from calendar URL filter. */
  defaultClinicId?: string;
};

type AnchorSelection =
  | { kind: "patient"; hit: ConsultationLinkSearchPatientHit }
  | { kind: "lead"; hit: ConsultationLinkSearchLeadHit };

function columnResourceDefaults(
  columnId: string | undefined,
  staffIdByUserId: Map<string, string>
): {
  clinicId: string;
  roomId: string;
  assignedStaffId: string;
  legacyOwnerUserId: string;
} {
  const col = columnId?.trim() ?? "";
  const assignment = columnPrefillAssignment(col, staffIdByUserId);
  if (col.startsWith("r:")) {
    return { clinicId: "", roomId: col.slice(2), assignedStaffId: assignment.assignedStaffId, legacyOwnerUserId: assignment.legacyOwnerUserId };
  }
  if (col.startsWith("c:")) {
    return { clinicId: col.slice(2), roomId: "", assignedStaffId: assignment.assignedStaffId, legacyOwnerUserId: assignment.legacyOwnerUserId };
  }
  return {
    clinicId: "",
    roomId: "",
    assignedStaffId: assignment.assignedStaffId,
    legacyOwnerUserId: assignment.legacyOwnerUserId,
  };
}

const PLACEHOLDER_DURATION_MIN = 30;

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function formatClockHm(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** 15-minute aligned starts within configured business hours; last start still fits `durationMin`. */
function quarterHourStartOptions(cfg: BusinessGridConfig, durationMin: number): string[] {
  const startMin = Math.max(0, Math.floor(cfg.dayStartHourUtc)) * 60;
  const endBoundMin = Math.max(startMin + 15, Math.floor(cfg.dayEndHourUtc)) * 60;
  const dur = Math.max(15, durationMin);
  const lastStart = endBoundMin - dur;
  const out: string[] = [];
  for (let m = startMin; m <= lastStart; m += 15) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
}

function mergeDayAndHm(dayKey: string, hm: string): string {
  return `${dayKey.trim()}T${hm}`;
}

function clampStartToNearestOption(
  dayKey: string,
  desiredLocal: string,
  cfg: BusinessGridConfig,
  durationMin: number
): string {
  const opts = quarterHourStartOptions(cfg, durationMin);
  if (!opts.length) return desiredLocal;
  const wantHm = desiredLocal.slice(11, 16);
  if (opts.includes(wantHm)) return normalizeQuickBookDatetimeLocal(desiredLocal);
  const wantMin = hhmmToMinutes(wantHm);
  let bestHm = opts[0]!;
  let bestAbs = Infinity;
  for (const o of opts) {
    const d = Math.abs(hhmmToMinutes(o) - wantMin);
    if (d < bestAbs) {
      bestAbs = d;
      bestHm = o;
    }
  }
  return mergeDayAndHm(dayKey, bestHm);
}

export function CalendarQuickCreateDrawer({
  tenantId,
  open,
  onClose,
  calendarTimezone,
  prefill,
  clinics,
  assignees,
  staffDirectory,
  gridConfig,
  resourceColumns,
  calendarQueryClinicId,
  calendarOperatorPrimaryClinicId = null,
  setupRecommendations = [],
  services = [],
  tenantMetadata = null,
  onCreated,
  workflowVariant = "default",
  calendarWorkspaceDisplayTheme = "dark",
}: {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  calendarTimezone: string;
  prefill: CalendarQuickCreatePrefill | null;
  gridConfig: BusinessGridConfig;
  resourceColumns: OperationalCalendarResourceColumn[];
  /** Active `clinicId` URL filter on the operational calendar (same tenant). */
  calendarQueryClinicId?: string | null;
  /** Server-resolved primary clinic for the signed-in operator's staff profile. */
  calendarOperatorPrimaryClinicId?: string | null;
  clinics: CrmShellClinicOption[];
  /** `fi_tenants.metadata` for default locale hints when clinic metadata is absent. */
  tenantMetadata?: Record<string, unknown> | null;
  /** Legacy fi_users — owner column labels only. */
  assignees: CrmShellUserPickerOption[];
  staffDirectory: ClinicalStaffPickerOption[];
  setupRecommendations?: string[];
  services?: FiServiceRow[];
  onCreated: (booking: FiBookingRow, displayLabel: string) => void;
  workflowVariant?: "default" | "fiOs";
  /** FI OS calendar workspace display — light surfaces when set to `light`. */
  calendarWorkspaceDisplayTheme?: "dark" | "light";
}) {
  const toast = useCalendarToastOptional();
  const titleId = useId();
  const tz = calendarTimezone.trim();
  const tzLabel = displayCalendarTimezoneSubtitle(tz);
  const { staffIdByUserId } = useMemo(() => buildStaffUserLinkIndex(staffDirectory), [staffDirectory]);

  const visibleStaffColumnIds = useMemo(() => {
    return new Set(
      resourceColumns
        .filter((c) => c.kind === "fi_staff" && c.staffId?.trim())
        .map((c) => c.staffId!.trim())
    );
  }, [resourceColumns]);

  const providerOptions = useMemo(() => {
    const staffCols = resourceColumns.filter((c) => c.kind === "fi_staff" && c.staffId?.trim());
    return staffDirectory.filter((s) => {
      const vis = isCalendarVisibleClinicalStaff({
        is_active: s.is_active !== false,
        staff_role: s.staff_role,
        calendar_visible: s.calendar_visible,
      });
      if (!vis) return false;
      if (staffCols.length === 0) return true;
      return visibleStaffColumnIds.has(s.id.trim());
    });
  }, [resourceColumns, staffDirectory, visibleStaffColumnIds]);

  const [templateId, setTemplateId] = useState<CalendarQuickTemplateId | null>("consultation");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  /** When true, end time was edited under Advanced scheduling — do not auto-derive over it. */
  const [manualEndOverride, setManualEndOverride] = useState(false);
  const skipOneEndSyncRef = useRef(false);
  const [clinicId, setClinicId] = useState("");
  const [clinicResolveBlocked, setClinicResolveBlocked] = useState<"no_clinics" | "ambiguous" | null>(null);
  const [roomId, setRoomId] = useState("");
  const [roomOptions, setRoomOptions] = useState<RoomPickerOption[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [legacyOwnerUserId, setLegacyOwnerUserId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientMobile, setPatientMobile] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const debouncedPatientQ = useDebouncedValue(patientQuery.trim(), 320);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientErr, setPatientErr] = useState<string | null>(null);
  const [patientHits, setPatientHits] = useState<ConsultationLinkSearchPatientHit[]>([]);
  const [leadHits, setLeadHits] = useState<ConsultationLinkSearchLeadHit[]>([]);
  const [selection, setSelection] = useState<AnchorSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextAvailBusy, setNextAvailBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [conflictPreview, setConflictPreview] = useState<BookingConflictPreviewResult | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);

  const [serviceResourceReqs, setServiceResourceReqs] = useState<FiServiceResourceRequirementRow[]>([]);
  const [resourceSuggest, setResourceSuggest] = useState<SuggestResourceAssignmentsResult | null>(null);
  const [resourcePicks, setResourcePicks] = useState<Record<string, string>>({});

  const clinicLocale = useMemo(
    () =>
      resolveClinicLocale({
        clinicMetadata: clinics.find((c) => c.id === clinicId.trim())?.metadata ?? null,
        tenantMetadata: tenantMetadata ?? null,
        calendarTimezone: tz,
      }),
    [clinicId, clinics, tenantMetadata, tz]
  );

  const legacyOwnerLabel = useMemo(() => {
    const uid = legacyOwnerUserId.trim();
    if (!uid) return null;
    const u = assignees.find((x) => x.id === uid);
    return u?.full_name?.trim() || u?.email?.trim() || `User ${uid.slice(0, 8)}…`;
  }, [assignees, legacyOwnerUserId]);

  const resetFromPrefill = useCallback(() => {
    if (!prefill?.localStart?.trim()) return;
    const colDefaults = columnResourceDefaults(prefill.columnId, staffIdByUserId);
    const columnClinicId = colDefaults.clinicId?.trim() || null;
    const resolution = resolveQuickBookClinicId({
      columnClinicId,
      prefillDefaultClinicId: prefill.defaultClinicId,
      calendarQueryClinicId: calendarQueryClinicId ?? null,
      operatorPrimaryClinicId: calendarOperatorPrimaryClinicId,
      clinics,
    });
    if (resolution.ok) {
      setClinicId(resolution.clinicId);
      setClinicResolveBlocked(null);
    } else {
      setClinicId("");
      setClinicResolveBlocked(resolution.reason);
    }
    setRoomId(colDefaults.roomId || "");
    setAssignedStaffId(colDefaults.assignedStaffId);
    setLegacyOwnerUserId(colDefaults.legacyOwnerUserId);
    const unsetType = Boolean(prefill.appointmentTypeUnset);
    const explicitTpl = prefill.templateId ? calendarQuickTemplateById(prefill.templateId) : null;
    const nextTpl: CalendarQuickTemplateId | null = unsetType ? null : explicitTpl?.id ?? "consultation";
    setTemplateId(nextTpl);
    setNotes("");
    setManualEndOverride(false);
    const startRaw = normalizeQuickBookDatetimeLocal(prefill.localStart.trim());
    const dayKey = startRaw.slice(0, 10);
    const tplForDur = nextTpl ? calendarQuickTemplateById(nextTpl) : null;
    const durMin = tplForDur ? quickTemplateDurationMinutes(tplForDur, services) : PLACEHOLDER_DURATION_MIN;
    const start = clampStartToNearestOption(dayKey, startRaw, gridConfig, durMin);
    setStartLocal(start);
    const endDerived = deriveQuickBookEndLocal({ startLocal: start, durationMinutes: durMin, timeZone: tz });
    setEndLocal(endDerived ?? "");
    const startIso = fromDatetimeLocalValueInTimezone(start, tz);
    setPatientName("");
    setPatientMobile("");
    setPatientEmail("");
    setPatientQuery("");
    setPatientHits([]);
    setLeadHits([]);
    setSelection(null);
    setFormErr(null);
    setResourcePicks({});
    logFiCalendarTimezoneDebug("quick-create-drawer-prefill", {
      clinicTimezone: tz,
      selectedSlotDatetimeLocal: start,
      selectedSlotUtcIso: startIso,
      appointmentTypeUnset: unsetType,
    });
  }, [
    prefill,
    services,
    staffIdByUserId,
    tz,
    gridConfig,
    clinics,
    calendarQueryClinicId,
    calendarOperatorPrimaryClinicId,
  ]);

  useEffect(() => {
    if (!open) return;
    resetFromPrefill();
  }, [open, resetFromPrefill]);

  useEffect(() => {
    if (!open || !debouncedPatientQ) {
      setPatientHits([]);
      setLeadHits([]);
      setPatientErr(null);
      setPatientLoading(false);
      return;
    }
    let cancelled = false;
    setPatientLoading(true);
    setPatientErr(null);
    void (async () => {
      try {
        const url = `/api/tenants/${encodeURIComponent(tenantId.trim())}/consultations/search-links?q=${encodeURIComponent(debouncedPatientQ)}`;
        const res = await fetch(url, { credentials: "same-origin" });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          patients?: ConsultationLinkSearchPatientHit[];
          leads?: ConsultationLinkSearchLeadHit[];
        };
        if (!res.ok || !json.ok) throw new Error(json.error || "Search failed.");
        if (cancelled) return;
        setPatientHits(json.patients ?? []);
        setLeadHits(json.leads ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          setPatientHits([]);
          setLeadHits([]);
          setPatientErr(e instanceof Error ? e.message : "Search failed.");
        }
      } finally {
        if (!cancelled) setPatientLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, debouncedPatientQ]);

  const tplForRooms = useMemo(
    () => (templateId ? calendarQuickTemplateById(templateId) : undefined),
    [templateId]
  );

  /** Single resolved quick-book duration (catalog → template → placeholder). */
  const selectedDurationMinutes = useMemo(() => {
    if (!tplForRooms) return PLACEHOLDER_DURATION_MIN;
    return quickTemplateDurationMinutes(tplForRooms, services);
  }, [services, tplForRooms]);

  useEffect(() => {
    if (!open || manualEndOverride) return;
    if (skipOneEndSyncRef.current) {
      skipOneEndSyncRef.current = false;
      return;
    }
    if (!startLocal.trim().slice(0, 10)) return;
    const next = deriveQuickBookEndLocal({
      startLocal,
      durationMinutes: selectedDurationMinutes,
      timeZone: tz,
    });
    if (next) setEndLocal(next);
  }, [open, manualEndOverride, selectedDurationMinutes, startLocal, tz]);
  const catalogService = useMemo(() => {
    if (!tplForRooms) return null;
    return serviceForBookingType(services, tplForRooms.bookingType);
  }, [services, tplForRooms]);

  useEffect(() => {
    if (!open || !catalogService?.id) {
      setServiceResourceReqs([]);
      setResourceSuggest(null);
      setResourcePicks({});
      return;
    }
    let cancelled = false;
    void loadServiceResourceRequirementsAction(tenantId.trim(), catalogService.id).then((r) => {
      if (cancelled) return;
      setServiceResourceReqs(r.ok ? r.requirements : []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, catalogService?.id]);

  useEffect(() => {
    if (!open || !catalogService?.id || !clinicId.trim() || serviceResourceReqs.length === 0) {
      if (!serviceResourceReqs.length) setResourceSuggest(null);
      return;
    }
    let cancelled = false;
    void suggestResourceAssignmentsAction(tenantId.trim(), {
      clinicId: clinicId.trim(),
      serviceId: catalogService.id,
    }).then((r) => {
      if (cancelled) return;
      setResourceSuggest(r.ok ? r.suggestions : null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, clinicId, catalogService?.id, serviceResourceReqs.length]);

  useEffect(() => {
    if (!open) return;
    const cid = clinicId.trim();
    const startIso = fromDatetimeLocalValueInTimezone(startLocal, tz);
    const endIso = fromDatetimeLocalValueInTimezone(endLocal, tz);
    if (!cid || !startIso || !endIso || !tplForRooms) {
      setRoomOptions([]);
      return;
    }
    let cancelled = false;
    setRoomLoading(true);
    void (async () => {
      const r = await loadRoomPickerOptionsAction(tenantId.trim(), {
        clinicId: cid,
        bookingType: tplForRooms.bookingType,
        startAt: startIso,
        endAt: endIso,
      });
      if (cancelled) return;
      if (!r.ok) {
        setRoomOptions([]);
        setRoomLoading(false);
        return;
      }
      setRoomOptions(r.options);
      const auto = r.options.find((o) => o.eligible && o.available && o.room.is_active && o.preferred);
      const only = r.options.filter((o) => o.eligible && o.available && o.room.is_active);
      if (!roomId.trim()) {
        if (auto) setRoomId(auto.room.id);
        else if (only.length === 1) setRoomId(only[0]!.room.id);
      } else {
        const current = r.options.find((o) => o.room.id === roomId.trim());
        if (current && current.disabledReason) setRoomId("");
      }
      setRoomLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, clinicId, startLocal, endLocal, tz, tplForRooms, templateId, roomId]);

  const calmIncompleteConflictPreview = useMemo(
    (): BookingConflictPreviewResult => ({
      status: "warning",
      messages: [
        {
          type: "service",
          severity: "info",
          message: BOOKING_CONFLICT_PREVIEW_CALM_INCOMPLETE_MESSAGE,
        },
      ],
    }),
    []
  );

  const builtResourceExtras = useMemo(() => {
    if (!resourceSuggest || serviceResourceReqs.length === 0) return [];
    const primStaff = assignedStaffId.trim();
    const primRoom = roomId.trim();
    const out: { resource_type: "staff" | "room"; resource_id: string; role_label?: string | null }[] = [];
    for (const req of serviceResourceReqs) {
      const pick = resourcePicks[req.id]?.trim();
      if (!pick) continue;
      if (req.resource_type === "staff_role" || req.resource_type === "staff_member") {
        if (pick === primStaff) continue;
        out.push({ resource_type: "staff", resource_id: pick, role_label: req.requirement_label });
      } else if (req.resource_type === "room_type" || req.resource_type === "room_id") {
        if (pick === primRoom) continue;
        out.push({ resource_type: "room", resource_id: pick, role_label: req.requirement_label });
      }
    }
    return out;
  }, [resourceSuggest, serviceResourceReqs, resourcePicks, assignedStaffId, roomId]);

  const conflictPreviewBody = useMemo(() => {
    if (!tplForRooms) return null;
    const startIso = fromDatetimeLocalValueInTimezone(startLocal, tz);
    const endIso = fromDatetimeLocalValueInTimezone(endLocal, tz);
    if (!startIso || !endIso) return null;
    return {
      previewIntent: "quick_create" as const,
      clinicId: clinicId.trim() || null,
      bookingType: tplForRooms.bookingType,
      roomId: roomId.trim() || null,
      staffId: assignedStaffId.trim() || null,
      startAt: startIso,
      endAt: endIso,
      ...(builtResourceExtras.length > 0 ? { extraResourceAssignments: builtResourceExtras } : {}),
    };
  }, [assignedStaffId, builtResourceExtras, clinicId, endLocal, roomId, startLocal, tplForRooms, tz]);
  const debouncedConflictKey = useDebouncedValue(
    conflictPreviewBody ? JSON.stringify(conflictPreviewBody) : "",
    350
  );

  useEffect(() => {
    if (!open || !debouncedConflictKey) {
      setConflictPreview(null);
      setConflictLoading(false);
      return;
    }
    let cancelled = false;
    setConflictLoading(true);
    void (async () => {
      const r = await previewBookingConflictsAction(
        tenantId.trim(),
        JSON.parse(debouncedConflictKey) as Record<string, unknown>
      );
      if (cancelled) return;
      setConflictPreview(r.ok ? r.preview : null);
      setConflictLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, debouncedConflictKey]);

  const onApplySuggestedSlot = useCallback(
    (slot: NextAvailableBookingSlot) => {
      setManualEndOverride(false);
      skipOneEndSyncRef.current = true;
      const startWall = toDatetimeLocalValueInTimezone(slot.startAt, tz);
      setStartLocal(startWall);
      const slotEnd = slot.endAt?.trim();
      const dur =
        tplForRooms ? quickTemplateDurationMinutes(tplForRooms, services) : PLACEHOLDER_DURATION_MIN;
      const endWall = slotEnd
        ? toDatetimeLocalValueInTimezone(slot.endAt, tz)
        : deriveQuickBookEndLocal({ startLocal: startWall, durationMinutes: dur, timeZone: tz });
      setEndLocal(endWall ?? "");
      setRoomId(slot.roomId);
      if (slot.staffId) setAssignedStaffId(slot.staffId);
    },
    [services, tplForRooms, tz]
  );

  const nextSlotsRequest = useMemo(() => {
    if (!tplForRooms || !clinicId.trim()) return null;
    const startIso = fromDatetimeLocalValueInTimezone(startLocal, tz);
    if (!startIso) return null;
    return {
      clinicId: clinicId.trim(),
      bookingType: tplForRooms.bookingType,
      serviceId: catalogService?.id ?? null,
      staffId: assignedStaffId.trim() || null,
      roomId: roomId.trim() || null,
      preferredStartAt: startIso,
      durationMinutes: selectedDurationMinutes,
    };
  }, [assignedStaffId, catalogService?.id, clinicId, roomId, selectedDurationMinutes, startLocal, tplForRooms, tz]);

  const onTemplateChange = useCallback(
    (id: CalendarQuickTemplateId) => {
      setManualEndOverride(false);
      setRoomId("");
      setResourcePicks({});
      setTemplateId(id);
      const t = calendarQuickTemplateById(id);
      if (!t) return;
      const durMin = quickTemplateDurationMinutes(t, services);
      const dk = startLocal.slice(0, 10);
      if (!dk) return;
      const clamped = clampStartToNearestOption(dk, startLocal, gridConfig, durMin);
      setStartLocal(clamped);
    },
    [gridConfig, services, startLocal]
  );

  const onStartChange = useCallback((nextStart: string) => {
    setManualEndOverride(false);
    setStartLocal(normalizeQuickBookDatetimeLocal(nextStart));
  }, []);

  const bumpStartByClockMinutes = useCallback(
    (deltaMin: number) => {
      const dayKey = startLocal.slice(0, 10);
      const tpl = templateId ? calendarQuickTemplateById(templateId) : null;
      const durMin = tpl ? quickTemplateDurationMinutes(tpl, services) : PLACEHOLDER_DURATION_MIN;
      const startIso = fromDatetimeLocalValueInTimezone(startLocal, tz);
      if (!startIso) return;
      const bumpIso = addUtcMinutesToIso(startIso, deltaMin);
      const bumpLocal = toDatetimeLocalValueInTimezone(bumpIso, tz);
      const clamped = clampStartToNearestOption(dayKey, bumpLocal, gridConfig, durMin);
      onStartChange(clamped);
    },
    [gridConfig, onStartChange, services, startLocal, templateId, tz]
  );

  const applyNextAvailableSlot = useCallback(async () => {
    const req = nextSlotsRequest;
    if (!req || !tplForRooms) return;
    setNextAvailBusy(true);
    try {
      const r = await findNextAvailableBookingSlotsAction(tenantId.trim(), {
        ...req,
        limit: 5,
      });
      if (r.ok && r.slots[0]) onApplySuggestedSlot(r.slots[0]);
    } finally {
      setNextAvailBusy(false);
    }
  }, [nextSlotsRequest, onApplySuggestedSlot, tenantId, tplForRooms]);

  const isFiOsFlow = workflowVariant === "fiOs";

  const hasRoomConflict = useMemo(
    () => Boolean(conflictPreview?.messages?.some((m) => m.type === "room" && m.severity === "error")),
    [conflictPreview]
  );

  const dayKey = startLocal.length >= 10 ? startLocal.slice(0, 10) : "";

  const timeSelectOptions = useMemo(() => {
    if (!dayKey) return [];
    return quarterHourStartOptions(gridConfig, selectedDurationMinutes);
  }, [dayKey, gridConfig, selectedDurationMinutes]);

  const dateHeadingLong = dayKey ? formatClinicLongDate(dayKey, clinicLocale) : "";
  const dateHeadingShort = dayKey ? formatClinicDate(dayKey, clinicLocale) : "";

  const clinicLabel = clinics.find((x) => x.id === clinicId)?.display_name?.trim() ?? null;

  const timeSummary = useMemo(
    () =>
      buildQuickBookTimeSummary({
        label: tplForRooms?.label ?? null,
        startLocal,
        endLocal,
        durationMinutes: tplForRooms ? selectedDurationMinutes : null,
        locale: clinicLocale,
        timeZone: tz,
      }),
    [clinicLocale, endLocal, selectedDurationMinutes, startLocal, tplForRooms, tz]
  );

  const assignedRoomLabel = useMemo(() => {
    const id = roomId.trim();
    if (!id) return null;
    return roomOptions.find((o) => o.room.id === id)?.room.display_name ?? null;
  }, [roomId, roomOptions]);

  useEffect(() => {
    if (!open) return;
    const sid = assignedStaffId.trim();
    if (!sid) return;
    if (!providerOptions.some((s) => s.id === sid)) setAssignedStaffId("");
  }, [open, assignedStaffId, providerOptions]);

  const clearExistingSelection = useCallback(() => {
    setSelection(null);
    setPatientQuery("");
    setPatientHits([]);
    setLeadHits([]);
  }, []);

  const selectPatientHit = useCallback((hit: ConsultationLinkSearchPatientHit) => {
    setSelection({ kind: "patient", hit });
    setPatientName(hit.name);
    setPatientMobile(hit.phone?.trim() ?? "");
    setPatientEmail("");
    setPatientQuery("");
    setPatientHits([]);
    setLeadHits([]);
  }, []);

  const selectLeadHit = useCallback((hit: ConsultationLinkSearchLeadHit) => {
    setSelection({ kind: "lead", hit });
    setPatientName(hit.name);
    setPatientMobile("");
    setPatientEmail("");
    setPatientQuery("");
    setPatientHits([]);
    setLeadHits([]);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    const tpl = templateId ? calendarQuickTemplateById(templateId) : undefined;
    if (!tpl) {
      setFormErr("Pick an appointment type.");
      return;
    }
    const startNorm = normalizeQuickBookDatetimeLocal(startLocal);
    const resolvedEndLocal =
      manualEndOverride
        ? normalizeQuickBookDatetimeLocal(endLocal)
        : deriveQuickBookEndLocal({
            startLocal: startNorm,
            durationMinutes: selectedDurationMinutes,
            timeZone: tz,
          }) ?? normalizeQuickBookDatetimeLocal(endLocal);
    const startIso = fromDatetimeLocalValueInTimezone(startNorm, tz);
    const endIso = fromDatetimeLocalValueInTimezone(resolvedEndLocal, tz);
    if (!startIso || !endIso) {
      setFormErr("Start and end times are required.");
      return;
    }
    const endMs = parseIsoUtcMs(endIso);
    const startMs = parseIsoUtcMs(startIso);
    if (endMs == null || startMs == null || endMs <= startMs) {
      setFormErr("End must be after start.");
      return;
    }

    const displayName = patientName.trim();
    if (!displayName) {
      setFormErr("Patient name is required.");
      return;
    }

    if (!clinicId.trim()) {
      setFormErr(
        clinicResolveBlocked === "no_clinics"
          ? "Add a clinic for this tenant before booking."
          : "Choose a site under Advanced scheduling (Clinic override), or set a calendar clinic filter."
      );
      return;
    }

    const staffId = assignedStaffId.trim();
    if (staffId) {
      const staff = staffDirectory.find((s) => s.id === staffId);
      if (staff && !canSelectStaffForClinicalPicker(staff)) {
        setFormErr(staff.clinical_readiness.block_reason ?? "Selected provider is not clinically available.");
        return;
      }
    }

    let anchor:
      | { kind: "lead"; leadId: string }
      | { kind: "patient"; patientId: string; personId: string }
      | { kind: "new_lead"; displayName: string; phone?: string; email?: string };

    if (selection?.kind === "patient") {
      anchor = { kind: "patient", patientId: selection.hit.id, personId: selection.hit.person_id };
    } else if (selection?.kind === "lead") {
      anchor = { kind: "lead", leadId: selection.hit.id };
    } else {
      anchor = {
        kind: "new_lead",
        displayName,
        phone: patientMobile.trim() || undefined,
        email: patientEmail.trim() || undefined,
      };
    }

    const assignedUserId = staffId ? null : legacyOwnerUserId.trim() || null;

    setBusy(true);
    try {
      const r = await calendarQuickCreateBookingAction(tenantId.trim(), {
        startAt: startIso,
        endAt: endIso,
        calendarTimezone: tz,
        bookingType: tpl.bookingType,
        title: tpl.title,
        clinicId: clinicId.trim() || null,
        roomId: roomId.trim() || null,
        assignedStaffId: staffId || null,
        assignedUserId,
        templateId: tpl.id,
        anchor,
        description: notes.trim() || null,
        metadata: { template_label: tpl.label },
        resourceAssignments: builtResourceExtras.length > 0 ? builtResourceExtras : undefined,
      });
      if (!r.ok) {
        setFormErr(r.error);
        toast?.error(r.error);
        return;
      }
      logFiCalendarTimezoneDebug("quick-create-booking-returned", {
        clinicTimezone: tz,
        loadedStartAt: r.booking.start_at,
        loadedEndAt: r.booking.end_at,
        renderedStartDisplay: formatClinicTimeForLocale(r.booking.start_at, clinicLocale, tz),
      });
      toast?.success("Appointment saved.");
      onCreated(r.booking, displayName);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error while saving.";
      setFormErr(msg);
      toast?.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!open || !prefill) return null;

  const clinicSetupHref = `/fi-admin/${tenantId.trim()}/settings/clinic-setup`;
  const showClinicOverride = clinics.length > 1;
  const isLightFiOsDrawer = workflowVariant === "fiOs" && calendarWorkspaceDisplayTheme === "light";
  const os = isLightFiOsDrawer ? fiPageHeaderVariantClassNames.clinicLight : fiPageHeaderVariantClassNames.osDark;
  const drawerSurfaceClass = isLightFiOsDrawer ? fiSurfaceVariantClassNames.crmLight : fiSurfaceVariantClassNames.darkGlass;
  const inputClass = isLightFiOsDrawer
    ? "mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35"
    : "mt-1 w-full rounded-lg border border-white/[0.12] bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-[#22C1FF]/45";
  const bumpBtnClass = isLightFiOsDrawer
    ? "inline-flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
    : "inline-flex items-center justify-center rounded-full border border-white/[0.12] bg-slate-950/45 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.06] disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-[125] flex justify-end" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Close" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          drawerSurfaceClass,
          "relative m-0 flex h-[100dvh] w-full max-w-full flex-col sm:m-4 sm:h-[min(100dvh-2rem,900px)] sm:max-w-md sm:rounded-2xl"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-5">
          <div className={cn(os.root, "min-w-0")}>
            <h2 id={titleId} className={cn(os.title, "text-lg sm:text-xl")}>
              Quick book
            </h2>
            <p className={cn(os.description, "mt-1")}>Date and room are handled automatically.</p>
            <p className="mt-1 text-[11px] text-slate-500">Times use {tzLabel}.</p>
          </div>
          <button
            type="button"
            className={cn(
              fiButtonVariantClassNames.ghost,
              "shrink-0",
              isLightFiOsDrawer ? "text-slate-400" : "text-slate-300"
            )}
            onClick={() => !busy && onClose()}
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-4">
            {setupRecommendations.length > 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Setup recommendation</p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs leading-snug text-amber-100/90">
                  {setupRecommendations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <p className={cn(os.eyebrow, "mb-2")}>Patient or lead</p>
              <div className="grid gap-2">
                <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                  Name <span className="text-rose-300">*</span>
                  <input
                    className={inputClass}
                    value={patientName}
                    onChange={(e) => {
                      setPatientName(e.target.value);
                      clearExistingSelection();
                    }}
                    placeholder="Full name"
                    required
                    autoComplete="name"
                  />
                </label>
                <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                  Mobile
                  <input
                    className={inputClass}
                    value={patientMobile}
                    onChange={(e) => {
                      setPatientMobile(e.target.value);
                      clearExistingSelection();
                    }}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Optional"
                  />
                </label>
                <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                  Email
                  <input
                    type="email"
                    className={inputClass}
                    value={patientEmail}
                    onChange={(e) => {
                      setPatientEmail(e.target.value);
                      clearExistingSelection();
                    }}
                    autoComplete="email"
                    placeholder="Optional"
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {selection
                  ? `Linked to existing ${selection.kind}. Clear the name field and search below to change.`
                  : "A new patient record is created automatically when you save with a name and no match selected."}
              </p>
            </div>

            <details className="rounded-xl border border-white/[0.1] bg-slate-950/25">
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
                Find existing patient or lead
              </summary>
              <div className="space-y-2 border-t border-white/[0.08] px-3 pb-3 pt-2">
                <input
                  className={inputClass}
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Search name, phone, or email…"
                  autoComplete="off"
                />
                {patientLoading ? <p className="text-xs text-slate-500">Searching…</p> : null}
                {patientErr ? <p className="text-xs text-rose-300">{patientErr}</p> : null}
                {patientHits.length > 0 ? (
                  <ul className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-white/[0.08] bg-slate-950/40 p-1">
                    {patientHits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          className={cn(
                            "w-full rounded-md px-2 py-1.5 text-left text-xs transition",
                            selection?.kind === "patient" && selection.hit.id === h.id
                              ? "bg-sky-500/20 text-sky-50"
                              : "text-slate-200 hover:bg-white/[0.05]"
                          )}
                          onClick={() => selectPatientHit(h)}
                        >
                          <span className="font-medium">{h.name}</span>
                          {h.phone ? <span className="ml-1 text-slate-500">{h.phone}</span> : null}
                          <span className="block text-[10px] text-slate-500">Patient</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {leadHits.length > 0 ? (
                  <ul className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-white/[0.08] bg-slate-950/40 p-1">
                    {leadHits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          className={cn(
                            "w-full rounded-md px-2 py-1.5 text-left text-xs transition",
                            selection?.kind === "lead" && selection.hit.id === h.id
                              ? "bg-sky-500/20 text-sky-50"
                              : "text-slate-200 hover:bg-white/[0.05]"
                          )}
                          onClick={() => selectLeadHit(h)}
                        >
                          <span className="font-medium">{h.name}</span>
                          <span className="ml-1 text-slate-500">{h.stageLabel}</span>
                          <span className="block text-[10px] text-slate-500">Lead</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>

            <div>
              <p className={cn(os.eyebrow, "mb-2")}>Appointment type</p>
              {!templateId ? (
                <p className="mb-2 text-xs text-slate-400">Pick a type — duration updates from the service catalog.</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {CALENDAR_QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTemplateChange(t.id)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition",
                      templateId === t.id
                        ? "border-[#22C1FF]/50 bg-sky-500/15 text-sky-50 shadow-sm shadow-cyan-950/30"
                        : "border-white/[0.1] bg-slate-950/30 text-slate-200 hover:border-white/20"
                    )}
                  >
                    {t.label}
                    <span className="mt-0.5 block text-xs font-normal tabular-nums text-slate-400">
                      {quickTemplateDurationMinutes(t, services)} min
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={cn(os.eyebrow, "mb-1")}>Time</p>
              <p className="text-xs text-slate-500">Selected from calendar. Adjust if needed.</p>
              <p className="mt-3 text-base font-semibold leading-snug text-slate-50">{dateHeadingLong}</p>
              {dateHeadingShort ? (
                <p className="mt-0.5 text-sm tabular-nums text-slate-400">{dateHeadingShort}</p>
              ) : null}
              {clinicResolveBlocked ? (
                <div className="mt-2 rounded-lg border border-amber-500/35 bg-amber-950/25 px-3 py-2 text-xs leading-snug text-amber-100/95">
                  <p>
                    Clinic is not configured for this calendar. Please complete Clinic Setup
                    {clinicResolveBlocked === "ambiguous"
                      ? ", or choose a site under Advanced scheduling (Clinic override)."
                      : "."}
                  </p>
                  <Link
                    href={clinicSetupHref}
                    className="mt-1.5 inline-block font-semibold text-sky-300 underline hover:text-sky-200"
                  >
                    Settings → Clinic Setup
                  </Link>
                </div>
              ) : clinicLabel ? (
                <p className="mt-2 text-xs text-slate-400">
                  Clinic: <span className="font-medium text-slate-200">{clinicLabel}</span>
                  <span className="text-slate-400"> · {tzLabel}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">{tzLabel}</p>
              )}
              <p className="mt-2 text-sm font-medium text-sky-100/95 tabular-nums" role="status">
                {timeSummary}
              </p>
              <label className={cn("mt-3 block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                Start time
                <select
                  className={cn(inputClass, "text-base font-semibold tabular-nums")}
                  value={(() => {
                    const hm = normalizeQuickBookDatetimeLocal(startLocal).slice(11, 16);
                    return timeSelectOptions.includes(hm) ? hm : "";
                  })()}
                  onChange={(e) => {
                    const hm = e.target.value;
                    if (!hm || !dayKey) return;
                    onStartChange(mergeDayAndHm(dayKey, hm));
                  }}
                >
                  <option value="">Select…</option>
                  {timeSelectOptions.map((hm) => (
                    <option key={hm} value={hm}>
                      {formatClockHm(hm)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={bumpBtnClass}
                  onClick={() => bumpStartByClockMinutes(-30)}
                >
                  −30 min
                </button>
                <button
                  type="button"
                  className={bumpBtnClass}
                  onClick={() => bumpStartByClockMinutes(-15)}
                >
                  −15 min
                </button>
                <button
                  type="button"
                  className={bumpBtnClass}
                  onClick={() => bumpStartByClockMinutes(15)}
                >
                  +15 min
                </button>
                <button
                  type="button"
                  className={bumpBtnClass}
                  onClick={() => bumpStartByClockMinutes(30)}
                >
                  +30 min
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-cyan-500/35 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-500/25 disabled:opacity-50"
                  disabled={nextAvailBusy || !nextSlotsRequest}
                  onClick={() => void applyNextAvailableSlot()}
                >
                  {nextAvailBusy ? "Searching…" : "Next available"}
                </button>
              </div>
            </div>

            <details
              className={cn(
                "rounded-xl border border-white/[0.1] bg-slate-950/25",
                hasRoomConflict && "border-rose-500/35 bg-rose-950/20"
              )}
              open={hasRoomConflict}
            >
              <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
                {hasRoomConflict ? (
                  <span className="text-rose-200">Room issue detected</span>
                ) : (
                  <span>Room will be assigned automatically.</span>
                )}
                {assignedRoomLabel && !hasRoomConflict ? (
                  <span className="mt-1 block text-[11px] font-normal text-slate-500">Planned: {assignedRoomLabel}</span>
                ) : null}
              </summary>
              <div className="space-y-2 border-t border-white/[0.08] px-3 pb-3 pt-2 text-xs leading-snug text-slate-400">
                <p>
                  {roomLoading
                    ? "Checking rooms for this slot…"
                    : assignedRoomLabel
                      ? `This booking will save with room “${assignedRoomLabel}” when the slot is valid.`
                      : !clinicId.trim()
                        ? "Set a clinic (see message above or Advanced scheduling) so a room can be assigned."
                        : "Choose an appointment type and clinic — a room is picked automatically when slots load."}
                </p>
              </div>
            </details>

            {providerOptions.length > 0 ? (
              <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                Provider
                <StaffClinicalSelect
                  tenantId={tenantId}
                  options={providerOptions}
                  value={assignedStaffId}
                  onChange={setAssignedStaffId}
                  emptyLabel="Unassigned"
                  className={inputClass}
                />
                {legacyOwnerLabel && !assignedStaffId.trim() ? (
                  <p className="mt-1 text-[11px] text-slate-500">From calendar column: {legacyOwnerLabel}</p>
                ) : null}
              </label>
            ) : null}

            <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
              Notes <span className="font-normal text-slate-500">(optional)</span>
              <textarea
                className={cn(inputClass, "min-h-[72px] resize-y")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes…"
              />
            </label>

            <details
              className={cn(
                "rounded-xl border border-white/[0.1] bg-slate-950/25",
                isFiOsFlow && "open:border-cyan-500/25"
              )}
            >
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
                Advanced scheduling (full booking)
              </summary>
              <div className="space-y-3 border-t border-white/[0.08] px-3 pb-3 pt-2">
                <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                  Start (exact)
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={normalizeQuickBookDatetimeLocal(startLocal)}
                    onChange={(e) => {
                      setManualEndOverride(false);
                      setStartLocal(normalizeQuickBookDatetimeLocal(e.target.value));
                    }}
                  />
                </label>
                <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                  End (exact)
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={normalizeQuickBookDatetimeLocal(endLocal)}
                    onChange={(e) => {
                      setManualEndOverride(true);
                      setEndLocal(normalizeQuickBookDatetimeLocal(e.target.value));
                    }}
                  />
                </label>
                {showClinicOverride ? (
                  <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                    Clinic override
                    <select
                      className={inputClass}
                      value={clinicId}
                      onChange={(e) => {
                        setClinicId(e.target.value);
                        setRoomId("");
                        setClinicResolveBlocked(null);
                      }}
                    >
                      <option value="">—</option>
                      {clinics.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {clinicId.trim() ? (
                  <label className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                    Room
                    <select
                      className={inputClass}
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      disabled={roomLoading}
                    >
                      <option value="">{roomLoading ? "Loading rooms…" : "Select room"}</option>
                      {roomOptions.map((o) => (
                        <option key={o.room.id} value={o.room.id} disabled={Boolean(o.disabledReason)}>
                          {o.room.display_name}
                          {o.disabledReason ? ` — ${o.disabledReason}` : o.preferred ? " (preferred)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {serviceResourceReqs.length > 0 && resourceSuggest ? (
                  <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-950/25 px-2 py-2">
                    <p className="text-xs font-semibold text-amber-100/95">Required resources</p>
                    {serviceResourceReqs.map((req) => {
                      const val = resourcePicks[req.id] ?? "";
                      if (req.resource_type === "staff_role" || req.resource_type === "staff_member") {
                        const ids = resourceSuggest.staffOptionsByRequirementId[req.id] ?? [];
                        return (
                          <label key={req.id} className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                            {req.requirement_label}
                            {!req.is_required ? <span className="text-slate-500"> (optional)</span> : null}
                            <select
                              className={inputClass}
                              value={val}
                              onChange={(e) => setResourcePicks((p) => ({ ...p, [req.id]: e.target.value }))}
                            >
                              <option value="">—</option>
                              {ids.map((sid) => {
                                const st = staffDirectory.find((s) => s.id === sid);
                                return (
                                  <option key={sid} value={sid}>
                                    {st?.full_name?.trim() || sid.slice(0, 8)}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                        );
                      }
                      const rooms = resourceSuggest.roomOptionsByRequirementId[req.id] ?? [];
                      return (
                        <label key={req.id} className={cn("block text-xs font-medium", isLightFiOsDrawer ? "text-slate-300" : "text-slate-300", os.meta)}>
                          {req.requirement_label}
                          {!req.is_required ? <span className="text-slate-500"> (optional)</span> : null}
                          <select
                            className={inputClass}
                            value={val}
                            onChange={(e) => setResourcePicks((p) => ({ ...p, [req.id]: e.target.value }))}
                          >
                            <option value="">—</option>
                            {rooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.display_name}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </details>

            <BookingConflictPreview
              preview={conflictPreviewBody ? conflictPreview : calmIncompleteConflictPreview}
              loading={Boolean(conflictPreviewBody) && conflictLoading && !conflictPreview}
              variant="dark"
            />

            <NextAvailableBookingSlots
              tenantId={tenantId}
              calendarTimezone={tz}
              request={nextSlotsRequest}
              show={Boolean(nextSlotsRequest) && (conflictPreview?.status === "blocked" || hasRoomConflict)}
              onApplySlot={onApplySuggestedSlot}
              variant="dark"
            />

            {formErr ? <p className="text-sm text-rose-300">{formErr}</p> : null}
          </div>

          <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-white/[0.08] pt-4">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50"
              disabled={busy}
              onClick={() => onClose()}
            >
              Cancel
            </button>
            <button type="submit" className={fiButtonVariantClassNames.osPrimary} disabled={busy || !clinicId.trim()}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
