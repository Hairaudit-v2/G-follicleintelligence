import Link from "next/link";

import { PlatformTenantsClient } from "@/src/components/fi-admin/system/PlatformTenantsClient";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function SystemTenantsPage() {
  const supabase = supabaseAdmin();
  const { data: tenants, error } = await supabase
    .from("fi_tenants")
    .select("id, name, slug, created_at")
    .order("name")
    .limit(500);
  if (error) {
    return <p className="text-sm text-red-400">Could not load tenants: {error.message}</p>;
  }
  const rows = (tenants ?? []) as {
    id: string;
    name: string;
    slug: string;
    created_at: string | null;
  }[];

  return (
    <div className="space-y-8">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Platform</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Tenant management</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Create tenants, default clinics, tenant settings, and the first clinic admin user. All
          mutations run on the server; the browser never receives a service-role key.
        </p>
      </div>

      <PlatformTenantsClient />

      <div>
        <h2 className="text-sm font-semibold text-slate-200">All tenants ({rows.length})</h2>
        <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium text-slate-100">{t.name}</p>
                <p className="text-xs text-slate-500">
                  <span className="font-mono">{t.slug}</span>
                  {t.created_at ? (
                    <span className="text-slate-600"> · {t.created_at.slice(0, 10)}</span>
                  ) : null}
                </p>
              </div>
              <Link
                href={`/fi-admin/${t.id}`}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                Tenant home →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
