import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function SystemAcademyPage() {
  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_staff_source_ids")
    .select("id", { count: "exact", head: true })
    .ilike("source_system", "%academy%");
  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-200">
          Academy linkage query is not available in this build ({error.message}).
        </p>
        <p className="text-xs text-slate-500">
          Staff source IDs remain the integration point for Academy snapshots.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>AcademyOS</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Academy</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Academy-linked staff source rows: <strong className="text-slate-200">{count ?? 0}</strong>{" "}
          (<code className="text-xs text-slate-300">fi_staff_source_ids</code> where{" "}
          <code className="text-xs text-slate-300">source_system</code> matches Academy / IIOHR
          Academy). Use Staff Twin in each tenant for operational snapshots.
        </p>
      </div>
      <p className="text-sm text-slate-500">
        Open a tenant&apos;s{" "}
        <Link
          className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
          href="/fi-admin/system/staff"
        >
          staff directory
        </Link>{" "}
        and staff twin for operational detail.
      </p>
    </div>
  );
}
