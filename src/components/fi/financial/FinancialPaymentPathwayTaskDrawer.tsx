"use client";

import { useState, useTransition } from "react";

import { addPaymentPathwayTaskNoteAction } from "@/lib/actions/financial-os-payment-pathway-inbox-actions";
import {
  financialOsClasses,
  FinancialOsFeedbackText,
  financialOsActionFeedback,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { pathwayTypeLabel } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";
import {
  FinancialPaymentPathwayTaskBadge,
  pathwayTaskTypeLabel,
} from "@/src/components/fi/financial/FinancialPaymentPathwayTaskBadge";
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
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  function onAddNote() {
    if (!note.trim()) return;
    setFeedback(null);
    start(async () => {
      const res = await addPaymentPathwayTaskNoteAction(tenantId, {
        task_id: row.id,
        notes: note.trim(),
      });
      setFeedback(financialOsActionFeedback(res, "Note saved."));
      if (res.ok) setNote("");
    });
  }

  return (
    <div className={financialOsClasses.drawerOverlay} role="dialog" aria-modal="true">
      <div className={financialOsClasses.drawerPanel}>
        <div className={financialOsClasses.drawerHeader}>
          <h3 className="text-sm font-semibold text-slate-50">Pathway task</h3>
          <button type="button" className={financialOsClasses.textButton} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={financialOsClasses.drawerBody}>
          <div>
            <FinancialPaymentPathwayTaskBadge
              status={row.status}
              priority={row.priority}
              variant="dark"
            />
          </div>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className={financialOsClasses.mutedMeta}>Task type</dt>
              <dd className="text-slate-200">{pathwayTaskTypeLabel(row.task_type)}</dd>
            </div>
            <div>
              <dt className={financialOsClasses.mutedMeta}>Pathway</dt>
              <dd className="text-slate-200">
                {pathwayTypeLabel(row.pathway_type)} ({row.pathway_status})
              </dd>
            </div>
            <div>
              <dt className={financialOsClasses.mutedMeta}>Patient</dt>
              <dd className="text-slate-200">{row.patient_label ?? "—"}</dd>
            </div>
            <div>
              <dt className={financialOsClasses.mutedMeta}>Case</dt>
              <dd className="text-slate-200">{row.case_label ?? "—"}</dd>
            </div>
            <div>
              <dt className={financialOsClasses.mutedMeta}>Due date</dt>
              <dd className="font-mono text-slate-200">{row.due_date ?? "—"}</dd>
            </div>
            <div>
              <dt className={financialOsClasses.mutedMeta}>Notes</dt>
              <dd className="whitespace-pre-wrap text-slate-200">{row.notes ?? "—"}</dd>
            </div>
          </dl>

          {canMutate ? (
            <div className="space-y-3 border-t border-white/[0.06] pt-3">
              <label className={`flex flex-col gap-1 ${financialOsClasses.formLabel}`}>
                Assign to
                <select
                  className={financialOsClasses.inlineSelect}
                  value={row.assigned_to ?? ""}
                  onChange={(e) => onAssign(row.id, e.target.value ? e.target.value : null)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email ?? u.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  onClick={() => onStatus(row.id, "in_progress")}
                >
                  Mark in progress
                </button>
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  onClick={() => onStatus(row.id, "waiting_patient")}
                >
                  Waiting patient
                </button>
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  onClick={() => onStatus(row.id, "waiting_provider")}
                >
                  Waiting provider
                </button>
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  onClick={() => onStatus(row.id, "completed")}
                >
                  Complete
                </button>
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  onClick={() => onStatus(row.id, "cancelled")}
                >
                  Cancel
                </button>
              </div>
              <label className={`flex flex-col gap-1 ${financialOsClasses.formLabel}`}>
                Add note
                <textarea
                  className={`${financialOsClasses.input} resize-y`}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  type="button"
                  className={`mt-1 ${financialOsClasses.primaryButton}`}
                  disabled={pending || !note.trim()}
                  onClick={onAddNote}
                >
                  Save note
                </button>
              </label>
              <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
