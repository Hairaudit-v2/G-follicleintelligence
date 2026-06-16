import test from "node:test";
import assert from "node:assert/strict";

import { splitHubspotDealIds } from "@/src/lib/crm/hubspotImport/hubspotDealIds";
import { mapLeadStatusToKey, mapStageOfJourneyToPipelineSlug } from "@/src/lib/crm/hubspotImport/hubspotImportMappings";
import { parseHubspotContactsCsv } from "@/src/lib/crm/hubspotImport/parseHubspotContactsCsv";
import { parseCsvRows } from "@/src/lib/crm/hubspotImport/parseDelimitedText";
import { validateHubspotContactsRows } from "@/src/lib/crm/hubspotImport/validateHubspotContactsImport";
import type { HubspotContactParsedRow } from "@/src/lib/crm/hubspotImport/hubspotContactCsvColumns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<HubspotContactParsedRow> & { rowIndex?: number; recordId?: string }): HubspotContactParsedRow {
  // Use "key" in overrides for fields that tests may explicitly set to null,
  // so null is preserved rather than falling back to the default via ??.
  return {
    rowIndex: overrides.rowIndex ?? 1,
    recordId: overrides.recordId ?? "1",
    firstName: "firstName" in overrides ? (overrides.firstName as string) : "Test",
    lastName: "lastName" in overrides ? (overrides.lastName as string) : "User",
    email: "email" in overrides ? (overrides.email as string | null) : "test@example.com",
    phoneNumber: "phoneNumber" in overrides ? (overrides.phoneNumber as string | null) : "+61 412 345 678",
    contactOwner: null,
    leadStatus: "leadStatus" in overrides ? (overrides.leadStatus as string | null) : "New",
    createDate: null,
    lastModifiedDate: null,
    contactType: "contactType" in overrides ? (overrides.contactType as string | null) : null,
    lifecycleStage: "lifecycleStage" in overrides ? (overrides.lifecycleStage as string | null) : null,
    leadSource: null,
    stageOfJourney: "stageOfJourney" in overrides ? (overrides.stageOfJourney as string | null) : null,
    nextAppointmentDate: null,
    associatedDeal: null,
    associatedCompany: null,
    associatedDealIds: null,
    nonSurgical: "nonSurgical" in overrides ? (overrides.nonSurgical as string | null) : null,
  };
}

// ---------------------------------------------------------------------------
// Existing tests (unchanged behaviour)
// ---------------------------------------------------------------------------

test("parseCsvRows handles quoted commas", () => {
  const rows = parseCsvRows('a,"b,c",d\n1,2,3');
  assert.deepEqual(rows, [
    ["a", "b,c", "d"],
    ["1", "2", "3"],
  ]);
});

test("parseHubspotContactsCsv maps headers", () => {
  const csv = [
    "Record ID,First Name,Last Name,Email,Phone Number,Contact owner,Lead Status,Create Date,Last Modified Date,Contact Type,Lifecycle Stage,Lead Source,Stage of Journey,Next appointment date,Associated Deal,Associated Company,Associated Deal IDs",
    "1,John,Doe,john@example.com,+61412345678,owner,New,2024-01-01,2024-01-02,Lead,Lead,Organic Search,Welcome,,,",
  ].join("\n");
  const r = parseHubspotContactsCsv(csv);
  assert.equal(r.error, undefined);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].email, "john@example.com");
  assert.equal(r.rows[0].recordId, "1");
  assert.equal(r.rows[0].leadStatus, "New");
});

test("validateHubspotContactsRows flags duplicate phone as warning only", () => {
  const rows = [
    makeRow({ rowIndex: 1, recordId: "1", email: "a@test.com", phoneNumber: "+61412345678" }),
    makeRow({ rowIndex: 2, recordId: "2", email: "b@test.com", phoneNumber: "+61412345678" }),
  ];
  const rep = validateHubspotContactsRows(rows);
  const dup1 = rep.rowResults[0].issues.filter((i) => i.code === "duplicate_phone");
  const dup2 = rep.rowResults[1].issues.filter((i) => i.code === "duplicate_phone");
  assert.equal(dup1.length, 1);
  assert.equal(dup2.length, 1);
  assert.equal(dup1[0].blocking, false);
  assert.equal(rep.passed, true, "duplicate phone alone should not block import");
});

