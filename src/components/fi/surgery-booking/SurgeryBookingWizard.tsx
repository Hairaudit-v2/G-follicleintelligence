"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  confirmSurgeryBookingAction,
  loadSurgeryBookingWizardContextAction,
  type SurgeryBookingWizardContext,
} from "@/lib/actions/fi-surgery-booking-actions";
import { fromDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import { DEFAULT_CALENDAR_TIMEZONE } from "@/src/lib/calendar/calendarTimezone";
import {
  listSurgeryBookingMissingRequirements,
  SURGERY_BOOKING_WIZARD_STEPS,
} from "@/src/lib/surgeryBooking/surgeryBookingEngineCore";
import type {
  SurgeryBookingConfirmResult,
  SurgeryBookingWizardPrefill,
} from "@/src/lib/surgeryBooking/surgeryBookingTypes";

const fieldClass =
  "mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500";

function addMinutesIso(startLocal: string, minutes: number, tz: string): string {
  const startIso = fromDatetimeLocalValue(startLocal, tz);
  if (!startIso) return "";
  const end = new Date(startIso);
  end.setMinutes(end.getMinutes() + minutes);
  return end.toISOString();
}

export function SurgeryBookingWizard({
  tenantId,
  prefill,
  onClose,
}: {
  tenantId: string;
  prefill: SurgeryBookingWizardPrefill;
  onClose: () => void;
}) {
  const router = useRouter();
  const tid = tenantId.trim();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<SurgeryBookingWizardContext | null>(null);
  const [result, setResult] = useState<SurgeryBookingConfirmResult | null>(null);

  const [clinicId, setClinicId] = useState(prefill.clinicId ?? "");
  const [procedureType, setProcedureType] = useState(
    prefill.procedureType ?? "Hair transplant surgery"
  );
  const [graftEstimate, setGraftEstimate] = useState(prefill.graftEstimate ?? "");
  const [zonesText, setZonesText] = useState(
    prefill.plannedZones?.map((z) => z.label?.trim() || z.key).join(", ") ?? ""
  );
  const [clinicalNotes, setClinicalNotes] = useState(prefill.clinicalNotes ?? "");
  const [surgeonStaffId, setSurgeonStaffId] = useState(prefill.surgeonStaffId ?? "");
  const [startLocal, setStartLocal] = useState("");
  const [roomId, setRoomId] = useState("");
  const [createDepositRequest, setCreateDepositRequest] = useState(true);
  const [confirmBooking, setConfirmBooking] = useState(false);

  const timezone = DEFAULT_CALENDAR_TIMEZONE;

  useEffect(() => {
    let cancelled = false;
    void loadSurgeryBookingWizardContextAction({ tenantId: tid, clinicId: clinicId || undefined }).then(
      (res) => {
        if (cancelled || !res.ok) return;
        setCtx(res.data);
        if (!clinicId && res.data.clinics[0]?.id) setClinicId(res.data.clinics[0].id);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [tid, clinicId]);

  const roomsForClinic = useMemo(
    () => (ctx?.rooms ?? []).filter((r) => !clinicId || r.clinic_id === clinicId),
    [ctx?.rooms, clinicId]
  );

  const stepMissing = useMemo(() => {
    const endAt = startLocal ? addMinutesIso(startLocal, 480, timezone) : "";
    return listSurgeryBookingMissingRequirements(
      {
        patientId: prefill.patientId ?? undefined,
        clinicId: clinicId || undefined,
        procedureType,
        surgeonStaffId: surgeonStaffId || undefined,
        startAt: startLocal
          ? (fromDatetimeLocalValue(startLocal, timezone) ?? undefined)
          : undefined,
        endAt: endAt || undefined,
        roomId: roomId || undefined,
      },
      step as 1 | 2 | 3 | 4
    );
  }, [
    clinicId,
    prefill.patientId,
    procedureType,
    roomId,
    startLocal,
    step,
    surgeonStaffId,
    timezone,
  ]);

  const canAdvance = stepMissing.length === 0;

  const submit = useCallback(async () => {
    if (!prefill.patientId?.trim()) {
      setError("Patient is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const startAt = fromDatetimeLocalValue(startLocal, timezone);
    if (!startAt) {
      setError("Invalid start date/time.");
      setBusy(false);
      return;
    }
    const endAt = addMinutesIso(startLocal, 480, timezone);
    if (!endAt) {
      setError("Could not compute end time.");
      setBusy(false);
      return;
    }
    const plannedZones = zonesText
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((label, idx) => ({ key: `zone_${idx + 1}`, label }));

    const res = await confirmSurgeryBookingAction(tid, {
      patientId: prefill.patientId.trim(),
      personId: prefill.personId ?? null,
      caseId: prefill.caseId ?? null,
      leadId: prefill.leadId ?? null,
      clinicId: clinicId.trim(),
      consultationId: prefill.consultationId ?? null,
      crmQuoteId: prefill.crmQuoteId ?? null,
      procedureType: procedureType.trim(),
      graftEstimate: graftEstimate.trim() || null,
      plannedZones,
      clinicalNotes: clinicalNotes.trim() || null,
      surgeonStaffId: surgeonStaffId.trim(),
      startAt,
      endAt,
      timezone,
      roomId: roomId.trim(),
      bookingStatus: confirmBooking ? "confirmed" : "scheduled",
      createDepositRequest,
      entrySource: prefill.entrySource ?? "wizard",
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.result);
    router.refresh();
  }, [
    clinicId,
    clinicalNotes,
    confirmBooking,
    createDepositRequest,
    graftEstimate,
    prefill,
    procedureType,
    roomId,
    router,
    startLocal,
    surgeonStaffId,
    tid,
    timezone,
    zonesText,
  ]);

  if (result) {
    return (
      <div className="space-y-5 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Success</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Surgery booked</h2>
          <p className="mt-2 text-sm text-slate-400">
            Calendar, surgery plan, readiness checklist, and audit trail were created automatically.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pre-op checklist
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {result.preOpChecklist.map((item) => (
              <li key={item.key} className={item.complete ? "text-emerald-300" : "text-amber-300"}>
                {item.complete ? "✓" : "○"} {item.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.nextActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded bg-cyan-700/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-600"
            >
              {action.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="border-b border-white/10 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
          Surgery booking engine
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">Book surgery</h2>
        <ol className="mt-3 flex flex-wrap gap-2 text-xs">
          {SURGERY_BOOKING_WIZARD_STEPS.map((s) => (
            <li
              key={s.id}
              className={
                step === s.id
                  ? "rounded-full bg-cyan-900/50 px-2 py-0.5 text-cyan-200"
                  : step > s.id
                    ? "rounded-full bg-emerald-900/30 px-2 py-0.5 text-emerald-200"
                    : "rounded-full bg-slate-800/80 px-2 py-0.5 text-slate-400"
              }
            >
              {s.id}. {s.label}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-400">Patient</p>
              <p className="text-sm font-medium text-slate-100">
                {prefill.patientDisplayName?.trim() || "Selected patient"}
              </p>
            </div>
            {prefill.caseLabel ? (
              <div>
                <p className="text-xs text-slate-400">Case</p>
                <p className="text-sm text-slate-200">{prefill.caseLabel}</p>
              </div>
            ) : null}
            <label className="block text-sm text-slate-300">
              Clinic
              <select
                className={fieldClass}
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
              >
                <option value="">Select clinic…</option>
                {(ctx?.clinics ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <label className="block text-sm text-slate-300">
              Procedure type
              <input
                className={fieldClass}
                value={procedureType}
                onChange={(e) => setProcedureType(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Graft estimate
              <input
                className={fieldClass}
                placeholder="e.g. 2800–3200"
                value={graftEstimate}
                onChange={(e) => setGraftEstimate(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Recipient zones (comma-separated)
              <input
                className={fieldClass}
                value={zonesText}
                onChange={(e) => setZonesText(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Clinical notes
              <textarea
                className={`${fieldClass} min-h-[88px]`}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Surgeon
              <select
                className={fieldClass}
                value={surgeonStaffId}
                onChange={(e) => setSurgeonStaffId(e.target.value)}
              >
                <option value="">Select surgeon…</option>
                {(ctx?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} ({s.role})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <label className="block text-sm text-slate-300">
              Start date & time
              <input
                type="datetime-local"
                className={fieldClass}
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </label>
            <p className="text-xs text-slate-500">Default duration: 8 hours (surgery day).</p>
            <label className="block text-sm text-slate-300">
              Procedure room
              <select className={fieldClass} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Select room…</option>
                {roomsForClinic.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={createDepositRequest}
                onChange={(e) => setCreateDepositRequest(e.target.checked)}
              />
              Create deposit invoice when payment rules allow
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={confirmBooking}
                onChange={(e) => setConfirmBooking(e.target.checked)}
              />
              Mark booking as confirmed (deposit clearance still applies within 14 days)
            </label>
            <div className="rounded border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
              Confirming creates the calendar appointment, updates the surgery plan, stores a
              pre-op checklist on the booking, writes CRM/timeline audit entries, and optionally
              raises a deposit invoice.
            </div>
          </div>
        ) : null}

        {stepMissing.length > 0 ? (
          <ul className="mt-4 space-y-1 text-xs text-amber-300">
            {stepMissing.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
        <button
          type="button"
          disabled={step <= 1 || busy}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40"
        >
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            disabled={!canAdvance || busy}
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            className="rounded bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            disabled={!canAdvance || busy}
            onClick={() => void submit()}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Booking…" : "Confirm surgery booking"}
          </button>
        )}
      </div>
    </div>
  );
}