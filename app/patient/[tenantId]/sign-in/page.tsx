import Link from "next/link";
import { redirect } from "next/navigation";

import { PatientPortalSignInForm } from "@/src/components/patient-portal/PatientPortalSignInForm";
import { resolvePatientPortalAccess } from "@/src/lib/patientPortal/patientPortalAccess.server";

export const metadata = {
  title: "Patient sign in",
  robots: { index: false, follow: false },
};

function pickString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function PatientPortalSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) redirect("/");

  const access = await resolvePatientPortalAccess(tid);
  const returnPath = `/patient/${tid}/medications`;
  const errorCode = pickString(searchParams.error);

  if (access.status === "linked") {
    redirect(returnPath);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/90">
          Patient portal
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Sign in</h1>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-6 shadow-xl">
        <PatientPortalSignInForm
          tenantId={tid}
          clinicName={access.clinicName}
          returnPath={returnPath}
          errorCode={errorCode}
        />
      </div>
      <p className="text-center text-xs text-slate-500">
        <Link href="/contact" className="text-slate-400 hover:text-slate-300 hover:underline">
          Need help getting access?
        </Link>
      </p>
    </div>
  );
}
