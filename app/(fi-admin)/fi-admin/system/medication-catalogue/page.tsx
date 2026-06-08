import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function SystemMedicationCataloguePage() {
  const supabase = supabaseAdmin();
  const { data: cat, error: e1 } = await supabase
    .from("fi_medication_catalogue")
    .select("id, tenant_id, medication_name, active")
    .order("medication_name")
    .limit(400);
  if (e1) {
    return <p className="text-sm text-red-400">Could not load catalogue: {e1.message}</p>;
  }
  const rows = (cat ?? []) as { id: string; tenant_id: string; medication_name: string; active: boolean | null }[];
  const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id)));
  const names = new Map<string, string>();
  if (tenantIds.length) {
    const { data: tenants } = await supabase.from("fi_tenants").select("id, name").in("id", tenantIds);
    for (const t of (tenants ?? []) as { id: string; name: string }[]) {
      names.set(String(t.id), String(t.name ?? ""));
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Prescribing</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Medication catalogue</h1>
        <p className="mt-1 text-sm text-slate-500">Cross-tenant view (first 400 rows). Editing remains per-tenant in ClinicOS.</p>
      </div>
      <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-100">{r.medication_name}</p>
              <p className="text-xs text-slate-500">
                {names.get(r.tenant_id) || "Tenant"} · {r.active === false ? "inactive" : "active"}
              </p>
            </div>
            <Link href={`/fi-admin/${r.tenant_id}/prescriptions/new`} className="text-xs font-medium text-cyan-400 hover:text-cyan-300">
              Tenant Rx →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
