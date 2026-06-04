import { Suspense } from "react";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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
  const result = await searchFoundationRecords({
    tenantId,
    query: q.trim() ? q : null,
    type: parseFilter(searchParams.type),
    limit: parseLimit(searchParams.limit),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-gray-900">Directory</h1>
        <p className="mt-1 max-w-3xl text-xs text-gray-600">
          Read-only search across foundation patients, cases, clinics, and organisations for this tenant. Results
          link to universal patient and case records where applicable; clinics and organisations open as in-page
          anchors on this screen.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
        <FoundationSearchDirectory tenantId={tenantId} result={result} />
      </Suspense>
    </div>
  );
}
