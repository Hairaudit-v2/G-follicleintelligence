import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ImagingAiReviewOpsPanel } from "@/src/components/fi-admin/imaging/ImagingAiReviewOpsPanel";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadImagingAiReviewOpsHealth } from "@/src/lib/imaging-os/imagingAiReviewOps.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  return {
    title: `AI review ops · ${tenantId.trim().slice(0, 8)}`,
    robots: { index: false, follow: false },
  };
}

export default async function ImagingAiReviewOpsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccessUnlessStaffPinSession(tid);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  const health = await loadImagingAiReviewOpsHealth({ tenantId: tid });

  return (
    <div className="mx-auto max-w-6xl space-y-5 py-6">
      <Link
        href={`/fi-admin/${tid}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-100"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to tenant home
      </Link>

      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
          ImagingOS
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          AI review operations
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Operator-safe monitoring for ImagingOS AI jobs. Replay actions supersede pending or failed
          work and never overwrite staff-reviewed graft-tray decisions.
        </p>
        <p className="text-xs text-slate-500">
          <Link
            href={`/fi-admin/${tid}/imaging/review`}
            className="text-violet-300 hover:underline"
          >
            Clinical review queue
          </Link>
        </p>
      </header>

      <ImagingAiReviewOpsPanel tenantId={tid} health={health} />
    </div>
  );
}
