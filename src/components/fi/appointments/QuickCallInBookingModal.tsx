"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone } from "lucide-react";

import { useCalendarToastOptional } from "@/components/calendar/CalendarToast";
import { quickCallInConsultationAction } from "@/lib/actions/fi-quick-call-in-actions";
import { fromDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import { BOOKING_TYPES } from "@/src/lib/bookings/bookingPolicy";
import {
  activeBookableServices,
  formatPriceAud,
  serviceForBookingType,
} from "@/src/lib/bookings/servicesCatalog";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import {
  canSelectStaffForClinicalPicker,
  type ClinicalStaffPickerOption,
} from "@/src/lib/staff/clinicalStaffPicker";
import { StaffClinicalSelect } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import {
  QUICK_CALL_IN_DEFAULT_TIMEZONE,
  dispatchCrmKanbanRefresh,
} from "@/src/lib/calendar/quickCallInConstants";
import {
  localNowForDatetimePicker,
  nextQuarterHourLocalString,
} from "@/src/lib/calendar/quickCallInDatetime";

function procedureLabel(t: string): string {
  const s = t.trim();
  if (s === "follow_up") return "Follow-up";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export type QuickCallInBookingModalProps = {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  /** IANA zone for interpreting `datetime-local` (default Perth). */
  calendarTimezone?: string;
  /** Optional `YYYY-MM-DDTHH:mm` in `calendarTimezone` to prefill start. */
  initialLocalStart?: string | null;
  /** Prefill clinic when opening from a site column. */
  initialClinicId?: string | null;
  /** Prefill clinical provider (`fi_staff.id`) when opening from a staff column. */
  initialAssignedStaffId?: string | null;
  /** @deprecated Legacy alias — resolved to staff when linked. */
  initialAssignedUserId?: string | null;
  clinics?: CrmShellClinicOption[];
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
  adminKey?: string;
  /** Tenant procedure catalog — drives procedure labels and suggested pricing. */
  services?: FiServiceRow[];
  /** After server success — parent may optimistically update calendar, open slide-over, etc. */
  onCreated?: (payload: { booking: FiBookingRow; leadId: string }) => void;
  /** Open appointment slide-over when provider is present (optional). */
  onOpenBooking?: (appointmentId: string) => void;
};

export function QuickCallInBookingModal({
  tenantId,
  open,
  onClose,
  calendarTimezone = QUICK_CALL_IN_DEFAULT_TIMEZONE,
  initialLocalStart,
  initialClinicId = null,
  initialAssignedStaffId = null,
  initialAssignedUserId = null,
  clinics = [],
  clinicalStaffOptions = [],
  adminKey = "",
  services = [],
  onCreated,
  onOpenBooking,
}: QuickCallInBookingModalProps) {
  const toast = useCalendarToastOptional();

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [localStart, setLocalStart] = useState("");
  const [bookingType, setBookingType] = useState("consultation");
  const [notes, setNotes] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tz = calendarTimezone.trim() || QUICK_CALL_IN_DEFAULT_TIMEZONE;

  const resetDefaults = useCallback(() => {
    const base = initialLocalStart?.trim()
      ? nextQuarterHourLocalString(initialLocalStart.trim(), tz)
      : nextQuarterHourLocalString(localNowForDatetimePicker(tz), tz);
    setLocalStart(base);
    setBookingType("consultation");
    setNotes("");
    setClinicId(initialClinicId?.trim() ?? "");
    const staffPrefill =
      initialAssignedStaffId?.trim() ||
      (initialAssignedUserId?.trim()
        ? clinicalStaffOptions.find((s) => s.fi_user_id?.trim() === initialAssignedUserId.trim())
            ?.id
        : "") ||
      "";
    setAssignedStaffId(staffPrefill);
    setError(null);
  }, [
    clinicalStaffOptions,
    initialAssignedStaffId,
    initialAssignedUserId,
    initialClinicId,
    initialLocalStart,
    tz,
  ]);

  useEffect(() => {
    if (!open) return;
    resetDefaults();
  }, [open, resetDefaults]);

  const startIso = useMemo(() => fromDatetimeLocalValue(localStart, tz), [localStart, tz]);

  const bookable = useMemo(() => activeBookableServices(services), [services]);
  const selectedCatalog = useMemo(
    () => serviceForBookingType(services, bookingType),
    [services, bookingType]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fn = firstName.trim();
    const sn = surname.trim();
    const mob = mobile.trim();
    if (!fn || !sn || !mob) {
      setError("First name, surname, and mobile are required.");
      return;
    }
    if (!startIso) {
      setError("Pick a valid date and time.");
      return;
    }

    const staffId = assignedStaffId.trim();
    if (staffId) {
      const staff = clinicalStaffOptions.find((s) => s.id === staffId);
      if (staff && !canSelectStaffForClinicalPicker(staff)) {
        setError(
          staff.clinical_readiness.block_reason ?? "Selected provider is not clinically available."
        );
        return;
      }
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        firstName: fn,
        surname: sn,
        mobile: mob,
        email: email.trim() || undefined,
        startAt: startIso,
        bookingType,
        notes: notes.trim() || undefined,
        clinicId: clinicId.trim() || null,
        assignedStaffId: staffId || null,
        calendarTimezone: tz,
      };
      if (adminKey.trim()) body.adminKey = adminKey.trim();

      const r = await quickCallInConsultationAction(tenantId, body);
      if (!r.ok) {
        setError(r.error);
        toast?.error(r.error);
        return;
      }

      onCreated?.({ booking: r.booking, leadId: r.leadId });
      dispatchCrmKanbanRefresh();

      const openSlide = () => {
        onOpenBooking?.(r.bookingId);
      };

      toast?.success("Call-in consultation booked.", {
        label: "Open booking",
        onClick: openSlide,
      });

      onClose();
      setFirstName("");
      setSurname("");
      setMobile("");
      setEmail("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-call-in-title"
        className="relative z-[121] m-0 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-2xl sm:m-4 sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
            <Phone className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="quick-call-in-title" className="text-base font-semibold text-slate-100">
              New call-in booking
            </h2>
            <p className="text-xs text-slate-400">
              Creates a CRM lead (source Phone), patient shell, and consultation appointment. Times
              use <span className="font-medium">{tz}</span>.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-40"
            onClick={() => !busy && onClose()}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="space-y-3 px-4 py-4 sm:px-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-200">First name</span>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-200">Surname</span>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  autoComplete="family-name"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-medium text-slate-200">Mobile</span>
              <input
                required
                className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-200">Email (optional)</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-200">Start (local)</span>
              <input
                type="datetime-local"
                required
                className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                value={localStart}
                onChange={(e) => setLocalStart(e.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-200">Service / procedure</span>
              <select
                className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                value={bookingType}
                onChange={(e) => setBookingType(e.target.value)}
              >
                {bookable.length > 0
                  ? bookable.map((s) => (
                      <option key={s.id} value={s.booking_type ?? ""}>
                        {s.name} ({s.duration_minutes} min)
                      </option>
                    ))
                  : BOOKING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {procedureLabel(t)}
                      </option>
                    ))}
              </select>
              {selectedCatalog && selectedCatalog.base_price > 0 ? (
                <p className="mt-1 text-xs text-slate-400">
                  Suggested price: {formatPriceAud(selectedCatalog.base_price)}
                </p>
              ) : null}
            </label>

            {clinics.length > 0 ? (
              <label className="block text-sm">
                <span className="font-medium text-slate-200">Clinic (optional)</span>
                <select
                  className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  value={clinicId}
                  onChange={(e) => setClinicId(e.target.value)}
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

            {clinicalStaffOptions.length > 0 ? (
              <label className="block text-sm">
                <span className="font-medium text-slate-200">Clinical provider (optional)</span>
                <StaffClinicalSelect
                  tenantId={tenantId}
                  options={clinicalStaffOptions}
                  value={assignedStaffId}
                  onChange={setAssignedStaffId}
                  emptyLabel="—"
                  className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                />
              </label>
            ) : null}

            <label className="block text-sm">
              <span className="font-medium text-slate-200">Notes (optional)</span>
              <textarea
                rows={3}
                className="mt-1 w-full resize-y rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </div>

          <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-white/[0.06] bg-white/[0.03] px-4 py-3 sm:px-5">
            <button
              type="button"
              className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.03] disabled:opacity-50"
              disabled={busy}
              onClick={() => onClose()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              disabled={busy}
            >
              {busy ? "Saving…" : "Create booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
