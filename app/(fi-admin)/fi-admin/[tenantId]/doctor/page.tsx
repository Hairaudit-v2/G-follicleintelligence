import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { assertBookingsOperatorPageAccess, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadDoctorWorkspace } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";

import { DoctorWorkspaceHome } from "@/src/components/fi-admin/doctor-workspace/DoctorWorkspaceHome";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  return {
    title: `Doctor workspace · ${tenantId.slice(0, 8)}…`,
    robots: { index: false, follow: false },
  };
}

export default async function DoctorWorkspacePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="p-6 text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const session = await assertBookingsOperatorPageAccess(tid);
  const [includeCrmTasks] = await Promise.all([getCrmShellNavAllowed(tid)]);

  let bundle;
  try {
    bundle = await loadDoctorWorkspace(tid, {
      viewerFiUserId: session.fiUserId,
      includeCrmTasks,
    });
  } catch {
    redirect(`/fi-admin/${tid}`);
  }

  const base = `/fi-admin/${tid}`;
  return <DoctorWorkspaceHome bundle={bundle} base={base} />;
}
