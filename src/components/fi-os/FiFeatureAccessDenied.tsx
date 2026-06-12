"use client";

import Link from "next/link";

import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { FI_FEATURE_REGISTRY } from "@/src/config/fiFeatureAccessRegistry";

const cardClass =
  "mx-auto max-w-lg rounded-2xl border border-white/[0.08] bg-[#0F1629]/90 p-6 shadow-xl shadow-black/40 backdrop-blur-md";

export function FiFeatureAccessDenied({
  tenantId,
  featureKey,
}: {
  tenantId: string;
  featureKey: FiFeatureKey | null;
}) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const label = featureKey ? FI_FEATURE_REGISTRY[featureKey]?.label ?? featureKey : "this area";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-10">
      <div className={cardClass}>
        <h1 className="text-lg font-semibold tracking-tight text-[#F8FAFC]">Focused workspace</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">This workspace is focused on other workflows.</p>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
          You do not currently have <span className="text-[#E2E8F0]">{label}</span> in your workspace.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
          If you need this for your role, ask an FI OS administrator to update your access.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={base}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500"
          >
            Back to dashboard
          </Link>
          <Link
            href={base}
            className="inline-flex items-center justify-center rounded-lg border border-white/[0.12] bg-[#081020]/80 px-3 py-2 text-xs font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35"
          >
            Open My Workspace
          </Link>
        </div>
        <p className="mt-4 text-xs text-[#64748B]">
          Request access: coming soon — for now, contact an FI OS administrator directly.
        </p>
      </div>
    </div>
  );
}
