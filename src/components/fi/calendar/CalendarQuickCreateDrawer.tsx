"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";

import { calendarQuickCreateBookingAction } from "@/lib/actions/fi-calendar-quick-create-actions";
import { useCalendarToastOptional } from "@/components/calendar/CalendarToast";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import {
  CALENDAR_QUICK_TEMPLATES,
  calendarQuickTemplateById,
  type CalendarQuickTemplateId,
} from "@/src/lib/calendar/calendarQuickCreateTemplates";
import { displayCalendarTimezoneSubtitle } from "@/src/lib/calendar/calendarTimezone";
import type { ConsultationLinkSearchLeadHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import type { ConsultationLinkSearchPatientHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
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

function addMinutesToIso(startIso: string, minutes: number): string {
  return new Date(Date.parse(startIso) + minutes * 60_000).toISOString();
}

export type CalendarQuickCreatePrefill = {
  localStart: string;
  columnId?: string;
  dayKey?: string;
  templateId?: CalendarQuickTemplateId;
};

type AnchorSelection =
  | { kind: "patient"; hit: ConsultationLinkSearchPatientHit }
  | { kind: "lead"; hit: ConsultationLinkSearchLeadHit }
  | { kind: "new_lead" }
  | { kind: "block" };

function columnResourceDefaults(columnId?: string): {
  clinicId: string;
  assignedStaffId: string;
  assignedUserId: string;
  assigneeSelect: string;
} {
  const col = columnId?.trim() ?? "";
  if (col.startsWith("c:")) {
    return { clinicId: col.slice(2), assignedStaffId: "", assignedUserId: "", assigneeSelect: "" };
  }
  if (col.startsWith("s:")) {
    return { clinicId: "", assignedStaffId: col.slice(2), assignedUserId: "", assigneeSelect: `s:${col.slice(2)}` };
  }
  if (col.startsWith("u:")) {
    return { clinicId: "", assignedStaffId: "", assignedUserId: col.slice(2), assigneeSelect: `u:${col.slice(2)}` };
  }
  return { clinicId: "", assignedStaffId: "", assignedUserId: "", assigneeSelect: "" };
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
  onCreated,
}: {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  calendarTimezone: string;
  prefill: CalendarQuickCreatePrefill | null;
  clinics: CrmShellClinicOption[];
  assignees: CrmShellUserPickerOption[];
  staffDirectory: CrmShellUserPickerOption[];
  onCreated: (booking: FiBookingRow) => void;
}) {
  const toast = useCalendarToastOptional();
  const titleId = useId();
  const tz = calendarTimezone.trim();
  const tzLabel = displayCalendarTimezoneSubtitle(tz);

  const [templateId, setTemplateId] = useState<CalendarQuickTemplateId>("consultation_30");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [assigneeSelect, setAssigneeSelect] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const debouncedPatientQ = useDebouncedValue(patientQuery.trim(), 320);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientErr, setPatientErr] = useState<string | null>(null);
  const [patientHits, setPatientHits] = useState<ConsultationLinkSearchPatientHit[]>([]);
  const [leadHits, setLeadHits] = useState<ConsultationLinkSearchLeadHit[]>([]);
  const [selection, setSelection] = useState<AnchorSelection | null>(null);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const resetFromPrefill = useCallback(() => {
    if (!prefill?.localStart?.trim()) return;
    const colDefaults = columnResourceDefaults(prefill.columnId);
    setClinicId(colDefaults.clinicId);
    setAssigneeSelect(colDefaults.assigneeSelect);
    const tpl = prefill.templateId ? calendarQuickTemplateById(prefill.templateId) : null;
    const nextTpl = tpl?.id ?? "consultation_30";
    setTemplateId(nextTpl);
    const start = prefill.localStart.trim();
    setStartLocal(start);
    const startIso = fromDatetimeLocalValue(start, tz);
    const t = calendarQuickTemplateById(nextTpl);
    let endIso: string | null = null;
    if (t?.isBlock) {
      endIso = startIso ? addMinutesToIso(startIso, t.durationMinutes) : null;
    } else if (startIso && t) {
      try {
        endIso = addMinutesToIso(startIso, t.durationMinutes);
      } catch {
        endIso = null;
      }
    }
    if (startIso && endIso) {
      setEndLocal(toDatetimeLocalValue(endIso, tz));
    } else {
      setEndLocal("");
    }
    setPatientQuery("");
    setPatientHits([]);
    setLeadHits([]);
    setSelection(t?.isBlock ? { kind: "block" } : null);
    setNewLeadName("");
    setNewLeadPhone("");
    setNewLeadEmail("");
    setFormErr(null);
  }, [prefill, tz]);

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

  const onTemplateChange = useCallback(
    (id: CalendarQuickTemplateId) => {
      setTemplateId(id);
      const t = calendarQuickTemplateById(id);
      setSelection((prev) => {
        if (t?.isBlock) return { kind: "block" };
        if (prev?.kind === "block") return null;
        return prev;
      });
      const startIso = fromDatetimeLocalValue(startLocal, tz);
      if (!startIso || !t) return;
      const endIso = addMinutesToIso(startIso, t.durationMinutes);
      setEndLocal(toDatetimeLocalValue(endIso, tz));
    },
    [startLocal, tz]
  );

  const onStartChange = useCallback(
    (nextStart: string) => {
      setStartLocal(nextStart);
      const tpl = calendarQuickTemplateById(templateId);
      const startIso = fromDatetimeLocalValue(nextStart, tz);
      if (!startIso || !tpl) return;
      const endIso = addMinutesToIso(startIso, tpl.durationMinutes);
      setEndLocal(toDatetimeLocalValue(endIso, tz));
    },
    [templateId, tz]
  );

  const assigneeOptions = useMemo(() => {
    const rows: { value: string; label: string }[] = [{ value: "", label: "Unassigned" }];
    for (const s of staffDirectory) {
      const sid = s.id?.trim();
      if (!sid) continue;
      rows.push({
        value: `s:${sid}`,
        label: (s.email?.trim() || s.id.slice(0, 8)) + " (staff)",
      });
    }
    for (const u of assignees) {
      const uid = u.id?.trim();
      if (!uid) continue;
      rows.push({ value: `u:${uid}`, label: u.email?.trim() || uid.slice(0, 8) });
    }
    return rows;
  }, [assignees, staffDirectory]);

  const parseAssigneeSelect = useCallback((v: string) => {
    if (v.startsWith("s:")) return { assignedStaffId: v.slice(2), assignedUserId: "" };
    if (v.startsWith("u:")) return { assignedStaffId: "", assignedUserId: v.slice(2) };
    return { assignedStaffId: "", assignedUserId: "" };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const tpl = calendarQuickTemplateById(templateId);
    if (!tpl) {
      setFormErr("Pick a valid template.");
      return;
    }
    const startIso = fromDatetimeLocalValue(startLocal, tz);
    const endIso = fromDatetimeLocalValue(endLocal, tz);
    if (!startIso || !endIso) {
      setFormErr("Start and end times are required.");
      return;
    }
    if (Date.parse(endIso) <= Date.parse(startIso)) {
      setFormErr("End must be after start.");
      return;
    }

    let anchor:
      | { kind: "lead"; leadId: string }
      | { kind: "patient"; patientId: string; personId: string }
      | { kind: "new_lead"; displayName: string; phone: string; email?: string }
      | { kind: "block" };

    if (tpl.isBlock) {
      anchor = { kind: "block" };
    } else if (selection?.kind === "patient") {
      anchor = { kind: "patient", patientId: selection.hit.id, personId: selection.hit.person_id };
    } else if (selection?.kind === "lead") {
      anchor = { kind: "lead", leadId: selection.hit.id };
    } else if (selection?.kind === "new_lead" || (newLeadName.trim() && newLeadPhone.trim())) {
      const nm = newLeadName.trim();
      const ph = newLeadPhone.trim();
      if (!nm || !ph) {
        setFormErr("Enter name and phone to create a lead, or select an existing patient or lead.");
        return;
      }
      anchor = {
        kind: "new_lead",
        displayName: nm,
        phone: ph,
        email: newLeadEmail.trim() || undefined,
      };
    } else {
      setFormErr("Select a patient or lead, create a new lead, or choose Block time.");
      return;
    }

    const { assignedStaffId, assignedUserId } = parseAssigneeSelect(assigneeSelect);

    setBusy(true);
    try {
      const r = await calendarQuickCreateBookingAction(tenantId.trim(), {
        startAt: startIso,
        endAt: endIso,
        calendarTimezone: tz,
        bookingType: tpl.bookingType,
        title: tpl.title,
        clinicId: clinicId.trim() || null,
        assignedStaffId: assignedStaffId.trim() || null,
        assignedUserId: assignedUserId.trim() || null,
        templateId: tpl.id,
        anchor,
        metadata: { template_label: tpl.label },
      });
      if (!r.ok) {
        setFormErr(r.error);
        toast?.error(r.error);
        return;
      }
      toast?.success("Appointment created.");
      onCreated(r.booking);
      onClose();
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
              Quick create appointment
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
            <div>
              <p className={cn(os.eyebrow, "mb-2")}>Template</p>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTemplateChange(t.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                      templateId === t.id
                        ? "border-[#22C1FF]/50 bg-sky-500/15 text-sky-100"
                        : "border-white/[0.1] bg-slate-950/30 text-slate-300 hover:border-white/20"
                    )}
                  >
                    {t.label}
                    <span className="ml-1 tabular-nums text-slate-500">({t.durationMinutes}m)</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className={cn("block text-xs font-medium text-slate-300 sm:col-span-2", os.meta)}>
                Start
                <input type="datetime-local" className={inputClass} value={startLocal} onChange={(e) => onStartChange(e.target.value)} required />
              </label>
              <label className={cn("block text-xs font-medium text-slate-300 sm:col-span-2", os.meta)}>
                End
                <input type="datetime-local" className={inputClass} value={endLocal} onChange={(e) => setEndLocal(e.target.value)} required />
              </label>
            </div>

            {clinics.length > 0 ? (
              <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
                Clinic
                <select className={inputClass} value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
                  <option value="">—</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {assigneeOptions.length > 1 ? (
              <label className={cn("block text-xs font-medium text-slate-300", os.meta)}>
                Provider / resource
                <select className={inputClass} value={assigneeSelect} onChange={(e) => setAssigneeSelect(e.target.value)}>
                  {assigneeOptions.map((o) => (
                    <option key={o.value || "none"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {calendarQuickTemplateById(templateId)?.isBlock ? (
              <p className="rounded-lg border border-sky-500/25 bg-sky-950/30 px-3 py-2 text-xs text-sky-100">
                Block time uses an internal calendar hold (no patient). You can adjust the window above.
              </p>
            ) : (
              <>
                <div>
                  <p className={cn(os.eyebrow, "mb-1")}>Patient or lead</p>
                  <p className="mb-2 text-xs text-slate-500">Search by name, phone, or email — or create a new lead below.</p>
                  <input
                    className={inputClass}
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search…"
                    autoComplete="off"
                  />
                  {patientLoading ? <p className="mt-1 text-xs text-slate-500">Searching…</p> : null}
                  {patientErr ? <p className="mt-1 text-xs text-rose-300">{patientErr}</p> : null}
                  {patientHits.length > 0 ? (
                    <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/[0.08] bg-slate-950/40 p-1">
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
                            onClick={() => {
                              setNewLeadName("");
                              setNewLeadPhone("");
                              setNewLeadEmail("");
                              setSelection({ kind: "patient", hit: h });
                            }}
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
                    <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/[0.08] bg-slate-950/40 p-1">
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
                            onClick={() => {
                              setNewLeadName("");
                              setNewLeadPhone("");
                              setNewLeadEmail("");
                              setSelection({ kind: "lead", hit: h });
                            }}
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

                <div className="rounded-xl border border-white/[0.08] bg-slate-950/35 p-3">
                  <p className={cn(os.eyebrow, "mb-2")}>New lead</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className={cn("block text-xs text-slate-300 sm:col-span-2", os.meta)}>
                      Name
                      <input
                        className={inputClass}
                        value={newLeadName}
                        onChange={(e) => {
                          setNewLeadName(e.target.value);
                          setSelection({ kind: "new_lead" });
                        }}
                        placeholder="Full name"
                      />
                    </label>
                    <label className={cn("block text-xs text-slate-300", os.meta)}>
                      Phone
                      <input
                        className={inputClass}
                        value={newLeadPhone}
                        onChange={(e) => {
                          setNewLeadPhone(e.target.value);
                          setSelection({ kind: "new_lead" });
                        }}
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </label>
                    <label className={cn("block text-xs text-slate-300", os.meta)}>
                      Email
                      <input
                        type="email"
                        className={inputClass}
                        value={newLeadEmail}
                        onChange={(e) => {
                          setNewLeadEmail(e.target.value);
                          setSelection({ kind: "new_lead" });
                        }}
                        autoComplete="email"
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

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
              {busy ? "Saving…" : "Save appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
