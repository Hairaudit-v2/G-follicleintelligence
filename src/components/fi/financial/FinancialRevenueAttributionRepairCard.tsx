"use client";

import { useState, useTransition } from "react";

import {
  saveRevenueAttributionOverrideAction,
  recalculateRevenueAttributionAction,
} from "@/lib/actions/financial-os-revenue-attribution-actions";
import {
  FinancialOsFeedbackText,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FI_REVENUE_ATTRIBUTION_SOURCES } from "@/src/lib/financialOs/financialRevenueAttributionCore";
import type { FiRevenueAttributionManualOverrideRow } from "@/src/lib/financialOs/financialRevenueAttributionCore";

export function FinancialRevenueAttributionRepairCard(props: {
  tenantId: string;
  caseId: string;
  override: FiRevenueAttributionManualOverrideRow | null;
  consultantOptions: Array<{ value: string; label: string }>;
  canMutate?: boolean;
  variant?: "light" | "dark";
  className?: string;
}) {
  const { override, consultantOptions, canMutate = false, variant = "light", className } = props;
  const [source, setSource] = useState(override?.attribution_source ?? "");
  const [campaignName, setCampaignName] = useState(override?.campaign_name ?? "");
  const [campaignId, setCampaignId] = useState(override?.campaign_id ?? "");
  const [consultantId, setConsultantId] = useState(override?.consultant_fi_user_id ?? "");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, startTransition] = useTransition();

  const panelCls =
    variant === "dark"
      ? "rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
      : "rounded-lg border border-white/[0.08] bg-white/[0.03] p-3";

  function runSave() {
    if (!canMutate) return;
    startTransition(async () => {
      setFeedback(null);
      const result = await saveRevenueAttributionOverrideAction(props.tenantId, {
        case_id: props.caseId,
        attribution_source: source || null,
        campaign_name: campaignName || null,
        campaign_id: campaignId || null,
        consultant_fi_user_id: consultantId || null,
      });
      if (result.ok) {
        setFeedback({
          tone: "success",
          message: "Attribution override saved. Recalculate to append a correction event.",
        });
      } else {
        setFeedback({ tone: "error", message: result.error });
      }
    });
  }

  function runRecalc() {
    if (!canMutate) return;
    startTransition(async () => {
      setFeedback(null);
      const result = await recalculateRevenueAttributionAction(props.tenantId, {
        case_id: props.caseId,
      });
      if (result.ok) {
        setFeedback({ tone: "success", message: "Manual attribution event recorded." });
      } else {
        setFeedback({ tone: "error", message: result.error });
      }
    });
  }

  return (
    <div className={className}>
      <div className={panelCls}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Revenue attribution repair
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Override source, campaign, or consultant. Saves per-case manual rules; recalculate appends
          a correction event (confidence = manual).
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={financialOsClasses.formLabel}>
            Source
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={!canMutate || pending}
              className={financialOsClasses.select}
            >
              <option value="">Auto-resolve</option>
              {FI_REVENUE_ATTRIBUTION_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={financialOsClasses.formLabel}>
            Consultant
            <select
              value={consultantId}
              onChange={(e) => setConsultantId(e.target.value)}
              disabled={!canMutate || pending}
              className={financialOsClasses.select}
            >
              <option value="">Auto-resolve</option>
              {consultantOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={financialOsClasses.formLabel}>
            Campaign name
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              disabled={!canMutate || pending}
              className={financialOsClasses.input}
              placeholder="e.g. Spring FUE"
            />
          </label>
          <label className={financialOsClasses.formLabel}>
            Campaign ID
            <input
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              disabled={!canMutate || pending}
              className={financialOsClasses.input}
              placeholder="External campaign id"
            />
          </label>
        </div>

        {canMutate ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runSave}
              disabled={pending}
              className="rounded-md bg-cyan-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Save override
            </button>
            <button
              type="button"
              onClick={runRecalc}
              disabled={pending}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
            >
              Recalculate attribution
            </button>
          </div>
        ) : null}

        <FinancialOsFeedbackText
          message={feedback?.message ?? null}
          tone={feedback?.tone}
          className="mt-2"
        />
      </div>
    </div>
  );
}
