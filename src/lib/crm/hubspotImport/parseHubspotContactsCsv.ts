import { HEADER_TO_KEY, type HubspotContactParsedRow } from "./hubspotContactCsvColumns";
import { parseCsvRows, trimCell } from "./parseDelimitedText";

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase();
}

export type ParseHubspotContactsCsvResult = {
  headers: string[];
  rows: HubspotContactParsedRow[];
  error?: string;
};

export function parseHubspotContactsCsv(content: string): ParseHubspotContactsCsvResult {
  const matrix = parseCsvRows(content);
  if (matrix.length < 1) {
    return { headers: [], rows: [], error: "CSV is empty." };
  }
  const headers = matrix[0].map((h) => h.trim());
  const headerKeys = headers.map((h) => HEADER_TO_KEY[normaliseHeader(h)]);
  const unknown = headers.filter((h, i) => !headerKeys[i] && normaliseHeader(h).length > 0);
  if (unknown.length && !headerKeys.some(Boolean)) {
    return {
      headers,
      rows: [],
      error:
        "Unrecognised headers: " +
        unknown.slice(0, 5).join(", ") +
        (unknown.length > 5 ? "..." : ""),
    };
  }

  const rows: HubspotContactParsedRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const obj: HubspotContactParsedRow = {
      rowIndex: r,
      recordId: null,
      firstName: null,
      lastName: null,
      email: null,
      phoneNumber: null,
      contactOwner: null,
      leadStatus: null,
      createDate: null,
      lastModifiedDate: null,
      contactType: null,
      lifecycleStage: null,
      leadSource: null,
      stageOfJourney: null,
      nextAppointmentDate: null,
      associatedDeal: null,
      associatedCompany: null,
      associatedDealIds: null,
      nonSurgical: null,
    };
    for (let c = 0; c < headers.length; c++) {
      const key = headerKeys[c];
      if (!key) continue;
      const raw = line[c];
      const v = trimCell(raw);
      (obj as Record<string, unknown>)[key] = v;
    }
    rows.push(obj);
  }
  return { headers, rows };
}
