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
    <div className="mt-3 rounded border border-amber-200 bg-amber-50/80 p-3">
      <p className="text-xs font-medium text-amber-950">Archive image</p>
      <p className="mt-1 text-xs text-amber-900">Archived images stay in the record but are hidden from the active grid by default.</p>
      <label className="mt-2 block text-xs text-gray-800">
        Reason (optional)
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      {msg ? <p className="mt-2 text-xs text-gray-800">{msg}</p> : null}
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
        className="mt-2 rounded border border-amber-700 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
    </div>
  );
}
