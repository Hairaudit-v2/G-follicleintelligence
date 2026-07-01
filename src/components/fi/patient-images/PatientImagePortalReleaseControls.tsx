"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setPatientImagePortalReleaseAction } from "@/lib/actions/fi-patient-actions";
import type { PatientPortalReleaseStatus } from "@/src/lib/patientImages/patientImageTypes";

export function PatientImagePortalReleaseControls({
  tenantId,
  patientId,
  imageId,
  releaseStatus,
}: {
  tenantId: string;
  patientId: string;
  imageId: string;
  releaseStatus: PatientPortalReleaseStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const isReleased = releaseStatus === "released";

  function mutate(next: PatientPortalReleaseStatus) {
    setMsg(null);
    startTransition(async () => {
      const res = await setPatientImagePortalReleaseAction(tenantId, patientId, imageId, {
        release_status: next,
      });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg(next === "released" ? "Released to patient portal." : "Held from patient portal.");
      router.refresh();
    });
  }

  return (
    <div className="rounded border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Patient portal visibility
      </p>
      <p className="mt-1 text-xs text-slate-300">
        Status:{" "}
        <span className={isReleased ? "text-emerald-300" : "text-amber-300"}>
          {isReleased ? "Released" : "Held"}
        </span>
        . Held images never appear in the patient imaging portal until a clinician releases them.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!isReleased ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => mutate("released")}
            className="rounded bg-emerald-700/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Release to portal
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => mutate("held")}
            className="rounded border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-900/50 disabled:opacity-50"
          >
            Revoke portal access
          </button>
        )}
      </div>
      {msg ? <p className="mt-2 text-xs text-slate-400">{msg}</p> : null}
    </div>
  );
}