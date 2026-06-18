"use client";

import { Fragment, useMemo, useState, useTransition } from "react";

import { createFinanceApplicationAction } from "@/lib/actions/financial-os-finance-actions";
import { FinancialOsPillFilterBar } from "@/src/components/fi-admin/financial-os/FinancialOsPillFilterBar";
import {
  FinancialOsFeedbackText,
  FinancialOsFormPanel,
  FinancialOsTable,
  FinancialOsTh,
  financialOsActionFeedback,
  financialOsFilteredEmptyMessage,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialFinanceApplicationDocuments } from "@/src/components/fi/financial/FinancialFinanceApplicationDocuments";
import { FinancialFinanceApplicationStatusBadge } from "@/src/components/fi/financial/FinancialFinanceApplicationStatusBadge";
import type { FinanceApplicationRecord } from "@/src/lib/financialOs/financialFinanceApplications.server";
import type { FinanceProviderRecord } from "@/src/lib/financialOs/financialFinanceProviders.server";
import type { FinancialPaymentPathwayRecord } from "@/src/lib/financialOs/financialPaymentPathways.server";

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

const FINANCE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "documents_pending", label: "Documents pending" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "settlement_pending", label: "Settlement pending" },
  { value: "settled", label: "Settled" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function FinancialFinanceApplicationTable(props: {
  tenantId: string;
  rows: FinanceApplicationRecord[];
  providers: FinanceProviderRecord[];
  pathways: FinancialPaymentPathwayRecord[];
  canMutate: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pathwayId, setPathwayId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [requestedCents, setRequestedCents] = useState("");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  const medicalFinancePathways = useMemo(
    () => props.pathways.filter((p) => p.pathway_type === "medical_finance"),
    [props.pathways]
  );
  const activeProviders = useMemo(() => props.providers.filter((p) => p.is_active), [props.providers]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return props.rows;
    return props.rows.filter((r) => r.application_status === statusFilter);
  }, [props.rows, statusFilter]);

  function createApplication(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!pathwayId || !providerId) {
      setFeedback({ message: "Select a medical finance pathway and provider.", tone: "warning" });
      return;
    }
    const cents = requestedCents.trim() ? Number(requestedCents) : null;
    start(async () => {
      const pathway = medicalFinancePathways.find((p) => p.id === pathwayId);
      const res = await createFinanceApplicationAction(props.tenantId, {
        payment_pathway_id: pathwayId,
        finance_provider_id: providerId,
        patient_id: pathway?.patient_id ?? null,
        case_id: pathway?.case_id ?? null,
        booking_id: pathway?.booking_id ?? null,
        requested_amount_cents: cents,
      });
      setFeedback(financialOsActionFeedback(res, "Finance application created."));
    });
  }

  return (
    <div className="space-y-4">
      {props.canMutate ? (
        <FinancialOsFormPanel
          title="New finance application"
          description="Linked to a medical_finance payment pathway. No live provider API calls in Phase 3."
        >
          <form onSubmit={createApplication}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={financialOsClasses.formLabel}>
                Payment pathway
                <select
                  value={pathwayId}
                  onChange={(e) => setPathwayId(e.target.value)}
                  className={financialOsClasses.select}
                  required
                >
                  <option value="">Select pathway…</option>
                  {medicalFinancePathways.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id.slice(0, 8)}… · {p.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className={financialOsClasses.formLabel}>
                Finance provider
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className={financialOsClasses.select}
                  required
                >
                  <option value="">Select provider…</option>
                  {activeProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={financialOsClasses.formLabel}>
                Requested amount (cents)
                <input
                  value={requestedCents}
                  onChange={(e) => setRequestedCents(e.target.value)}
                  className={financialOsClasses.input}
                  inputMode="numeric"
                />
              </label>
            </div>
            <button type="submit" disabled={pending} className={`mt-3 ${financialOsClasses.primaryButton}`}>
              {pending ? "Creating…" : "Create application"}
            </button>
            {feedback ? <FinancialOsFeedbackText message={feedback.message} tone={feedback.tone} className="mt-2" /> : null}
          </form>
        </FinancialOsFormPanel>
      ) : null}

      <FinancialOsPillFilterBar
        label="Filter status"
        value={statusFilter}
        options={FINANCE_STATUS_FILTER_OPTIONS}
        onChange={setStatusFilter}
        ariaLabel="Finance application status filter"
      />

      <FinancialOsTable
        isEmpty={filtered.length === 0}
        emptyMessage={financialOsFilteredEmptyMessage(
          props.rows.length > 0,
          "No finance applications yet.",
          "No finance applications match this status filter.",
        )}
        emptyHint={
          props.rows.length > 0 && filtered.length === 0 ? "Try clearing the status filter to see all applications." : undefined
        }
        head={
          <>
            <FinancialOsTh>Provider</FinancialOsTh>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Requested</FinancialOsTh>
            <FinancialOsTh>Approved</FinancialOsTh>
            <FinancialOsTh>Expected settlement</FinancialOsTh>
            <FinancialOsTh>Updated</FinancialOsTh>
            <FinancialOsTh />
          </>
        }
      >
        {filtered.map((row) => (
          <Fragment key={row.id}>
            <tr className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellStrong}>
                {row.provider_name ?? row.finance_provider_id.slice(0, 8)}
              </td>
              <td className={financialOsClasses.tableCell}>
                <FinancialFinanceApplicationStatusBadge status={row.application_status} />
              </td>
              <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.requested_amount_cents)}</td>
              <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.approved_amount_cents)}</td>
              <td className={financialOsClasses.tableCellMono}>{row.expected_settlement_date ?? "—"}</td>
              <td className={financialOsClasses.tableCell}>{row.updated_at.slice(0, 10)}</td>
              <td className={financialOsClasses.tableCell}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  className={financialOsClasses.textButton}
                >
                  {expandedId === row.id ? "Hide" : "Details"}
                </button>
              </td>
            </tr>
            {expandedId === row.id ? (
              <tr>
                <td colSpan={7} className={financialOsClasses.tableCell}>
                  <FinancialFinanceApplicationDocuments tenantId={props.tenantId} application={row} canMutate={props.canMutate} />
                </td>
              </tr>
            ) : null}
          </Fragment>
        ))}
      </FinancialOsTable>
    </div>
  );
}
