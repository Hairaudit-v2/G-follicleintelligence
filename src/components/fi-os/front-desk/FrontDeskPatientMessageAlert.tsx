"use client";

/**
 * FI-PATIENT-APP-2F.3 — in-app popup for newly arrived patient messages.
 * Dismiss does NOT mark handled / acknowledged.
 */

import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  buildFrontDeskSafeMessagePreview,
  type FrontDeskPatientMessageQueueItem,
} from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesCore";

export type FrontDeskPatientMessageAlertProps = {
  item: FrontDeskPatientMessageQueueItem;
  onView: () => void;
  onDismiss: () => void;
};

export function FrontDeskPatientMessageAlert({
  item,
  onView,
  onDismiss,
}: FrontDeskPatientMessageAlertProps) {
  const safe = buildFrontDeskSafeMessagePreview({
    category: item.category,
    body: item.preview,
  });

  return (
    <div
      role="alertdialog"
      aria-labelledby="fd-patient-msg-alert-title"
      aria-describedby="fd-patient-msg-alert-body"
      className={cn(
        "pointer-events-auto fixed bottom-4 right-4 z-[110] w-[min(100vw-2rem,22rem)]",
        "rounded-xl border border-[#22C1FF]/30 bg-[#0F1629]/95 p-4 shadow-xl backdrop-blur-sm",
        "animate-in slide-in-from-bottom-2 fade-in"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            id="fd-patient-msg-alert-title"
            className="text-sm font-semibold text-slate-100"
          >
            {safe.toastTitle}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{item.patientDisplayName}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p id="fd-patient-msg-alert-body" className="mt-2 text-sm text-slate-300">
        {item.previewPolicy === "generic_sensitive"
          ? safe.toastBody
          : item.preview ?? safe.toastBody}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onView}
          className="rounded-lg bg-[#22C1FF]/20 px-3 py-1.5 text-xs font-medium text-[#22C1FF] hover:bg-[#22C1FF]/30"
        >
          View message
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
