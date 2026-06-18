import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES,
  renderReceptionCommunicationTemplate,
  renderReceptionCommunicationTemplateContent,
} from "@/src/lib/receptionOs/receptionCommunicationTemplates";

describe("receptionCommunicationTemplates", () => {
  it("renders merge variables in SMS and email bodies", () => {
    const tpl = RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES.deposit_reminder;
    const rendered = renderReceptionCommunicationTemplateContent(tpl, {
      patient_first_name: "Alex",
      clinic_name: "Evolved Clinic",
      deposit_amount: "AUD 500",
    });
    assert.match(rendered.smsBody ?? "", /Alex/);
    assert.match(rendered.smsBody ?? "", /Evolved Clinic/);
    assert.match(rendered.emailSubject ?? "", /Evolved Clinic/);
  });

  it("replaces unknown tokens with empty string", () => {
    const out = renderReceptionCommunicationTemplate("Hello {{patient_first_name}} {{unknown_var}}", {
      patient_first_name: "Sam",
    });
    assert.equal(out, "Hello Sam ");
  });

  it("ships all seven default template keys", () => {
    assert.equal(Object.keys(RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES).length, 7);
    assert.ok(RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES.payment_link_follow_up.smsBody?.includes("{{payment_link}}"));
  });
});
