import Link from "next/link";

import { resolvePatientPortalAccess } from "@/src/lib/patientPortal/patientPortalAccess.server";

export const metadata = {
  title: "Patient portal",
  robots: { index: false, follow: false },
};

export default async function PatientPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId.trim();
  const base = `/patient/${tid}`;
  const access = await resolvePatientPortalAccess(tid);

  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a1424]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link
            href={`${base}/medications`}
            className="text-sm font-semibold text-slate-100 transition hover:text-cyan-300"
          >
            {access.clinicName ? `${access.clinicName} · Medications` : "My medications"}
          </Link>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {access.status === "unauthenticated" ? (
              <Link
                href={`${base}/sign-in`}
                className="font-medium text-cyan-300 transition hover:text-cyan-200"
              >
                Sign in
              </Link>
            ) : (
              <span>{access.status === "linked" ? "Signed in" : "Account not linked"}</span>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  );
}
