import Link from "next/link";
import type { CaseSummaryDocument } from "@/src/lib/cases/caseSummaryDocumentTypes";
import { CaseSummaryDocumentPrintButton } from "./CaseSummaryDocumentPrintButton";
import { CaseSummaryDocumentSection } from "./CaseSummaryDocumentSection";

function Dl({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="sm:contents">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 print:text-gray-700">
            {r.label}
          </dt>
          <dd className="text-sm text-gray-900 print:text-black">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function readinessHealthLabel(health: string): string {
  switch (health) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In progress";
    case "needs_attention":
      return "Needs attention";
    case "not_started":
      return "Not started";
    default:
      return health;
  }
}

export function CaseSummaryDocumentPage({
  document: doc,
  caseDetailHref,
}: {
  document: CaseSummaryDocument;
  /** Link back to the interactive case profile (preserves worklist query when present). */
  caseDetailHref: string;
}) {
  const generated = new Date(doc.meta.generatedAtIso);
  const generatedLabel = Number.isNaN(generated.getTime())
    ? doc.meta.generatedAtIso
    : generated.toLocaleString();

  return (
    <div className="case-summary-document mx-auto max-w-4xl bg-white px-4 py-8 print:max-w-none print:px-6 print:py-4">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 print:mb-6">
        <div>
          <p className="print:hidden">
            <Link href={caseDetailHref} className="text-sm text-blue-600 hover:underline">
              ← Back to patient
            </Link>
          </p>
          <h1 className="mt-2 text-xl font-semibold text-gray-900 print:mt-0 print:text-black">
            Patient summary
          </h1>
          <p className="mt-1 text-sm text-gray-600 print:text-gray-800">
            Read-only handover view · Generated {generatedLabel}
          </p>
          <p className="mt-1 font-mono text-xs text-gray-500 print:text-gray-700">
            Tenant {doc.meta.tenantId} · Patient {doc.meta.caseId}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          <CaseSummaryDocumentPrintButton />
        </div>
      </div>

      <div className="space-y-8 print:space-y-6">
        <CaseSummaryDocumentSection title="Patient summary">
          <Dl rows={doc.caseSummary} />
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Linked patient / person">
          {doc.linkedPatient.patientProfileHref ? (
            <p className="print:hidden">
              <Link
                href={doc.linkedPatient.patientProfileHref}
                className="text-sm text-blue-600 hover:underline"
              >
                Open patient profile
              </Link>
            </p>
          ) : null}
          <Dl rows={doc.linkedPatient.rows} />
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Linked CRM leads">
          {doc.linkedLeads.leads.length === 0 ? (
            <p className="text-sm text-gray-600">No leads linked to this patient.</p>
          ) : (
            <ul className="list-none space-y-3">
              {doc.linkedLeads.leads.map((L) => (
                <li
                  key={L.leadDetailHref}
                  className="rounded border border-gray-100 p-3 print:border-gray-300"
                >
                  <p className="font-medium text-gray-900 print:text-black">{L.title}</p>
                  <p className="text-xs text-gray-500 print:text-gray-700">
                    {L.linkReasonLabel} · Status: {L.status}
                  </p>
                  <p className="mt-1 print:hidden">
                    <Link href={L.leadDetailHref} className="text-sm text-blue-600 hover:underline">
                      Open lead
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Treatment profile">
          <Dl rows={doc.treatmentProfile} />
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Planning notes (patient)">
          {doc.planningNotes ? (
            <div className="whitespace-pre-wrap rounded border border-gray-100 bg-gray-50/80 p-3 text-sm print:border-gray-300 print:bg-white">
              {doc.planningNotes}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No planning notes on the patient record.</p>
          )}
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Surgery plan">
          {!doc.surgeryPlan.present ? (
            <p className="text-sm text-gray-600">No surgery plan row for this patient yet.</p>
          ) : (
            <>
              <Dl rows={doc.surgeryPlan.rows} />
              {doc.surgeryPlan.graftEstimate ? (
                <p className="text-sm">
                  <span className="font-medium text-gray-800">Graft estimate: </span>
                  {doc.surgeryPlan.graftEstimate}
                </p>
              ) : null}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 print:text-gray-700">
                  Planned zones
                </p>
                {doc.surgeryPlan.zones.length ? (
                  <ul className="list-disc pl-5 text-sm">
                    {doc.surgeryPlan.zones.map((z) => (
                      <li key={z}>{z}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">No planned zones recorded.</p>
                )}
              </div>
              {doc.surgeryPlan.surgicalPlanSummary ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 print:text-gray-700">
                    Surgical plan summary
                  </p>
                  <div className="whitespace-pre-wrap rounded border border-gray-100 bg-gray-50/80 p-3 text-sm print:border-gray-300 print:bg-white">
                    {doc.surgeryPlan.surgicalPlanSummary}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Procedure day">
          {!doc.procedureDay.present ? (
            <p className="text-sm text-gray-600">No procedure day record yet.</p>
          ) : (
            <>
              <Dl rows={doc.procedureDay.rows} />
              {doc.procedureDay.completionSummary ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 print:text-gray-700">
                    Completion summary
                  </p>
                  <div className="whitespace-pre-wrap rounded border border-gray-100 bg-gray-50/80 p-3 text-sm print:border-gray-300 print:bg-white">
                    {doc.procedureDay.completionSummary}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Post-op status">
          {!doc.postOp.present ? (
            <p className="text-sm text-gray-600">No post-op tracking row yet.</p>
          ) : (
            <Dl rows={doc.postOp.rows} />
          )}
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Follow-up checkpoints">
          {doc.followUpCheckpoints.length === 0 ? (
            <p className="text-sm text-gray-600">No follow-up rows loaded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 print:border-gray-800">
                    <th className="py-2 pr-3 font-medium text-gray-900 print:text-black">
                      Checkpoint
                    </th>
                    <th className="py-2 pr-3 font-medium text-gray-900 print:text-black">
                      Scheduled
                    </th>
                    <th className="py-2 pr-3 font-medium text-gray-900 print:text-black">
                      Completed
                    </th>
                    <th className="py-2 pr-3 font-medium text-gray-900 print:text-black">Status</th>
                    <th className="py-2 pr-3 font-medium text-gray-900 print:text-black">Images</th>
                    <th className="py-2 font-medium text-gray-900 print:text-black">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.followUpCheckpoints.map((fu, idx) => (
                    <tr
                      key={`${fu.checkpointLabel}-${idx}`}
                      className="border-b border-gray-100 print:border-gray-300"
                    >
                      <td className="py-2 pr-3 align-top">{fu.checkpointLabel}</td>
                      <td className="py-2 pr-3 align-top">{fu.scheduled}</td>
                      <td className="py-2 pr-3 align-top">{fu.completed}</td>
                      <td className="py-2 pr-3 align-top">{fu.statusLabel}</td>
                      <td className="py-2 pr-3 align-top">{fu.linkedImages}</td>
                      <td className="py-2 align-top whitespace-pre-wrap text-gray-800">
                        {fu.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Linked images">
          <p className="text-sm text-gray-900 print:text-black">
            <span className="font-medium">{doc.linkedImageCount}</span> patient-linked image
            {doc.linkedImageCount === 1 ? "" : "s"} (loaded for this summary; list capped in source
            query).
          </p>
          {doc.patientSafeImagingExports.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Patient-safe imaging status (redacted)
              </p>
              {doc.patientSafeImagingExports.map((row, i) => (
                <div
                  key={`${row.photoDate}-${row.viewLabel}-${i}`}
                  className="rounded border border-gray-200 p-3 text-sm print:border-gray-400"
                >
                  <p>
                    <span className="font-medium text-gray-900">{row.statusMessage}</span>
                  </p>
                  <p className="mt-1 text-gray-600">
                    {row.photoDate} · {row.viewLabel} · {row.sessionType}
                    {row.progressLabel !== "—" ? ` · ${row.progressLabel}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Timeline summary">
          <p className="text-sm text-gray-700 print:text-gray-900">
            <span className="font-medium text-gray-900 print:text-black">
              {doc.timeline.eventCount}
            </span>{" "}
            timeline event{doc.timeline.eventCount === 1 ? "" : "s"} (newest first; preview below).
          </p>
          {doc.timeline.preview.length ? (
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              {doc.timeline.preview.map((line, i) => (
                <li key={`${line.occurredOn}-${line.title}-${i}`} className="text-gray-800">
                  <span className="text-gray-500 print:text-gray-700">{line.occurredOn}</span>
                  {" — "}
                  <span className="font-medium text-gray-900 print:text-black">{line.title}</span>
                  {line.status ? <span className="text-gray-600"> ({line.status})</span> : null}
                  {line.sensitive ? (
                    <span className="mt-0.5 block text-xs text-amber-800 print:text-amber-900">
                      Sensitive CRM activity — detail text omitted from this summary view.
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-600">No timeline events.</p>
          )}
        </CaseSummaryDocumentSection>

        <CaseSummaryDocumentSection title="Readiness summary">
          <p className="text-sm text-gray-900 print:text-black">
            Overall required checks:{" "}
            <span className="font-medium">
              {doc.readiness.requiredSatisfied}/{doc.readiness.requiredTotal}
            </span>{" "}
            ({doc.readiness.overallPercent}%).
          </p>
          <p className="mt-2 text-sm text-gray-800 print:text-black">
            {doc.readiness.nextRecommendedStep}
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {doc.readiness.sections.map((s) => (
              <li
                key={s.title}
                className="rounded border border-gray-100 p-2 print:border-gray-300"
              >
                <span className="font-medium text-gray-900 print:text-black">{s.title}</span>
                <span className="text-gray-500"> · </span>
                <span className="text-gray-700 print:text-gray-900">
                  {readinessHealthLabel(s.health)}
                </span>
                <p className="mt-1 text-gray-600 print:text-gray-800">{s.summary}</p>
              </li>
            ))}
          </ul>
        </CaseSummaryDocumentSection>
      </div>

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500 print:mt-8 print:border-gray-800 print:text-gray-700">
        Follicle Intelligence · SurgeryOS patient summary · Internal use only. This view does not
        include HairAudit, formal audit grading, AI outcome scoring, or certification scoring.
      </footer>
    </div>
  );
}
