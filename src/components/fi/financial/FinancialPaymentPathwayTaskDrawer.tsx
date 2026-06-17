"use client";

import { useState, useTransition } from "react";

import { addPaymentPathwayTaskNoteAction } from "@/lib/actions/financial-os-payment-pathway-inbox-actions";
import { pathwayTypeLabel } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";
import { FinancialPaymentPathwayTaskBadge, pathwayTaskTypeLabel } from "@/src/components/fi/financial/FinancialPaymentPathwayTaskBadge";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { PaymentPathwayInboxRow } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";

export function FinancialPaymentPathwayTaskDrawer(props: {
  tenantId: string;
  row: PaymentPathwayInboxRow;
  users: CrmShellUserPickerOption[];
  canMutate: boolean;
  onClose: () => void;
  onStatus: (taskId: string, status: string) => void;
  onAssign: (taskId: string, assignedTo: string | null) => void;
}) {
  const { tenantId, row, users, canMutate, onClose, onStatus, onAssign } = props;
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onAddNote() {
    if (!note.trim()) return;
    setMsg(null);
    start(async () => {
      const res = await addPaymentPathwayTaskNoteAction(tenantId, { task_id: row.id, notes: note.trim() });
      setMsg(res.ok ? "Note saved." : res.error);
      if (res.ok) setNote("");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Pathway task</h3>
          <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={onClose}>Close</button>
        </div>
        <div className="space-y-4 p-4 text-sm text-slate-700">
          <div>
            <FinancialPaymentPathwayTaskBadge status={row.status} priority={row.priority} variant="light" />
          </div>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-slate-500">Task type</dt>
              <dd>{pathwayTaskTypeLabel(row.task_type)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Pathway</dt>
              <dd>{pathwayTypeLabel(row.pathway_type)} ({row.pathway_status})</dd>
            </div>
            <div>
              <dt className="text-slate-500">Patient</dt>
              <dd>{row.patient_label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Case</dt>
              <dd>{row.case_label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Due date</dt>
              <dd className="font-mono">{row.due_date ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Notes</dt>
              <dd className="whitespace-pre-wrap">{row.notes ?? "—"}</dd>
            </div>
          </dl>

          {canMutate ? (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-500">Assign to</span>
                <select
                  className="rounded border border-slate-200 px-2 py-1.5"
                  value={row.assigned_to ?? ""}
                  onChange={(e) => onAssign(row.id, e.target.value ? e.target.value : null)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.email ?? u.id}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => onStatus(row.id, "in_progress")}>Mark in progress</button>
                <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => onStatus(row.id, "waiting_patient")}>Waiting patient</button>
                <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => onStatus(row.id, "waiting_provider")}>Waiting provider</button>
                <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => onStatus(row.id, "completed")}>Complete</button>
                <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => onStatus(row.id, "cancelled")}>Cancel</button>
              </div>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-500">Add note</span>
                <textarea className="rounded border border-slate-200 px-2 py-1.5" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                <button type="button" className="mt-1 rounded bg-slate-900 px-2 py-1 text-white disabled:opacity-50" disabled={pending || !note.trim()} onClick={onAddNote}>
                  Save note
                </button>
              </label>
              {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
