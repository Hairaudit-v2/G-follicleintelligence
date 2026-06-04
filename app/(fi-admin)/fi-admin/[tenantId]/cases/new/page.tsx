import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FirstCaseWizardClient } from "@/src/components/fi-admin/cases/FirstCaseWizardClient";

export const metadata = {
  title: "New case",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FirstCaseWizardPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const { data: clinicRows, error: ce } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tenantId)
    .order("display_name", { ascending: true });

  if (ce) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <p className="text-sm text-red-600">Could not load clinics for this tenant.</p>
        <Link href={`/fi-admin/${tenantId}/cases`} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          Back to cases
        </Link>
      </div>
    );
  }

  const clinics = (clinicRows ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    display_name: String((r as { display_name: string }).display_name),
  }));

  return <FirstCaseWizardClient tenantId={tenantId} clinics={clinics} />;
}
