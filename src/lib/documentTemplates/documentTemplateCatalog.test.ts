import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENT_TEMPLATE_CATEGORIES,
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  DOCUMENT_TEMPLATE_DEFAULTS,
} from "./documentTemplateConstants";
import {
  REMINDER_TRIGGER_EVENTS,
  REMINDER_TRIGGER_GROUPS,
  REMINDER_TRIGGER_LABELS,
} from "@/src/lib/reminders/reminderConstants";
import {
  RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES,
  RECEPTION_COMMUNICATION_TEMPLATE_KEYS,
  RECEPTION_COMMUNICATION_TEMPLATE_LABELS,
} from "@/src/lib/receptionOs/receptionCommunicationTemplates";

test("document template defaults cover every category except custom", () => {
  const cats = new Set(DOCUMENT_TEMPLATE_DEFAULTS.map((d) => d.category));
  for (const c of DOCUMENT_TEMPLATE_CATEGORIES) {
    if (c === "custom") continue;
    assert.ok(cats.has(c), `missing default for category ${c}`);
    assert.ok(DOCUMENT_TEMPLATE_CATEGORY_LABELS[c]);
  }
  for (const d of DOCUMENT_TEMPLATE_DEFAULTS) {
    assert.ok(d.slug.trim().length > 0);
    assert.ok(d.body.trim().length > 40);
  }
});

test("reminder triggers include invoice payment and booking lifecycle keys", () => {
  for (const key of [
    "booking_same_day",
    "booking_cancelled",
    "booking_rescheduled",
    "invoice_deposit_reminder",
    "invoice_balance_reminder",
    "invoice_due_reminder",
    "invoice_overdue_reminder",
    "invoice_paid_receipt",
  ] as const) {
    assert.ok((REMINDER_TRIGGER_EVENTS as readonly string[]).includes(key));
    assert.ok(REMINDER_TRIGGER_LABELS[key]);
  }
  const flat = REMINDER_TRIGGER_GROUPS.flatMap((g) => g.triggers);
  for (const t of REMINDER_TRIGGER_EVENTS) {
    assert.ok(flat.includes(t), `trigger ${t} missing from groups`);
  }
});

test("reception commercial templates include invoice and sales-terms keys", () => {
  for (const key of [
    "invoice_payment_reminder",
    "invoice_overdue",
    "balance_due_reminder",
    "sales_terms_send",
    "booking_confirmation",
    "booking_cancellation",
    "post_payment_thank_you",
  ] as const) {
    assert.ok((RECEPTION_COMMUNICATION_TEMPLATE_KEYS as readonly string[]).includes(key));
    assert.ok(RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES[key]);
    assert.ok(RECEPTION_COMMUNICATION_TEMPLATE_LABELS[key]);
  }
});
