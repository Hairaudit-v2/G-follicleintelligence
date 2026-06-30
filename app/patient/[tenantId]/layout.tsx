import Link from "next/link";

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

  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a1424]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href={`${base}/medications`} className="text-sm font-semibold text-slate-100 transition hover:text-cyan-300">
            My medications
          </Link>
          <p className="text-xs text-slate-400">DoctorOS · Patient portal</p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  );
}
