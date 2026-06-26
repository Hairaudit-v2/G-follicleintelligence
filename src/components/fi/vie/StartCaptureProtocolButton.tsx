"use client";

import { useCallback, useState, useTransition } from "react";
import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";
import { createImagingProtocolSessionAction } from "@/lib/actions/fi-imaging-actions";
import { PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP } from "@/src/lib/patientImages/patientImagingCaptureRoutes";
import { VIE_PROTOCOL_CATALOG, type VieProtocolSlug } from "@/src/lib/vie";
import { VieCaptureWizard } from "./VieCaptureWizard";

export function StartCaptureProtocolButton({
  tenantId,
  patientId,
  canCapture,
  className,
  label = "Start Capture Protocol",
}: {
  tenantId: string;
  patientId: string;
  canCapture: boolean;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "capture">("pick");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{ sessionId: string; templateSlug: VieProtocolSlug } | null>(
    null
  );

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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            {step === "pick" ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 id="vie-capture-dialog-title" className="text-base font-semibold text-gray-900">
                      Start capture protocol
                    </h2>
                    <p className="mt-1 text-xs text-gray-600">
                      All clinical photography is protocol-driven. Select the visit type to begin guided capture with
                      visual framing guides and instant quality checks.
                    </p>
                  </div>
                  <button type="button" onClick={close} className="text-sm text-gray-500 hover:text-gray-800">
                    Close
                  </button>
                </div>

                <ul className="mt-4 space-y-2">
                  {VIE_PROTOCOL_CATALOG.map((p) => (
                    <li key={p.slug}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => startProtocol(p.slug)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left hover:border-cyan-400 hover:bg-cyan-50/50 disabled:opacity-50"
                      >
                        <span className="block text-sm font-semibold text-gray-900">{p.name}</span>
                        <span className="mt-0.5 block text-xs text-gray-600">
                          {p.slots.filter((s) => s.required).length} required
                          {p.slots.some((s) => s.slot_tier === "addon") ? " incl. add-ons" : ""}
                          {p.slots.some((s) => !s.required) ? ` · ${p.slots.filter((s) => !s.required).length} optional` : ""}
                          {" · "}
                          {p.description}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {pending ? <p className="mt-3 text-sm text-gray-600">Starting protocol…</p> : null}
                {err ? (
                  <p className="mt-3 text-sm text-red-700" role="alert">
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
