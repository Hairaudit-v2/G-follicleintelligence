import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { resolveProvisioningStatusBadge } from "@/src/lib/onboarding-os/tenantProvisioningCore";
import { loadTenantProvisioningSessions } from "@/src/lib/onboarding-os/tenantProvisioning.server";
import type { ProvisioningSessionStatus } from "@/src/lib/onboarding-os/tenantProvisioningTypes";

export const dynamic = "force-dynamic";

const BADGE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-500/15 text-slate-300",
  info: "bg-cyan-500/15 text-cyan-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
};

export default async function OnboardingOsListPage() {
  const loaded = await loadTenantProvisioningSessions();
  if (!loaded.ok) {
    return (
      <p className="text-sm text-red-400">Could not load provisioning sessions: {loaded.error}</p>
    );
  }

  const sessions = loaded.sessions;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase A</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Tenant provisioning</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Start and track FI OS clinic onboarding sessions. All writes run server-side via the
            service role — no unsafe public database access.
          </p>
        </div>
        <Link
          href="/fi-admin/platform/onboarding/new"
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          New session
        </Link>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-200">Sessions ({sessions.length})</h2>
        {sessions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No provisioning sessions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
            {sessions.map((s) => {
              const badge = resolveProvisioningStatusBadge(s.status as ProvisioningSessionStatus);
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-100">{s.tenant_name}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono">{s.tenant_slug}</span>
                      <span className="text-slate-600"> · {s.created_at.slice(0, 10)}</span>
                      <span className="text-slate-600"> · {s.progress_percent}%</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[badge.tone] ?? BADGE_CLASSES.neutral}`}
                    >
                      {badge.label}
                    </span>
                    <Link
                      href={`/fi-admin/platform/onboarding/${s.id}`}
                      className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
                    >
                      Open →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
