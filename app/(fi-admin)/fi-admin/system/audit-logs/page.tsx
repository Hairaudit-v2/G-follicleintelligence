import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function SystemAuditLogsPage() {
  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_os_impersonation_sessions")
    .select("id", { count: "exact", head: true });
  if (error) {
    return <p className="text-sm text-red-400">Could not load impersonation audit: {error.message}</p>;
  }
  const { data: tenants } = await supabase.from("fi_tenants").select("id, name").order("name");
  const trows = (tenants ?? []) as { id: string; name: string }[];
  return (
    <div className="space-y-6">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Audit</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Audit logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Platform impersonation sessions recorded in <code className="text-xs text-slate-400">fi_os_impersonation_sessions</code> (
          {count ?? 0} rows). Tenant AuditOS and HairAudit remain the operational review surfaces.
        </p>
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4">
        <p className="text-sm font-semibold text-slate-100">HairAudit OS</p>
        <p className="mt-1 text-xs text-slate-500">HairAudit platform queue and evidence.</p>
        <Link href="/hair-audit/admin" className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300">
          Open HairAudit admin →
        </Link>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-200">Tenant AuditOS</p>
        <ul className="mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
          {trows.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-slate-200">{t.name}</span>
              <Link href={`/fi-admin/${t.id}/audit`} className="text-xs font-medium text-cyan-400 hover:text-cyan-300">
                AuditOS →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
