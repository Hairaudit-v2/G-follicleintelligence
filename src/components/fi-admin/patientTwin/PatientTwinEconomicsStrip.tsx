import Link from "next/link";

import type { OverviewEconomicsSection } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import {
  formatAudCents,
  OVERVIEW_SECTION_HEADINGS,
} from "@/src/lib/patientTwin/patientTwinOverviewCopy";
import { OVERVIEW_SECTION_IDS } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import { OverviewAvailabilityBadge } from "./OverviewAvailabilityBadge";

export function PatientTwinEconomicsStrip({
  economics,
}: {
  economics: OverviewEconomicsSection;
}) {
  return (
    <section
      id={OVERVIEW_SECTION_IDS.economics}
      className="scroll-mt-4 rounded-xl border border-white/[0.08] bg-[#0b1220]/90 p-4"
      aria-labelledby="overview-economics-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="overview-economics-heading"
          className="text-sm font-semibold tracking-tight text-slate-100"
        >
          {OVERVIEW_SECTION_HEADINGS.economics}
        </h2>
        <OverviewAvailabilityBadge availability={economics.availability} />
      </div>

      {economics.availability === "not_recorded" ? (
        <p className="mt-3 text-sm text-slate-400">
          Quote and payment totals are not recorded on this health record.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <dl className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Quote
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">
              {economics.quoteCents != null
                ? formatAudCents(economics.quoteCents, economics.currency)
                : "Not recorded"}
            </dd>
          </dl>
          <dl className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Deposit
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">
              {economics.depositCents != null
                ? formatAudCents(economics.depositCents, economics.currency)
                : "Not recorded"}
            </dd>
          </dl>
          <dl className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Balance
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">
              {economics.balanceCents != null
                ? formatAudCents(economics.balanceCents, economics.currency)
                : "Not recorded"}
            </dd>
          </dl>
          <dl className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Paid total
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">
              {formatAudCents(economics.paidTotalCents, economics.currency)}
            </dd>
          </dl>
        </div>
      )}

      {economics.invoiceCount > 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          {economics.invoiceCount} invoice{economics.invoiceCount === 1 ? "" : "s"} on record
          {economics.reconciliationNote ? ` · ${economics.reconciliationNote}` : null}
        </p>
      ) : null}

      <Link
        href={economics.paymentsHref}
        className="mt-3 inline-block text-sm font-medium text-cyan-300 hover:underline"
      >
        Open Payments
      </Link>
    </section>
  );
}
