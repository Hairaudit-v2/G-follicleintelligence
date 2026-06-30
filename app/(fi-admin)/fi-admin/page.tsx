"use client";

import { useEffect, useState, type ComponentProps } from "react";
import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { cn } from "@/lib/utils";

type Tenant = { id: string; name: string; slug: string };

type TenantsJson =
  | { ok: true; tenants?: Tenant[]; devTenantListFallback?: boolean }
  | { ok: false; error?: string; code?: string };

function authHelpBlock(code: string | undefined, message: string) {
  if (code === "AUTH_REQUIRED") {
    return (
      <InfoNotice variant="warning" title="Production sign-in required" className="mt-3 max-w-xl">
        <p>
          <strong className="text-amber-50">Production mode</strong> (
          <code className="rounded bg-black/30 px-1 text-xs">NODE_ENV=production</code>, e.g.{" "}
          <code className="text-xs">next start</code>): use{" "}
          <code className="text-xs">/fi-login</code>, then ensure your user is provisioned in{" "}
          <code className="text-xs">fi_users</code> and/or{" "}
          <code className="text-xs">fi_os_identities</code>.
        </p>
        <p className="mt-2">
          For <strong className="text-amber-50">local</strong> tenant picking <em>without</em>{" "}
          login, run <code className="text-xs">next dev</code> (not{" "}
          <code className="text-xs">next start</code>) and set{" "}
          <code className="text-xs">FI_ENABLE_DEV_ADMIN_ACCESS=true</code> in{" "}
          <code className="text-xs">.env.local</code> — see{" "}
          <code className="text-xs">docs/dev-local-fi-admin.md</code> in this repository.
        </p>
      </InfoNotice>
    );
  }
  if (code === "FI_PORTAL_FORBIDDEN") {
    return (
      <InfoNotice variant="danger" title="Access denied" className="mt-3 max-w-xl">
        <p>{message}</p>
        <p className="mt-2">
          Use{" "}
          <Link
            href="/fi-login"
            className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
          >
            /fi-login
          </Link>{" "}
          with a provisioned account, or sign out and try a different account.
        </p>
      </InfoNotice>
    );
  }
  if (code === "AUTH_OR_DEV_FLAG_REQUIRED") {
    return (
      <InfoNotice
        variant="warning"
        title="Authentication or dev flag required"
        className="mt-3 max-w-xl"
      >
        <p>{message}</p>
        <p className="mt-2">
          See <code className="text-xs">docs/dev-local-fi-admin.md</code> in the repo for details.
        </p>
      </InfoNotice>
    );
  }
  return null;
}

function GlassPanel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(fiOsChromeClasses.glassCard, className)} {...props} />;
}

export default function FiAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [devTenantListFallback, setDevTenantListFallback] = useState(false);

  useEffect(() => {
    fetch("/api/tenants")
      .then(async (r) => {
        const d = (await r.json()) as TenantsJson;
        if (!r.ok || !d.ok) {
          const msg = !d.ok && "error" in d && d.error ? d.error : `Request failed (${r.status})`;
          setError(msg);
          setErrorCode(!d.ok && "code" in d ? d.code : undefined);
          setTenants([]);
          setDevTenantListFallback(false);
          return;
        }
        setTenants(d.tenants ?? []);
        setDevTenantListFallback(Boolean(d.devTenantListFallback));
        setError(null);
        setErrorCode(undefined);
      })
      .catch(() => {
        setError("Failed to load");
        setErrorCode(undefined);
        setTenants([]);
        setDevTenantListFallback(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GlassPanel className="p-8">
        <p className="animate-pulse text-sm text-slate-500">Loading workspaces…</p>
      </GlassPanel>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <InfoNotice variant="danger" title="Could not load tenants">
          <p>{error}</p>
        </InfoNotice>
        {authHelpBlock(errorCode, error)}
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="space-y-4">
        {devTenantListFallback ? (
          <InfoNotice variant="warning" title="Development access">
            <p>
              <strong className="text-amber-50">No authenticated FI user session.</strong>
            </p>
          </InfoNotice>
        ) : null}
        {devTenantListFallback ? (
          <p className="text-sm text-slate-500">
            No rows in{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-slate-200">
              fi_tenants
            </code>
            . Create one via SQL: insert into fi_tenants (name, slug) values (&apos;Demo&apos;,
            &apos;demo&apos;);
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            No tenants linked to your account. Ask an administrator to add your Supabase Auth user
            to{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-slate-200">
              fi_users
            </code>{" "}
            for a tenant, or for local development without login see{" "}
            <code className="text-xs">docs/dev-local-fi-admin.md</code> (
            <code className="text-xs">FI_ENABLE_DEV_ADMIN_ACCESS=true</code>).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {devTenantListFallback ? (
        <InfoNotice variant="warning" title="Development access">
          <p className="text-xs sm:text-sm">
            <strong className="text-amber-50">No authenticated FI user session.</strong> Listing all
            rows from <code className="text-xs">fi_tenants</code> because{" "}
            <code className="text-xs">FI_ENABLE_DEV_ADMIN_ACCESS=true</code> and{" "}
            <code className="text-xs">NODE_ENV</code> is not production. Sign in to use
            tenant-scoped membership instead.
          </p>
        </InfoNotice>
      ) : null}
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Workspaces</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50">Select tenant</h2>
        <p className="mt-1 text-xs text-slate-500">
          Opens the tenant console. Access rules are unchanged.
        </p>
      </div>
      <ul className="flex flex-wrap gap-3">
        {tenants.map((t) => (
          <li key={t.id}>
            <Link
              href={`/fi-admin/${t.id}`}
              className="inline-flex min-w-[10rem] flex-col rounded-xl border border-white/[0.1] bg-[#060d18]/90 px-4 py-3 text-left shadow-lg shadow-black/30 backdrop-blur-md transition hover:border-cyan-500/35 hover:bg-white/[0.06]"
            >
              <span className="text-sm font-semibold text-slate-50">{t.name}</span>
              <span className="mt-0.5 font-mono text-xs text-slate-500">{t.slug}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
