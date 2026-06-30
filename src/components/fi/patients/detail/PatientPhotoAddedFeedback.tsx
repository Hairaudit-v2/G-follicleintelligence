"use client";

import { CheckCircle2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  PATIENT_PHOTO_ADDED_SEARCH_PARAM,
  PATIENT_PHOTO_ADDED_TOAST_MESSAGE,
  parsePatientPhotoAddedFeedback,
} from "@/src/lib/patientImages/patientImagingCaptureRoutes";

/** Shows a success toast and refreshes server data after ImagingOS quick capture returns to the profile. */
export function PatientPhotoAddedFeedback() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (handledRef.current) return;
    if (!parsePatientPhotoAddedFeedback(searchParams.get(PATIENT_PHOTO_ADDED_SEARCH_PARAM))) return;

    handledRef.current = true;
    setVisible(true);
    router.refresh();

    const params = new URLSearchParams(searchParams.toString());
    params.delete(PATIENT_PHOTO_ADDED_SEARCH_PARAM);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });

    const dismissTimer = window.setTimeout(() => setVisible(false), 4500);
    return () => window.clearTimeout(dismissTimer);
  }, [pathname, router, searchParams]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed right-4 z-[100] flex w-[min(100vw-2rem,20rem)] items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-emerald-200 shadow-lg backdrop-blur-sm",
        "bottom-20 md:bottom-4"
      )}
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{PATIENT_PHOTO_ADDED_TOAST_MESSAGE}</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="rounded-md p-0.5 opacity-70 transition hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
