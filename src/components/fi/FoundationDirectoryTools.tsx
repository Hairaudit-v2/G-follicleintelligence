"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createFiClinicAction,
  createFiOrganisationAction,
} from "@/lib/actions/fi-foundation-bootstrap-actions";
import type { OrganisationType } from "@/src/lib/fi/foundation/types";

const ORG_TYPE_OPTIONS: { value: OrganisationType; label: string }[] = [
  { value: "clinical_network", label: "Clinical network" },
  { value: "commercial_partner", label: "Commercial partner" },
  { value: "standards_program", label: "Standards program" },
  { value: "internal", label: "Internal" },
  { value: "other", label: "Other" },
];

function Feedback({ message, ok }: { message: string | null; ok: boolean | null }) {
  if (!message) return null;
  const cls = ok ? "text-green-800 bg-green-50 border-green-200" : "text-red-800 bg-red-50 border-red-200";
  return (
    <p role="status" className={`rounded border px-2 py-1.5 text-xs ${cls}`}>
      {message}
    </p>
  );
}

export type FoundationDirectoryOrgOption = { id: string; name: string };

export function FoundationDirectoryTools({
  tenantId,
  organisations,
  organisationCount,
  clinicCount,
}: {
  tenantId: string;
  organisations: FoundationDirectoryOrgOption[];
  organisationCount: number;
  clinicCount: number;
}) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [orgBusy, setOrgBusy] = useState(false);
  const [clinicBusy, setClinicBusy] = useState(false);
  const [orgMsg, setOrgMsg] = useState<string | null>(null);
  const [orgOk, setOrgOk] = useState<boolean | null>(null);
  const [clinicMsg, setClinicMsg] = useState<string | null>(null);
  const [clinicOk, setClinicOk] = useState<boolean | null>(null);

  const isBarren = organisationCount === 0 && clinicCount === 0;
  const hasOrgs = organisationCount > 0;

  async function onCreateOrganisation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOrgBusy(true);
    setOrgMsg(null);
    setOrgOk(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const slug = String(fd.get("slug") ?? "");
    const organisation_type = String(fd.get("organisation_type") ?? "");
    const res = await createFiOrganisationAction({
      adminKey,
      tenantId,
      name,
      slug,
      organisation_type,
    });
    setOrgBusy(false);
    if (res.ok) {
      setOrgOk(true);
      setOrgMsg("Organisation created. Opening configuration…");
      router.push(`/fi-admin/${tenantId}/configuration`);
    } else {
      setOrgOk(false);
      setOrgMsg(res.error);
    }
  }

  async function onCreateClinic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasOrgs) return;
    setClinicBusy(true);
    setClinicMsg(null);
    setClinicOk(null);
    const fd = new FormData(e.currentTarget);
    const display_name = String(fd.get("display_name") ?? "");
    const organisation_id = String(fd.get("organisation_id") ?? "").trim() || null;
    const res = await createFiClinicAction({
      adminKey,
      tenantId,
      display_name,
      organisation_id: organisation_id || undefined,
    });
    setClinicBusy(false);
    if (res.ok) {
      setClinicOk(true);
      setClinicMsg("Clinic created. Opening configuration…");
      router.push(`/fi-admin/${tenantId}/configuration`);
    } else {
      setClinicOk(false);
      setClinicMsg(res.error);
    }
  }

  return (
    <section id="foundation-tools" className="scroll-mt-4 space-y-4 rounded border border-gray-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-medium text-gray-900">Foundation records</h2>
        <p className="mt-1 max-w-3xl text-xs text-gray-600">
          Create <code className="rounded bg-gray-100 px-1">fi_organisations</code> and{" "}
          <code className="rounded bg-gray-100 px-1">fi_clinics</code> rows for this tenant. Requires the same{" "}
          <code className="rounded bg-gray-100 px-1">FI_ADMIN_API_KEY</code> as Configuration; all writes use the
          service role on the server only.
        </p>
      </div>

      {isBarren ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          This tenant has no organisations or clinics yet. Use{" "}
          <strong className="font-medium">Create organisation</strong> first, then{" "}
          <strong className="font-medium">Create clinic</strong>. After each step you will be taken to Configuration
          to finish branding and URLs.{" "}
          <Link href={`/fi-admin/${tenantId}/configuration`} className="font-medium text-amber-950 underline">
            Open configuration
          </Link>
        </p>
      ) : null}

      <label className="block max-w-md space-y-1">
        <span className="text-xs font-medium text-gray-700">FI Admin API key</span>
        <input
          type="password"
          value={adminKey}
          onChange={(ev) => setAdminKey(ev.target.value)}
          autoComplete="off"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Used for both actions below"
        />
      </label>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded border border-gray-100 bg-gray-50/80 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Create organisation</h3>
          <form className="space-y-2" onSubmit={onCreateOrganisation}>
            <label className="block space-y-1">
              <span className="text-xs text-gray-600">Name</span>
              <input
                name="name"
                required
                maxLength={200}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-600">Slug</span>
              <input
                name="slug"
                required
                maxLength={80}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Lowercase letters, digits, and hyphens only (e.g. evolved-perth)"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
                placeholder="e.g. evolved-perth"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-600">Type</span>
              <select name="organisation_type" required className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">Select…</option>
                {ORG_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={orgBusy}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {orgBusy ? "Creating…" : "Create organisation"}
            </button>
            <Feedback message={orgMsg} ok={orgOk} />
          </form>
        </div>

        <div className="space-y-3 rounded border border-gray-100 bg-gray-50/80 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Create clinic</h3>
          {!hasOrgs ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-950">
              Create an organisation first. Clinics can optionally link to an organisation for this tenant.
            </p>
          ) : null}
          <form className="space-y-2" onSubmit={onCreateClinic}>
            <label className="block space-y-1">
              <span className="text-xs text-gray-600">Display name</span>
              <input
                name="display_name"
                required
                maxLength={200}
                disabled={!hasOrgs}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-600">Organisation (recommended)</span>
              <select
                name="organisation_id"
                disabled={!hasOrgs}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
                defaultValue=""
              >
                <option value="">None (standalone clinic)</option>
                {organisations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={clinicBusy || !hasOrgs}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {clinicBusy ? "Creating…" : "Create clinic"}
            </button>
            <Feedback message={clinicMsg} ok={clinicOk} />
          </form>
        </div>
      </div>
    </section>
  );
}