test("validateHubspotContactsRows flags duplicate record id as blocking", () => {
  const rows = [
    makeRow({ rowIndex: 1, recordId: "X" }),
    makeRow({ rowIndex: 2, recordId: "X" }),
  ];
  const rep = validateHubspotContactsRows(rows);
  const dup = rep.rowResults[0].issues.filter((i) => i.code === "duplicate_record_id");
  assert.equal(dup.length, 1);
  assert.equal(dup[0].blocking, true);
  assert.equal(rep.passed, false);
});

test("validateHubspotContactsRows classification patient when contact type mentions patient", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "10", contactType: "Patient" })];
  const rep = validateHubspotContactsRows(rows);
  assert.equal(rep.rowResults[0].classification, "patient");
});

test("validateHubspotContactsRows classification mixed when surgery booked and lifecycle is lead", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "11", stageOfJourney: "Surgery booked", lifecycleStage: "Lead" })];
  const rep = validateHubspotContactsRows(rows);
  assert.equal(rep.rowResults[0].classification, "mixed_patient_lead");
});

test("validateHubspotContactsRows classification patient when surgery done despite lead lifecycle", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "12", stageOfJourney: "Surgery done", lifecycleStage: "Lead" })];
  const rep = validateHubspotContactsRows(rows);
  assert.equal(rep.rowResults[0].classification, "patient");
});

test("validateHubspotContactsRows classification lead_only for welcome journey and lead", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "13", stageOfJourney: "Welcome", lifecycleStage: "Lead" })];
  const rep = validateHubspotContactsRows(rows);
  assert.equal(rep.rowResults[0].classification, "lead_only");
});

test("mapStageOfJourneyToPipelineSlug maps consult scheduled", () => {
  const r = mapStageOfJourneyToPipelineSlug("Consult scheduled");
  assert.equal(r.unmapped, false);
  assert.ok(r.slug);
});

test("mapLeadStatusToKey maps new", () => {
  const r = mapLeadStatusToKey("New");
  assert.equal(r.unmapped, false);
  assert.ok(r.key);
});

test("splitHubspotDealIds splits and dedupes", () => {
  assert.deepEqual(splitHubspotDealIds("1;2;2;3"), ["1", "2", "3"]);
  assert.deepEqual(splitHubspotDealIds(null), []);
});

// ---------------------------------------------------------------------------
// NEW: Scientific-notation phone detection
// ---------------------------------------------------------------------------

test("scientific notation phone is flagged as warning, not blocking", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "100", phoneNumber: "6.14123E+10" })];
  const rep = validateHubspotContactsRows(rows);
  const sci = rep.rowResults[0].issues.filter((i) => i.code === "scientific_notation_phone");
  assert.equal(sci.length, 1, "should have one scientific_notation_phone issue");
  assert.equal(sci[0].blocking, false, "should not be blocking");
  assert.equal(rep.passed, true, "report should pass (warning only)");
  assert.equal(rep.rowResults[0].phoneCorrupted, true, "phoneCorrupted flag set");
});

test("scientific notation phone variants are all detected", () => {
  const variants = ["6.14123E+10", "6.14123e+10", "6.14E+10", "1.23456789E+11", "9.99E+9"];
  for (const ph of variants) {
    const rows = [makeRow({ rowIndex: 1, recordId: "101", phoneNumber: ph })];
    const rep = validateHubspotContactsRows(rows);
    const sci = rep.rowResults[0].issues.filter((i) => i.code === "scientific_notation_phone");
    assert.equal(sci.length, 1, "variant " + ph + " should be flagged");
  }
});

