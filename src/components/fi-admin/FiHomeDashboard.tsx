import Link from "next/link";
import type { FiHomeDashboardPayload } from "@/src/lib/fiOs/fiHomeDashboardLoader.server";

function CheckRow({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
  return (
    <li className="flex gap-2 text-sm">
      <span className={done ? "text-emerald-700" : "text-gray-400"} aria-hidden>
        {done ? "✓" : "○"}
      </span>
      <div>
        <span className={done ? "text-gray-800" : "text-gray-600"}>{label}</span>
        {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </li>
  );
}

function ActionCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="block rounded border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <p className="mt-1 text-xs text-gray-600">{description}</p>
    </Link>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50/80 px-3 py-2">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

export function FiHomeDashboard({
  data,
  showCrmShellExtras,
}: {
  data: FiHomeDashboardPayload;
  showCrmShellExtras: boolean;
}) {
  const base = `/fi-admin/${data.tenantId}`;
  const pct = Math.round(data.setupProgressRatio * 100);

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-1">
        <h1 className="text-base font-medium text-gray-900">Welcome</h1>
        <p className="text-sm text-gray-700">
          <span className="font-medium">{data.tenantName}</span>
          {data.tenantSlug ? (
            <span className="text-gray-500">
              {" "}
              (<span className="font-mono text-xs">{data.tenantSlug}</span>)
            </span>
          ) : null}
        </p>
        <p className="max-w-2xl text-xs text-gray-600">
          This is your tenant home in Follicle Intelligence Admin. Use it to see setup progress and jump to the right
          screen — everything here is read-only.
        </p>
      </header>

      <section className="space-y-2" aria-labelledby="setup-progress-heading">
        <h2 id="setup-progress-heading" className="text-sm font-medium text-gray-900">
          Setup progress
        </h2>
        <div className="max-w-md">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[color:var(--fi-brand-accent,#2563eb)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-600">{pct}% complete</p>
        </div>
        <ul className="max-w-xl space-y-2 border-t border-gray-100 pt-3">
          <CheckRow done={data.checklist.organisationCreated} label="Organisation created" />
          <CheckRow done={data.checklist.clinicCreated} label="Clinic created" />
          <CheckRow done={data.checklist.clinicSettingsComplete} label="Clinic settings completed" />
          <CheckRow done={data.checklist.firstCaseCreated} label="First patient / case created" />
          {showCrmShellExtras ? (
            <>
              <CheckRow
                done={Boolean(data.checklist.crmAccessAvailable)}
                label="CRM access available"
                hint="Your account can open CRM, bookings, and calendar from the navigation."
              />
              <CheckRow
                done={Boolean(data.checklist.bookingsCalendarAvailable)}
                label="Bookings & calendar available"
                hint="Use Bookings and Calendar in the nav when you are ready to schedule."
              />
            </>
          ) : null}
        </ul>
      </section>

      <section className="space-y-2 rounded border border-blue-100 bg-blue-50/60 px-4 py-3" aria-labelledby="next-action-heading">
        <h2 id="next-action-heading" className="text-sm font-medium text-blue-950">
          Recommended next step
        </h2>
        <p className="text-sm font-medium text-gray-900">{data.nextAction.title}</p>
        <p className="text-xs text-gray-700">{data.nextAction.description}</p>
        <Link
          href={data.nextAction.href}
          className="inline-block text-sm font-medium text-blue-800 underline decoration-blue-300 underline-offset-2 hover:text-blue-950"
        >
          Go there →
        </Link>
      </section>

      <section className="space-y-2" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-sm font-medium text-gray-900">
          Main actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            href={`${base}/cases/new`}
            title="Create first case"
            description="Guided wizard for person, patient, and case."
          />
          <ActionCard href={`${base}/cases`} title="View cases" description="Worklist, filters, and case detail." />
          <ActionCard href={`${base}/directory`} title="Directory" description="Search foundation records and manage orgs/clinics." />
          <ActionCard
            href={`${base}/configuration`}
            title="Configuration"
            description="Tenant, organisation, and clinic branding and settings."
          />
        </div>
      </section>

      {showCrmShellExtras ? (
        <section className="space-y-2" aria-labelledby="crm-quick-heading">
          <h2 id="crm-quick-heading" className="text-sm font-medium text-gray-900">
            CRM &amp; scheduling
          </h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={`${base}/crm`} className="text-blue-800 underline underline-offset-2 hover:text-blue-950">
              CRM
            </Link>
            <span className="text-gray-300">|</span>
            <Link href={`${base}/bookings`} className="text-blue-800 underline underline-offset-2 hover:text-blue-950">
              Bookings
            </Link>
            <span className="text-gray-300">|</span>
            <Link href={`${base}/calendar`} className="text-blue-800 underline underline-offset-2 hover:text-blue-950">
              Calendar
            </Link>
          </div>
        </section>
      ) : null}

      <section className="space-y-2" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-sm font-medium text-gray-900">
          System status summary
        </h2>
        <p className="max-w-2xl text-xs text-gray-600">Counts are read-only snapshots for this tenant.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          <CountTile label="Organisations" value={data.counts.organisations} />
          <CountTile label="Clinics" value={data.counts.clinics} />
          <CountTile label="Persons" value={data.counts.persons} />
          <CountTile label="Patients" value={data.counts.patients} />
          <CountTile label="Cases" value={data.counts.cases} />
        </div>
      </section>

      <section className="space-y-2 rounded border border-amber-100 bg-amber-50/50 px-4 py-3 text-xs text-amber-950">
        <h2 className="text-sm font-medium text-amber-950">About Foundation integrity</h2>
        <p className="max-w-3xl leading-relaxed">
          <Link href={`${base}/foundation-integrity`} className="font-medium text-amber-900 underline underline-offset-2">
            Foundation integrity
          </Link>{" "}
          is a <strong>technical health</strong> screen for events, coverage, and data quality — not your daily clinic
          dashboard. For everyday clinical and operational work, use <strong>Cases</strong> and (when available){" "}
          <strong>CRM / Bookings</strong>.
        </p>
      </section>
    </div>
  );
}
