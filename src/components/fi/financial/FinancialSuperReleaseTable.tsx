"use client";

import { Fragment, useMemo, useState, useTransition } from "react";

import { createSuperReleaseApplicationAction } from "@/lib/actions/financial-os-super-release-actions";
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
import { FinancialSuperReleaseClinicalLetterPanel } from "@/src/components/fi/financial/FinancialSuperReleaseClinicalLetterPanel";
import { FinancialSuperReleaseDocuments } from "@/src/components/fi/financial/FinancialSuperReleaseDocuments";
import { FinancialSuperReleaseStatusBadge } from "@/src/components/fi/financial/FinancialSuperReleaseStatusBadge";
import type { SuperReleaseApplicationRecord } from "@/src/lib/financialOs/financialSuperRelease.server";
import type { FinancialPaymentPathwayRecord } from "@/src/lib/financialOs/financialPaymentPathways.server";

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

const SUPER_RELEASE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "eligibility_review", label: "Eligibility review" },
  { value: "documents_pending", label: "Documents pending" },
  { value: "clinical_letter_required", label: "Clinical letter required" },
  { value: "ready_for_submission", label: "Ready for submission" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "release_pending", label: "Release pending" },
  { value: "funds_released", label: "Funds released" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function FinancialSuperReleaseTable(props: {
  tenantId: string;
  rows: SuperReleaseApplicationRecord[];
  pathways: FinancialPaymentPathwayRecord[];
  canMutate: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pathwayId, setPathwayId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [requestedCents, setRequestedCents] = useState("");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  const superReleasePathways = useMemo(
    () => props.pathways.filter((p) => p.pathway_type === "super_release"),
    [props.pathways]
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return props.rows;
    return props.rows.filter((r) => r.application_status === statusFilter);
  }, [props.rows, statusFilter]);

  function createApplication(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!pathwayId) {
      setFeedback({ message: "Select a super_release payment pathway.", tone: "warning" });
      return;
    }
    const cents = requestedCents.trim() ? Number(requestedCents) : null;
    start(async () => {
      const pathway = superReleasePathways.find((p) => p.id === pathwayId);
      const res = await createSuperReleaseApplicationAction(props.tenantId, {
        payment_pathway_id: pathwayId,
        patient_id: pathway?.patient_id ?? null,
        case_id: pathway?.case_id ?? null,
        booking_id: pathway?.booking_id ?? null,
        provider_name: providerName.trim() || null,
        requested_amount_cents: cents,
      });
      setFeedback(financialOsActionFeedback(res, "Super release application created."));
    });
  }

  return (
    <div className="space-y-4">
      {props.canMutate ? (
        <FinancialOsFormPanel title="New super release application">
          <p className={financialOsClasses.formHint}>
            Linked to a <code className={financialOsClasses.code}>super_release</code> payment pathway. Provider-neutral
            workflow — no live API integration.
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
                  {superReleasePathways.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id.slice(0, 8)}… · {p.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className={financialOsClasses.formLabel}>
                Provider name (optional)
                <input
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className={financialOsClasses.input}
                  placeholder="e.g. AustralianSuper"
                />
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
        options={SUPER_RELEASE_STATUS_FILTER_OPTIONS}
        onChange={setStatusFilter}
        ariaLabel="Super release application status filter"
      />

      <FinancialOsTable
        isEmpty={filtered.length === 0}
        emptyMessage={financialOsFilteredEmptyMessage(
          props.rows.length > 0,
          "No super release applications yet.",
          "No super release applications match this status filter.",
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
            <FinancialOsTh>Expected release</FinancialOsTh>
            <FinancialOsTh>Updated</FinancialOsTh>
            <FinancialOsTh />
          </>
        }
      >
        {filtered.map((row) => (
          <Fragment key={row.id}>
            <tr className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellStrong}>{row.provider_name ?? "—"}</td>
              <td className={financialOsClasses.tableCell}>
                <FinancialSuperReleaseStatusBadge status={row.application_status} />
              </td>
              <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.requested_amount_cents)}</td>
              <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.approved_amount_cents)}</td>
              <td className={financialOsClasses.tableCellMono}>{row.expected_release_date ?? "—"}</td>
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
                <td colSpan={7} className={`space-y-3 ${financialOsClasses.tableCell}`}>
                  <FinancialSuperReleaseDocuments tenantId={props.tenantId} application={row} canMutate={props.canMutate} />
                  <FinancialSuperReleaseClinicalLetterPanel tenantId={props.tenantId} application={row} canMutate={props.canMutate} />
                </td>
              </tr>
            ) : null}
          </Fragment>
        ))}
      </FinancialOsTable>
    </div>
  );
}
