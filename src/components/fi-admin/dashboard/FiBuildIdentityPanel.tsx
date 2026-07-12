import "server-only";

import { isPipelineV1EnabledForTenant } from "@/src/lib/crm/pipelineRollout.server";
import {
  pickBuildEnvironment,
  pickBuildSha,
  shortBuildSha,
  type FiBuildIdentity,
} from "@/src/lib/fi-os/buildIdentity";

/**
 * Platform-admin-only deployed build marker. Rendered inside System diagnostics —
 * never in normal staff chrome. Confirms the running build's SHA, environment, and
 * per-tenant Pipeline rollout so a stale deploy can be ruled out at a glance.
 */
export async function FiBuildIdentityPanel({ tenantId }: { tenantId: string }) {
  const identity: FiBuildIdentity = {
    sha: pickBuildSha(process.env),
    environment: pickBuildEnvironment(process.env),
    pipelineRolloutEnabled: await isPipelineV1EnabledForTenant(tenantId),
  };

  const rows: Array<{ label: string; value: string }> = [
    { label: "Build", value: shortBuildSha(identity.sha) },
    { label: "Environment", value: identity.environment ?? "unknown" },
    {
      label: "Pipeline rollout",
      value: identity.pipelineRolloutEnabled ? "enabled" : "disabled",
    },
  ];

  return (
    <section
      className="rounded-xl border border-white/[0.07] bg-[#0c1426]/50 p-4 sm:p-5"
      aria-labelledby="fi-build-identity-heading"
      data-fi-build-identity="true"
    >
      <h3
        id="fi-build-identity-heading"
        className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
      >
        Deployed build
      </h3>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-slate-500">{r.label}</dt>
            <dd className="font-mono text-slate-200">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
