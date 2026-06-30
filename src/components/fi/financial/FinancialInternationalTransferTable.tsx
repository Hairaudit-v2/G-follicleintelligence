"use client";

import { Fragment, useMemo, useState, useTransition } from "react";

import { createInternationalTransferApplicationAction } from "@/lib/actions/financial-os-international-transfer-actions";
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
import { FinancialInternationalTransferProofs } from "@/src/components/fi/financial/FinancialInternationalTransferProofs";
import { FinancialInternationalTransferSettlementPanel } from "@/src/components/fi/financial/FinancialInternationalTransferSettlementPanel";
import { FinancialInternationalTransferStatusBadge } from "@/src/components/fi/financial/FinancialInternationalTransferStatusBadge";
import type { InternationalTransferApplicationRecord } from "@/src/lib/financialOs/financialInternationalTransfer.server";
import type { FinancialPaymentPathwayRecord } from "@/src/lib/financialOs/financialPaymentPathways.server";

const TRANSFER_METHODS = ["bank_transfer", "wise", "swift", "paypal", "other"] as const;

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  ...[
    "instructions_required",
    "instructions_sent",
    "awaiting_transfer",
    "proof_received",
    "under_reconciliation",
    "settlement_pending",
    "partially_settled",
    "settled",
    "variance_review",
    "rejected",
    "cancelled",
  ].map((value) => ({ value, label: value.replace(/_/g, " ") })),
] as const;

