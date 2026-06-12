"use client";

import { FI_WORKSPACE_PROFILES } from "@/src/config/fiWorkspaceProfiles";
import type { StaffIntelligenceViewModel } from "@/src/lib/fi-os/staffIntelligence.server";

function severityStyles(sev: string): string {
  if (sev === "critical") return "border-amber-700/50 bg-amber-950/30 text-amber-100";
  if (sev === "attention") return "border-cyan-700/40 bg-cyan-950/25 text-cyan-50";
  return "border-white/[0.08] bg-slate-900/40 text-slate-200";
}

export function StaffOrganisationalIntelligencePanel(props: { intel: StaffIntelligenceViewModel }) {
  const { intel } = props;
  const profileLabel = FI_WORKSPACE_PROFILES[intel.workspaceProfileHint]?.label ?? intel.workspaceProfileHint;

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h3 className="text-sm font-semibold text-gray-900">Organisational intelligence</h3>
      <p className="mt-1 text-xs text-gray-600">
        Support-oriented signals for managers. This view does not change permissions, workspace layout, or feature access.
      </p>

      <dl className="mt-3 grid gap-2 text-xs text-gray-700 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-500">Workspace profile (hint)</dt>
          <dd className="text-gray-900">{profileLabel}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Position type</dt>
          <dd className="text-gray-900">
            {intel.positionTypeTitle ? `${intel.positionTypeTitle} (${intel.positionTypeCode ?? "—"})` : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Feature template</dt>
          <dd className="text-gray-900">{intel.featureTemplateKey ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Last profile snapshot</dt>
          <dd className="text-gray-900">
            {intel.latestProfile
              ? `${new Date(intel.latestProfile.computed_at).toLocaleString()} (${intel.latestProfile.visibility_scope})`
              : "No saved profile row yet"}
          </dd>
        </div>
      </dl>

      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">Signal cards</h4>
      <ul className="mt-2 space-y-2">
        {intel.signalCards.map((s) => (
          <li
            key={s.key}
            className={`rounded border px-3 py-2 text-xs ${severityStyles(s.severity)}`}
          >
            <p className="font-semibold">
              {s.label} · <span className="font-normal opacity-90">count {s.count}</span>
            </p>
            <p className="mt-1 opacity-90">{s.description}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide opacity-70">
              Visibility: {s.visibility_level.replace(/_/g, " ")}
            </p>
          </li>
        ))}
      </ul>

      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">Recommended next steps</h4>
      {intel.recommendations.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">No additional recommendations from current signals.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {intel.recommendations.map((r) => (
            <li key={r.id} className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800">
              <p className="font-semibold text-gray-900">{r.title}</p>
              <p className="mt-1 text-gray-700">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
