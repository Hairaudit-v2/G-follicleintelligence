import type { FiStaffCompetencyProjectionRow } from "@/src/lib/academy-os/academyCompetencyTypes";

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { dateStyle: "medium" });
}

function formatIsoDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function statusBadgeClass(status: string): string {
  const base = "rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  switch (status) {
    case "expired":
      return `${base} border-rose-500/45 bg-rose-500/15 text-rose-100`;
    case "restricted":
    case "suspended":
      return `${base} border-amber-500/45 bg-amber-500/15 text-amber-50`;
    case "expiring":
      return `${base} border-amber-400/50 bg-amber-400/12 text-amber-100`;
    default:
      return `${base} border-emerald-500/40 bg-emerald-500/12 text-emerald-100`;
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type StaffAcademyCompetencyProjectionPanelProps = {
  projections: FiStaffCompetencyProjectionRow[];
  variant?: "light" | "dark";
};

export function StaffAcademyCompetencyProjectionPanel({
  projections,
  variant = "light",
}: StaffAcademyCompetencyProjectionPanelProps) {
  const isDark = variant === "dark";
  const titleClass = isDark ? "text-[#F8FAFC]" : "text-slate-100";
  const mutedClass = isDark ? "text-[#94A3B8]" : "text-slate-400";
  const labelClass = isDark ? "text-[#64748B]" : "text-slate-500";
  const valueClass = isDark ? "text-[#E2E8F0]" : "text-slate-200";
  const rowClass = isDark
    ? "rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
    : "rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3";

  return (
    <div>
      <h2 className={`text-lg font-semibold ${titleClass}`}>Academy Competency Projection</h2>
      <p className={`mt-1 text-sm ${mutedClass}`}>
        Operational competency intelligence exported from IIOHR Academy. Read-only — IIOHR remains
        the educational system of record.
      </p>

      {projections.length === 0 ? (
        <p className={`mt-4 text-sm ${mutedClass}`}>
          No competency projections received yet. Projections appear when IIOHR exports verified
          competency intelligence.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {projections.map((row) => (
            <li key={row.id} className={rowClass}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className={`font-mono text-sm font-medium ${valueClass}`}>{row.competencyKey}</p>
                <span className={statusBadgeClass(row.competencyStatus)}>
                  {statusLabel(row.competencyStatus)}
                </span>
              </div>
              <dl className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${labelClass}`}>
                <div>
                  <dt>Readiness band</dt>
                  <dd className={`mt-0.5 ${valueClass}`}>{row.readinessBand ?? "—"}</dd>
                </div>
                <div>
                  <dt>Certification level</dt>
                  <dd className={`mt-0.5 ${valueClass}`}>{row.certificationLevel ?? "—"}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd className={`mt-0.5 ${valueClass}`}>{formatIsoDate(row.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Last verified</dt>
                  <dd className={`mt-0.5 ${valueClass}`}>
                    {formatIsoDateTime(row.lastVerifiedAt)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
