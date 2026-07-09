"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createManualExpenseAction } from "@/lib/actions/financial-os-expense-actions";
import {
  FinancialOsFeedbackText,
  financialOsActionFeedback,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { FiExpenseCategoryRow } from "@/src/lib/financialOs/expenses/expenseTypes";
import { FI_EXPENSE_PAYMENT_METHODS } from "@/src/lib/financialOs/expenses/expenseTypes";

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Convert major-unit string (e.g. 12.50) to integer cents. */
function parseDollarsToCents(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function ExpenseManualEntryForm(props: {
  tenantId: string;
  categories: FiExpenseCategoryRow[];
  canMutate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);

  const [expenseDate, setExpenseDate] = useState(todayYmd());
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(props.categories[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<string>("card");
  const [campaignKey, setCampaignKey] = useState("");
  const [status, setStatus] = useState<"draft" | "reviewed">("reviewed");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!props.canMutate) return;
    setFeedback(null);

    const amountCents = parseDollarsToCents(amount);
    if (amountCents == null) {
      setFeedback({ message: "Enter a valid non-negative amount.", tone: "error" });
      return;
    }

    start(async () => {
      const res = await createManualExpenseAction(props.tenantId, {
        expense_date: expenseDate,
        amount_cents: amountCents,
        vendor_name: vendor || null,
        description: description || null,
        category_id: categoryId || null,
        payment_method: paymentMethod || null,
        campaign_key: campaignKey || null,
        status,
      });
      const fb = financialOsActionFeedback(res, "Expense saved.");
      setFeedback(fb);
      if (res.ok) {
        setAmount("");
        setVendor("");
        setDescription("");
        setCampaignKey("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className={financialOsClasses.formPanel}>
      <h2 className={financialOsClasses.formTitle}>Manual expense</h2>
      <p className={financialOsClasses.formHint}>
        Capture a single clinic cost. Amount is stored in cents (AUD). Does not touch the revenue
        ledger.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={financialOsClasses.formLabel}>
          Date
          <input
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className={financialOsClasses.input}
            disabled={!props.canMutate || pending}
          />
        </label>
        <label className={financialOsClasses.formLabel}>
          Amount (AUD)
          <input
            type="text"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={financialOsClasses.input}
            disabled={!props.canMutate || pending}
          />
        </label>
        <label className={financialOsClasses.formLabel}>
          Vendor
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className={financialOsClasses.input}
            disabled={!props.canMutate || pending}
            maxLength={200}
          />
        </label>
        <label className={financialOsClasses.formLabel}>
          Category
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={financialOsClasses.select}
            disabled={!props.canMutate || pending}
          >
            <option value="" className={financialOsClasses.selectOption}>
              Uncategorized
            </option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id} className={financialOsClasses.selectOption}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className={financialOsClasses.formLabel}>
          Payment method
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={financialOsClasses.select}
            disabled={!props.canMutate || pending}
          >
            {FI_EXPENSE_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m} className={financialOsClasses.selectOption}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className={financialOsClasses.formLabel}>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "reviewed")}
            className={financialOsClasses.select}
            disabled={!props.canMutate || pending}
          >
            <option value="reviewed" className={financialOsClasses.selectOption}>
              Reviewed
            </option>
            <option value="draft" className={financialOsClasses.selectOption}>
              Draft
            </option>
          </select>
        </label>
        <label className={`${financialOsClasses.formLabel} sm:col-span-2`}>
          Description
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={financialOsClasses.input}
            disabled={!props.canMutate || pending}
            maxLength={2000}
          />
        </label>
        <label className={`${financialOsClasses.formLabel} sm:col-span-2`}>
          Campaign key (optional, for CPL later)
          <input
            type="text"
            value={campaignKey}
            onChange={(e) => setCampaignKey(e.target.value)}
            className={financialOsClasses.input}
            disabled={!props.canMutate || pending}
            placeholder="e.g. meta_q3_perth"
            maxLength={200}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!props.canMutate || pending}
          className={financialOsClasses.primaryButton}
        >
          {pending ? "Saving…" : "Save expense"}
        </button>
        {!props.canMutate ? (
          <span className={financialOsClasses.mutedMeta}>You do not have write access.</span>
        ) : null}
      </div>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </form>
  );
}
