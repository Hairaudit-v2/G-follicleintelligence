"use client";

import { useCallback, useState, useTransition } from "react";
import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";
import { createImagingProtocolSessionAction } from "@/lib/actions/fi-imaging-actions";
import { PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP } from "@/src/lib/patientImages/patientImagingCaptureRoutes";
import { VIE_PROTOCOL_CATALOG } from "@/src/lib/vie/vieProtocolCatalog";
import { VIE_PROTOCOL_PICKER_GROUPS } from "@/src/lib/vie/vieProtocolTypes";
import type { VieProtocolSlug } from "@/src/lib/vie/vieProtocolTypes";
import type { PatientTrialConsentGateView } from "@/src/lib/patients/patientTrialConsentShared";
import {
  isPatientTrialConsentCaptureAllowed,
  PATIENT_TRIAL_CONSENT_REQUIRED_TOOLTIP,
} from "@/src/lib/patients/patientTrialConsentShared";

import { VieCaptureWizard } from "./VieCaptureWizard";

function protocolSlotSummary(slug: VieProtocolSlug): string {
  const p = VIE_PROTOCOL_CATALOG.find((x) => x.slug === slug);
  if (!p) return "";
  const required = p.slots.filter((s) => s.required).length;
  const addon = p.slots.filter((s) => s.slot_tier === "addon" && s.required).length;
  const optional = p.slots.filter((s) => !s.required).length;
  const parts = [`${required} required`];
  if (addon > 0) parts.push(`${addon} donor add-on${addon === 1 ? "" : "s"}`);
  if (optional > 0) parts.push(`${optional} optional`);
  return parts.join(" · ");
}

export function StartCaptureProtocolButton({
  tenantId,
  patientId,
  canCapture,
  trialConsentGate,
  className,
  label = "Start Capture Protocol",
}: {
  tenantId: string;
  patientId: string;
  canCapture: boolean;
  trialConsentGate?: PatientTrialConsentGateView | null;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "capture">("pick");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    templateSlug: VieProtocolSlug;
  } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setStep("pick");
    setErr(null);
    setActiveSession(null);
  }, []);

  const startProtocol = useCallback(
    (templateSlug: VieProtocolSlug) => {
      setErr(null);
      startTransition(async () => {
        const res = await createImagingProtocolSessionAction(tenantId, patientId, { templateSlug });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        setActiveSession({ sessionId: res.sessionId, templateSlug });
        setStep("capture");
      });
    },
    [patientId, tenantId]
  );

  const buttonLabel = (
    <>
      <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </>
  );

  const consentAllowed = isPatientTrialConsentCaptureAllowed(trialConsentGate);

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

  if (!consentAllowed) {
    return (
      <span
        title={PATIENT_TRIAL_CONSENT_REQUIRED_TOOLTIP}
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
          setStep("pick");
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
          aria-labelledby="vie-capture-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-xl">
            {step === "pick" ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2
                      id="vie-capture-dialog-title"
                      className="text-base font-semibold text-slate-100"
                    >
                      Start capture protocol
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      All clinical photography is protocol-driven. Select the visit type to begin
                      guided capture with visual framing guides and instant quality checks.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="text-sm text-gray-500 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 space-y-5">
                  {VIE_PROTOCOL_PICKER_GROUPS.map((group) => {
                    const protocols = VIE_PROTOCOL_CATALOG.filter(
                      (p) => p.picker_category === group.category
                    );
                    if (protocols.length === 0) return null;
                    return (
                      <section key={group.category}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
                          {group.label}
                        </h3>
                        <p className="mt-0.5 text-[0.65rem] text-gray-500">{group.hint}</p>
                        <ul className="mt-2 space-y-2">
                          {protocols.map((p) => (
                            <li key={p.slug}>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => startProtocol(p.slug)}
                                className="w-full rounded-lg border border-white/[0.08] px-3 py-2.5 text-left hover:border-cyan-400 hover:bg-cyan-50/50 disabled:opacity-50"
                              >
                                <span className="block text-sm font-semibold text-slate-100">
                                  {p.name}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-400">
                                  {protocolSlotSummary(p.slug)} · {p.description}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>

                {pending ? <p className="mt-3 text-sm text-slate-400">Starting protocol…</p> : null}
                {err ? (
                  <p className="mt-3 text-sm text-rose-300" role="alert">
                    {err}
                  </p>
                ) : null}
              </>
            ) : activeSession ? (
              <VieCaptureWizard
                tenantId={tenantId}
                patientId={patientId}
                sessionId={activeSession.sessionId}
                templateSlug={activeSession.templateSlug}
                onClose={close}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
