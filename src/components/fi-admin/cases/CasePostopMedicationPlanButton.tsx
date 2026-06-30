"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createCasePostopMedicationPlanAction } from "@/lib/actions/fi-case-postop-medication-plan-actions";

export function CasePostopMedicationPlanButton({
  tenantId,
  caseId,
  foundationPatientId,
  anchorHint,
}: {
  tenantId: string;
  caseId: string;
  /** Foundation patient (`fi_patients.id`) required for MedicationOS plan + case linkage. */
  foundationPatientId: string | null;
  /** Short human hint for which date will anchor offsets (procedure day vs booking). */
  anchorHint: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "info" | "err">("info");

  const disabled = pending || !foundationPatientId?.trim();

  return (
    <div className="mt-4 rounded border border-dashed border-white/[0.08] bg-white/[0.03] p-3">
      <p className="text-xs font-medium text-slate-200">Post-operative medication (MedicationOS)</p>
      <p className="mt-1 text-xs text-slate-400">
        Creates a <strong>draft</strong> therapy plan from the standard post-op bundle. Does not prescribe or send
        pharmacy orders.
        {anchorHint ? (
          <>
            {" "}
            Day offsets anchor to: <span className="font-medium text-slate-200">{anchorHint}</span>.
          </>
        ) : (
          <> A procedure day date or surgery booking is required to anchor the plan.</>
        )}
      </p>
      {!foundationPatientId ? (
        <p className="mt-2 text-xs text-amber-300">Link a foundation patient on this case to enable this action.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const res = await createCasePostopMedicationPlanAction(tenantId, caseId, {});
              if (!res.ok) {
                setTone("err");
                setMsg(res.error);
                return;
              }
              if (res.outcome === "existing") {
                setTone("info");
                setMsg("Post-op medication plan already exists.");
              } else {
                setTone("ok");
                setMsg("Post-op medication plan created (draft).");
              }
              router.refresh();
            });
          }}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {pending ? "Working…" : "Create post-op medication plan"}
        </button>
      </div>
      {msg ? (
        <p
          className={
            tone === "err"
              ? "mt-2 text-xs text-rose-300"
              : tone === "ok"
                ? "mt-2 text-xs text-emerald-300"
                : "mt-2 text-xs text-slate-300"
          }
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
