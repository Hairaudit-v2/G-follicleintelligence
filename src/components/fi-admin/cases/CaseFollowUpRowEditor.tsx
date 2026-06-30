"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCaseFollowUpAction, upsertCaseFollowUpAction } from "@/lib/actions/fi-case-post-op-actions";
import type { CaseImageListItem } from "@/src/lib/cases/caseLoaders";
import type { CaseFollowUpRow } from "@/src/lib/cases/postOpLoaders";
import { followUpCheckpointLabel, followUpStatusLabel } from "@/src/lib/cases/postOpLabels";
import {
  FOLLOW_UP_STATUS_VALUES,
  type FollowUpCheckpointValue,
  type FollowUpStatusValue,
} from "@/src/lib/cases/postOpTypes";

import { caseFormField } from "./caseFormFieldProps";

function todayYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function sortIds(a: string[]): string[] {
  return [...a].sort();
}

export function CaseFollowUpRowEditor({
  tenantId,
  caseId,
  checkpoint,
  row,
  imageOptions,
}: {
  tenantId: string;
  caseId: string;
  checkpoint: FollowUpCheckpointValue;
  row: CaseFollowUpRow | null;
  imageOptions: CaseImageListItem[];
}) {
  const router = useRouter();
  const [scheduledDate, setScheduledDate] = useState(row?.scheduled_date?.slice(0, 10) ?? "");
  const [completedDate, setCompletedDate] = useState(row?.completed_date?.slice(0, 10) ?? "");
  const [followUpStatus, setFollowUpStatus] = useState(row?.follow_up_status ?? "pending");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [linkedIds, setLinkedIds] = useState<string[]>(row?.linked_image_ids ?? []);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setScheduledDate(row?.scheduled_date?.slice(0, 10) ?? "");
    setCompletedDate(row?.completed_date?.slice(0, 10) ?? "");
    setFollowUpStatus(row?.follow_up_status ?? "pending");
    setNotes(row?.notes ?? "");
    setLinkedIds(row?.linked_image_ids ?? []);
  }, [row]);

  const dirty = useMemo(() => {
    if (!row) {
      return (
        !!scheduledDate.trim() ||
        !!completedDate.trim() ||
        followUpStatus !== "pending" ||
        !!notes.trim() ||
        linkedIds.length > 0
      );
    }
    return (
      scheduledDate !== (row.scheduled_date?.slice(0, 10) ?? "") ||
      completedDate !== (row.completed_date?.slice(0, 10) ?? "") ||
      followUpStatus !== row.follow_up_status ||
      notes !== (row.notes ?? "") ||
      JSON.stringify(sortIds(linkedIds)) !== JSON.stringify(sortIds(row.linked_image_ids))
    );
  }, [row, scheduledDate, completedDate, followUpStatus, notes, linkedIds]);

  function toggleImage(id: string) {
    setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const followUpField = (suffix: string) => caseFormField(`follow-up-${checkpoint}-${suffix}`);
  const scheduledDateField = followUpField("scheduled-date");
  const completedDateField = followUpField("completed-date");
  const followUpStatusField = followUpField("status");
  const notesField = followUpField("notes");

  return (
    <div className="rounded border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-100">{followUpCheckpointLabel(checkpoint)}</h3>
        {row ? (
          <p className="text-xs text-gray-500">
            Status: <span className="font-medium text-slate-200">{followUpStatusLabel(row.follow_up_status)}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500">No row yet — save to record this checkpoint.</p>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label htmlFor={scheduledDateField.id} className="block text-xs font-medium text-slate-300">
          Scheduled date
          <input
            {...scheduledDateField}
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={completedDateField.id} className="block text-xs font-medium text-slate-300">
          Completed date
          <input
            {...completedDateField}
            type="date"
            value={completedDate}
            onChange={(e) => setCompletedDate(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label htmlFor={followUpStatusField.id} className="mt-2 block text-xs font-medium text-slate-300">
        Follow-up status
        <select
          {...followUpStatusField}
          value={followUpStatus}
          onChange={(e) => setFollowUpStatus(e.target.value)}
          className="mt-1 block w-full max-w-xs rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        >
          {FOLLOW_UP_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor={notesField.id} className="mt-2 block text-xs font-medium text-slate-300">
        Notes
        <textarea
          {...notesField}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>

      <fieldset className="mt-2">
        <legend className="text-xs font-medium text-slate-300">Linked patient images (by ID)</legend>
        {imageOptions.length === 0 ? (
          <p className="mt-1 text-xs text-gray-500">No patient images on file — upload via patient images first.</p>
        ) : (
          <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto text-xs">
            {imageOptions.map((img) => {
              const linkedImageField = caseFormField(`follow-up-${checkpoint}-linked-${img.id}`);
              return (
              <li key={img.id} className="flex items-start gap-2">
                <input
                  {...linkedImageField}
                  type="checkbox"
                  checked={linkedIds.includes(img.id)}
                  onChange={() => toggleImage(img.id)}
                  className="mt-0.5 rounded border-slate-700"
                />
                <span className="text-slate-200">
                  <span className="font-mono text-[10px] text-gray-500">{img.id.slice(0, 8)}…</span>{" "}
                  {img.image_category}
                  {img.caption ? ` — ${img.caption.slice(0, 60)}${img.caption.length > 60 ? "…" : ""}` : null}
                </span>
              </li>
            );
            })}
          </ul>
        )}
      </fieldset>

      {msg ? <p className="mt-2 text-xs text-slate-300">{msg}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const body =
                row?.id != null
                  ? {
                      id: row.id,
                      scheduled_date: scheduledDate.trim() ? scheduledDate.trim().slice(0, 10) : null,
                      completed_date: completedDate.trim() ? completedDate.trim().slice(0, 10) : null,
                      follow_up_status: followUpStatus as FollowUpStatusValue,
                      notes: notes.trim() ? notes.trim() : null,
                      linked_image_ids: linkedIds,
                    }
                  : {
                      checkpoint,
                      scheduled_date: scheduledDate.trim() ? scheduledDate.trim().slice(0, 10) : null,
                      completed_date: completedDate.trim() ? completedDate.trim().slice(0, 10) : null,
                      follow_up_status: followUpStatus as FollowUpStatusValue,
                      notes: notes.trim() ? notes.trim() : null,
                      linked_image_ids: linkedIds,
                    };
              const res = await upsertCaseFollowUpAction(tenantId, caseId, body);
              if (!res.ok) {
                setMsg(res.error);
                return;
              }
              setMsg("Saved.");
              router.refresh();
            });
          }}
          className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {pending ? "Saving…" : "Save checkpoint"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            const t = todayYmd();
            setCompletedDate(t);
            setFollowUpStatus("completed");
            startTransition(async () => {
              const body =
                row?.id != null
                  ? {
                      id: row.id,
                      scheduled_date: scheduledDate.trim() ? scheduledDate.trim().slice(0, 10) : null,
                      completed_date: t,
                      follow_up_status: "completed" as const,
                      notes: notes.trim() ? notes.trim() : null,
                      linked_image_ids: linkedIds,
                    }
                  : {
                      checkpoint,
                      scheduled_date: scheduledDate.trim() ? scheduledDate.trim().slice(0, 10) : null,
                      completed_date: t,
                      follow_up_status: "completed" as const,
                      notes: notes.trim() ? notes.trim() : null,
                      linked_image_ids: linkedIds,
                    };
              const res = await upsertCaseFollowUpAction(tenantId, caseId, body);
              if (!res.ok) {
                setMsg(res.error);
                return;
              }
              router.refresh();
            });
          }}
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-white/[0.03]"
        >
          {pending ? "Saving…" : "Mark complete (today)"}
        </button>
        {row?.id ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Remove this follow-up row for this checkpoint?")) return;
              setMsg(null);
              startTransition(async () => {
                const res = await deleteCaseFollowUpAction(tenantId, caseId, { id: row.id });
                if (!res.ok) {
                  setMsg(res.error);
                  return;
                }
                router.refresh();
              });
            }}
            className="rounded border border-rose-500/20 bg-[#0F1629]/80 backdrop-blur-md px-2 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/10"
          >
            Remove row
          </button>
        ) : null}
      </div>
    </div>
  );
}
