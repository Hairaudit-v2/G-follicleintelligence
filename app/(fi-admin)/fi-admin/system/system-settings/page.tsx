import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export const dynamic = "force-dynamic";

export default function SystemSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Configuration</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">System settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Environment-backed settings (Supabase URL/keys, <code className="text-xs text-slate-300">FI_ADMIN_API_KEY</code>,{" "}
          <code className="text-xs text-slate-300">NODE_ENV</code>, etc.) are managed outside this UI. Per-tenant branding and
          operational settings remain under each tenant&apos;s <strong className="text-slate-200">Configuration</strong> module.
        </p>
      </div>
      <ul className="list-inside list-disc text-sm text-slate-400">
        <li>Supabase project: Authentication, RLS policies, and migrations in this repository.</li>
        <li>Production access rules: <code className="text-xs">docs/fi-os-access-production.md</code></li>
      </ul>
    </div>
  );
}