test("valid phone numbers are not flagged as scientific notation", () => {
  const valids = ["+61412345678", "0412345678", "1800 123 456", "(02) 9999 8888"];
  for (const ph of valids) {
    const rows = [makeRow({ rowIndex: 1, recordId: "102", phoneNumber: ph })];
    const rep = validateHubspotContactsRows(rows);
    const sci = rep.rowResults[0].issues.filter((i) => i.code === "scientific_notation_phone");
    assert.equal(sci.length, 0, "valid phone " + ph + " should not be flagged");
  }
});

test("scientific notation phone is excluded from in-file duplicate detection", () => {
  // Two rows with the same scientific notation phone should NOT produce duplicate_phone_in_file
  const rows = [
    makeRow({ rowIndex: 1, recordId: "103a", phoneNumber: "6.14123E+10" }),
    makeRow({ rowIndex: 2, recordId: "103b", phoneNumber: "6.14123E+10" }),
  ];
  const rep = validateHubspotContactsRows(rows);
  const dup1 = rep.rowResults[0].issues.filter((i) => i.code === "duplicate_phone");
  const dup2 = rep.rowResults[1].issues.filter((i) => i.code === "duplicate_phone");
  assert.equal(dup1.length, 0, "corrupted phone should not participate in dedup");
  assert.equal(dup2.length, 0, "corrupted phone should not participate in dedup");
});

// ---------------------------------------------------------------------------
// NEW: No email AND no phone
// ---------------------------------------------------------------------------

test("no email and no phone produces blocking no_contact_method issue", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "300", email: null, phoneNumber: null })];
  const rep = validateHubspotContactsRows(rows);
  const ncm = rep.rowResults[0].issues.filter((i) => i.code === "no_contact_method");
  assert.equal(ncm.length, 1);
  assert.equal(ncm[0].blocking, true);
  assert.equal(rep.passed, false);
  assert.equal(rep.rowsBlockedCount, 1);
});

test("email present but no phone does NOT produce no_contact_method", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "301", email: "e@test.com", phoneNumber: null })];
  const rep = validateHubspotContactsRows(rows);
  const ncm = rep.rowResults[0].issues.filter((i) => i.code === "no_contact_method");
  assert.equal(ncm.length, 0);
});

test("phone present but no email does NOT produce no_contact_method", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "302", email: null, phoneNumber: "0412345678" })];
  const rep = validateHubspotContactsRows(rows);
  const ncm = rep.rowResults[0].issues.filter((i) => i.code === "no_contact_method");
  assert.equal(ncm.length, 0);
});

// ---------------------------------------------------------------------------
// NEW: Email in name fields
// ---------------------------------------------------------------------------

test("email in first name field produces email_in_first_name warning", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "400", firstName: "john@example.com" })];
  const rep = validateHubspotContactsRows(rows);
  const issues = rep.rowResults[0].issues.filter((i) => i.code === "email_in_first_name");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].blocking, false);
});

test("email in last name field produces email_in_last_name warning", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "401", lastName: "john@example.com" })];
  const rep = validateHubspotContactsRows(rows);
  const issues = rep.rowResults[0].issues.filter((i) => i.code === "email_in_last_name");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].blocking, false);
});

test("normal names do not produce email_in_name issues", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "402", firstName: "John", lastName: "Smith" })];
  const rep = validateHubspotContactsRows(rows);
  const issues = rep.rowResults[0].issues.filter((i) => i.code === "email_in_first_name" || i.code === "email_in_last_name");
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// NEW: Placeholder phone detection
// ---------------------------------------------------------------------------

test("all-same-digit phone is flagged as placeholder", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "500", phoneNumber: "0000000000" })];
  const rep = validateHubspotContactsRows(rows);
  const ph = rep.rowResults[0].issues.filter((i) => i.code === "placeholder_phone");
  assert.equal(ph.length, 1);
  assert.equal(ph[0].blocking, false);
});

test("sequential 1234567890 phone is flagged as placeholder", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "501", phoneNumber: "1234567890" })];
  const rep = validateHubspotContactsRows(rows);
  const ph = rep.rowResults[0].issues.filter((i) => i.code === "placeholder_phone");
  assert.equal(ph.length, 1);
});

