"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createFiClinicAction,
  createFiOrganisationAction,
} from "@/lib/actions/fi-foundation-bootstrap-actions";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
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
  const cls = ok
    ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-100"
    : "border-rose-500/30 bg-rose-950/40 text-rose-100";
  return (
    <p role="status" className={`rounded-lg border px-2 py-1.5 text-xs ${cls}`}>
      {message}
    </p>
  );
}

export type FoundationDirectoryOrgOption = { id: string; name: string };

const fieldClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/80 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none ring-cyan-500/0 transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/25";

const labelClass = "text-xs font-medium text-[#94A3B8]";

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
    <section id="foundation-tools" className="scroll-mt-4">
      <DashboardCard className="p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[#F8FAFC]">Foundation records</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
            Create <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-xs text-[#E2E8F0]">fi_organisations</code> and{" "}
            <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-xs text-[#E2E8F0]">fi_clinics</code> for this tenant.
            Writes use the same deployment <code className="text-xs text-[#22C1FF]">FI_ADMIN_API_KEY</code> as Configuration
            (server-side service role only).
          </p>
        </div>

        {isBarren ? (
          <DashboardCard elevated className="mt-4 border-amber-500/25 bg-amber-950/25 p-4">
            <p className="text-sm leading-relaxed text-amber-100/95">
              <strong className="text-amber-50">Starting fresh:</strong> this tenant has no organisations or clinics yet.
              Create an <strong className="text-amber-50">organisation</strong> first, then a <strong className="text-amber-50">clinic</strong>. After each step you can finish branding in{" "}
              <Link href={`/fi-admin/${tenantId}/configuration`} className="font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-50">
                Configuration
              </Link>
              .
            </p>
          </DashboardCard>
        ) : null}

        <DashboardCard
          elevated
          className="mt-5 border-violet-500/25 bg-[#120a1e]/55 p-4 sm:p-5"
        >
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-violet-300/90">Deployment operators</p>
          <h3 className="mt-1 text-sm font-semibold text-[#E2E8F0]">Admin API key (not stored in browser)</h3>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
            Only the actions below need this key. Browsing the directory and search never require it — clinical staff can
            explore read-only results without credentials.
          </p>
          <label className="mt-4 block max-w-md space-y-1.5">
            <span className={labelClass}>FI_ADMIN_API_KEY</span>
            <input
              type="password"
              value={adminKey}
              onChange={(ev) => setAdminKey(ev.target.value)}
              autoComplete="off"
              className={fieldClass}
              placeholder="Paste key to enable organisation / clinic creation"
            />
          </label>
        </DashboardCard>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div id="directory-create-organisation" className="scroll-mt-24 space-y-3 rounded-xl border border-white/[0.08] bg-[#141C33]/50 p-4 backdrop-blur-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#22C1FF]">Create organisation</h3>
            <form className="space-y-2" onSubmit={onCreateOrganisation}>
              <label className="block space-y-1">
                <span className={labelClass}>Name</span>
                <input name="name" required maxLength={200} className={fieldClass} autoComplete="off" />
              </label>
              <label className="block space-y-1">
                <span className={labelClass}>Slug</span>
                <input
                  name="slug"
                  required
                  maxLength={80}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  title="Lowercase letters, digits, and hyphens only (e.g. evolved-perth)"
                  className={`${fieldClass} font-mono`}
                  placeholder="e.g. evolved-perth"
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1">
                <span className={labelClass}>Type</span>
                <select name="organisation_type" required className={fieldClass}>
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
                className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50"
              >
                {orgBusy ? "Creating…" : "Create organisation"}
              </button>
              <Feedback message={orgMsg} ok={orgOk} />
            </form>
          </div>

          <div id="directory-create-clinic" className="scroll-mt-24 space-y-3 rounded-xl border border-white/[0.08] bg-[#141C33]/50 p-4 backdrop-blur-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#22C1FF]">Create clinic</h3>
            {!hasOrgs ? (
              <DashboardCard className="border-amber-500/20 bg-amber-950/30 p-3 text-xs text-amber-100">
                Create an organisation first. Clinics can optionally link to an organisation for this tenant.
              </DashboardCard>
            ) : null}
            <form className="space-y-2" onSubmit={onCreateClinic}>
              <label className="block space-y-1">
                <span className={labelClass}>Display name</span>
                <input
                  name="display_name"
                  required
                  maxLength={200}
                  disabled={!hasOrgs}
                  className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-45`}
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1">
                <span className={labelClass}>Organisation (recommended)</span>
                <select
                  name="organisation_id"
                  disabled={!hasOrgs}
                  className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-45`}
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
                className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50"
              >
                {clinicBusy ? "Creating…" : "Create clinic"}
              </button>
              <Feedback message={clinicMsg} ok={clinicOk} />
            </form>
          </div>
        </div>
      </DashboardCard>
    </section>
  );
}
