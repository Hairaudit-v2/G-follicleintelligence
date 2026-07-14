"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Camera, CheckCircle2, Circle } from "lucide-react";
import { useRouter } from "next/navigation";

import { ensureTreatmentImagingSessionAction } from "@/lib/actions/fi-imaging-actions";
import type { TreatmentImagingChecklistPayload } from "@/src/lib/imaging-os/treatmentImagingSession.server";
import { TREATMENT_IMAGING_CAPTURE_SOURCE } from "@/src/lib/imaging-os/treatmentImagingProtocol";
import type { VieProtocolSlug } from "@/src/lib/vie/vieProtocolTypes";
import { VieCaptureWizard } from "@/src/components/fi/vie/VieCaptureWizard";
import { appointmentCardClass } from "@/src/components/fi/appointments/shared/appointmentSharedStyles";

export function TreatmentPhotosChecklist({
  tenantId,
  patientId,
  bookingId,
  checklist,
  canCapture,
  className,
}: {
  tenantId: string;
  patientId: string | null;
  bookingId: string;
  checklist: TreatmentImagingChecklistPayload;
  canCapture: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(checklist.sessionId);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [localChecklist, setLocalChecklist] = useState(checklist);

  useEffect(() => {
    setLocalChecklist(checklist);
    setSessionId(checklist.sessionId);
  }, [checklist]);

  const startCapture = useCallback(() => {
    if (!patientId) {
      setErr("Link a patient to capture treatment photos.");
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await ensureTreatmentImagingSessionAction(tenantId, patientId, { bookingId });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setSessionId(res.sessionId);
      setLocalChecklist(res.checklist);
      setWizardOpen(true);
    });
  }, [bookingId, patientId, tenantId]);

  if (!localChecklist.applies) return null;

  const { completion, completionPolicy, treatmentType } = localChecklist;
  const pct = completion.percent;

  return (
    <section className={className ?? appointmentCardClass} data-testid="treatment-photos-checklist">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Treatment Photos</h2>
          <p className="mt-1 text-xs text-slate-400">
            Standard scalp imaging for this {treatmentType.replace(/_/g, " ")} session — five
            required views plus one optional clinical image.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <span>
            {completion.requiredComplete}/{completion.requiredTotal} required
          </span>
          <div className="mt-1 font-medium text-slate-200">{pct}% complete</div>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-cyan-500/80 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {completion.slots.map((slot) => (
          <li
            key={slot.slug}
            className="flex items-center gap-2 rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm"
            data-testid={`treatment-photo-slot-${slot.slug}`}
            data-complete={slot.complete ? "true" : "false"}
          >
            {slot.complete ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            )}
            <span className={slot.complete ? "text-slate-200" : "text-slate-300"}>
              {slot.label}
            </span>
            <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-slate-500">
              {slot.required ? "Required" : "Optional"}
            </span>
          </li>
        ))}
      </ul>

      {!patientId ? (
        <p className="mt-3 text-sm text-amber-200">
          Link a patient to enable treatment photo capture.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canCapture || pending}
            onClick={startCapture}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            data-testid="treatment-photos-capture-btn"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden />
            {pending
              ? "Preparing…"
              : completion.complete
                ? "Review / add photos"
                : "Capture treatment photos"}
          </button>
        </div>
      )}

      {completionPolicy.warning ? (
        <p className="mt-3 text-xs text-amber-200" data-testid="treatment-photos-warning">
          {completionPolicy.warning}
        </p>
      ) : null}
      {completionPolicy.blockedMessage && !completion.complete ? (
        <p className="mt-2 text-xs text-rose-200" data-testid="treatment-photos-blocked-hint">
          {completionPolicy.blockedMessage}
        </p>
      ) : null}
      {err ? <p className="mt-2 text-xs text-rose-200">{err}</p> : null}

      {wizardOpen && sessionId && patientId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Treatment photo capture"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/[0.08] bg-[#0F1629]/95 p-4 shadow-xl">
            <VieCaptureWizard
              tenantId={tenantId}
              patientId={patientId}
              sessionId={sessionId}
              templateSlug={localChecklist.protocolSlug as VieProtocolSlug}
              captureSource={TREATMENT_IMAGING_CAPTURE_SOURCE}
              surgeryContext={{
                bookingId,
                caseId: null,
                procedureDayId: null,
              }}
              treatmentContext={{
                bookingId,
                treatmentType: localChecklist.treatmentType,
                imageContext: localChecklist.imageContext,
                protocolSlug: localChecklist.protocolSlug,
              }}
              onClose={() => {
                setWizardOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
