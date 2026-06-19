"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  assignArCaseOwnerAction,
  logArCallAction,
  markArReminderSentAction,
  resolveArCaseAction,
  setArCaseNextActionAction,
  writeOffArCaseAction,
} from "@/lib/actions/financial-os-accounts-receivable-actions";
import {
  FinancialOsFeedbackText,
  FinancialOsTable,
  FinancialOsTh,
  financialOsActionFeedback,
  financialOsClasses,
  financialOsFilteredEmptyMessage,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import {
  FI_AR_RECEIVABLE_TYPES,
  FI_AR_RECEIVABLE_TYPE_LABELS,
  FI_AR_RISK_LEVELS,
  FI_AR_RISK_LABELS,
  FI_AR_CASE_STATUSES,
  FI_AR_STATUS_LABELS,
  FI_AR_REMINDER_CHANNELS,
} from "@/src/lib/financialOs/financialAccountsReceivableCore";
import type { AccountsReceivableWorkQueueRow } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

export type ArWorkQueueFilterState = {
  risk: string;
  status: string;
  receivable_type: string;
  assigned_fi_user_id: string;
  clinic_id: string;
};

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function filterArRows(rows: AccountsReceivableWorkQueueRow[], filters: ArWorkQueueFilterState): AccountsReceivableWorkQueueRow[] {
  return rows.filter((row) => {
    if (filters.risk !== "all" && row.risk_level !== filters.risk) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.receivable_type !== "all" && row.receivable_type !== filters.receivable_type) return false;
    if (filters.assigned_fi_user_id === "unassigned" && row.assigned_fi_user_id) return false;
    if (filters.assigned_fi_user_id !== "all" && filters.assigned_fi_user_id !== "unassigned" && row.assigned_fi_user_id !== filters.assigned_fi_user_id) return false;
    if (filters.clinic_id !== "all" && row.clinic_id !== filters.clinic_id) return false;
    return true;
  });
}

