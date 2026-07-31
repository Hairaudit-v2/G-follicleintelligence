import Link from "next/link";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { SurgeryReviewHubModel } from "@/src/lib/fiOs/surgery/surgeryReviewHubCore";

const cardClass =
  "flex h-full flex-col rounded-xl border border-white/[0.08] bg-[#0F1629]/70 p-4 transition hover:border-[#22C1FF]/25";
const ctaClass =
  "mt-auto inline-flex w-fit items-center rounded-lg border border-[#22C1FF]/35 bg-[#22C1FF]/10 px-3 py-1.5 text-xs font-medium text-[#22C1FF] transition hover:bg-[#22C1FF]/18";

export function SurgeryReviewHub({ model }: { model: SurgeryReviewHubModel }) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:max-w-[1200px]">
      <DashboardCard elevated className="p-6 sm:p-8">
        <SectionHeader
          kicker="Surgery"
          title={model.headerTitle}
          description={model.headerDescription}
        />
      </DashboardCard>

      {model.summaryCards.length > 0 ? (
        <section aria-labelledby="surgery-review-summary-heading">
          <h2
            id="surgery-review-summary-heading"
            className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]"
          >
            What needs attention
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {model.summaryCards.map((card) => (
              <li key={card.id}>
                <div className={cardClass}>
                  <p className="text-sm font-semibold text-[#F8FAFC]">{card.title}</p>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-[#94A3B8]">
                    {card.description}
                  </p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                    {card.statusLabel}
                  </p>
                  {card.href ? (
                    <Link href={card.href} className={`${ctaClass} mt-3`}>
                      {card.ctaLabel}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {model.panels.length > 0 ? (
        <section aria-labelledby="surgery-review-queues-heading" className="space-y-3">
          <h2
            id="surgery-review-queues-heading"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]"
          >
            Review queues
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {model.panels.map((panel) => (
              <li key={panel.id}>
                <DashboardCard className="flex h-full flex-col p-5">
                  <h3 className="text-base font-semibold text-[#F8FAFC]">{panel.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#94A3B8]">
                    {panel.description}
                  </p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                    {panel.statusLabel}
                  </p>
                  {panel.href ? (
                    <Link href={panel.href} className={`${ctaClass} mt-4`}>
                      {panel.ctaLabel}
                    </Link>
                  ) : null}
                </DashboardCard>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <DashboardCard className="p-5">
          <p className="text-sm text-[#94A3B8]">
            You do not have access to surgery review queues for this clinic. Contact a clinic admin
            if you need access.
          </p>
        </DashboardCard>
      )}

      {model.advancedAdminLink ? (
        <DashboardCard className="border-dashed border-white/[0.12] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
            Administrative
          </p>
          <p className="mt-2 text-sm font-medium text-[#CBD5E1]">{model.advancedAdminLink.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-[#94A3B8]">
            {model.advancedAdminLink.description}
          </p>
          <Link href={model.advancedAdminLink.href} className={`${ctaClass} mt-4`}>
            {model.advancedAdminLink.label}
          </Link>
        </DashboardCard>
      ) : null}
    </div>
  );
}
