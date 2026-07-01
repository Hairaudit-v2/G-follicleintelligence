import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ImagingClinicalReviewQueue } from "@/src/components/fi-admin/imaging/ImagingClinicalReviewQueue";
import { ImagingClinicalReviewQueueFilters } from "@/src/components/fi-admin/imaging/ImagingClinicalReviewQueueFilters";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { parseImagingReviewQueueFiltersFromSearchParams } from "@/src/lib/imaging-os/imagingClinicalReviewQueueFilters";
import {
  attachReviewerLabelsToQueueItems,
  loadImagingClinicalReviewQueue,
} from "@/src/lib/imaging-os/imagingClinicalReviewQueue.server";
import { loadImagingReviewerDirectoryForTenant } from "@/src/lib/imaging-os/imagingReviewerDirectoryLoader.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  return {
    title: `Imaging review · ${tenantId.trim().slice(0, 8)}`,
    robots: { index: false, follow: false },
  };
}

export default async function ImagingClinicalReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") urlParams.set(key, value);
    else if (Array.isArray(value) && value[0]) urlParams.set(key, value[0]);
  }
  const filters = parseImagingReviewQueueFiltersFromSearchParams(urlParams);
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccessUnlessStaffPinSession(tid);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  const [rawItems, reviewers] = await Promise.all([
    loadImagingClinicalReviewQueue(tid, undefined, 100, filters),
    loadImagingReviewerDirectoryForTenant(tid).catch(() => []),
  ]);
  const labelByUserId = new Map(reviewers.map((r) => [r.fi_user_id, r.display_name]));
  const items = attachReviewerLabelsToQueueItems(rawItems, labelByUserId);

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
          Clinical image review queue
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Staff-facing queue for low-confidence classifications, quality flags, missing scalp regions,
          failed analysis, and assessment items requiring review. No patient-facing diagnostic
          claims.
        </p>
      </header>

      <ImagingClinicalReviewQueueFilters tenantId={tid} reviewers={reviewers} />
      <ImagingClinicalReviewQueue tenantId={tid} items={items} reviewers={reviewers} />
    </div>
  );
}