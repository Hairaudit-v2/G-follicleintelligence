"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tenant = { id: string; name: string; slug: string };

export default function FiAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTenants(d.tenants ?? []);
        else setError(d.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading tenants…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (tenants.length === 0)
    return (
      <p className="text-gray-500">
        No tenants. Create one via SQL: insert into fi_tenants (name, slug) values ({"'"}Demo{"'"}, {"'"}demo{"'"});
      </p>
    );

  return (
    <div className="space-y-4">
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
