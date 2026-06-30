"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  createBalanceInvoiceFromSurgeryCaseAction,
  createDepositInvoiceFromSurgeryCaseAction,
  createPaymentRequestAction,
  resendPaymentRequestAction,
  updateInvoiceDueDateAction,
} from "@/lib/actions/fi-revenue-invoice-actions";
import type { CasePaymentReadiness } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import {
  invoiceBalanceDueCents,
  isInvoiceOpenForCollection,
} from "@/src/lib/revenueOs/revenueInvoiceModel";

function formatMoney(cents: number, currency: string): string {
  const v = cents / 100;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function audToCents(aud: string): number | null {
  const n = Number(String(aud).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function latestRequestForInvoice(readiness: CasePaymentReadiness, invoiceId: string) {
  return readiness.paymentRequests.find((p) => p.invoice_id === invoiceId) ?? null;
}

export function CaseRevenuePaymentsCardClient(props: {
  tenantId: string;
  caseId: string;
  patientFoundationId: string | null;
  readiness: CasePaymentReadiness;
  canMutate: boolean;
}) {
  const { tenantId, caseId, patientFoundationId, readiness, canMutate } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const open = useMemo(
    () =>
      readiness.invoices.filter(
        (i) => isInvoiceOpenForCollection(i.status) && invoiceBalanceDueCents(i) > 0
      ),
    [readiness.invoices]
  );

  const hasDepositOpen = open.some((i) => i.invoice_kind === "surgery_deposit");

  const [depositDue, setDepositDue] = useState("");
  const [depositAud, setDepositAud] = useState("");
  const [procFeeAud, setProcFeeAud] = useState("");

  const [balanceDue, setBalanceDue] = useState("");
  const [balanceAud, setBalanceAud] = useState("");

  async function sendFullBalanceForKind(kind: "surgery_deposit" | "surgery_balance") {
    const inv = open.find((i) => i.invoice_kind === kind);
    if (!inv) {
      setBanner(
        `No open ${kind === "surgery_deposit" ? "deposit" : "balance"} invoice — create one first.`
      );
      return;
    }
    const cents = invoiceBalanceDueCents(inv);
    if (cents <= 0) return;
    setBusy(`preset-${kind}`);
    try {
      const res = await createPaymentRequestAction(tenantId, {
        invoice_id: inv.id,
        amount_cents: cents,
        send: true,
      });
      if (!res.ok) setErr(res.error);
      else await copyText("payment link", res.pay_page_url);
    } finally {
      setBusy(null);
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setErr(null);
      setBanner(`Copied ${label}.`);
      setTimeout(() => setBanner(null), 2500);
    } catch {
      setErr("Could not copy — select the link manually.");
    }
  }

  return (
    <div className="space-y-4">
      {readiness.depositReadinessMessage ? (
        <p className="rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          {readiness.depositReadinessMessage}
        </p>
      ) : null}
      {err ? <p className="text-sm font-medium text-rose-300">{err}</p> : null}
      {banner ? <p className="text-xs font-medium text-emerald-300">{banner}</p> : null}

      {canMutate && open.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/15 disabled:opacity-50"
            disabled={Boolean(busy) || !open.some((i) => i.invoice_kind === "surgery_deposit")}
            onClick={() => void sendFullBalanceForKind("surgery_deposit")}
          >
            Send deposit payment link
          </button>
          <button
            type="button"
            className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/15 disabled:opacity-50"
            disabled={Boolean(busy) || !open.some((i) => i.invoice_kind === "surgery_balance")}
            onClick={() => void sendFullBalanceForKind("surgery_balance")}
          >
            Send balance payment link
          </button>
          <span className="self-center text-xs text-slate-500">
            Custom amount: use per-invoice row below.
          </span>
        </div>
      ) : null}

      {!canMutate ? (
        <p className="text-sm text-slate-400">
          Finance or manager access is required to create payment links and invoices.
        </p>
      ) : (
        <div className="rounded border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-slate-200">
          <p className="font-medium text-slate-100">Create case invoices</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">
                Surgery deposit (when no deposit invoice exists)
              </p>
              <input
                type="date"
                className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
                value={depositDue}
                onChange={(e) => setDepositDue(e.target.value)}
                disabled={hasDepositOpen || Boolean(busy)}
              />
              <input
                className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
                placeholder="Deposit AUD (optional override)"
                value={depositAud}
                onChange={(e) => setDepositAud(e.target.value)}
                disabled={hasDepositOpen || Boolean(busy)}
              />
              <input
                className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
                placeholder="Procedure fee AUD (for % rules)"
                value={procFeeAud}
                onChange={(e) => setProcFeeAud(e.target.value)}
                disabled={hasDepositOpen || Boolean(busy)}
              />
              <button
                type="button"
                className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                disabled={hasDepositOpen || Boolean(busy) || !depositDue}
                onClick={async () => {
                  setBusy("dep");
                  try {
                    const depCents = depositAud.trim() ? audToCents(depositAud) : null;
                    const feeCents = procFeeAud.trim() ? audToCents(procFeeAud) : null;
                    const res = await createDepositInvoiceFromSurgeryCaseAction(tenantId, {
                      case_id: caseId,
                      due_date_ymd: depositDue,
                      deposit_amount_cents: depCents,
                      procedure_fee_estimate_cents: feeCents,
                    });
                    if (!res.ok) setErr(res.error);
                    else window.location.reload();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Create deposit invoice
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Surgery balance</p>
              <input
                type="date"
                className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
                value={balanceDue}
                onChange={(e) => setBalanceDue(e.target.value)}
                disabled={Boolean(busy)}
              />
              <input
                className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
                placeholder="Balance AUD"
                value={balanceAud}
                onChange={(e) => setBalanceAud(e.target.value)}
                disabled={Boolean(busy)}
              />
              <button
                type="button"
                className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                disabled={Boolean(busy) || !balanceDue || !balanceAud.trim()}
                onClick={async () => {
                  const cents = audToCents(balanceAud);
                  if (!cents) return;
                  setBusy("bal");
                  try {
                    const res = await createBalanceInvoiceFromSurgeryCaseAction(tenantId, {
                      case_id: caseId,
                      balance_amount_cents: cents,
                      due_date_ymd: balanceDue,
                    });
                    if (!res.ok) setErr(res.error);
                    else window.location.reload();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Create balance invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {open.length === 0 ? (
        <p className="text-sm text-slate-400">No open invoices with a balance for this case.</p>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded border border-white/[0.08]">
          {open.map((inv) => (
            <InvoicePaymentRow
              key={inv.id}
              tenantId={tenantId}
              inv={inv}
              latest={latestRequestForInvoice(readiness, inv.id)}
              canMutate={canMutate}
              busy={busy}
              setBusy={setBusy}
              onBanner={setBanner}
              onError={setErr}
              onCopy={copyText}
            />
          ))}
        </ul>
      )}

      {patientFoundationId ? (
        <p className="text-xs text-slate-400">
          <Link
            href={`/fi-admin/${tenantId}/patients/${patientFoundationId}?tab=payments`}
            className="font-medium text-blue-300 hover:underline"
          >
            Open patient payments tab
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function InvoicePaymentRow(props: {
  tenantId: string;
  inv: import("@/src/lib/revenueOs/revenueInvoiceModel").FiInvoiceRow;
  latest: import("@/src/lib/revenueOs/revenueInvoiceModel").FiPaymentRequestRow | null;
  canMutate: boolean;
  busy: string | null;
  setBusy: (s: string | null) => void;
  onBanner: (s: string | null) => void;
  onError: (s: string | null) => void;
  onCopy: (label: string, text: string) => void;
}) {
  const { tenantId, inv, latest, canMutate, busy, setBusy, onBanner, onError, onCopy } = props;
  const bal = invoiceBalanceDueCents(inv);
  const [due, setDue] = useState(inv.due_date ?? "");
  const [aud, setAud] = useState(String((bal / 100).toFixed(2)));
  const [note, setNote] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");

  const expiresIso = useMemo(() => {
    const s = expiresLocal.trim();
    if (!s) return null;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  }, [expiresLocal]);

  return (
    <li className="space-y-2 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{inv.title ?? inv.invoice_kind}</p>
          <p className="text-xs text-slate-400">
            {inv.invoice_kind} · <span className="font-semibold">{inv.status}</span>
          </p>
          <p className="text-xs text-slate-400">
            Balance {formatMoney(bal, inv.currency)} of {formatMoney(inv.total_cents, inv.currency)}{" "}
            total
          </p>
        </div>
      </div>

      {latest ? (
        <div className="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-2 text-xs text-slate-300">
          <p>
            Last payment request: <span className="font-semibold">{latest.status}</span>
            {latest.sent_at ? (
              <>
                {" "}
                · sent <span className="font-mono">{latest.sent_at.slice(0, 19)}</span>
              </>
            ) : null}
          </p>
          {canMutate && latest.status !== "paid" && latest.status !== "cancelled" && bal > 0 ? (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-blue-300 hover:underline disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={async () => {
                setBusy(`rs-${latest.id}`);
                try {
                  const res = await resendPaymentRequestAction(tenantId, {
                    payment_request_id: latest.id,
                  });
                  if (!res.ok) onError(res.error);
                  else {
                    onError(null);
                    await onCopy("payment link", res.pay_page_url);
                  }
                } finally {
                  setBusy(null);
                }
              }}
            >
              Resend / refresh link
            </button>
          ) : null}
        </div>
      ) : null}

      {canMutate ? (
        <div className="grid gap-2 border-t border-white/[0.06] pt-2 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Due date
            <div className="mt-1 flex gap-1">
              <input
                type="date"
                className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
              <button
                type="button"
                className="shrink-0 rounded border border-slate-700 px-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06] disabled:opacity-50"
                disabled={Boolean(busy) || !due}
                onClick={async () => {
                  setBusy(`due-${inv.id}`);
                  try {
                    const res = await updateInvoiceDueDateAction(tenantId, {
                      invoice_id: inv.id,
                      due_date_ymd: due,
                    });
                    if (!res.ok) onError(res.error);
                    else {
                      onError(null);
                      onBanner("Due date saved.");
                    }
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Save
              </button>
            </div>
          </label>
          <label className="block text-xs text-slate-400">
            Amount (AUD)
            <input
              className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-xs"
              value={aud}
              onChange={(e) => setAud(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Optional note to include with the request (stored as metadata)
            <textarea
              className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-xs"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Link expiry (optional, local time)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-xs"
              value={expiresLocal}
              onChange={(e) => setExpiresLocal(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={async () => {
                const cents = audToCents(aud);
                if (!cents) {
                  onError("Enter a valid AUD amount.");
                  return;
                }
                setBusy(`send-${inv.id}`);
                try {
                  const res = await createPaymentRequestAction(tenantId, {
                    invoice_id: inv.id,
                    amount_cents: cents,
                    send: true,
                    staff_note: note.trim() || null,
                    expires_at_iso: expiresIso,
                  });
                  if (!res.ok) onError(res.error);
                  else {
                    onError(null);
                    await onCopy("payment link", res.pay_page_url);
                  }
                } finally {
                  setBusy(null);
                }
              }}
            >
              Send payment link
            </button>
            <button
              type="button"
              className="rounded border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.03] disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={async () => {
                const cents = audToCents(aud);
                if (!cents) {
                  onError("Enter a valid AUD amount.");
                  return;
                }
                setBusy(`draft-${inv.id}`);
                try {
                  const res = await createPaymentRequestAction(tenantId, {
                    invoice_id: inv.id,
                    amount_cents: cents,
                    send: false,
                    staff_note: note.trim() || null,
                    expires_at_iso: expiresIso,
                  });
                  if (!res.ok) onError(res.error);
                  else {
                    onError(null);
                    await onCopy("payment link", res.pay_page_url);
                  }
                } finally {
                  setBusy(null);
                }
              }}
            >
              Create link (draft) &amp; copy
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
