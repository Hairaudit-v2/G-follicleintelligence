import Link from "next/link";
import type { ReactNode } from "react";

import type { TimelyZapierIntegrationSetup } from "@/src/lib/integrations/timely/timelyZapierIntegrationSetupLoader.server";

const patientExample = `{
  "external_id": "{{Customer ID}}",
  "first_name": "{{First Name}}",
  "last_name": "{{Last Name}}",
  "email": "{{Email}}",
  "mobile": "{{Phone}}",
  "date_of_birth": "{{Date of Birth}}",
  "notes": "{{Notes}}"
}`;

const appointmentExample = `{
  "external_appointment_id": "{{Appointment ID}}",
  "external_patient_id": "{{Customer ID}}",
  "service_name": "{{Service Name}}",
  "staff_name": "{{Staff Name}}",
  "start_time": "{{Start Time}}",
  "end_time": "{{End Time}}",
  "notes": "{{Notes}}",
  "status": "{{Status}}"
}`;

function MonoBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-white/[0.08] bg-[#060d18] p-3 text-xs leading-relaxed text-[#CBD5E1]">
      {children}
    </pre>
  );
}

function StatusRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.06] py-2 last:border-b-0">
      <span className="text-sm text-[#94A3B8]">{label}</span>
      <span className="text-sm font-medium text-[#E2E8F0]">{value}</span>
    </div>
  );
}

export function TimelyZapierSetupGuide({
  tenantId,
  appOrigin,
  setup,
}: {
  tenantId: string;
  appOrigin: string;
  setup: TimelyZapierIntegrationSetup;
}) {
  const origin = appOrigin.replace(/\/+$/, "");
  const patientUrl = `${origin}/api/tenants/${tenantId}/integrations/timely/patient`;
  const appointmentUrl = `${origin}/api/tenants/${tenantId}/integrations/timely/appointment`;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Connection status</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Deployment checks and tenant-scoped Timely sync stats (read-only). Webhook secret is never shown.
        </p>
        <div className="mt-4 divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] bg-[#060d18]/60 px-3">
          <StatusRow
            label="FI_TIMELY_WEBHOOK_SECRET configured"
            value={setup.webhookSecretConfigured ? "Yes" : "No"}
          />
          <StatusRow label="Timely mappings (all entity types)" value={setup.timelyMappingsTotal} />
          <StatusRow label="Patients synced (Timely)" value={setup.timelyPatientsSynced} />
          <StatusRow label="Appointments synced (Timely)" value={setup.timelyAppointmentsSynced} />
          <StatusRow
            label="Last imported appointment"
            value={
              setup.lastAppointment ? (
                <span className="text-right">
                  <span className="block font-mono text-xs text-[#22C1FF]">
                    {setup.lastAppointment.booking_start_at ?? "—"}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#94A3B8]">
                    mapping {setup.lastAppointment.created_at} · external {setup.lastAppointment.external_id}
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Webhook URLs</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Use your current browser host as <span className="text-[#CBD5E1]">APP_URL</span> below, or set{" "}
          <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-xs text-[#22C1FF]">NEXT_PUBLIC_SITE_URL</code> for
          stable production links.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Patient</p>
            <p className="mt-1 font-mono text-xs text-[#94A3B8]">
              POST {"{"}APP_URL{"}"}/api/tenants/[tenantId]/integrations/timely/patient
            </p>
            <p className="mt-2 font-mono text-sm text-[#22C1FF]">POST {patientUrl}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Appointment</p>
            <p className="mt-1 font-mono text-xs text-[#94A3B8]">
              POST {"{"}APP_URL{"}"}/api/tenants/[tenantId]/integrations/timely/appointment
            </p>
            <p className="mt-2 font-mono text-sm text-[#22C1FF]">POST {appointmentUrl}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Required header</h2>
        <MonoBlock>{`Authorization: Bearer <FI_TIMELY_WEBHOOK_SECRET>`}</MonoBlock>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Example Zapier payloads</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Patient JSON</p>
            <MonoBlock>{patientExample}</MonoBlock>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Appointment JSON</p>
            <MonoBlock>{appointmentExample}</MonoBlock>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Recent imports</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">Last 20 Timely appointment mappings for this tenant.</p>
        {setup.recentBookingImports.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748B]">No appointment mappings yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#060d18]/80 text-xs uppercase tracking-wide text-[#64748B]">
                  <th className="px-3 py-2 font-medium">Imported</th>
                  <th className="px-3 py-2 font-medium">Timely appointment id</th>
                  <th className="px-3 py-2 font-medium">FI booking</th>
                  <th className="px-3 py-2 font-medium">Start</th>
                  <th className="px-3 py-2 font-medium">Title</th>
                </tr>
              </thead>
              <tbody>
                {setup.recentBookingImports.map((row) => (
                  <tr key={`${row.external_id}-${row.created_at}`} className="border-b border-white/[0.05] last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs text-[#94A3B8]">{row.created_at}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#CBD5E1]">{row.external_id}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/fi-admin/${tenantId}/calendar`}
                        className="font-mono text-xs text-[#22C1FF] underline-offset-2 hover:underline"
                        title="Open calendar to locate this booking"
                      >
                        {row.booking_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#94A3B8]">{row.booking_start_at ?? "—"}</td>
                    <td className="px-3 py-2 text-[#CBD5E1]">{row.booking_title ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
