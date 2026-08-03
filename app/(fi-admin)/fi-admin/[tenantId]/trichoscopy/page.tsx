import Link from "next/link";
import { notFound } from "next/navigation";

import { TrichoscopyStatusCard } from "@/src/components/trichoscopy/TrichoscopyStatusCard";
import { resolveTrichoscopyRouteAccess } from "@/src/lib/platform/entitlements/trichoscopyRouteGate.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiosTrichoscopyStatus } from "@/src/lib/integrations/hliTrichoscopy/types";

export const dynamic = "force-dynamic";

export default async function TrichoscopyModuleHomePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  const access = await resolveTrichoscopyRouteAccess(tid);
  if (!access.ok) notFound();

  const supabase = supabaseAdmin();
  const { data: recent } = await supabase
    .from("fi_hli_trichoscopy_links")
    .select("id, fios_patient_id, purpose, status, requested_at, last_synced_at")
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
    .limit(12);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Trichoscopy Intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Clinic trichoscopy</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Request and track HLI trichoscopy episodes across patients. Confirmed evidence remains
          available according to your subscription and retention policy.
        </p>
        {access.ok && access.historicalReadOnly ? (
          <p className="text-sm text-amber-200">
            Subscription inactive — historical confirmed evidence remains readable; new requests are
            blocked.
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/fi-admin/${tid}/settings/modules/trichoscopy`}
          className="rounded-lg border border-white/[0.12] px-3 py-2 text-xs text-slate-200 hover:border-cyan-400/40"
        >
          Module settings
        </Link>
        <Link
          href={`/fi-admin/${tid}/patients`}
          className="rounded-lg border border-white/[0.12] px-3 py-2 text-xs text-slate-200 hover:border-cyan-400/40"
        >
          Open patients
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Recent episodes</h2>
        {!recent?.length ? (
          <p className="text-sm text-slate-500">No trichoscopy episodes yet for this clinic.</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((row) => (
              <li key={String((row as { id: string }).id)}>
                <TrichoscopyStatusCard
                  tenantId={tid}
                  patientId={String((row as { fios_patient_id: string }).fios_patient_id)}
                  linkId={String((row as { id: string }).id)}
                  purpose={String((row as { purpose: string }).purpose)}
                  status={(row as { status: FiosTrichoscopyStatus }).status}
                  episodeCreatedAt={(row as { requested_at?: string | null }).requested_at}
                  lastSyncedAt={(row as { last_synced_at?: string | null }).last_synced_at}
                  historicalReadOnly={access.historicalReadOnly}
                  canRequest={!access.historicalReadOnly}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
