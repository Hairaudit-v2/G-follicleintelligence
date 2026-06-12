import Link from "next/link";

import type { PatientClinicalIntelligenceView } from "@/src/lib/fi-os/clinicalIntelligenceSignals";
import { recommendedNextStepForClinicalSignal } from "@/src/lib/fi-os/clinicalIntelligenceRecommendations";

export function PatientTwinClinicalIntelligenceCard(props: {
  tenantId: string;
  patientId: string;
  view: PatientClinicalIntelligenceView;
}) {
  const { tenantId, patientId, view } = props;
  const imagingHref = `/fi-admin/${encodeURIComponent(tenantId)}/foundation-integrity`;

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      aria-labelledby="patient-twin-clinical-intel-heading"
    >
      <h2 id="patient-twin-clinical-intel-heading" className="text-sm font-semibold text-slate-900">
        Clinical intelligence
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Neutral signals from linked records — review in context; does not replace clinician judgement.
      </p>
      {view.signals.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No open signals from the current Patient Twin projection.</p>
      ) : (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
          {view.signals.map((s) => (
            <li key={`${s.signalKey}-${s.title}`}>
              <span className="font-medium text-slate-900">{s.title}</span>
              <span className="text-slate-600"> — {recommendedNextStepForClinicalSignal(s.signalKey)}</span>
            </li>
          ))}
        </ul>
      )}
      {view.recommendedNextStep ? (
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-medium">Suggested next step: </span>
          {view.recommendedNextStep}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-blue-700">
        <Link href={imagingHref} className="hover:underline">
          Imaging workspace
        </Link>
        <Link href={`/fi-admin/${encodeURIComponent(tenantId)}/cases`} className="hover:underline">
          SurgeryOS cases
        </Link>
        <Link href={`/fi-admin/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}`} className="hover:underline">
          Patient profile
        </Link>
      </div>
    </section>
  );
}
