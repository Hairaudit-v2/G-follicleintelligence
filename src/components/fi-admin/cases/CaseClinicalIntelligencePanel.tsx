import Link from "next/link";

import type { CaseReadinessReport } from "@/src/lib/cases/caseReadinessTypes";
import { deriveCaseClinicalSignals } from "@/src/lib/fi-os/clinicalIntelligenceSignals";
import { recommendedNextStepForClinicalSignal } from "@/src/lib/fi-os/clinicalIntelligenceRecommendations";
import { CASE_DETAIL_SECTION_IDS, CASE_PROCEDURE_DAY_DETAIL_HASH } from "@/src/lib/cases/caseDetailNavConstants";

export function CaseClinicalIntelligencePanel(props: {
  tenantId: string;
  caseId: string;
  patientFoundationId: string | null;
  readiness: CaseReadinessReport;
}) {
  const { tenantId, caseId, patientFoundationId, readiness } = props;
  const signals = deriveCaseClinicalSignals({
    caseId,
    patientFoundationId,
    readiness,
  });
  const base = `/fi-admin/${encodeURIComponent(tenantId)}/cases/${encodeURIComponent(caseId)}`;

  return (
    <div className="rounded border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-indigo-950">Case intelligence</h3>
      <p className="mt-1 text-xs text-indigo-900/80">
        Support signals from existing readiness data only — not a substitute for clinical judgement.
      </p>
      {signals.length === 0 ? (
        <p className="mt-3 text-sm text-indigo-900/75">No open journey signals detected from current case data.</p>
      ) : (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-indigo-950">
          {signals.map((s) => (
            <li key={`${s.signalKey}-${s.title}`}>
              <span className="font-medium">{s.title}</span>
              <span className="text-indigo-800/80"> — {recommendedNextStepForClinicalSignal(s.signalKey)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-indigo-900/75">{readiness.nextRecommendedStep}</p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-indigo-800">
        <Link href={`${base}#${CASE_DETAIL_SECTION_IDS.readiness}`} className="hover:underline">
          Readiness
        </Link>
        <Link href={`${base}${CASE_PROCEDURE_DAY_DETAIL_HASH}`} className="hover:underline">
          Procedure day
        </Link>
        <Link href={`${base}#${CASE_DETAIL_SECTION_IDS.postOp}`} className="hover:underline">
          Post-op / follow-ups
        </Link>
        {patientFoundationId ? (
          <Link
            href={`/fi-admin/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientFoundationId)}/twin`}
            className="hover:underline"
          >
            Patient Twin
          </Link>
        ) : null}
      </div>
    </div>
  );
}
