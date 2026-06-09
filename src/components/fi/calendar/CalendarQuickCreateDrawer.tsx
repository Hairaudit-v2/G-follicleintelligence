"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";

import { calendarQuickCreateBookingAction } from "@/lib/actions/fi-calendar-quick-create-actions";
import { loadRoomPickerOptionsAction } from "@/lib/actions/fi-rooms-actions";
import { useCalendarToastOptional } from "@/components/calendar/CalendarToast";
import {
  addUtcMinutesToIso,
  displayCalendarTimezoneSubtitle,
  formatClinicTime,
  fromDatetimeLocalValueInTimezone,
  logFiCalendarTimezoneDebug,
  parseIsoUtcMs,
  toDatetimeLocalValueInTimezone,
} from "@/src/lib/calendar/calendarTimezone";
import {
  CALENDAR_QUICK_TEMPLATES,
  calendarQuickTemplateById,
  type CalendarQuickTemplateId,
} from "@/src/lib/calendar/calendarQuickCreateTemplates";
import type { ConsultationLinkSearchLeadHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import type { ConsultationLinkSearchPatientHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import { quickTemplateDurationMinutes } from "@/src/lib/bookings/servicesCatalog";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import type { RoomPickerOption } from "@/src/lib/rooms/roomTypes";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
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

export function CalendarQuickCreateDrawer({
  tenantId,
  open,
  onClose,
  calendarTimezone,
  prefill,
  clinics,
  assignees,
  staffDirectory,
  setupRecommendations = [],
  services = [],
  onCreated,
  workflowVariant = "default",
}: {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  calendarTimezone: string;
  prefill: CalendarQuickCreatePrefill | null;
  clinics: CrmShellClinicOption[];
  /** Legacy fi_users — owner column labels only. */
  assignees: CrmShellUserPickerOption[];
  staffDirectory: ClinicalStaffPickerOption[];
  setupRecommendations?: string[];
  services?: FiServiceRow[];
  onCreated: (booking: FiBookingRow, displayLabel: string) => void;
  workflowVariant?: "default" | "fiOs";
}) {
  const toast = useCalendarToastOptional();
  const titleId = useId();
  const tz = calendarTimezone.trim();
  const tzLabel = displayCalendarTimezoneSubtitle(tz);
  const { staffIdByUserId } = useMemo(() => buildStaffUserLinkIndex(staffDirectory), [staffDirectory]);

  const [templateId, setTemplateId] = useState<CalendarQuickTemplateId>("consultation");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [clinicId, setClinicId] = useState("");
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
  const [formErr, setFormErr] = useState<string | null>(null);

  const legacyOwnerLabel = useMemo(() => {
    const uid = legacyOwnerUserId.trim();
    if (!uid) return null;
    const u = assignees.find((x) => x.id === uid);
    return u?.full_name?.trim() || u?.email?.trim() || `User ${uid.slice(0, 8)}…`;
  }, [assignees, legacyOwnerUserId]);

  const resetFromPrefill = useCallback(() => {
    if (!prefill?.localStart?.trim()) return;
    const colDefaults = columnResourceDefaults(prefill.columnId, staffIdByUserId);
    const clinicFromFilter = prefill.defaultClinicId?.trim() ?? "";
    setClinicId(colDefaults.clinicId || clinicFromFilter || "");
    setRoomId(colDefaults.roomId || "");
    setAssignedStaffId(colDefaults.assignedStaffId);
    setLegacyOwnerUserId(colDefaults.legacyOwnerUserId);
    const tpl = prefill.templateId ? calendarQuickTemplateById(prefill.templateId) : null;
    const nextTpl = tpl?.id ?? "consultation";
    setTemplateId(nextTpl);
    const start = prefill.localStart.trim();
    setStartLocal(start);
    const startIso = fromDatetimeLocalValueInTimezone(start, tz);
    const t = calendarQuickTemplateById(nextTpl);
    let endIso: string | null = null;
    if (startIso && t) {
      try {
        endIso = addUtcMinutesToIso(startIso, quickTemplateDurationMinutes(t, services));
      } catch {
        endIso = null;
      }
    }
    if (startIso && endIso) {
      setEndLocal(toDatetimeLocalValueInTimezone(endIso, tz));
    } else {
      setEndLocal("");
    }
    setPatientName("");
    setPatientMobile("");
    setPatientEmail("");
    setPatientQuery("");
    setPatientHits([]);
    setLeadHits([]);
    setSelection(null);
    setFormErr(null);
    logFiCalendarTimezoneDebug("quick-create-drawer-prefill", {
      clinicTimezone: tz,
      selectedSlotDatetimeLocal: start,
      selectedSlotUtcIso: startIso,
      endUtcIso: endIso,
    });
  }, [prefill, services, staffIdByUserId, tz]);

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

  const tplForRooms = useMemo(() => calendarQuickTemplateById(templateId), [templateId]);

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

  const onTemplateChange = useCallback(
    (id: CalendarQuickTemplateId) => {
      setRoomId("");
      setTemplateId(id);
      const startIso = fromDatetimeLocalValueInTimezone(startLocal, tz);
      const t = calendarQuickTemplateById(id);
      if (!startIso || !t) return;
      const endIso = addUtcMinutesToIso(startIso, quickTemplateDurationMinutes(t, services));
      setEndLocal(toDatetimeLocalValueInTimezone(endIso, tz));
    },
    [services, startLocal, tz]
  );

  const onStartChange = useCallback(
    (nextStart: string) => {
      setStartLocal(nextStart);
      const tpl = calendarQuickTemplateById(templateId);
      const startIso = fromDatetimeLocalValueInTimezone(nextStart, tz);
      if (!startIso || !tpl) return;
      const endIso = addUtcMinutesToIso(startIso, quickTemplateDurationMinutes(tpl, services));
      setEndLocal(toDatetimeLocalValueInTimezone(endIso, tz));
    },
    [services, templateId, tz]
  );

  const selectedStaff = useMemo(
    () => staffDirectory.find((s) => s.id === assignedStaffId.trim()) ?? null,
    [assignedStaffId, staffDirectory]
  );

  const isFiOsFlow = workflowVariant === "fiOs";

  const scheduleSummary = useMemo(() => {
    if (!startLocal || !endLocal) return "Time, clinic & provider — tap to adjust";
    const datePart = startLocal.slice(0, 10);
    const tStart = startLocal.slice(11, 16);
    const tEnd = endLocal.slice(11, 16);
    const c = clinics.find((x) => x.id === clinicId)?.display_name?.trim();
    const providerLabel = selectedStaff?.full_name?.trim() || selectedStaff?.email?.trim() || legacyOwnerLabel;
    const parts: string[] = [datePart, `${tStart}–${tEnd}`];
    if (c) parts.push(c);
    if (providerLabel) parts.push(providerLabel);
    return parts.join(" · ");
  }, [clinicId, clinics, endLocal, legacyOwnerLabel, selectedStaff, startLocal]);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const tpl = calendarQuickTemplateById(templateId);
    if (!tpl) {
      setFormErr("Pick an appointment type.");
      return;
    }
    const startIso = fromDatetimeLocalValueInTimezone(startLocal, tz);
    const endIso = fromDatetimeLocalValueInTimezone(endLocal, tz);
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
        metadata: { template_label: tpl.label },
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
        renderedStartDisplay: formatClinicTime(r.booking.start_at, tz),
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
  }

  if (!open || !prefill) return null;

  const os = fiPageHeaderVariantClassNames.osDark;
  const inputClass =
    "mt-1 w-full rounded-lg border border-white/[0.12] bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-[#22C1FF]/45";

  return (
    <div className="fixed inset-0 z-[125] flex justify-end" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Close" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          fiSurfaceVariantClassNames.darkGlass,
          "relative m-0 flex h-[100dvh] w-full max-w-full flex-col sm:m-4 sm:h-[min(100dvh-2rem,900px)] sm:max-w-md sm:rounded-2xl"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-5">
          <div className={cn(os.root, "min-w-0")}>
            <p className={os.eyebrow}>Scheduling</p>
            <h2 id={titleId} className={cn(os.title, "text-lg sm:text-xl")}>
              Quick book
            </h2>
            <p className={os.description}>Times use {tzLabel}.</p>
          </div>
          <button
            type="button"
            className={cn(fiButtonVariantClassNames.ghost, "shrink-0 text-slate-300")}
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
              <p className={cn(os.eyebrow, "mb-2")}>Patient details</p>
              <div className="grid gap-2">
                <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
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
                <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
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
                <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
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

            <details
              className={cn(
                "rounded-xl border border-white/[0.1] bg-slate-950/25",
                isFiOsFlow && "open:border-cyan-500/25"
              )}
              open={!isFiOsFlow}
            >
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
                <span className="text-slate-500">Time & place · </span>
                {scheduleSummary}
              </summary>
              <div className="space-y-3 border-t border-white/[0.08] px-3 pb-3 pt-2">
                <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
                  Start
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={startLocal}
                    onChange={(e) => onStartChange(e.target.value)}
                    required
                  />
                </label>
                <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
                  End
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={endLocal}
                    onChange={(e) => setEndLocal(e.target.value)}
                    required
                  />
                </label>
                {clinics.length > 0 ? (
                  <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
                    Clinic
                    <select
                      className={inputClass}
                      value={clinicId}
                      onChange={(e) => {
                        setClinicId(e.target.value);
                        setRoomId("");
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
                  <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
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
                {staffDirectory.length > 0 ? (
                  <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
                    Clinical provider
                    <StaffClinicalSelect
                      tenantId={tenantId}
                      options={staffDirectory}
                      value={assignedStaffId}
                      onChange={setAssignedStaffId}
                      emptyLabel="Unassigned"
                      className={inputClass}
                    />
                    {legacyOwnerLabel && !assignedStaffId.trim() ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Calendar column owner: {legacyOwnerLabel} (assign a clinical provider above when possible)
                      </p>
                    ) : null}
                  </label>
                ) : null}
              </div>
            </details>

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
            <button type="submit" className={fiButtonVariantClassNames.osPrimary} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
