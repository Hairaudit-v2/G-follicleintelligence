import Link from "next/link";

import type { ModuleAccessDenialReason } from "@/src/lib/platform/entitlements/entitlementTypes";
import { moduleAccessDenialMessage } from "@/src/lib/platform/entitlements/modules";

const cardClass =
  "mx-auto max-w-lg rounded-2xl border border-white/[0.08] bg-[#0F1629]/90 p-6 shadow-xl shadow-black/40 backdrop-blur-md";

type DeniedCopy = {
  title: string;
  body: string;
};

const DENIED_COPY: Partial<Record<ModuleAccessDenialReason, DeniedCopy>> = {
  tenant_unverified: {
    title: "Clinic not activated",
    body: "This clinic workspace is not yet activated for paid add-on modules. Contact Follicle Intelligence support to complete activation.",
  },
  module_disabled: {
    title: "Module not enabled",
    body: "HR OS is not enabled for this clinic workspace. Ask a clinic owner or administrator to request access.",
  },
  billing_inactive: {
    title: "Subscription inactive",
    body: "HR OS is not available on your current plan. Ask a clinic owner or administrator to review your subscription.",
  },
  role_not_allowed: {
    title: "Insufficient role",
    body: "Your role does not include access to HR OS. Ask a clinic owner or administrator to update your permissions.",
  },
};

function resolveDeniedCopy(reason: ModuleAccessDenialReason, moduleLabel: string): DeniedCopy {
  const specific = DENIED_COPY[reason];
  if (specific) return specific;

  return {
    title: "Access unavailable",
    body: moduleAccessDenialMessage(reason) || `${moduleLabel} is not available for your account.`,
  };
}

export function FiModuleAccessDenied({
  tenantId,
  moduleLabel = "HR OS",
  reason,
  platformAdminPreview = false,
}: {
  tenantId: string;
  moduleLabel?: string;
  reason: ModuleAccessDenialReason;
  platformAdminPreview?: boolean;
}) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const copy = resolveDeniedCopy(reason, moduleLabel);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-10">
      <div className={cardClass}>
        <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{moduleLabel}</p>
        <h1 className="mt-2 text-lg font-semibold tracking-tight text-[#F8FAFC]">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{copy.body}</p>
        {platformAdminPreview ? (
          <p className="mt-2 text-xs text-[#64748B]">
            Platform operator preview is not available for this denial state.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={base}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500"
          >
            Back to Today
          </Link>
          <Link
            href={base}
            className="inline-flex items-center justify-center rounded-lg border border-white/[0.12] bg-[#081020]/80 px-3 py-2 text-xs font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35"
          >
            Open My Workspace
          </Link>
        </div>
        <p className="mt-4 text-xs text-[#64748B]">
          Need help? Contact your clinic administrator or Follicle Intelligence support.
        </p>
      </div>
    </div>
  );
}
