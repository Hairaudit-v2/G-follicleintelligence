import { ExternalLink } from "lucide-react";

import { isAllowedHrPortalUrl } from "@/src/lib/staff/myHrPortalSelection";
import type {
  StaffComplianceItem,
  StaffComplianceStatus,
  StaffComplianceSummary,
} from "@/src/lib/staffCompliance/staffComplianceTypes";

function formatComplianceIsoDate(iso: string | null | undefined): string {
  if (iso == null) return "—";
  const s = String(iso).trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-AU", { dateStyle: "medium" });
}

function formatLastSyncedLine(iso: string | null | undefined): string | null {
  if (iso == null) return null;
  const s = String(iso).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return `Last synced: ${s}`;
  return `Last synced: ${d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}`;
}

function complianceStatusLabel(s: StaffComplianceStatus): string {
  switch (s) {
    case "due_soon":
      return "Due soon";
    case "expired":
      return "Expired";
    case "missing":
      return "Missing";
    case "unknown":
      return "Unknown";
    default:
      return "Current";
  }
}

function complianceStatusBadgeClass(s: StaffComplianceStatus): string {
  const base = "rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  switch (s) {
    case "expired":
      return `${base} border-rose-500/45 bg-rose-500/15 text-rose-100`;
    case "missing":
      return `${base} border-amber-500/45 bg-amber-500/15 text-amber-50`;
    case "due_soon":
      return `${base} border-amber-400/50 bg-amber-400/12 text-amber-100`;
    case "unknown":
      return `${base} border-slate-500/40 bg-slate-500/12 text-slate-200`;
    default:
      return `${base} border-emerald-500/40 bg-emerald-500/12 text-emerald-100`;
  }
}

function ItemStatusBadge({ status }: { status: StaffComplianceStatus }) {
  return (
    <span className={complianceStatusBadgeClass(status)}>{complianceStatusLabel(status)}</span>
  );
}

/**
 * Staff Twin (Stage 7E): read-only training / compliance from `fi_staff_source_ids.metadata`.
 * Not embedded; links are plain HTTP(S) opens in a new tab when present.
 */
export function StaffTwinIiohrComplianceCard({ summary }: { summary: StaffComplianceSummary }) {
  const hasRows = summary.items.length > 0;
  const synced = formatLastSyncedLine(summary.lastSyncedAt ?? null);
  const displayItems = summary.items.slice(0, 6);

  if (!hasRows) {
    return (
      <>
        <h2 className="text-lg font-semibold text-[#F8FAFC]">IIOHR training &amp; compliance</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Snapshot from linked source rows — not the legal system of record for HR or Academy.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-[#94A3B8]">
          No IIOHR training or compliance summary has been synced yet.
        </p>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#F8FAFC]">IIOHR training &amp; compliance</h2>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Snapshot from{" "}
            <span className="font-mono text-xs text-[#64748B]">fi_staff_source_ids.metadata</span> —
            not the legal system of record.
          </p>
        </div>
        <span className={complianceStatusBadgeClass(summary.overallStatus)}>
          Overall: {complianceStatusLabel(summary.overallStatus)}
        </span>
      </div>

      {synced ? <p className="mt-4 text-xs text-[#64748B]">{synced}</p> : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
        <div>
          <dt className="text-[#64748B]">Current</dt>
          <dd className="mt-0.5 font-semibold text-[#E2E8F0]">{summary.counts.current}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Due soon</dt>
          <dd className="mt-0.5 font-semibold text-[#E2E8F0]">{summary.counts.due_soon}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Expired</dt>
          <dd className="mt-0.5 font-semibold text-[#E2E8F0]">{summary.counts.expired}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Missing</dt>
          <dd className="mt-0.5 font-semibold text-[#E2E8F0]">{summary.counts.missing}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Unknown</dt>
          <dd className="mt-0.5 font-semibold text-[#E2E8F0]">{summary.counts.unknown}</dd>
        </div>
      </dl>

      <ul className="mt-6 space-y-3">
        {displayItems.map((item) => (
          <li
            key={`${item.sourceSystem}:${item.id}:${item.label}`}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#E2E8F0]">{item.label}</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Completed {formatComplianceIsoDate(item.completedAt)} · Expires{" "}
                  {formatComplianceIsoDate(item.expiresAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <ItemStatusBadge status={item.status} />
                {item.sourceUrl && isAllowedHrPortalUrl(item.sourceUrl) ? (
                  <a
                    href={item.sourceUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#22C1FF] underline-offset-2 hover:underline"
                  >
                    Source
                    <ExternalLink className="h-3 w-3 opacity-90" aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {summary.items.length > 6 ? (
        <p className="mt-4 text-xs text-[#64748B]">Showing 6 of {summary.items.length} items.</p>
      ) : null}
    </div>
  );
}

function attentionItems(summary: StaffComplianceSummary): StaffComplianceItem[] {
  return summary.items.filter(
    (i) => i.status === "due_soon" || i.status === "expired" || i.status === "missing"
  );
}

/** My HR Portal: compact read-only snapshot for the signed-in staff member. */
export function MyHrTrainingComplianceCompactCard({
  summary,
}: {
  summary: StaffComplianceSummary;
}) {
  const items = attentionItems(summary);
  const synced = formatLastSyncedLine(summary.lastSyncedAt ?? null);

  return (
    <div className="mt-6 border-t border-white/[0.08] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#F8FAFC]">Training &amp; compliance</h3>
        <span className={complianceStatusBadgeClass(summary.overallStatus)}>
          {complianceStatusLabel(summary.overallStatus)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
        Read-only summary from Follicle Intelligence link data — not your official HR or Academy
        record.
      </p>
      {synced ? <p className="mt-2 text-xs text-[#64748B]">{synced}</p> : null}
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[#94A3B8]">
          No items are due soon, expired, or missing in this snapshot.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={`${item.sourceSystem}:${item.id}:${item.label}`}
              className="text-sm text-[#CBD5E1]"
            >
              <span className="font-medium text-[#E2E8F0]">{item.label}</span>
              <span className="mx-2 text-[#475569]">·</span>
              <ItemStatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
