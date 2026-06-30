import type {
  FiStaffProcedurePrivilegeRow,
  PrivilegeStatus,
  PrivilegeWarningCode,
} from "@/src/lib/academy-os/procedurePrivilegeTypes";
import {
  privilegeLevelLabel,
  privilegeStatusLabel,
  procedureKeyLabel,
} from "@/src/lib/academy-os/procedurePrivilegeTypes";
import type { ProcedurePrivilegeSuggestionResult } from "@/src/lib/academy-os/procedurePrivilegeSuggestionEngine";

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { dateStyle: "medium" });
}

function statusBadgeClass(status: PrivilegeStatus | string): string {
  const base = "rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  switch (status) {
    case "expired":
    case "revoked":
      return `${base} border-rose-500/45 bg-rose-500/15 text-rose-100`;
    case "suspended":
    case "pending_review":
      return `${base} border-amber-500/45 bg-amber-500/15 text-amber-50`;
    default:
      return `${base} border-emerald-500/40 bg-emerald-500/12 text-emerald-100`;
  }
}

function warningLabel(code: PrivilegeWarningCode): string {
  switch (code) {
    case "privilege_expiring_soon":
      return "Privilege expiring within 30 days";
    case "review_due_soon":
      return "Privilege review due soon";
    case "clinic_specific_required":
      return "Clinic-specific privilege may be required";
    case "tenant_wide_fallback_used":
      return "Using tenant-wide privilege fallback";
    case "no_privilege_requirement_configured":
      return "No privilege requirement configured";
    default:
      return String(code).replace(/_/g, " ");
  }
}

type StaffProcedurePrivilegePanelProps = {
  privileges: FiStaffProcedurePrivilegeRow[];
  suggestions: ProcedurePrivilegeSuggestionResult[];
  variant?: "light" | "dark";
};

export function StaffProcedurePrivilegePanel({
  privileges,
  suggestions,
  variant = "light",
}: StaffProcedurePrivilegePanelProps) {
  const isDark = variant === "dark";
  const titleClass = isDark ? "text-[#F8FAFC]" : "text-slate-100";
  const mutedClass = isDark ? "text-[#94A3B8]" : "text-slate-400";
  const labelClass = isDark ? "text-[#64748B]" : "text-slate-500";
  const valueClass = isDark ? "text-[#E2E8F0]" : "text-slate-200";
  const rowClass = isDark
    ? "rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
    : "rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3";

  const novelSuggestions = suggestions.flatMap((s) =>
    s.suggestedPrivileges.map((item) => ({
      ...item,
      sourceProjectionId: s.sourceProjectionId,
      bundleReason: s.reason,
    }))
  );

  return (
    <div>
      <h2 className={`text-lg font-semibold ${titleClass}`}>Procedure Privileges</h2>
      <p className={`mt-1 text-sm ${mutedClass}`}>
        AcademyOS operational authorization — what this clinic permits the staff member to perform or assist.
        Distinct from IIOHR certifications.
      </p>

      {privileges.length === 0 ? (
        <p className={`mt-4 text-sm ${mutedClass}`}>
          No operational procedure privileges granted yet. Privileges are clinic authorization records, not LMS
          certifications.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {privileges.map((row) => (
            <li key={row.id} className={rowClass}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className={`font-mono text-sm font-medium ${valueClass}`}>{procedureKeyLabel(row.procedureKey)}</p>
                  <p className={`mt-0.5 text-xs ${mutedClass}`}>{privilegeLevelLabel(row.privilegeLevel)}</p>
                </div>
                <span className={statusBadgeClass(row.privilegeStatus)}>
                  {privilegeStatusLabel(row.privilegeStatus)}
                </span>
              </div>
              <dl className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${labelClass}`}>
                <div>
                  <dt>Clinic scope</dt>
                  <dd className={`mt-0.5 ${valueClass}`}>{row.clinicId ? "Clinic-specific" : "Tenant-wide"}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd className={`mt-0.5 ${valueClass}`}>{formatIsoDate(row.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd className={`mt-0.5 ${valueClass}`}>{row.sourceSystem.replace(/_/g, " ")}</dd>
                </div>
                <div>
                  <dt>Source projection</dt>
                  <dd className={`mt-0.5 font-mono text-[11px] ${valueClass}`}>
                    {row.sourceProjectionId ?? "—"}
                  </dd>
                </div>
              </dl>
              {row.restrictionReason ? (
                <p className="mt-2 text-xs text-amber-200">{row.restrictionReason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-white/10 pt-5">
        <h3 className={`text-sm font-semibold ${titleClass}`}>Suggested from IIOHR projections</h3>
        <p className={`mt-1 text-xs ${mutedClass}`}>
          Read-only suggestions — admin grant workflow coming in a later phase.
        </p>
        {novelSuggestions.length === 0 ? (
          <p className={`mt-3 text-sm ${mutedClass}`}>No new privilege suggestions from current competency projections.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {novelSuggestions.map((item, index) => (
              <li
                key={`${item.sourceProjectionId}-${item.procedureKey}-${item.privilegeLevel}-${index}`}
                className={rowClass}
              >
                <p className={`text-sm font-medium ${valueClass}`}>
                  {procedureKeyLabel(item.procedureKey)} · {privilegeLevelLabel(item.privilegeLevel)}
                </p>
                <p className={`mt-1 text-xs ${mutedClass}`}>{item.reason}</p>
                <p className={`mt-2 text-[10px] uppercase tracking-wider ${labelClass}`}>
                  Confirm grant — coming soon
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** @deprecated internal helper export for tests */
export { warningLabel as formatProcedurePrivilegeWarningLabel };
