import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  createLeadflowEnquiryInputSchema,
  LEADFLOW_ENQUIRY_SOURCE_LABELS,
  mapLeadflowEnquiryToCrmCreateBody,
  normalizeLeadSourceLabel,
} from "@/src/lib/leadFlow/createLeadflowEnquiryCore";

const LEAD_INDEX_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/crm/page.tsx";
const NEW_ENQUIRY_DIALOG = "src/components/fi-admin/leadflow/NewEnquiryDialog.tsx";
const LEADFLOW_DIAGNOSTICS = "src/components/fi-admin/leadflow/LeadFlowSystemDiagnostics.tsx";

const FORBIDDEN_OPERATOR_LABELS = [
  "FI admin key",
  "External source lead id",
  "Extra person metadata",
  "Person source system",
];

describe("createLeadflowEnquiryCore", () => {
  it("requires name, interest, and at least one contact method", () => {
    const missingContact = createLeadflowEnquiryInputSchema.safeParse({
      name: "Jane Doe",
      interest: "prp",
    });
    assert.equal(missingContact.success, false);

    const ok = createLeadflowEnquiryInputSchema.safeParse({
      name: "Jane Doe",
      phone: "07700900123",
      interest: "hair_transplant",
    });
    assert.equal(ok.success, true);
  });

  it("normalizes lead source keys to operator-facing labels", () => {
    assert.equal(normalizeLeadSourceLabel("website"), "Website");
    assert.equal(normalizeLeadSourceLabel("phone_call"), "Phone call");
    assert.equal(normalizeLeadSourceLabel("walk_in"), "Walk in");
    assert.equal(normalizeLeadSourceLabel("meta_ads"), "Meta ads");
    assert.equal(normalizeLeadSourceLabel("google_ads"), "Google ads");
    assert.equal(normalizeLeadSourceLabel("referral"), "Referral");
    assert.equal(normalizeLeadSourceLabel("hubspot"), "HubSpot");
    assert.equal(normalizeLeadSourceLabel("other"), "Other");
    assert.deepEqual(LEADFLOW_ENQUIRY_SOURCE_LABELS, {
      website: "Website",
      phone_call: "Phone call",
      walk_in: "Walk in",
      meta_ads: "Meta ads",
      google_ads: "Google ads",
      referral: "Referral",
      hubspot: "HubSpot",
      other: "Other",
    });
  });

  it("maps enquiry fields to CRM create payload without admin key or internal metadata", () => {
    const parsed = createLeadflowEnquiryInputSchema.parse({
      name: "Jane Doe",
      email: "jane@example.com",
      interest: "hair_transplant",
      leadSource: "website",
      priority: "high",
      notes: "  Prefers weekday calls  ",
    });

    const body = mapLeadflowEnquiryToCrmCreateBody(parsed);
    assert.equal(body.summary, "Hair transplant — Jane Doe");
    assert.equal(body.status, "open");
    assert.deepEqual(body.metadata, {
      created_via: "leadflow_enquiry_ui",
      interest: "hair_transplant",
      interest_label: "Hair transplant",
      lead_source: "website",
      lead_source_label: "Website",
      intake_notes: "Prefers weekday calls",
    });

    const person = body.person as Record<string, unknown>;
    assert.equal(person.source_system, "fi_crm");
    assert.equal(person.phone, null);
    assert.equal(person.email, "jane@example.com");
    assert.deepEqual(person.metadata, { notes: "Prefers weekday calls" });
    assert.equal(body.priority, "high");
    assert.equal(body.adminKey, undefined);
  });

  it("stores blank phone and email as null", () => {
    const parsed = createLeadflowEnquiryInputSchema.parse({
      name: "Jane Doe",
      phone: "   ",
      email: " jane@example.com ",
      interest: "general_enquiry",
    });

    const body = mapLeadflowEnquiryToCrmCreateBody(parsed);
    const person = body.person as Record<string, unknown>;
    assert.equal(person.phone, null);
    assert.equal(person.email, "jane@example.com");
  });
});

describe("Lead Index operator UI regression guard", () => {
  it("does not render developer create-lead fields on the Lead Index page", () => {
    const leadIndexPage = readFileSync(LEAD_INDEX_PAGE, "utf8");
    const newEnquiryDialog = readFileSync(NEW_ENQUIRY_DIALOG, "utf8");

    assert.doesNotMatch(leadIndexPage, /CrmCreateLeadPanel/);
    assert.match(leadIndexPage, /NewEnquiryDialog/);

    for (const label of FORBIDDEN_OPERATOR_LABELS) {
      assert.doesNotMatch(leadIndexPage, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(newEnquiryDialog, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("keeps the raw create-lead panel behind system diagnostics permission", () => {
    const diagnostics = readFileSync(LEADFLOW_DIAGNOSTICS, "utf8");
    assert.match(diagnostics, /\{showDiagnosticsExpanded \? \([\s\S]*CrmCreateLeadPanel/);
  });
});
