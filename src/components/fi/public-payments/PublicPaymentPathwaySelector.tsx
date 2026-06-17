"use client";

import { useState, useTransition } from "react";

import { selectPublicPaymentPathwayAction } from "@/lib/actions/public-payment-pathway-actions";
import type { FiPaymentPathwayType } from "@/src/lib/financialOs/financialPaymentPathwayCore";
import type { PublicPaymentPathwayOption } from "@/src/lib/financialOs/publicPaymentPathwaySelectionCore";

export function PublicPaymentPathwaySelector(props: {
  publicToken: string;
  options: PublicPaymentPathwayOption[];
  initialSelectedPathwayType: FiPaymentPathwayType | null;
  initialCheckoutUrl: string | null;
  initialShowCheckout: boolean;
  initialConfirmationMessage: string | null;
  isDepositPaymentRequest: boolean;
}) {
  const {
    publicToken,
    options,
    initialSelectedPathwayType,
    initialCheckoutUrl,
    initialShowCheckout,
    initialConfirmationMessage,
  } = props;

  const [pending, start] = useTransition();
  const [selectedType, setSelectedType] = useState<FiPaymentPathwayType | null>(initialSelectedPathwayType);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(initialConfirmationMessage);
  const [showCheckout, setShowCheckout] = useState(initialShowCheckout);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(initialCheckoutUrl);
  const [error, setError] = useState<string | null>(null);

  function onSelect(pathwayType: FiPaymentPathwayType) {
    setError(null);
    start(async () => {
      const res = await selectPublicPaymentPathwayAction({ publicToken, pathwayType });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelectedType(pathwayType);
      setConfirmationMessage(res.confirmationMessage);
      setShowCheckout(res.continueToCheckout);
      setCheckoutUrl(res.checkoutUrl);
    });
  }

  return (
    <section className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Choose your payment option</h2>
        <p className="mt-1 text-xs text-slate-600">
          Select how you would like to proceed. Your clinic will see your choice and follow up where needed.
        </p>
      </div>

      <ul className="space-y-2">
        {options.map((opt) => {
          const isSelected = selectedType === opt.pathwayType;
          const isBusy = pending && !isSelected;
          return (
            <li key={opt.pathwayType}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onSelect(opt.pathwayType)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                  isSelected
                    ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">{opt.title}</span>
                <span className="mt-0.5 block text-xs text-slate-600">{opt.description}</span>
                {isSelected ? (
                  <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-blue-700">Selected</span>
                ) : null}
                {isBusy ? <span className="mt-1 block text-[11px] text-slate-500">Saving…</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p> : null}

      {confirmationMessage ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{confirmationMessage}</p>
      ) : null}

      {showCheckout && checkoutUrl ? (
        <div className="pt-1">
          <a
            href={checkoutUrl}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Pay now
          </a>
          <p className="mt-2 text-xs text-slate-500">You will leave this page to complete card payment with our payment partner.</p>
        </div>
      ) : null}
    </section>
  );
}
