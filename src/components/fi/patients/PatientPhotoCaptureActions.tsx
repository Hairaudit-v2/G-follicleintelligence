"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Camera, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { VoiceNoteEntryButton } from "@/src/components/fi/clinical-notes/VoiceNoteEntryButton";
import {
  buildPatientImagingCaptureHref,
  PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP,
  type PatientPhotoQuickActionSource,
} from "@/src/lib/patientImages/patientImagingCaptureRoutes";

type Props = {
  tenantId: string;
  patientId: string;
  canCapture: boolean;
  source: PatientPhotoQuickActionSource;
  /** Header row beside patient name (desktop + mobile). */
  variant?: "header" | "mobile-bar";
  className?: string;
  onNavigate?: () => void;
};

function CaptureLink({
  href,
  enabled,
  label,
  icon,
  className,
  onNavigate,
}: {
  href: string;
  enabled: boolean;
  label: string;
  icon: ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  if (enabled) {
    return (
      <Link href={href} className={className} onClick={onNavigate}>
        {icon}
        {label}
      </Link>
    );
  }

  return (
    <span
      title={PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP}
      aria-disabled="true"
      className={cn(className, "cursor-not-allowed opacity-50")}
    >
      {icon}
      {label}
    </span>
  );
}

export function PatientPhotoCaptureActions({
  tenantId,
  patientId,
  canCapture,
  source,
  variant = "header",
  className,
  onNavigate,
}: Props) {
  const takePhotoHref = buildPatientImagingCaptureHref(tenantId, patientId, "camera", source);
  const uploadPhotoHref = buildPatientImagingCaptureHref(tenantId, patientId, "library", source);

  if (variant === "mobile-bar") {
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-3 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm md:hidden",
          className
        )}
        role="toolbar"
        aria-label="Patient quick actions"
      >
        <div className="mx-auto flex max-w-6xl items-stretch gap-2">
          <CaptureLink
            href={takePhotoHref}
            enabled={canCapture}
            label="Take Photo"
            icon={<Camera className="h-4 w-4 shrink-0" aria-hidden />}
            onNavigate={onNavigate}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white"
          />
          <CaptureLink
            href={uploadPhotoHref}
            enabled={canCapture}
            label="Upload Photo"
            icon={<Upload className="h-4 w-4 shrink-0" aria-hidden />}
            onNavigate={onNavigate}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-900"
          />
          <div className="flex min-h-[44px] flex-1 items-center justify-center [&_button]:min-h-[44px] [&_button]:w-full [&_button]:justify-center">
            <VoiceNoteEntryButton
              tenantId={tenantId}
              patientId={patientId}
              label="Add Note"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 text-xs font-semibold text-violet-950 hover:bg-violet-100"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Patient photo capture">
      <CaptureLink
        href={takePhotoHref}
        enabled={canCapture}
        label="Take Photo"
        icon={<Camera className="h-4 w-4 shrink-0" aria-hidden />}
        onNavigate={onNavigate}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
      />
      <CaptureLink
        href={uploadPhotoHref}
        enabled={canCapture}
        label="Upload Photo"
        icon={<Upload className="h-4 w-4 shrink-0" aria-hidden />}
        onNavigate={onNavigate}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
      />
    </div>
  );
}
