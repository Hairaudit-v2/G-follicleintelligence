"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tenant = { id: string; name: string; slug: string };

type TenantsJson =
  | { ok: true; tenants?: Tenant[]; devTenantListFallback?: boolean }
  | { ok: false; error?: string; code?: string };

export default function FiAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devTenantListFallback, setDevTenantListFallback] = useState(false);

  useEffect(() => {
    fetch("/api/tenants")
      .then(async (r) => {
        const d = (await r.json()) as TenantsJson;
        if (!r.ok || !d.ok) {
          const msg =
            !d.ok && "error" in d && d.error
              ? d.error
              : `Request failed (${r.status})`;
          setError(msg);
          setTenants([]);
          setDevTenantListFallback(false);
          return;
        }
        setTenants(d.tenants ?? []);
        setDevTenantListFallback(Boolean(d.devTenantListFallback));
        setError(null);
      })
      .catch(() => {
        setError("Failed to load");
        setTenants([]);
        setDevTenantListFallback(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading tenants…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (tenants.length === 0)
    return (
      <div className="space-y-3">
        {devTenantListFallback ? (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <strong>Development access:</strong> no authenticated FI user session.
          </div>
        ) : null}
        {devTenantListFallback ? (
          <p className="text-gray-500">
            No rows in <code className="rounded bg-gray-100 px-1 text-xs">fi_tenants</code>. Create one via SQL: insert
            into fi_tenants (name, slug) values (&apos;Demo&apos;, &apos;demo&apos;);
          </p>
        ) : (
          <p className="text-gray-500">
            No tenants linked to your account. Ask an administrator to add your Supabase Auth user to{" "}
            <code className="rounded bg-gray-100 px-1 text-xs">fi_users</code> for a tenant, or for local development
            without login see <code className="text-xs">docs/dev-local-fi-admin.md</code> (
            <code className="text-xs">FI_ENABLE_DEV_ADMIN_ACCESS=true</code>).
          </p>
        )}
      </div>
    );

  return (
    <div className="space-y-4">
      {devTenantListFallback ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong>Development access:</strong> no authenticated FI user session. Listing all rows from{" "}
          <code className="text-xs">fi_tenants</code> because <code className="text-xs">FI_ENABLE_DEV_ADMIN_ACCESS=true</code>{" "}
          and <code className="text-xs">NODE_ENV</code> is not production. Sign in to use tenant-scoped membership instead.
        </div>
      ) : null}
      <h2 className="text-base font-medium">Select tenant</h2>
      <ul className="flex flex-wrap gap-2">
        {tenants.map((t) => (
          <li key={t.id}>
            <Link
              href={`/fi-admin/${t.id}/cases`}
              className="inline-block rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              {t.name} ({t.slug})
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
