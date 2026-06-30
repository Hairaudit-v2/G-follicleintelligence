"use client";

import { useCallback, useState } from "react";

import {
  createDepositInvoiceFromSurgeryCaseAction,
  createInvoiceFromConsultationQuoteAction,
} from "@/lib/actions/fi-revenue-invoice-actions";
import { FiSection } from "@/src/components/fi-design/FiSection";

export function ConsultationQuoteRevenueActions(props: {
  tenantId: string;
  consultationId: string;
  adminKey: string;
  caseId: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const withKey = useCallback(
    <T extends Record<string, unknown>>(body: T) => {
      const k = props.adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [props.adminKey]
  );

  async function onCreateInvoice() {
    setBusy("invoice");
    setMsg(null);
    const res = await createInvoiceFromConsultationQuoteAction(
      props.tenantId,
      withKey({ consultation_id: props.consultationId })
    );
    setBusy(null);
    setMsg(res.ok ? `Invoice created (${res.invoice_id.slice(0, 8)}…).` : res.error);
  }

  async function onDepositInvoice() {
    if (!props.caseId?.trim()) {
      setMsg("Link a surgery case on this consultation before creating a deposit invoice.");
      return;
    }
    setBusy("deposit");
    setMsg(null);
    const res = await createDepositInvoiceFromSurgeryCaseAction(
      props.tenantId,
      withKey({
        case_id: props.caseId.trim(),
        deposit_amount_cents: null,
        procedure_fee_estimate_cents: null,
      })
    );
    setBusy(null);
    setMsg(res.ok ? `Deposit invoice created (${res.invoice_id.slice(0, 8)}…). Create a payment request from the case screen if needed.` : res.error);
  }

  return (
    <FiSection
      title="Billing actions"
      description="Creates RevenueOS invoices from this consultation — does not change quote fields. Finance or manager role required."
      headingId="consultation-revenue-actions-heading"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onCreateInvoice()}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy === "invoice" ? "Creating…" : "Create invoice from quote"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onDepositInvoice()}
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/[0.03] disabled:opacity-50"
        >
          {busy === "deposit" ? "Working…" : "Create deposit invoice (case)"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Deposit amounts follow active deposit rules or explicit amounts passed from the case workspace. Nothing here auto-charges a card.
      </p>
      {msg ? <p className="mt-2 text-sm text-slate-300">{msg}</p> : null}
    </FiSection>
  );
}
