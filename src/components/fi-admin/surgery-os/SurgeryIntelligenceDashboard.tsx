import Link from "next/link";
import { BarChart3, Camera, ClipboardList, Scissors } from "lucide-react";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { SurgeryIntelligenceDashboardPayload } from "@/src/lib/outcomeIntelligence/surgeryIntelligenceDashboardTypes";
import { SurgeryIntelligenceBackfillCard } from "./SurgeryIntelligenceBackfillCard";
import { SurgeryIntelligenceDashboardFiltersForm } from "./SurgeryIntelligenceDashboardFiltersForm";
import { SurgeryIntelligenceOutcomeReportActions } from "./SurgeryIntelligenceOutcomeReportActions";

function DistributionList({
  title,
  distribution,
}: {
  title: string;
  distribution: Record<string, number>;
}) {
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">{title}</h3>
        <p className="mt-2 text-sm text-[#64748B]">No data in range.</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {entries.map(([label, count]) => (
          <li
            key={label}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#0c1426]/50 px-3 py-2 text-sm"
          >
            <span className="truncate text-[#CBD5E1]">{label.replaceAll("_", " ")}</span>
            <span className="shrink-0 font-mono tabular-nums text-[#F8FAFC]">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatNullableNumber(value: number | null, suffix = ""): string {
  if (value == null) return "—";
  return `${value.toLocaleString()}${suffix}`;
}

export function SurgeryIntelligenceDashboard({ data }: { data: SurgeryIntelligenceDashboardPayload }) {
  const base = `/fi-admin/${data.tenantId}/surgery-os/intelligence`;

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10">
      <DashboardCard elevated className="p-6 sm:p-8">
        <SectionHeader
          kicker="Outcome Intelligence"
          title="Surgery case intelligence"
          description="Read-only view of published graft-tray, surgery imaging, longitudinal outcome comparison, and audit-readiness facts from the analytics event pipeline. Facts are not rebuilt from live SurgeryOS state on this page."
        />
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#64748B]">
          <span>
            Events loaded: <strong className="text-[#CBD5E1]">{data.eventCountLoaded}</strong>
          </span>
          <span aria-hidden>·</span>
          <span>
            Unique cases: <strong className="text-[#CBD5E1]">{data.dedupedCaseCount}</strong>
          </span>
        </div>
      </DashboardCard>

      <SurgeryIntelligenceBackfillCard tenantId={data.tenantId} />

      <SurgeryIntelligenceDashboardFiltersForm
        baseHref={base}
        filters={data.filters}
        filterOptions={data.filterOptions}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Reviewed cases (final count)"
          value={data.metrics.totalReviewedCasesWithFinalCount}
          icon={<Scissors size={20} />}
        />
        <StatCard
          label="Total final graft count"
          value={formatNullableNumber(data.metrics.totalFinalReviewedGraftCount)}
          icon={<BarChart3 size={20} />}
        />
        <StatCard
          label="Avg grafts per reviewed case"
          value={formatNullableNumber(data.metrics.averageFinalGraftCountPerCase)}
        />
        <StatCard
          label="Cases needing review"
          value={data.metrics.casesNeedingReview}
          icon={<ClipboardList size={20} />}
        />
        <StatCard
          label="Audit-ready cases"
          value={data.metrics.casesAuditReady}
          icon={<Camera size={20} />}
        />
        <StatCard
          label="Avg imaging completeness"
          value={
            data.metrics.averageImagingCompletenessScore != null
              ? `${data.metrics.averageImagingCompletenessScore}%`
              : "—"
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Due for follow-up" value={data.metrics.casesDueForFollowUp} />
        <StatCard
          label="Before/after comparison ready"
          value={data.metrics.casesReadyForBeforeAfterComparison}
        />
        <StatCard label="Missing donor follow-up" value={data.metrics.casesMissingDonorFollowUp} />
        <StatCard
          label="Missing recipient follow-up"
          value={data.metrics.casesMissingRecipientFollowUp}
        />
        <StatCard
          label="HairAudit outcome report ready"
          value={data.metrics.casesReadyForHairAuditOutcomeReport}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard className="p-5">
          <SectionHeader
            title="Final count source"
            description="Accepted AI vs manual vs override among cases with a final reviewed graft count."
          />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["AI accepted", data.metrics.sourceSplit.ai],
                ["Manual", data.metrics.sourceSplit.manual],
                ["Override", data.metrics.sourceSplit.override],
                ["Unknown", data.metrics.sourceSplit.unknown],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/[0.08] bg-[#141C33]/60 px-3 py-3 text-center"
              >
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                  {label}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[#94A3B8]">
            Avg AI/manual variance:{" "}
            <span className="font-medium text-[#E2E8F0]">
              {formatNullableNumber(data.metrics.averageAiManualVariance, " grafts")}
            </span>
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Missing final count: {data.metrics.casesMissingFinalCount}
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <DistributionList
              title="Mismatch band"
              distribution={data.metrics.mismatchBandDistribution}
            />
            <DistributionList
              title="Confidence"
              distribution={data.metrics.confidenceBandDistribution}
            />
            <DistributionList
              title="Image quality"
              distribution={data.metrics.imageQualityDistribution}
            />
            <DistributionList
              title="Imaging audit readiness"
              distribution={data.metrics.imagingAuditReadinessDistribution}
            />
          </div>
          <p className="mt-4 text-sm text-[#64748B]">
            Before/after ready: {data.metrics.casesBeforeAfterReady} · Imaging gaps:{" "}
            {data.metrics.casesWithImagingGaps}
          </p>
        </DashboardCard>
      </div>

      <DashboardCard className="overflow-hidden p-0">
        <div className="border-b border-white/[0.08] px-5 py-4">
          <SectionHeader
            title="Case drill-down"
            description="Published facts per surgery case — open SurgeryOS or ImagingOS for live review."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#0c1426]/80 text-xs uppercase tracking-[0.14em] text-[#94A3B8]">
              <tr>
                <th className="px-4 py-3 font-semibold">Procedure date</th>
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Final grafts</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Mismatch</th>
                <th className="px-4 py-3 font-semibold">Confidence</th>
                <th className="px-4 py-3 font-semibold">Quality</th>
                <th className="px-4 py-3 font-semibold">Reviewer</th>
                <th className="px-4 py-3 font-semibold">Imaging</th>
                <th className="px-4 py-3 font-semibold">Audit readiness</th>
                <th className="px-4 py-3 font-semibold">Longitudinal</th>
                <th className="px-4 py-3 font-semibold">HairAudit</th>
                <th className="px-4 py-3 font-semibold">Outcome report</th>
                <th className="px-4 py-3 font-semibold">Links</th>
              </tr>
            </thead>
            <tbody>
              {data.tableRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-[#64748B]">
                    No published surgery intelligence facts match the current filters.
                  </td>
                </tr>
              ) : (
                data.tableRows.map((row) => (
                  <tr
                    key={row.eventId}
                    className="border-t border-white/[0.06] text-[#CBD5E1] hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{row.procedureDate ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#F1F5F9]">{row.patientReference}</div>
                      {row.caseId ? (
                        <div className="text-xs text-[#64748B]">Case {row.caseId.slice(0, 8)}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {row.hasFinalGraftCount ? (row.finalReviewedGraftCount ?? "—") : "Pending"}
                    </td>
                    <td className="px-4 py-3">{row.graftCountSource ?? "—"}</td>
                    <td className="px-4 py-3">{row.mismatchBand ?? "—"}</td>
                    <td className="px-4 py-3">{row.confidenceBand ?? "—"}</td>
                    <td className="px-4 py-3">{row.imageQuality ?? "—"}</td>
                    <td className="px-4 py-3">{row.reviewerLabel ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className="font-medium text-[#F1F5F9]">
                          {row.imagingCompletenessLabel}
                        </span>
                        <div className="text-xs text-[#64748B]">
                          {row.imagingCompletenessScore}% complete
                          {row.poorQualityImageCount > 0
                            ? ` · ${row.poorQualityImageCount} poor quality`
                            : ""}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span
                          className={
                            row.imagingAuditReady
                              ? "text-emerald-300"
                              : row.imagingBeforeAfterReady
                                ? "text-sky-300"
                                : "text-[#CBD5E1]"
                          }
                        >
                          {row.imagingAuditReadinessLabel}
                        </span>
                        {row.imagingMissingRequirementsCount > 0 ? (
                          <div className="text-xs text-[#64748B]">
                            {row.imagingMissingRequirementsCount} requirement
                            {row.imagingMissingRequirementsCount === 1 ? "" : "s"} open
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span
                          className={
                            row.beforeAfterComparisonReady
                              ? "text-sky-300"
                              : "text-[#CBD5E1]"
                          }
                        >
                          {row.longitudinalComparisonLabel}
                        </span>
                        <div className="text-xs text-[#64748B]">
                          {row.followUpDue ? "Follow-up due" : "Follow-up on track"}
                          {row.donorFollowUpMissing ? " · donor gap" : ""}
                          {row.recipientFollowUpMissing ? " · recipient gap" : ""}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span
                          className={
                            row.hairAuditLinkageConflict
                              ? "text-amber-300"
                              : row.hairAuditOutcomeReportReady
                                ? "text-emerald-300"
                                : "text-[#CBD5E1]"
                          }
                        >
                          {row.hairAuditLinkLabel}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {row.hairAuditAdminHref ? (
                            <Link
                              href={row.hairAuditAdminHref}
                              className="rounded-md border border-white/10 px-2 py-1 text-xs text-[#22C1FF] hover:border-[#22C1FF]/40"
                            >
                              HairAudit
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SurgeryIntelligenceOutcomeReportActions tenantId={data.tenantId} row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={row.surgeryHref}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-[#22C1FF] hover:border-[#22C1FF]/40"
                        >
                          SurgeryOS
                        </Link>
                        {row.caseHref ? (
                          <Link
                            href={row.caseHref}
                            className="rounded-md border border-white/10 px-2 py-1 text-xs text-[#22C1FF] hover:border-[#22C1FF]/40"
                          >
                            Case
                          </Link>
                        ) : null}
                        {row.imagingHref ? (
                          <Link
                            href={row.imagingHref}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[#22C1FF] hover:border-[#22C1FF]/40"
                          >
                            <Camera size={12} aria-hidden />
                            Imaging
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  );
}