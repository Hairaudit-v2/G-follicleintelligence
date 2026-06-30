import { ExternalLink } from "lucide-react";

import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";

function badgeClass(variant: StaffHrNotificationSummary["variant"], compact: boolean): string {
  const base = compact
    ? "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
    : "inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  switch (variant) {
    case "no_link":
      return `${base} border-slate-700 bg-white/[0.06] text-slate-400`;
    case "outstanding":
      return `${base} border-amber-400/60 bg-amber-400/15 text-amber-200`;
    case "complete":
      return `${base} border-emerald-400/50 bg-emerald-500/10 text-emerald-300`;
    case "stale":
      return `${base} border-slate-400/50 bg-white/[0.06] text-slate-300`;
    default:
      return `${base} border-slate-700 bg-white/[0.06] text-slate-400`;
  }
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function onboardingLabel(status: StaffHrNotificationSummary["onboardingStatus"]): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "incomplete":
      return "Incomplete";
    default:
      return "Unknown";
  }
}

export function StaffHrNotificationBadge({
  summary,
  compact = false,
  title,
  showStaleHint = true,
}: {
  summary: StaffHrNotificationSummary;
  compact?: boolean;
  title?: string;
  showStaleHint?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-0.5">
      <span className={badgeClass(summary.variant, compact)} title={title ?? summary.badgeLabel}>
        {compact ? summary.shortLabel : summary.badgeLabel}
      </span>
      {showStaleHint && summary.hasHrLink && summary.isSyncStale ? (
        <span
          className={`${compact ? "text-[9px]" : "text-[10px]"} font-medium ${compact ? "text-amber-300" : "text-amber-300"}`}
        >
          HR sync stale
        </span>
      ) : null}
    </span>
  );
}

/** Staff Twin / My HR: read-only IIOHR HR & training snapshot card. */
export function StaffHrNotificationDetailCard({
  summary,
  variant = "dark",
}: {
  summary: StaffHrNotificationSummary;
  variant?: "dark" | "light";
}) {
  const isDark = variant === "dark";
  const label = isDark ? "text-[#64748B]" : "text-gray-500";
  const value = isDark ? "text-[#E2E8F0]" : "text-slate-100";
  const muted = isDark ? "text-[#94A3B8]" : "text-slate-400";

  if (!summary.hasHrLink) {
    return (
      <>
        <h2 className={`text-lg font-semibold ${isDark ? "text-[#F8FAFC]" : "text-slate-100"}`}>
          IIOHR HR &amp; Training
        </h2>
        <p className={`mt-1 text-sm ${muted}`}>
          Snapshot from linked <span className="font-mono text-xs">fi_staff_source_ids</span> — HR remains the system of
          record.
        </p>
        <p className={`mt-6 text-sm ${muted}`}>No IIOHR HR link recorded for this staff member.</p>
        <div className="mt-4">
          <StaffHrNotificationBadge summary={summary} />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-[#F8FAFC]" : "text-slate-100"}`}>
            IIOHR HR &amp; Training
          </h2>
          <p className={`mt-1 text-sm ${muted}`}>
            Bounded metadata from <span className="font-mono text-xs">iiohr_hr</span> sync — not the legal HR record.
          </p>
        </div>
        <StaffHrNotificationBadge summary={summary} />
      </div>

      {summary.isSyncStale ? (
        <p className={`text-xs ${isDark ? "text-amber-200/90" : "text-amber-300"}`}>
          HR sync stale — last snapshot may be out of date. Open IIOHR HR for the latest status.
        </p>
      ) : null}

      {summary.alerts.length > 0 ? (
        <ul className={`space-y-1 text-sm ${value}`}>
          {summary.alerts.map((a) => (
            <li key={a} className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
              {a}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`text-sm ${muted}`}>Ready / complete — no outstanding HR tasks in this snapshot.</p>
      )}

      <dl className={`grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 ${label}`}>
        <div>
          <dt>Onboarding</dt>
          <dd className={`mt-0.5 font-semibold ${value}`}>{onboardingLabel(summary.onboardingStatus)}</dd>
        </div>
        <div>
          <dt>Documents missing</dt>
          <dd className={`mt-0.5 font-semibold ${value}`}>{summary.required_documents_missing_count ?? "—"}</dd>
        </div>
        <div>
          <dt>Training required</dt>
          <dd className={`mt-0.5 font-semibold ${value}`}>{summary.training_required_count ?? "—"}</dd>
        </div>
        <div>
          <dt>Certificates outstanding</dt>
          <dd className={`mt-0.5 font-semibold ${value}`}>{summary.certificates_outstanding_count ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt>Last synced</dt>
          <dd className={`mt-0.5 font-semibold ${value}`}>{formatSyncedAt(summary.last_synced_at)}</dd>
        </div>
      </dl>

      {summary.hr_portal_url ? (
        <a
          href={summary.hr_portal_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline ${
            isDark ? "text-[#22C1FF]" : "text-blue-300"
          }`}
        >
          Open IIOHR HR portal
          <ExternalLink className="h-3.5 w-3.5 opacity-90" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