function fmtMoney(cents: number | null, currency = "AUD"): string {
  if (cents == null) return "—";
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function FinancialInternationalTransferTable(props: {
  tenantId: string;
  rows: InternationalTransferApplicationRecord[];
  pathways: FinancialPaymentPathwayRecord[];
  canMutate: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pathwayId, setPathwayId] = useState("");
  const [transferMethod, setTransferMethod] =
    useState<(typeof TRANSFER_METHODS)[number]>("bank_transfer");
  const [sourceCountry, setSourceCountry] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState("");
  const [expectedCents, setExpectedCents] = useState("");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  const internationalPathways = useMemo(
    () => props.pathways.filter((p) => p.pathway_type === "international_transfer"),
    [props.pathways]
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return props.rows;
    return props.rows.filter((r) => r.transfer_status === statusFilter);
  }, [props.rows, statusFilter]);

  function createApplication(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!pathwayId) {
      setFeedback({
        message: "Select an international_transfer payment pathway.",
        tone: "warning",
      });
      return;
    }
    const cents = expectedCents.trim() ? Number(expectedCents) : null;
    start(async () => {
      const pathway = internationalPathways.find((p) => p.id === pathwayId);
      const res = await createInternationalTransferApplicationAction(props.tenantId, {
        payment_pathway_id: pathwayId,
        patient_id: pathway?.patient_id ?? null,
        case_id: pathway?.case_id ?? null,
        booking_id: pathway?.booking_id ?? null,
        transfer_method: transferMethod,
        source_country_code: sourceCountry.trim() || null,
        source_currency_code: sourceCurrency.trim() || null,
        expected_settlement_amount_cents: cents,
      });
      setFeedback(financialOsActionFeedback(res, "International transfer application created."));
    });
  }

  return (
    <div className="space-y-4">
      {props.canMutate ? (
        <FinancialOsFormPanel title="New international transfer application">
          <p className={financialOsClasses.formHint}>
            Linked to an <code className={financialOsClasses.code}>international_transfer</code>{" "}
            payment pathway. Provider-neutral workflow — no live Wise/bank/SWIFT APIs.
          </p>
          <form onSubmit={createApplication}>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={financialOsClasses.formLabel}>
                Payment pathway
                <select
                  value={pathwayId}
                  onChange={(e) => setPathwayId(e.target.value)}
                  className={financialOsClasses.select}
                  required
                >
                  <option value="">Select pathway…</option>
                  {internationalPathways.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id.slice(0, 8)}… · {p.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className={financialOsClasses.formLabel}>
                Transfer method
                <select
                  value={transferMethod}
                  onChange={(e) =>
                    setTransferMethod(e.target.value as (typeof TRANSFER_METHODS)[number])
                  }
                  className={financialOsClasses.select}
                >
                  {TRANSFER_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className={financialOsClasses.formLabel}>
                Source country
                <input
                  value={sourceCountry}
                  onChange={(e) => setSourceCountry(e.target.value)}
                  className={financialOsClasses.input}
                  placeholder="GB"
                />
              </label>
              <label className={financialOsClasses.formLabel}>
                Source currency
                <input
                  value={sourceCurrency}
                  onChange={(e) => setSourceCurrency(e.target.value)}
                  className={financialOsClasses.input}
                  placeholder="GBP"
                />
              </label>
              <label className={financialOsClasses.formLabel}>
                Expected settlement (cents)
                <input
                  value={expectedCents}
                  onChange={(e) => setExpectedCents(e.target.value)}
                  className={financialOsClasses.input}
                  inputMode="numeric"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={pending}
              className={`mt-3 ${financialOsClasses.primaryButton}`}
            >
              {pending ? "Creating…" : "Create application"}
            </button>
            {feedback ? (
              <FinancialOsFeedbackText
                message={feedback.message}
                tone={feedback.tone}
                className="mt-2"
              />
            ) : null}
          </form>
        </FinancialOsFormPanel>
      ) : null}

      <FinancialOsPillFilterBar
        label="Filter status"
        value={statusFilter}
        options={STATUS_FILTER_OPTIONS}
        onChange={setStatusFilter}
        ariaLabel="International transfer status filter"
      />

      <FinancialOsTable
        isEmpty={filtered.length === 0}
        emptyMessage={financialOsFilteredEmptyMessage(
          props.rows.length > 0,
          "No international transfer applications yet.",
          "No international transfer applications match this status filter."
        )}
        emptyHint={
          props.rows.length > 0 && filtered.length === 0
            ? "Try clearing the status filter to see all applications."
            : undefined
        }
        head={
          <>
            <FinancialOsTh>Method</FinancialOsTh>
            <FinancialOsTh>Route</FinancialOsTh>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Expected</FinancialOsTh>
            <FinancialOsTh>Received</FinancialOsTh>
            <FinancialOsTh>Settlement date</FinancialOsTh>
            <FinancialOsTh>Updated</FinancialOsTh>
            <FinancialOsTh />
          </>
        }
      >
        {filtered.map((row) => (
          <Fragment key={row.id}>
            <tr className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellStrong}>
                {row.transfer_method.replace(/_/g, " ")}
              </td>
              <td className={financialOsClasses.tableCell}>
                {row.source_country_code ?? "—"} / {row.source_currency_code ?? "—"} →{" "}
                {row.settlement_currency_code}
              </td>
              <td className={financialOsClasses.tableCell}>
                <FinancialInternationalTransferStatusBadge status={row.transfer_status} />
              </td>
              <td className={financialOsClasses.tableCellMono}>
                {fmtMoney(row.expected_settlement_amount_cents, row.settlement_currency_code)}
              </td>
              <td className={financialOsClasses.tableCellMono}>
                {fmtMoney(row.received_amount_cents, row.settlement_currency_code)}
              </td>
              <td className={financialOsClasses.tableCellMono}>
                {row.expected_settlement_date ?? "—"}
              </td>
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
                <td colSpan={8} className={`space-y-3 ${financialOsClasses.tableCell}`}>
                  <FinancialInternationalTransferSettlementPanel
                    tenantId={props.tenantId}
                    application={row}
                    canMutate={props.canMutate}
                  />
                  <FinancialInternationalTransferProofs
                    tenantId={props.tenantId}
                    application={row}
                    canMutate={props.canMutate}
                  />
                </td>
              </tr>
            ) : null}
          </Fragment>
        ))}
      </FinancialOsTable>
    </div>
  );
}
