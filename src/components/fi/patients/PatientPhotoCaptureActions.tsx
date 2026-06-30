"use client";

import Link from "next/link";
import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";
import { VoiceNoteEntryButton } from "@/src/components/fi/clinical-notes/VoiceNoteEntryButton";
import { StartCaptureProtocolButton } from "@/src/components/fi/vie/StartCaptureProtocolButton";
import {
  PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP,
  type PatientPhotoQuickActionSource,
} from "@/src/lib/patientImages/patientImagingCaptureRoutes";

type Props = {
  tenantId: string;
  patientId: string;
  canCapture: boolean;
  source: PatientPhotoQuickActionSource;
  variant?: "header" | "mobile-bar";
  className?: string;
  onNavigate?: () => void;
};

export function PatientPhotoCaptureActions({
  tenantId,
  patientId,
  canCapture,
  source: _source,
  variant = "header",
  className,
  onNavigate,
}: Props) {
  const chip =
    "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium";

  if (variant === "mobile-bar") {
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-white/95 px-3 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm md:hidden",
          className
        )}
        role="toolbar"
        aria-label="Patient quick actions"
      >
        <div className="mx-auto flex max-w-6xl items-stretch gap-2">
          {canCapture ? (
            <StartCaptureProtocolButton
              tenantId={tenantId}
              patientId={patientId}
              canCapture
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white"
              label="Start Capture Protocol"
            />
          ) : (
            <span
              title={PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP}
              aria-disabled="true"
              className="inline-flex min-h-[44px] flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-white/[0.08] px-3 text-xs font-semibold text-gray-500 opacity-50"
            >
              <Camera className="h-4 w-4 shrink-0" aria-hidden />
              Start Capture Protocol
            </span>
          )}
          <div className="flex min-h-[44px] flex-1 items-center justify-center [&_button]:min-h-[44px] [&_button]:w-full [&_button]:justify-center">
            <VoiceNoteEntryButton
              tenantId={tenantId}
              patientId={patientId}
              label="Add Note"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-violet-500/10 px-3 text-xs font-semibold text-violet-950 hover:bg-violet-500/15"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Protocol capture">
      <StartCaptureProtocolButton
        tenantId={tenantId}
        patientId={patientId}
        canCapture={canCapture}
        className={`${chip} bg-gray-900 text-sm font-semibold text-white shadow-sm hover:bg-gray-800`}
        label="Start Capture Protocol"
      />
      {onNavigate ? (
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}/imaging`}
          className={`${chip} border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 text-slate-100 hover:bg-white/[0.03]`}
          onClick={onNavigate}
        >
          ImagingOS
        </Link>
      ) : null}
    </div>
  );
}
