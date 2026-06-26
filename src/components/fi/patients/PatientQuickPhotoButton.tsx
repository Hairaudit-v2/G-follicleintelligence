"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Camera, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { recordPatientPhotoQuickActionCompletedAction } from "@/lib/actions/fi-imaging-actions";
import { inferCaptureDeviceType } from "@/src/lib/imagingOs/imagingOsConstants";
import {
  PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP,
  type PatientImagingCaptureIntent,
  type PatientPhotoQuickActionSource,
} from "@/src/lib/patientImages/patientImagingCaptureRoutes";

function readImageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function PatientQuickPhotoButton({
  tenantId,
  patientId,
  canCapture,
  source = "patient_profile",
  className,
  label = "Quick Photo",
}: {
  tenantId: string;
  patientId: string;
  canCapture: boolean;
  source?: PatientPhotoQuickActionSource;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setErr(null);
    if (camRef.current) camRef.current.value = "";
    if (libRef.current) libRef.current.value = "";
  }, []);

  const uploadFile = useCallback(
    (file: File | null, intent: PatientImagingCaptureIntent) => {
      if (!file || !canCapture) return;
      setErr(null);
      startTransition(async () => {
        try {
          const dims = await readImageDimensions(file);
          const fd = new FormData();
          fd.set("file", file);
          fd.set("image_category", "scalp");
          fd.set("imaging_library_axis", "general_clinical");
          fd.set("capture_type", intent === "camera" ? "camera" : "upload");
          fd.set("capture_source", source);
          fd.set("device_type", inferCaptureDeviceType(typeof navigator !== "undefined" ? navigator.userAgent : ""));
          if (dims.width) fd.set("image_width", String(dims.width));
          if (dims.height) fd.set("image_height", String(dims.height));

          const res = await fetch(
            `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/images`,
            { method: "POST", body: fd, credentials: "include" }
          );
          const j = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            attribution?: { quality?: { alert_message?: string | null } };
          };
          if (!res.ok || !j.ok) {
            setErr(j.error ?? `Upload failed (${res.status}).`);
            return;
          }
          const qualityAlert = j.attribution?.quality?.alert_message;
          if (qualityAlert) {
            setErr(qualityAlert);
            return;
          }
          void recordPatientPhotoQuickActionCompletedAction({
            tenantId,
            patientId,
            intent,
            source,
          });
          router.refresh();
          close();
        } catch {
          setErr("Network error while uploading photo.");
        }
      });
    },
    [canCapture, close, patientId, router, source, tenantId]
  );

  const onFileChange = useCallback(
    (intent: PatientImagingCaptureIntent) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file, intent);
    },
    [uploadFile]
  );

  const buttonLabel = (
    <>
      <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </>
  );

  if (!canCapture) {
    return (
      <span
        title={PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP}
        aria-disabled="true"
        className={cn(className, "cursor-not-allowed opacity-50")}
      >
        {buttonLabel}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setErr(null);
        }}
        className={className}
        aria-haspopup="dialog"
      >
        {buttonLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-quick-photo-dialog-title"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="patient-quick-photo-dialog-title" className="text-base font-semibold text-gray-900">
                  Quick photo
                </h2>
                <p className="mt-1 text-xs text-gray-600">
                  Capture or upload a clinical photo for this patient. Images are saved to the patient record and run
                  through the imaging attribution pipeline.
                </p>
              </div>
              <button type="button" onClick={close} className="text-sm text-gray-500 hover:text-gray-800">
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => camRef.current?.click()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                <Camera className="h-4 w-4 shrink-0" aria-hidden />
                Take photo
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => libRef.current?.click()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                <Upload className="h-4 w-4 shrink-0" aria-hidden />
                Upload photo
              </button>
            </div>

            <input
              ref={camRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              capture="environment"
              className="hidden"
              onChange={onFileChange("camera")}
            />
            <input
              ref={libRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="hidden"
              onChange={onFileChange("library")}
            />

            {pending ? <p className="mt-3 text-sm text-gray-600">Uploading…</p> : null}
            {err ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {err}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
