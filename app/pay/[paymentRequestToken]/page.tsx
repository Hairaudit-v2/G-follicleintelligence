import type { Metadata } from "next";
import Link from "next/link";

import { PublicPaymentPathwaySelector } from "@/src/components/fi/public-payments/PublicPaymentPathwaySelector";
import { loadPublicPaymentPathwaySelectionByToken } from "@/src/lib/financialOs/publicPaymentPathwaySelection.server";
import { formatMoneyFromCents } from "@/src/lib/format/money";
import { loadPublicPaymentRequestView } from "@/src/lib/revenueOs/publicPaymentRequestLoaders.server";

export const metadata: Metadata = {
  title: "Pay invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PublicPayPage({
  params,
}: {
  params: Promise<{ paymentRequestToken: string }>;
}) {
  const { paymentRequestToken } = await params;
  const raw = paymentRequestToken?.trim() ?? "";
  const [view, pathwaySelection] = await Promise.all([
    loadPublicPaymentRequestView(raw),
    loadPublicPaymentPathwaySelectionByToken(raw),
  ]);

  if (!view.ok) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-100">Link unavailable</h1>
        <p className="mt-2 text-sm text-slate-400">
          This payment link is not valid or has been replaced. Contact the clinic for a new link or
          other payment options.
        </p>
      </div>
    );
  }

  const {
    state,
    brandName,
    clinicDisplayName,
    invoiceTitle,
    invoiceKind,
    currency,
    amountDueCents,
    checkoutUrl,
  } = view;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <header className="border-b border-white/[0.08] pb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Secure payment
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">
          {clinicDisplayName ?? brandName}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{brandName}</p>
      </header>

      <section className="mt-8 space-y-3 rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
        <h2 className="text-sm font-semibold text-slate-100">Invoice summary</h2>
        <p className="text-sm text-slate-300">{invoiceTitle ?? invoiceKind.replace(/_/g, " ")}</p>
        <p className="text-lg font-semibold text-slate-100">
          Amount due: {formatMoneyFromCents(amountDueCents, currency)}
        </p>
        {state === "paid" ? (
          <p className="rounded bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            This invoice is already paid. Thank you.
          </p>
        ) : null}
        {state === "cancelled" ? (
          <p className="rounded bg-white/[0.06] px-3 py-2 text-sm text-slate-200">
            This payment request was cancelled. Contact the clinic if you still need to pay.
          </p>
        ) : null}
        {state === "expired" ? (
          <p className="rounded bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            This payment link has expired. Please contact the clinic for a fresh link.
          </p>
        ) : null}
        {state === "manual_contact" ? (
          <p className="rounded bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
            Online card payment is not enabled for this clinic. Please contact the clinic to
            complete payment.
          </p>
        ) : null}
        {state === "payable" &&
        checkoutUrl &&
        !(pathwaySelection.ok && pathwaySelection.eligible) ? (
          <div className="pt-2">
            <a
              href={checkoutUrl}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Pay now
            </a>
            <p className="mt-2 text-xs text-slate-500">
              You will leave this page to complete card payment with our payment partner.
            </p>
          </div>
        ) : null}
      </section>

      {pathwaySelection.ok && pathwaySelection.eligible ? (
        <PublicPaymentPathwaySelector
          publicToken={pathwaySelection.publicToken}
          options={pathwaySelection.options}
          initialSelectedPathwayType={pathwaySelection.selectedPathwayType}
          initialCheckoutUrl={pathwaySelection.checkoutUrl}
          initialShowCheckout={pathwaySelection.showCheckoutForSelection}
          initialConfirmationMessage={pathwaySelection.confirmationMessage}
          isDepositPaymentRequest={pathwaySelection.isDepositPaymentRequest}
        />
      ) : null}

      <p className="mt-8 text-center text-xs text-slate-500">
        Questions? Reply to the clinic message that contained this link, or use the contact details
        they provided.
      </p>
      <p className="mt-4 text-center text-xs text-slate-400">
        <Link href="/follicle-intelligence/login" className="text-slate-500 underline">
          Staff sign-in
        </Link>{" "}
        is not required to pay this invoice.
      </p>
    </div>
  );
}
