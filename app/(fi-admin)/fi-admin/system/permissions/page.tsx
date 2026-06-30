import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { FI_OS_ROLES } from "@/src/lib/fiOs/fiOsRoles";

export const dynamic = "force-dynamic";

export default function SystemPermissionsPage() {
  return (
    <div className="prose prose-invert max-w-none prose-headings:text-slate-50 prose-p:text-slate-400 prose-li:text-slate-400 prose-strong:text-slate-200">
      <p className={fiOsChromeClasses.sectionEyebrow}>Policy</p>
      <h1 className="mt-1 text-xl font-semibold text-slate-50">Permissions</h1>
      <p className="text-sm">
        OS roles are stored in{" "}
        <code className="text-xs text-slate-300">fi_os_identities.os_role</code> and enforced
        server-side (Next.js layouts, route handlers, service role). The browser never receives a
        trusted admin flag from this table.
      </p>
      <h2 className="mt-6 text-lg text-slate-100">Platform OS roles</h2>
      <ul className="text-sm">
        {FI_OS_ROLES.map((r) => (
          <li key={r}>
            <strong>{r}</strong>
            {r === "fi_platform_admin" ? (
              <span>
                {" "}
                — full cross-tenant access, system administration UI, user impersonation, and system
                configuration surfaces. Capabilities: <code>canImpersonateUsers</code>,{" "}
                <code>canAccessAllTenants</code>, <code>canManageSystemConfiguration</code> (see{" "}
                <code className="text-xs">fiOsRoles.ts</code>).
              </span>
            ) : null}
            {r === "fi_admin" ? (
              <span>
                {" "}
                — cross-tenant directory and elevated operator overrides where implemented.
              </span>
            ) : null}
            {r === "fi_auditor" ? (
              <span> — cross-tenant read-oriented access; HairAudit OS hub.</span>
            ) : null}
            {["fi_clinic_admin", "fi_doctor", "fi_nurse", "fi_consultant"].includes(r) ? (
              <span>
                {" "}
                — platform identity; primary access is via tenant{" "}
                <code className="text-xs">fi_users</code> membership.
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg text-slate-100">Tenant roles</h2>
      <p className="text-sm">
        Tenant-scoped roles live on <code className="text-xs text-slate-300">fi_users.role</code>{" "}
        (e.g. CRM shell, bookings operator, staff management). A user may have both an OS row and
        one or more tenant memberships.
      </p>
    </div>
  );
}
