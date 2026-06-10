import Link from "next/link";

import { ClinicSetupWizard } from "@/src/components/fi-admin/settings/ClinicSetupWizard";
import { loadClinicsForTenant } from "@/src/lib/taxLocalisation/taxLocalisationSettings.server";

export const metadata = {
  title: "Clinic setup",
};

export default async function ClinicSetupPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId.trim();
  const clinics = await loadClinicsForTenant(tid);

  if (!clinics.length) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 pb-10 pt-2 sm:px-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-5 shadow-lg shadow-black/25 backdrop-blur-md">
          <h1 className="text-lg font-semibold text-slate-50">Clinic setup</h1>
          <p className="mt-2 text-sm text-slate-400">
            Add a clinic site under Configuration before running the setup wizard.
          </p>
          <Link
            href={`/fi-admin/${tid}/configuration`}
            className="mt-4 inline-block text-sm font-medium text-cyan-300 hover:text-cyan-200"
          >
            Go to Configuration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 pb-10 pt-2 sm:px-4">
      <ClinicSetupWizard
        tenantId={tid}
        clinics={clinics.map((c) => ({ id: c.id, displayName: c.displayName }))}
      />
    </div>
  );
}
