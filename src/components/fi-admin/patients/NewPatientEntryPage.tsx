import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DirectPatientCreateClient } from "@/src/components/fi-admin/patients/DirectPatientCreateClient";

type NewPatientEntryPageProps = {
  tenantId: string;
};

export function NewPatientEntryPage({ tenantId }: NewPatientEntryPageProps) {
  const base = `/fi-admin/${tenantId.trim()}`;

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-xl">
        <Link
          href={`${base}/patients`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to patients
        </Link>
      </div>
      <DirectPatientCreateClient tenantId={tenantId} />
    </div>
  );
}
