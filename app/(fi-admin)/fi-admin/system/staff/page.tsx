import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function SystemStaffPage() {
  const supabase = supabaseAdmin();
  const { data: tenants, error: e1 } = await supabase.from("fi_tenants").select("id, name").order("name");
  if (e1) return <p className="text-sm text-red-400">Could not load tenants: {e1.message}</p>;
  const trows = (tenants ?? []) as { id: string; name: string }[];
  const counts = new Map<string, number>();
  const { data: staffAgg, error: e2 } = await supabase.from("fi_staff").select("tenant_id");
  if (!e2 && staffAgg) {
    for (const r of staffAgg as { tenant_id: string }[]) {
      const k = r.tenant_id;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>HR</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Staff</h1>
        <p className="mt-1 text-sm text-slate-500">Staff profile counts per tenant; open a tenant for directory and HR import.</p>
      </div>
      <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
        {trows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium text-slate-100">{t.name}</p>
              <p className="text-xs text-slate-500">{counts.get(t.id) ?? 0} staff profiles</p>
            </div>
            <Link href={`/fi-admin/${t.id}/staff`} className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
              Staff directory →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
