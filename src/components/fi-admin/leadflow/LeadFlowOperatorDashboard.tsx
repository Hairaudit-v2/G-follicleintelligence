import { Activity, AlertCircle, CheckCircle2, Clock, Radio, Zap } from "lucide-react";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  labelLeadFlowOperatorPredictedProcedure,
  labelLeadFlowOperatorPriority,
} from "@/src/lib/fiAdmin/leadFlowOperatorDashboardCore";
import type { LeadFlowOperatorDashboardPayload } from "@/src/lib/fiAdmin/leadFlowOperatorDashboardTypes";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function priorityBadgeClass(band: string | null | undefined): string {
  const normalized = String(band ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "urgent") return "bg-rose-500/15 text-rose-200 ring-rose-400/30";
  if (normalized === "high") return "bg-amber-500/15 text-amber-100 ring-amber-400/30";
  if (normalized === "medium") return "bg-sky-500/15 text-sky-100 ring-sky-400/30";
  return "bg-white/[0.06] text-[#94A3B8] ring-white/10";
}

function queueHealthLabel(payload: LeadFlowOperatorDashboardPayload): {
  label: string;
  tone: "healthy" | "busy" | "warning";
} {
  const { pending, retrying, processing } = payload.queueHealth.counts;
  const backlog = pending + retrying + processing;
  if (payload.queueHealth.failed_last_24h > 0) {
    return { label: "Failures in last 24h", tone: "warning" };
  }
  if (backlog > 0) {
    return { label: `${backlog} in queue`, tone: "busy" };
  }
  return { label: "Queue healthy", tone: "healthy" };
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "healthy" | "busy" | "warning" | "neutral" | "connected" | "disconnected";
}) {
  const toneClass =
    tone === "healthy" || tone === "connected"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
      : tone === "busy"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-100"
        : tone === "warning"
          ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
          : tone === "disconnected"
            ? "border-white/10 bg-white/[0.04] text-[#94A3B8]"
            : "border-white/10 bg-white/[0.04] text-[#CBD5E1]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}

export function LeadFlowOperatorDashboard({
  payload,
}: {
  payload: LeadFlowOperatorDashboardPayload;
}) {
  const queueStatus = queueHealthLabel(payload);
  const hasLeads = payload.summary.totalLeads > 0;
  const hasFailedEvents = payload.failedDiagnostics.length > 0;

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative space-y-5">
          <div className="border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">
              LeadFlow
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">
              LeadFlow
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
              HubSpot-first lead intelligence for hair restoration clinics
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip
              label={payload.hubspot.connected ? "HubSpot connected" : "HubSpot not connected"}
              tone={payload.hubspot.connected ? "connected" : "disconnected"}
            />
            <StatusChip label={queueStatus.label} tone={queueStatus.tone} />
            <StatusChip
              label={`Last processed ${formatDateTime(payload.queueHealth.newest_processed_at)}`}
              tone="neutral"
            />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Health"
          title="Lead health"
          description="Live counts from your LeadFlow pipeline — refreshed on each visit."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total leads"
            value={payload.summary.totalLeads}
            icon={<Activity className="h-5 w-5" />}
          />
          <StatCard
            label="New leads"
            value={payload.summary.newLeads}
            icon={<Zap className="h-5 w-5" />}
          />
          <StatCard
            label="High / urgent priority"
            value={payload.summary.highUrgentPriorityLeads}
            icon={<AlertCircle className="h-5 w-5" />}
          />
          <StatCard
            label="Consultation booked"
            value={payload.summary.consultationBooked}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="Quote sent"
            value={payload.summary.quoteSent}
            icon={<Radio className="h-5 w-5" />}
          />
          <StatCard
            label="Procedure booked"
            value={payload.summary.procedureBooked}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Failed ingestion events"
            value={payload.summary.failedIngestionEvents}
            icon={<AlertCircle className="h-5 w-5" />}
          />
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Pipeline"
          title="Pipeline board"
          description="Top leads in each stage, ranked by score."
          className="mb-4"
        />
        {!hasLeads ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-5">
            <p className="font-medium text-[#F8FAFC]">Your pipeline is ready for its first lead</p>
            <p className="mt-2 text-sm text-[#94A3B8]">
              Once HubSpot events are processed, leads will appear here with stage, score, and
              priority intelligence.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {payload.pipeline.map((column) => (
              <div
                key={column.id}
                className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75"
              >
                <div className="border-b border-white/[0.06] px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#F8FAFC]">{column.label}</h3>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#CBD5E1]">
                      {column.count}
                    </span>
                  </div>
                </div>
                <ul className="flex-1 space-y-2 p-3">
                  {column.topLeads.length === 0 ? (
                    <li className="px-1 py-2 text-xs text-[#64748B]">No leads in this stage yet</li>
                  ) : (
                    column.topLeads.map((lead) => (
                      <li
                        key={lead.id}
                        className="rounded-lg border border-white/[0.06] bg-[#141C33]/50 px-3 py-2.5"
                      >
                        <p className="truncate text-sm font-medium text-[#F8FAFC]">{lead.name}</p>
                        <p className="mt-1 truncate text-xs text-[#94A3B8]">
                          {lead.procedureInterest?.trim() || "Procedure interest not set"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${priorityBadgeClass(lead.priorityBand)}`}
                          >
                            {labelLeadFlowOperatorPriority(lead.priorityBand)}
                          </span>
                          <span className="text-xs tabular-nums text-[#64748B]">
                            Score {lead.leadScore}
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="Priority"
            title="Priority intelligence"
            description="How your active leads are distributed by priority band."
            className="mb-4"
          />
          <div className="grid grid-cols-2 gap-3">
            {(["urgent", "high", "medium", "low"] as const).map((band) => (
              <StatCard
                key={band}
                label={labelLeadFlowOperatorPriority(band)}
                value={payload.priorityCounts[band]}
              />
            ))}
          </div>
        </DashboardCard>

        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="Procedures"
            title="Predicted procedure intelligence"
            description="Likely procedure interest based on LeadFlow scoring."
            className="mb-4"
          />
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                "fue_transplant",
                "repair_case",
                "prp",
                "exosomes",
                "consultation_only",
                "unknown",
              ] as const
            ).map((proc) => (
              <StatCard
                key={proc}
                label={labelLeadFlowOperatorPredictedProcedure(proc)}
                value={payload.predictedProcedureCounts[proc]}
              />
            ))}
          </div>
        </DashboardCard>
      </div>

      <DashboardCard className="overflow-hidden p-0">
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <SectionHeader
            kicker="Focus"
            title="High-priority leads"
            description="Urgent and high-priority leads ranked by score — follow up here first."
          />
        </div>
        {payload.highPriorityLeads.length === 0 ? (
          <div className="px-5 py-8 sm:px-6">
            <p className="text-sm text-[#94A3B8]">
              No high-priority leads right now. That is a good sign — keep response times tight as
              new enquiries arrive.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#0c1220]/80 text-xs uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-5 py-3 font-semibold sm:px-6">Name</th>
                  <th className="px-3 py-3 font-semibold">Contact</th>
                  <th className="px-3 py-3 font-semibold">Procedure interest</th>
                  <th className="px-3 py-3 font-semibold">Source</th>
                  <th className="px-3 py-3 font-semibold">Stage</th>
                  <th className="px-3 py-3 font-semibold">Score</th>
                  <th className="px-3 py-3 font-semibold">Priority</th>
                  <th className="px-3 py-3 font-semibold">Predicted procedure</th>
                  <th className="px-3 py-3 font-semibold sm:pr-6">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {payload.highPriorityLeads.map((lead) => (
                  <tr key={lead.id} className="text-[#CBD5E1]">
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-[#F8FAFC] sm:px-6">
                      {lead.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{lead.contact ?? "—"}</td>
                    <td className="px-3 py-3">{lead.procedureInterest?.trim() || "—"}</td>
                    <td className="px-3 py-3">{lead.source?.trim() || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{lead.stageLabel}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">{lead.score}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${priorityBadgeClass(lead.priority)}`}
                      >
                        {lead.priorityLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3">{lead.predictedProcedureLabel}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[#94A3B8] sm:pr-6">
                      <time dateTime={lead.updatedAt}>{formatDateTime(lead.updatedAt)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Activity"
          title="Recent activity"
          description="Latest LeadFlow events across your leads."
          className="mb-4"
        />
        {payload.recentActivity.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">
            Activity will appear here as leads are created, scored, and moved through your pipeline.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {payload.recentActivity.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#F8FAFC]">
                    {row.activityLabel}
                    {row.leadName ? (
                      <span className="text-[#94A3B8]"> · {row.leadName}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[#64748B]">{row.metadataSummary}</p>
                </div>
                <time className="shrink-0 text-xs text-[#94A3B8]" dateTime={row.createdAt}>
                  {formatDateTime(row.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Ingestion"
          title="Queue health"
          description="HubSpot event processing status for this clinic."
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Pending" value={payload.queueHealth.counts.pending} />
          <StatCard label="Retrying" value={payload.queueHealth.counts.retrying} />
          <StatCard label="Processing" value={payload.queueHealth.counts.processing} />
          <StatCard label="Processed (24h)" value={payload.queueHealth.processed_last_24h} />
          <StatCard label="Failed (24h)" value={payload.queueHealth.failed_last_24h} />
          <StatCard
            label="Oldest pending"
            value={formatDateTime(payload.queueHealth.oldest_pending_at)}
          />
          <StatCard
            label="Newest processed"
            value={formatDateTime(payload.queueHealth.newest_processed_at)}
          />
        </div>

        {hasFailedEvents ? (
          <details className="mt-6 rounded-xl border border-white/[0.08] bg-[#0c1220]/60">
            <summary className="cursor-pointer list-none px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#F8FAFC]">Failed event diagnostics</p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    Last {payload.failedDiagnostics.length} failed ingestion events — expand for
                    details.
                  </p>
                </div>
                <span className="text-xs font-medium text-[#22C1FF]/80">Expand</span>
              </div>
            </summary>
            <div className="overflow-x-auto border-t border-white/[0.06]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#0c1220]/80 text-xs uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3 font-semibold sm:px-5">Provider</th>
                    <th className="px-3 py-3 font-semibold">Event type</th>
                    <th className="px-3 py-3 font-semibold">External ID</th>
                    <th className="px-3 py-3 font-semibold">Error</th>
                    <th className="px-3 py-3 font-semibold">Retries</th>
                    <th className="px-3 py-3 font-semibold sm:pr-5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {payload.failedDiagnostics.map((event) => (
                    <tr key={event.id} className="text-[#CBD5E1]">
                      <td className="whitespace-nowrap px-4 py-3 sm:px-5">{event.provider}</td>
                      <td className="whitespace-nowrap px-3 py-3">{event.eventType}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                        {event.externalId ?? "—"}
                      </td>
                      <td className="max-w-xs px-3 py-3 text-xs">{event.errorMessage ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                        {event.retryCount}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-[#94A3B8] sm:pr-5">
                        <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : (
          <p className="mt-4 text-sm text-[#94A3B8]">
            No failed ingestion events — your queue is running cleanly.
          </p>
        )}
      </DashboardCard>
    </div>
  );
}
