import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatRelativeReceived,
  getPrimaryDisplayName,
  getReadableLeadSource,
} from "./PendingApprovalsList";

describe("Inbox PendingApprovalsList helpers", () => {
  it("maps HubSpot lead_source values to readable labels", () => {
    assert.equal(getReadableLeadSource("IN_PROGRESS"), "In Progress");
    assert.equal(getReadableLeadSource("CONNECTED"), "Connected");
    assert.equal(getReadableLeadSource("UNQUALIFIED"), "Unqualified");
    assert.equal(getReadableLeadSource("OPEN_DEAL"), "Open Deal");
    assert.equal(getReadableLeadSource("Website Appointment Button"), "Website Appointment");
    assert.equal(getReadableLeadSource("SOME_CUSTOM_SOURCE"), "SOME CUSTOM SOURCE");
    assert.equal(getReadableLeadSource(null), "Unknown source");
  });

  it("uses firstname + lastname, then email", () => {
    assert.equal(
      getPrimaryDisplayName({ firstName: "Ada", lastName: "Lovelace", email: "a@b.com" }),
      "Ada Lovelace"
    );
    assert.equal(
      getPrimaryDisplayName({ firstName: null, lastName: null, email: "solo@clinic.com" }),
      "solo@clinic.com"
    );
    assert.equal(
      getPrimaryDisplayName({ firstName: "  ", lastName: "", email: "  e@x.com  " }),
      "e@x.com"
    );
  });

  it("formats relative times with date-fns", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const label = formatRelativeReceived(twoDaysAgo);
    assert.match(label, /day/i);
    assert.equal(formatRelativeReceived(null), "");
  });
});
