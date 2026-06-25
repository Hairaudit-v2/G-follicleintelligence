import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";

import { ImagingOsWorkspace } from "@/src/components/fi-admin/imaging/ImagingOsWorkspace";
import { loadImagingOsPatientPayload } from "@/src/lib/imagingOs/imagingOsLoad.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}): Promise<Metadata> {
  const { patientId } = await params;
  const name = patientId.trim().slice(0, 8);
  return {
    title: `ImagingOS · ${name}`,
    robots: { index: false, follow: false },
  };
}

export default async function ImagingOsPatientPage({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}) {
  const { tenantId, patientId } = await params;
  const tid = tenantId?.trim();
  const pid = patientId?.trim();
  if (!tid || !pid) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const initial = await loadImagingOsPatientPayload(tid, pid);
  const profileHref = `/fi-admin/${tid}/patients/${pid}`;

  return (
    <div className="mx-auto max-w-6xl space-y-5 py-6">
      <Link
        href={profileHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to patient profile
      </Link>

      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">ImagingOS</p>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Clinical imaging workspace</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Longitudinal image library, photography protocols, scalp mapping, annotations, compare modes, and AI-ready job
          hooks — all tenant-scoped and linked to this foundation patient for Patient Twin and AuditOS.
        </p>
      </header>

      <Suspense fallback={<div className="h-48 animate-pulse rounded border border-gray-200 bg-white" aria-hidden />}>
        <ImagingOsWorkspace tenantId={tid} patientId={pid} initial={initial} />
      </Suspense>
    </div>
  );
}
