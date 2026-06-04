import { Suspense } from "react";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FoundationDirectoryTools } from "@/src/components/fi/FoundationDirectoryTools";
import { FoundationSearchDirectory } from "@/src/components/fi/FoundationSearchDirectory";
import { searchFoundationRecords } from "@/src/lib/fi/foundation/search";
import type { FoundationSearchFilter } from "@/src/lib/fi/foundation/search";

export const dynamic = "force-dynamic";

function parseFilter(v: string | undefined): FoundationSearchFilter {
  const t = (v ?? "all").toLowerCase();
  if (t === "patients" || t === "cases" || t === "clinics" || t === "organisations") return t;
  return "all";
}

function parseLimit(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export default async function FoundationDirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: { q?: string; type?: string; limit?: string };
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const [result, orgListRes, clinicCountRes] = await Promise.all([
    searchFoundationRecords({
      tenantId,
      query: q.trim() ? q : null,
      type: parseFilter(searchParams.type),
      limit: parseLimit(searchParams.limit),
    }),
    supabase.from("fi_organisations").select("id, name").eq("tenant_id", tenantId).order("name", { ascending: true }),
    supabase.from("fi_clinics").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  if (orgListRes.error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Could not load organisations for this tenant. Try again later.</p>
      </div>
    );
  }

  if (clinicCountRes.error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Could not load clinic counts for this tenant. Try again later.</p>
      </div>
    );
  }

  const organisations = (orgListRes.data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    name: String((r as { name: string }).name),
  }));
  const organisationCount = organisations.length;
  const clinicCount = clinicCountRes.count ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-gray-900">Directory</h1>
        <p className="mt-1 max-w-3xl text-xs text-gray-600">
          Search across foundation patients, cases, clinics, and organisations for this tenant. FI admins can create
          organisations and clinics below (service role + <code className="rounded bg-gray-100 px-1">FI_ADMIN_API_KEY</code>
          ); patient and case rows remain read-only here. Results link to universal patient and case records where
          applicable; clinics and organisations open as in-page anchors on this screen.
        </p>
      </div>
      <FoundationDirectoryTools
        tenantId={tenantId}
        organisations={organisations}
        organisationCount={organisationCount}
        clinicCount={clinicCount}
      />
      <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
        <FoundationSearchDirectory
          tenantId={tenantId}
          result={result}
          organisationCount={organisationCount}
          clinicCount={clinicCount}
        />
      </Suspense>
    </div>
  );
}
