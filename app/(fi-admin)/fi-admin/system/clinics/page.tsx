import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function SystemClinicsPage() {
  const supabase = supabaseAdmin();
  const { data: clinics, error: e1 } = await supabase
    .from("fi_clinics")
    .select("id, tenant_id, display_name")
    .order("display_name")
    .limit(500);
  if (e1) {
    return <p className="text-sm text-red-400">Could not load clinics: {e1.message}</p>;
  }
  const rows = (clinics ?? []) as { id: string; tenant_id: string; display_name: string | null }[];
  const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id).filter(Boolean)));
  const tenantNameById = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenants, error: e2 } = await supabase
      .from("fi_tenants")
      .select("id, name")
      .in("id", tenantIds);
    if (!e2 && tenants) {
      for (const t of tenants as { id: string; name: string }[]) {
        tenantNameById.set(String(t.id), String(t.name ?? ""));
      }
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Directory</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Clinics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Clinic rows across tenants (first 500 by display name).
        </p>
      </div>
      <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium text-slate-100">{c.display_name?.trim() || "Clinic"}</p>
              <p className="text-xs text-slate-500">
                {tenantNameById.get(c.tenant_id) || "Tenant"} ·{" "}
                <span className="font-mono">{c.tenant_id.slice(0, 8)}…</span>
              </p>
            </div>
            <Link
              href={`/fi-admin/${c.tenant_id}`}
              className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
            >
              Tenant home →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
