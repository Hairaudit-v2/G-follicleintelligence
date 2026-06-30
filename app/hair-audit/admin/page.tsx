import type { Metadata } from "next";
import Link from "next/link";

import { fiOsSignOutAction } from "@/lib/actions/fi-os-auth-actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertHairAuditOsAdminAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata: Metadata = {
  title: "HairAudit — OS administrator",
  robots: { index: false, follow: false },
};

export default async function HairAuditOsAdminPage() {
  await assertHairAuditOsAdminAccess();

  const supabase = supabaseAdmin();
  const { data: tenants, error } = await supabase
    .from("fi_tenants")
    .select("id, name, slug")
    .order("name");

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-rose-300">Could not load tenant directory.</p>
      </div>
    );
  }

  const rows = (tenants ?? []) as { id: string; name: string; slug: string }[];

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(1000px 500px at 10% 0%, rgba(52, 211, 153, 0.1), transparent 50%), linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-14">
        <header className="mb-10 border-b border-slate-700/80 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400/90">
            HairAudit
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Audit operating console</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Cross-clinic audit access for platform auditors. Open a tenant&apos;s audit queue to
            review submissions and reports.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-6 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Tenants</h2>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No tenants configured yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {rows.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/fi-admin/${t.id}/audit`}
                    className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-500/30 hover:bg-slate-900"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-slate-500">{t.slug}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
          <form action={fiOsSignOutAction}>
            <button type="submit" className="text-slate-500 hover:text-slate-400 hover:underline">
              Sign out
            </button>
          </form>
          <Link
            href="/follicle-intelligence/login"
            className="text-slate-500 hover:text-slate-400 hover:underline"
          >
            OS sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}
