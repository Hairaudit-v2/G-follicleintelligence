"use client";

/**
 * Report preview component. Renders canonical report_json before PDF.
 * Use with GET /api/fi/report?report_id=... to display report_json.
 */
import type { ReportJson } from "@/lib/fi/reportSchema";

type ReportPreviewProps = {
  report: ReportJson | null;
  className?: string;
};

export function ReportPreview({ report, className = "" }: ReportPreviewProps) {
  if (!report) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`}>
        <p className="text-sm text-gray-500">No report data to preview.</p>
      </div>
    );
  }

  const { metadata, disclaimers, score_summary, sections, charts, appendix } = report;

  return (
    <div className={`space-y-6 rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Follicle Intelligence™ Report Preview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Case {metadata.case_id} · {metadata.generated_at.slice(0, 10)}
          {metadata.partner_reference_code && (
            <> · Partner: {metadata.partner_reference_code}</>
          )}
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Score summary
        </h2>
        <p className="mt-2 text-gray-700">
          Overall: {(score_summary.overall_score * 10).toFixed(1)}/10 · Tier: {score_summary.risk_tier}
        </p>
        <p className="mt-1 text-sm text-gray-600">{score_summary.risk_tier_summary}</p>
        <ul className="mt-3 space-y-1">
          {score_summary.sections.map((s) => (
            <li key={s.id} className="flex justify-between text-sm">
              <span>{s.label}</span>
              <span>{(s.score * 10).toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </section>

      {disclaimers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Disclaimers
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-600">
            {disclaimers.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Findings
        </h2>
        <div className="mt-3 space-y-4">
          {[...sections].sort((a, b) => a.order - b.order).map((s) => (
            <div key={s.id}>
              <h3 className="font-medium text-gray-900">{s.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{s.content}</p>
            </div>
          ))}
        </div>
      </section>

      {charts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Chart definitions
          </h2>
          <p className="mt-2 text-xs text-gray-500">Charts are defined below (not rendered in preview).</p>
          <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-3 text-xs">
            {JSON.stringify(charts, null, 2)}
          </pre>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Appendix: Blood markers
        </h2>
        {appendix.blood_markers.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">None</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">Marker</th>
                <th className="py-2 pr-4 font-medium">Value</th>
                <th className="py-2 font-medium">Ref</th>
              </tr>
            </thead>
            <tbody>
              {appendix.blood_markers.map((m, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{m.name}</td>
                  <td className="py-2 pr-4">{m.value ?? "—"}{m.unit ? ` ${m.unit}` : ""}{m.flag ? ` [${m.flag}]` : ""}</td>
                  <td className="py-2">{m.referenceRange ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Appendix: Image findings
        </h2>
        {appendix.image_findings.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">None</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {appendix.image_findings.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.filename}</span>: {f.caption}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
