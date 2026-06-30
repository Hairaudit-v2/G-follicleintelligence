"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archivePatientImageAction } from "@/lib/actions/fi-patient-actions";

export function PatientImageArchiveButton({
  tenantId,
  patientId,
  imageId,
  onDone,
}: {
  tenantId: string;
  patientId: string;
  imageId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="mt-3 rounded border border-amber-400/20 bg-amber-400/10 p-3">
      <p className="text-xs font-medium text-amber-200">Archive image</p>
      <p className="mt-1 text-xs text-amber-200">
        Archived images stay in the record but are hidden from the active grid by default.
      </p>
      <label className="mt-2 block text-xs text-slate-200">
        Reason (optional)
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      {msg ? <p className="mt-2 text-xs text-slate-200">{msg}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await archivePatientImageAction(tenantId, patientId, imageId, {
              archive_reason: reason.trim() ? reason : null,
            });
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            onDone();
            router.refresh();
          });
        }}
        className="mt-2 rounded border border-amber-700 bg-[#0F1629]/80 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/15 disabled:opacity-50"
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
    </div>
  );
}
