import test from "node:test";
import assert from "node:assert/strict";

import { splitHubspotDealIds } from "@/src/lib/crm/hubspotImport/hubspotDealIds";
import { mapLeadStatusToKey, mapStageOfJourneyToPipelineSlug } from "@/src/lib/crm/hubspotImport/hubspotImportMappings";
import { parseHubspotContactsCsv } from "@/src/lib/crm/hubspotImport/parseHubspotContactsCsv";
import { parseCsvRows } from "@/src/lib/crm/hubspotImport/parseDelimitedText";
import { validateHubspotContactsRows } from "@/src/lib/crm/hubspotImport/validateHubspotContactsImport";
import type { HubspotContactParsedRow } from "@/src/lib/crm/hubspotImport/hubspotContactCsvColumns";

test("parseCsvRows handles quoted commas", () => {
  const rows = parseCsvRows('a,"b,c",d\n1,2,3');
  assert.deepEqual(rows, [
    ["a", "b,c", "d"],
    ["1", "2", "3"],
  ]);
});

test("parseHubspotContactsCsv maps headers", () => {
  const csv = [
    "Record ID,First Name,Email,Stage of Journey",
    "123,Jane,jane@example.com,Consult scheduled",
    "456,John,,",
  ].join("\n");
  const r = parseHubspotContactsCsv(csv);
  assert.equal(r.error, undefined);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].recordId, "123");
  assert.equal(r.rows[0].firstName, "Jane");
  assert.equal(r.rows[0].email, "jane@example.com");
  assert.equal(r.rows[0].stageOfJourney, "Consult scheduled");
});

test("validateHubspotContactsRows flags duplicate phone as warning only", () => {
  const rows: HubspotContactParsedRow[] = [
    {
      rowIndex: 1,
      recordId: "1",
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      phoneNumber: "4155550100",
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
    },
    {
      rowIndex: 2,
      recordId: "2",
      firstName: "C",
      lastName: "D",
      email: "b@test.com",
      phoneNumber: "(415) 555-0100",
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
    },
  ];
  const rep = validateHubspotContactsRows(rows);
  assert.equal(rep.passed, true);
  assert.equal(rep.blockingCount, 0);
  assert.equal(rep.warningCount, 2);
  assert.deepEqual(rep.duplicatePhonesInFile, ["4155550100"]);
  const dupIssues = rep.rowResults.flatMap((r) => r.issues.filter((i) => i.code === "duplicate_phone"));
  assert.equal(dupIssues.length, 2);
  assert.ok(dupIssues.every((i) => i.blocking === false));
});

test("validateHubspotContactsRows flags duplicate record id as blocking", () => {
  const rows: HubspotContactParsedRow[] = [
    {
      rowIndex: 1,
      recordId: "1",
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
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
    },
    {
      rowIndex: 2,
      recordId: "1",
      firstName: "C",
      lastName: "D",
      email: "b@test.com",
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
    },
  ];
  const rep = validateHubspotContactsRows(rows);
  assert.equal(rep.passed, false);
  assert.ok(rep.blockingCount > 0);
});

test("validateHubspotContactsRows classification patient when contact type mentions patient", () => {
  const rows: HubspotContactParsedRow[] = [
    {
      rowIndex: 1,
      recordId: "99",
      firstName: "X",
      lastName: "Y",
      email: "x@example.com",
      phoneNumber: "+1 555 0100",
      contactOwner: null,
      leadStatus: null,
      createDate: null,
      lastModifiedDate: null,
      contactType: "Patient",
      lifecycleStage: "lead",
      leadSource: null,
      stageOfJourney: null,
      nextAppointmentDate: null,
      associatedDeal: null,
      associatedCompany: null,
      associatedDealIds: null,
    },
  ];
  const rep = validateHubspotContactsRows(rows);
  assert.equal(rep.rowResults[0]?.classification, "patient");
});

test("mapStageOfJourneyToPipelineSlug maps consult scheduled", () => {
  const m = mapStageOfJourneyToPipelineSlug("Consult scheduled");
  assert.equal(m.slug, "consult_scheduled");
  assert.equal(m.unmapped, false);
});

test("mapLeadStatusToKey maps new", () => {
  const m = mapLeadStatusToKey("NEW");
  assert.equal(m.key, "new");
  assert.equal(m.unmapped, false);
});

test("splitHubspotDealIds splits and dedupes", () => {
  assert.deepEqual(splitHubspotDealIds("a; b , a"), ["a", "b"]);
});
