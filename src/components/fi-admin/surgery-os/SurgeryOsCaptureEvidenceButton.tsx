"use client";

import { useCallback, useState, useTransition } from "react";
import { Camera } from "lucide-react";

import { loadOrCreateSurgeryDayVieSessionAction } from "@/lib/actions/fi-imaging-actions";
import { cn } from "@/lib/utils";
import { VieCaptureWizard } from "@/src/components/fi/vie/VieCaptureWizard";
import type { SurgeryOsVieCaptureSummary } from "@/src/lib/surgeryOs/surgeryOsVieCapture.types";

export function SurgeryOsCaptureEvidenceButton({
  tenantId,
  capture,
  className,
  onClosed,
}: {
  tenantId: string;
  capture: SurgeryOsVieCaptureSummary;
  className?: string;
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [session, setSession] = useState<{
    sessionId: string;
    progress: Record<string, unknown>;
  } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setErr(null);
    setSession(null);
    onClosed?.();
  }, [onClosed]);

  const startCapture = useCallback(() => {
    setErr(null);
    startTransition(async () => {
      const res = await loadOrCreateSurgeryDayVieSessionAction(tenantId, capture.patientId, {
        caseId: capture.caseId,
        bookingId: capture.bookingId,
        procedureDayId: capture.procedureDayId,
        surgeryId: capture.surgeryId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setSession({ sessionId: res.sessionId, progress: res.progress });
      setOpen(true);
    });
  }, [
    capture.bookingId,
    capture.caseId,
    capture.patientId,
    capture.procedureDayId,
    capture.surgeryId,
    tenantId,
  ]);

  return (
    <>
      <button
        type="button"
        onClick={startCapture}
        disabled={pending || !capture.patientId}
        className={cn(className, "disabled:opacity-60")}
      >
        <Camera className="mr-1.5 inline h-4 w-4" aria-hidden />
        {pending ? "Starting capture…" : "Capture surgical evidence"}
      </button>
      {err ? (
        <p className="mt-2 text-xs text-rose-400" role="alert">
          {err}
        </p>
      ) : null}

      {open && session ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="surgery-os-vie-capture-title"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#334155] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-2xl">
            <VieCaptureWizard
              tenantId={tenantId}
              patientId={capture.patientId}
              sessionId={session.sessionId}
              templateSlug="surgery_day"
              initialProgress={session.progress}
              captureSource="surgery_os"
              surgeryContext={{
                caseId: capture.caseId,
                bookingId: capture.bookingId,
                procedureDayId: capture.procedureDayId,
              }}
              onClose={close}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
