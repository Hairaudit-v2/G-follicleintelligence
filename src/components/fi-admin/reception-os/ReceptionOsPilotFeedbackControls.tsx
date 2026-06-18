"use client";

import { useState, useTransition } from "react";
import { Check, MessageSquareWarning, ThumbsDown, ThumbsUp } from "lucide-react";

import { submitReceptionPilotFeedbackAction } from "@/lib/actions/fi-reception-pilot-actions";
import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  RECEPTION_PILOT_FEEDBACK_KINDS,
  RECEPTION_PILOT_FEEDBACK_LABELS,
  type ReceptionPilotFeedbackKind,
} from "@/src/lib/receptionOs/receptionPilotFeedbackModel";
import type { ReceptionOsOperatingMode } from "@/src/lib/receptionOs/receptionOperatingMode";

type ReceptionOsPilotFeedbackControlsProps = {
  tenantId: string;
  operatingMode: ReceptionOsOperatingMode;
  widgetKey?: string | null;
  taskId?: string | null;
  alertKind?: string | null;
  sourceRefId?: string | null;
  compact?: boolean;
};

const FEEDBACK_ICONS: Record<ReceptionPilotFeedbackKind, typeof ThumbsUp> = {
  useful: ThumbsUp,
  missing_information: MessageSquareWarning,
  wrong_alert: ThumbsDown,
  workflow_friction: MessageSquareWarning,
};

export function ReceptionOsPilotFeedbackControls({
  tenantId,
  operatingMode,
  widgetKey,
  taskId,
  alertKind,
  sourceRefId,
  compact = false,
}: ReceptionOsPilotFeedbackControlsProps) {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState<ReceptionPilotFeedbackKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (feedbackKind: ReceptionPilotFeedbackKind) => {
    setError(null);
    startTransition(async () => {
      const result = await submitReceptionPilotFeedbackAction(tenantId, {
        feedbackKind,
        context: {
          operatingMode,
          widgetKey: widgetKey ?? null,
          taskId: taskId ?? null,
          alertKind: alertKind ?? null,
          sourceRefId: sourceRefId ?? null,
        },
      });
      if (result.ok) {
        setSubmitted(feedbackKind);
      } else {
        setError(result.error);
      }
    });
  };

  if (submitted) {
    return (
      <p className={cn("flex items-center gap-1.5 text-xs text-emerald-400/90", compact ? "mt-2" : "mt-3")}>
        <Check className="h-3.5 w-3.5" aria-hidden />
        Thanks — {RECEPTION_PILOT_FEEDBACK_LABELS[submitted].replace("?", "")} recorded.
      </p>
    );
  }

  return (
    <div className={cn(compact ? "mt-2" : "mt-3 border-t border-white/[0.06] pt-3")}>
      {!compact ? (
        <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Pilot feedback</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {RECEPTION_PILOT_FEEDBACK_KINDS.map((kind) => {
          const Icon = FEEDBACK_ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              disabled={pending}
              onClick={() => submit(kind)}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-300 disabled:opacity-50",
              )}
            >
              <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              {RECEPTION_PILOT_FEEDBACK_LABELS[kind]}
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-1 text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
