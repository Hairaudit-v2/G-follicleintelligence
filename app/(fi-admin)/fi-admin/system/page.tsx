import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export const dynamic = "force-dynamic";

export default async function SystemAdminHomePage() {
  return (
    <div className="space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>FI Platform</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">System administration</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Cross-tenant operations for <strong className="text-slate-200">fi_platform_admin</strong>. Tenant consoles remain
          under <Link className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300" href="/fi-admin">/fi-admin</Link>
          ; use the left nav for catalogue-wide views and impersonation controls.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4">
          <p className="text-sm font-semibold text-slate-100">Tenant management</p>
          <p className="mt-1 text-xs text-slate-500">Provision tenants, default clinics, settings, and first clinic admin.</p>
          <Link
            href="/fi-admin/system/tenants"
            className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300"
          >
            Open tenants →
          </Link>
        </li>
        <li className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4">
          <p className="text-sm font-semibold text-slate-100">User impersonation</p>
          <p className="mt-1 text-xs text-slate-500">Act as another user (session audited). Actions remain attributable to you.</p>
          <Link
            href="/fi-admin/system/users"
            className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300"
          >
            Open impersonation →
          </Link>
        </li>
        <li className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4">
          <p className="text-sm font-semibold text-slate-100">HairAudit OS</p>
          <p className="mt-1 text-xs text-slate-500">HairAudit queue and platform audits.</p>
          <Link href="/hair-audit/admin" className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300">
            HairAudit admin →
          </Link>
        </li>
      </ul>
    </div>
  );
}