test("normal phone is not flagged as placeholder", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "502", phoneNumber: "0412345678" })];
  const rep = validateHubspotContactsRows(rows);
  const ph = rep.rowResults[0].issues.filter((i) => i.code === "placeholder_phone");
  assert.equal(ph.length, 0);
});

// ---------------------------------------------------------------------------
// NEW: Missing Lead Status
// ---------------------------------------------------------------------------

test("missing lead status produces missing_lead_status warning", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "600", leadStatus: null })];
  const rep = validateHubspotContactsRows(rows);
  const issues = rep.rowResults[0].issues.filter((i) => i.code === "missing_lead_status");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].blocking, false);
});

test("empty string lead status produces missing_lead_status warning", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "601", leadStatus: "   " })];
  const rep = validateHubspotContactsRows(rows);
  const issues = rep.rowResults[0].issues.filter((i) => i.code === "missing_lead_status");
  assert.equal(issues.length, 1);
});

test("valid lead status does not produce missing_lead_status", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "602", leadStatus: "New" })];
  const rep = validateHubspotContactsRows(rows);
  const missing = rep.rowResults[0].issues.filter((i) => i.code === "missing_lead_status");
  assert.equal(missing.length, 0);
});

test("freeform lead status produces unmapped_lead_status not missing_lead_status", () => {
  const rows = [makeRow({ rowIndex: 1, recordId: "603", leadStatus: "Totally Custom Value" })];
  const rep = validateHubspotContactsRows(rows);
  const missing = rep.rowResults[0].issues.filter((i) => i.code === "missing_lead_status");
  const unmapped = rep.rowResults[0].issues.filter((i) => i.code === "unmapped_lead_status");
  assert.equal(missing.length, 0, "should not produce missing_lead_status for non-empty value");
  assert.equal(unmapped.length, 1, "should produce unmapped_lead_status for unrecognised value");
});

// ---------------------------------------------------------------------------
// NEW: Non-Surgical column
// ---------------------------------------------------------------------------

test("parseHubspotContactsCsv parses Non-Surgical column when present", () => {
  const csv = [
    "Record ID,First Name,Email,Non-Surgical",
    "111,Alice,alice@test.com,Yes",
    "222,Bob,bob@test.com,",
  ].join("\n");
  const r = parseHubspotContactsCsv(csv);
  assert.equal(r.error, undefined);
  assert.equal(r.rows[0].nonSurgical, "Yes");
  assert.equal(r.rows[1].nonSurgical, null);
});

test("parseHubspotContactsCsv sets nonSurgical to null when column absent", () => {
  const csv = [
    "Record ID,First Name,Email",
    "333,Carol,carol@test.com",
  ].join("\n");
  const r = parseHubspotContactsCsv(csv);
  assert.equal(r.error, undefined);
  assert.equal(r.rows[0].nonSurgical, null);
});

// ---------------------------------------------------------------------------
// NEW: Dry-run report row counts
// ---------------------------------------------------------------------------

test("dry-run report counts rows blocked vs importable correctly", () => {
  const rows: HubspotContactParsedRow[] = [
    // Importable: has both email and phone
    makeRow({ rowIndex: 1, recordId: "r1", email: "a@test.com", phoneNumber: "0412000001" }),
    // Blocked: no email, no phone
    makeRow({ rowIndex: 2, recordId: "r2", email: null, phoneNumber: null }),
    // Importable but with warning (scientific notation phone)
    makeRow({ rowIndex: 3, recordId: "r3", email: "c@test.com", phoneNumber: "6.14E+10" }),
  ];
  const rep = validateHubspotContactsRows(rows);
  assert.equal(rep.rowsBlockedCount, 1, "one row blocked (no_contact_method)");
  assert.equal(rep.rowsImportableCount, 2, "two rows importable");
  assert.equal(rep.quarantinedPhoneCount, 1, "one row with quarantined phone");
  assert.equal(rep.passed, false, "report fails due to blocking issue");
});
