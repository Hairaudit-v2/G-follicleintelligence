"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCaseProfileAction } from "@/lib/actions/fi-case-actions";
import { CASE_DETAIL_SECTION_IDS, caseDetailSectionHeadingId } from "@/src/lib/cases/caseDetailNavConstants";

export function CasePlanningNotesPanel({
  tenantId,
  caseId,
  initialPlanningNotes,
  updatedAt,
}: {
  tenantId: string;
  caseId: string;
  initialPlanningNotes: string | null;
  updatedAt: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialPlanningNotes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNotes(initialPlanningNotes ?? "");
  }, [initialPlanningNotes, updatedAt]);

  const dirty = useMemo(() => notes !== (initialPlanningNotes ?? ""), [notes, initialPlanningNotes]);

  return (
    <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.notes)} className="text-sm font-semibold text-gray-900">
        Planning notes
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        High-level coordination and clinical intent — not graft counts or surgical audit scoring (Stage 5B+).
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={8}
        className="mt-3 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        placeholder="Consult goals, timeline, contraindications to review, etc."
      />
      {msg ? <p className="mt-2 text-xs text-gray-700">{msg}</p> : null}
      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await updateCaseProfileAction(tenantId, caseId, {
              planning_notes: notes.trim() ? notes.trim() : null,
            });
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            setMsg("Saved.");
            router.refresh();
          });
        }}
        className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {pending ? "Saving…" : "Save planning notes"}
      </button>
    </div>
  );
}