function ArWorkQueueFilters(props: {
  filters: ArWorkQueueFilterState;
  users: CrmShellUserPickerOption[];
  clinicOptions: Array<{ value: string; label: string }>;
  onChange: (next: ArWorkQueueFilterState) => void;
}) {
  const { filters, users, clinicOptions, onChange } = props;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className={financialOsClasses.formLabel}>
        Risk
        <select className={financialOsClasses.select} value={filters.risk} onChange={(e) => onChange({ ...filters, risk: e.target.value })}>
          <option value="all">All</option>
          {FI_AR_RISK_LEVELS.map((r) => (
            <option key={r} value={r} className={financialOsClasses.selectOption}>
              {FI_AR_RISK_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Status
        <select className={financialOsClasses.select} value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })}>
          <option value="all">All</option>
          {FI_AR_CASE_STATUSES.map((s) => (
            <option key={s} value={s} className={financialOsClasses.selectOption}>
              {FI_AR_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Type
        <select
          className={financialOsClasses.select}
          value={filters.receivable_type}
          onChange={(e) => onChange({ ...filters, receivable_type: e.target.value })}
        >
          <option value="all">All</option>
          {FI_AR_RECEIVABLE_TYPES.map((t) => (
            <option key={t} value={t} className={financialOsClasses.selectOption}>
              {FI_AR_RECEIVABLE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Owner
        <select
          className={financialOsClasses.select}
          value={filters.assigned_fi_user_id}
          onChange={(e) => onChange({ ...filters, assigned_fi_user_id: e.target.value })}
        >
          <option value="all">All</option>
          <option value="unassigned">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id} className={financialOsClasses.selectOption}>
              {u.email ?? u.id}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Clinic
        <select className={financialOsClasses.select} value={filters.clinic_id} onChange={(e) => onChange({ ...filters, clinic_id: e.target.value })}>
          <option value="all">All</option>
          {clinicOptions.map((c) => (
            <option key={c.value} value={c.value} className={financialOsClasses.selectOption}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ArCaseDrawer(props: {
  tenantId: string;
  row: AccountsReceivableWorkQueueRow | null;
  users: CrmShellUserPickerOption[];
  canMutate: boolean;
  onClose: () => void;
  onFeedback: (f: FinancialOsFeedback | null) => void;
}) {
  const { tenantId, row, users, canMutate, onClose, onFeedback } = props;
  const [pending, start] = useTransition();
  const [nextActionLocal, setNextActionLocal] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [reminderChannel, setReminderChannel] = useState<(typeof FI_AR_REMINDER_CHANNELS)[number]>("email");
  const [draftPreview, setDraftPreview] = useState<string | null>(null);

  if (!row) return null;

  function run(action: () => Promise<{ ok: boolean; error?: string; draft_preview?: string }>, success: string) {
    onFeedback(null);
    start(async () => {
      const res = await action();
      if ("draft_preview" in res && res.draft_preview) setDraftPreview(res.draft_preview);
      onFeedback(financialOsActionFeedback(res as { ok: true } | { ok: false; error: string }, success));
    });
  }

  return (
    <div className={financialOsClasses.drawerOverlay} role="dialog" aria-modal="true">
      <div className={financialOsClasses.drawerPanel}>
        <div className={financialOsClasses.drawerHeader}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">AR case</p>
            <h3 className="text-sm font-semibold text-slate-50">{row.patient_label ?? "Patient"}</h3>
          </div>
          <button type="button" className={financialOsClasses.secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={financialOsClasses.drawerBody}>
          <dl className="grid gap-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Type</dt>
              <dd>{FI_AR_RECEIVABLE_TYPE_LABELS[row.receivable_type]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Outstanding</dt>
              <dd className="font-mono text-slate-100">{fmtMoney(row.outstanding_amount_cents)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Days overdue</dt>
              <dd>{row.days_overdue}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Risk</dt>
              <dd>
                <FinancialOsRecordStatusBadge status={row.risk_level} label={FI_AR_RISK_LABELS[row.risk_level]} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <FinancialOsRecordStatusBadge status={row.status} label={FI_AR_STATUS_LABELS[row.status]} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Next action</dt>
              <dd>{fmtWhen(row.next_action_at)}</dd>
            </div>
            {row.case_id ? (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Case</dt>
                <dd>
                  <Link href={`/fi-admin/${tenantId}/cases/${row.case_id}`} className={financialOsClasses.link}>
                    View case
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>

          {canMutate ? (
            <div className="space-y-4 border-t border-white/[0.06] pt-4">
              <div>
                <label className={financialOsClasses.formLabel}>
                  Assign owner
                  <select
                    className={financialOsClasses.select}
                    value={row.assigned_fi_user_id ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      run(
                        () => assignArCaseOwnerAction(tenantId, { ar_case_id: row.id, assigned_fi_user_id: e.target.value || null }),
                        "Owner updated.",
                      )
                    }
                  >
                    <option value="" className={financialOsClasses.selectOption}>
                      Unassigned
                    </option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id} className={financialOsClasses.selectOption}>
                        {u.email ?? u.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className={financialOsClasses.formLabel}>
                  Set next action (ISO datetime)
                  <input
                    type="datetime-local"
                    className={financialOsClasses.input}
                    value={nextActionLocal}
                    onChange={(e) => setNextActionLocal(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={`${financialOsClasses.primaryButton} mt-2`}
                  disabled={pending || !nextActionLocal}
                  onClick={() =>
                    run(
                      () =>
                        setArCaseNextActionAction(tenantId, {
                          ar_case_id: row.id,
                          next_action_at: new Date(nextActionLocal).toISOString(),
                        }),
                      "Next action scheduled.",
                    )
                  }
                >
                  Save next action
                </button>
              </div>

              <div>
                <label className={financialOsClasses.formLabel}>
                  Log call
                  <textarea className={financialOsClasses.input} rows={2} value={callNotes} onChange={(e) => setCallNotes(e.target.value)} />
                </label>
                <button
                  type="button"
                  className={`${financialOsClasses.primaryButton} mt-2`}
                  disabled={pending}
                  onClick={() =>
                    run(() => logArCallAction(tenantId, { ar_case_id: row.id, notes: callNotes }), "Call logged.")
                  }
                >
                  Log call
                </button>
              </div>

              <div>
                <label className={financialOsClasses.formLabel}>
                  Prepare reminder (draft only)
                  <select
                    className={financialOsClasses.select}
                    value={reminderChannel}
                    onChange={(e) => setReminderChannel(e.target.value as (typeof FI_AR_REMINDER_CHANNELS)[number])}
                  >
                    {FI_AR_REMINDER_CHANNELS.map((c) => (
                      <option key={c} value={c} className={financialOsClasses.selectOption}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={`${financialOsClasses.primaryButton} mt-2`}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => markArReminderSentAction(tenantId, { ar_case_id: row.id, channel: reminderChannel }),
                      "Reminder draft queued — no live message sent.",
                    )
                  }
                >
                  Mark reminder sent (draft)
                </button>
                {draftPreview ? (
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-slate-400">
                    {draftPreview}
                  </pre>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  disabled={pending}
                  onClick={() => run(() => resolveArCaseAction(tenantId, { ar_case_id: row.id }), "Case resolved.")}
                >
                  Mark resolved
                </button>
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => writeOffArCaseAction(tenantId, { ar_case_id: row.id, reason: "Staff write-off" }),
                      "Case written off.",
                    )
                  }
                >
                  Mark written off
                </button>
              </div>
            </div>
          ) : (
            <p className={financialOsClasses.mutedMeta}>You do not have permission to mutate AR cases.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FinancialOsAccountsReceivableWorkQueue(props: {
  tenantId: string;
  rows: AccountsReceivableWorkQueueRow[];
  users: CrmShellUserPickerOption[];
  clinicOptions: Array<{ value: string; label: string }>;
  canMutate: boolean;
}) {
  const { tenantId, rows, users, clinicOptions, canMutate } = props;
  const [filters, setFilters] = useState<ArWorkQueueFilterState>({
    risk: "all",
    status: "all",
    receivable_type: "all",
    assigned_fi_user_id: "all",
    clinic_id: "all",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending] = useTransition();

  const filtered = useMemo(() => filterArRows(rows, filters), [rows, filters]);
  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <ArWorkQueueFilters filters={filters} users={users} clinicOptions={clinicOptions} onChange={setFilters} />
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} className="mt-1" />
      {pending ? <p className={financialOsClasses.mutedMeta}>Saving…</p> : null}

      <FinancialOsTable
        isEmpty={filtered.length === 0}
        emptyMessage={financialOsFilteredEmptyMessage(
          rows.length > 0,
          "No accounts receivable cases yet.",
          "No AR cases match these filters.",
        )}
        head={
          <>
            <FinancialOsTh>Patient</FinancialOsTh>
            <FinancialOsTh>Type</FinancialOsTh>
            <FinancialOsTh>Invoice</FinancialOsTh>
            <FinancialOsTh>Outstanding</FinancialOsTh>
            <FinancialOsTh>Days overdue</FinancialOsTh>
            <FinancialOsTh>Risk</FinancialOsTh>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Next action</FinancialOsTh>
            <FinancialOsTh>Owner</FinancialOsTh>
            <FinancialOsTh>Actions</FinancialOsTh>
          </>
        }
      >
        {filtered.map((row) => (
          <tr key={row.id} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCellStrong}>{row.patient_label ?? "—"}</td>
            <td className={financialOsClasses.tableCell}>{FI_AR_RECEIVABLE_TYPE_LABELS[row.receivable_type]}</td>
            <td className={financialOsClasses.tableCell}>{row.invoice_label ?? "—"}</td>
            <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.outstanding_amount_cents)}</td>
            <td className={financialOsClasses.tableCellMono}>{row.days_overdue > 0 ? row.days_overdue : "—"}</td>
            <td className={financialOsClasses.tableCell}>
              <FinancialOsRecordStatusBadge status={row.risk_level} label={FI_AR_RISK_LABELS[row.risk_level]} />
            </td>
            <td className={financialOsClasses.tableCell}>
              <FinancialOsRecordStatusBadge status={row.status} label={FI_AR_STATUS_LABELS[row.status]} />
            </td>
            <td className={financialOsClasses.tableCell}>{fmtWhen(row.next_action_at)}</td>
            <td className={financialOsClasses.tableCell}>{row.owner_label ?? "Unassigned"}</td>
            <td className={financialOsClasses.tableCell}>
              <button type="button" className={financialOsClasses.textButton} onClick={() => setSelectedId(row.id)}>
                Open
              </button>
            </td>
          </tr>
        ))}
      </FinancialOsTable>

      <ArCaseDrawer
        tenantId={tenantId}
        row={selected}
        users={users}
        canMutate={canMutate}
        onClose={() => setSelectedId(null)}
        onFeedback={setFeedback}
      />
    </div>
  );
}
