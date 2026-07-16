/**
 * Parse / normalise LLM JSON for AI Patient Summary.
 */

import type {
  PatientAiSummaryLlmPayload,
  PatientAiSummaryOperationalFlag,
  PatientAiSummaryTimelineItem,
} from "./patientAiSummaryTypes";

function asString(v: unknown, max = 500): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function stripCodeFences(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("```")) {
    return t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  return t;
}

export function parsePatientAiSummaryLlmJson(
  raw: string
): { ok: true; payload: PatientAiSummaryLlmPayload } | { ok: false; error: string } {
  try {
    const text = stripCodeFences(raw);
    const data = JSON.parse(text) as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return { ok: false, error: "Model returned non-object JSON." };
    }
    const overview = asString(data.overview, 1200);
    if (!overview) return { ok: false, error: "Missing overview." };

    const timelineRaw = Array.isArray(data.timelineHighlights) ? data.timelineHighlights : [];
    const timelineHighlights: PatientAiSummaryTimelineItem[] = timelineRaw
      .slice(0, 8)
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          occurredOn: asString(r.occurredOn, 32) || "unknown",
          kind: asString(r.kind, 40) || "event",
          label: asString(r.label, 200) || "Activity",
        };
      })
      .filter((t) => t.label);

    const flagsRaw = Array.isArray(data.operationalFlags) ? data.operationalFlags : [];
    const operationalFlags: PatientAiSummaryOperationalFlag[] = flagsRaw
      .slice(0, 8)
      .map((row) => {
        const r = row as Record<string, unknown>;
        const severity = String(r.severity ?? "info") === "attention" ? "attention" : "info";
        return {
          code: asString(r.code, 60) || "flag",
          label: asString(r.label, 200),
          severity,
          hrefSuffix: r.hrefSuffix != null ? asString(r.hrefSuffix, 80) : null,
        };
      })
      .filter((f) => f.label);

    const stepsRaw = Array.isArray(data.suggestedNextSteps) ? data.suggestedNextSteps : [];
    const suggestedNextSteps = stepsRaw
      .map((s) => asString(s, 240))
      .filter(Boolean)
      .slice(0, 6);

    return {
      ok: true,
      payload: {
        overview,
        timelineHighlights,
        operationalFlags,
        suggestedNextSteps,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to parse model JSON.",
    };
  }
}
