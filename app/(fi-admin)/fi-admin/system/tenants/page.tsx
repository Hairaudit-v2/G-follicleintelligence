import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function SystemTenantsPage() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_tenants").select("id, name, slug").order("name");
  if (error) {
    return <p className="text-sm text-red-400">Could not load tenants: {error.message}</p>;
  }
  const rows = (data ?? []) as { id: string; name: string; slug: string }[];
  return (
    <div className="space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Directory</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Tenants</h1>
        <p className="mt-1 text-sm text-slate-500">All workspaces in this environment.</p>
      </div>
      <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium text-slate-100">{t.name}</p>
              <p className="font-mono text-xs text-slate-500">{t.slug}</p>
            </div>
            <Link href={`/fi-admin/${t.id}`} className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
              Open tenant →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
