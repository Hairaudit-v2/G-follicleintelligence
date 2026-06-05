import Link from "next/link";

import { ClinicOsOpenGlobalSearchButton } from "@/src/components/fi-admin/shell/ClinicOsOpenGlobalSearchButton";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiEmptyState } from "@/src/components/fi-design/FiEmptyState";
import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";

type ClinicOsPatientsHomeProps = {
  tenantId: string;
  /** From `getCrmShellNavAllowed` — enables booking and CRM lead shortcuts. */
  showCrmNav: boolean;
  /** When true, “Open search” can trigger the shell global search dialog. */
  clinicOsShellEnabled: boolean;
};

/**
 * Clinic OS patients landing (Stage 1I): navigation and placeholders only — no patient list query.
 */
export function ClinicOsPatientsHome({ tenantId, showCrmNav, clinicOsShellEnabled }: ClinicOsPatientsHomeProps) {
  const base = `/fi-admin/${tenantId.trim()}`;

  return (
    <div className="space-y-6" aria-describedby="clinic-os-patients-preview-note">
      <p id="clinic-os-patients-preview-note" className="sr-only">
        Work queue figures and recent patient names are preview placeholders only. They are not live operational data.
      </p>

      <FiPageHeader
        eyebrow="Clinic OS"
        title="Patients"
        description="Find patients, start new enquiries, and move quickly into bookings, clinical patients and follow-ups."
        primaryAction={
          <Link
            href={`${base}/patients/new`}
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Add new patient
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <FiCard>
            <h2 className="text-sm font-semibold text-slate-900">Find a patient</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Search by name, phone, email or patient number.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {clinicOsShellEnabled ? (
                <>
                  <ClinicOsOpenGlobalSearchButton />
                  <p className="text-xs leading-relaxed text-slate-500 sm:max-w-xs">
                    Same search as the top bar or{" "}
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-600">
                      ⌘K
                    </kbd>{" "}
                    /{" "}
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-600">
                      Ctrl+K
                    </kbd>
                    .
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-slate-600">
                  Workspace search (header bar or{" "}
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-600">
                    ⌘K
                  </kbd>{" "}
                  /{" "}
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-600">
                    Ctrl+K
                  </kbd>
                  ) opens patient search when the Clinic OS shell is enabled for this deployment.
                </p>
              )}
            </div>
          </FiCard>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Workflows</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FiQuickActionCard
                title="Add new patient"
                description="Start from a lead, booking, or direct profile entry."
                href={`${base}/patients/new`}
              />
              <FiQuickActionCard
                title="Book appointment"
                description="Open the booking launcher for this clinic."
                href={showCrmNav ? `${base}/bookings/new` : undefined}
                disabled={!showCrmNav}
                disabledReason="Bookings require CRM workspace access (fi_admin or crm_operator)."
              />
              <FiQuickActionCard
                title="Create lead"
                description="Open the CRM pipeline for new enquiries."
                href={showCrmNav ? `${base}/crm` : undefined}
                disabled={!showCrmNav}
                disabledReason="CRM is available when your account has CRM workspace access."
                openAffordanceLabel="Open CRM"
              />
              <FiQuickActionCard
                title="Open active patients"
                description="Clinical patients and worklists for this tenant."
                href={`${base}/cases`}
              />
              <FiQuickActionCard title="Follow-ups" description="Due tasks and recall lists (preview)." />
              <FiQuickActionCard title="Send message" description="Team and patient messaging (preview)." />
            </div>
          </div>
        </div>

        <aside className="space-y-3 lg:col-span-4" aria-label="Patient work queues (preview)">
          <h2 className="text-sm font-semibold text-slate-900">Patient work queues</h2>
          <p className="text-xs text-slate-500">Preview · not connected to live metrics</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <FiKpiTile label="New enquiries" value="—" description="Preview · Coming soon" tone="info" />
            <FiKpiTile label="Consultations due" value="—" description="Preview · Coming soon" tone="info" />
            <FiKpiTile label="Follow-ups due" value="—" description="Preview · Coming soon" tone="info" />
            <FiKpiTile label="Treatment patients" value="—" description="Preview · Coming soon" tone="info" />
            <FiKpiTile label="Hair transplant patients" value="—" description="Preview · Coming soon" tone="info" />
            <FiKpiTile label="Records needing attention" value="—" description="Preview · Coming soon" tone="info" />
          </div>
        </aside>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent patients</h2>
        <FiEmptyState
          title="No recent activity to show"
          description="Preview only — recent patients will appear here once connected to live data. Use search to open a patient record."
        />
        <ul className="mt-3 space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-600" aria-hidden>
          <li className="flex justify-between gap-2 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
            <span className="font-medium text-slate-800">A. Preview</span>
            <span className="text-xs text-slate-400">Sample row</span>
          </li>
          <li className="flex justify-between gap-2 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
            <span className="font-medium text-slate-800">B. Preview</span>
            <span className="text-xs text-slate-400">Sample row</span>
          </li>
        </ul>
        <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Illustration only · not live patients
        </p>
      </div>
    </div>
  );
}
