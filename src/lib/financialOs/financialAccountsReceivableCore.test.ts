import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyPaymentToArCase,
  arCaseDedupeKey,
  buildAccountsReceivableCase,
  buildAccountsReceivableEvent,
  buildCaseArDisplayStatus,
  buildReminderDraft,
  calculateDaysOverdue,
  calculateReceivableRiskLevel,
  classifyReceivableType,
  deriveArCaseFromInvoice,
  FI_AR_HIGH_VALUE_THRESHOLD_CENTS,
  mapAccountsReceivableCaseRow,
} from "@/src/lib/financialOs/financialAccountsReceivableCore";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INVOICE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TODAY = "2026-06-20";

describe("financialAccountsReceivableCore", () => {
  it("classifyReceivableType maps invoice kinds", () => {
    assert.equal(
      classifyReceivableType({ invoice_kind: "consultation_quote" }),
      "consultation_invoice"
    );
    assert.equal(classifyReceivableType({ invoice_kind: "surgery_deposit" }), "surgery_deposit");
    assert.equal(classifyReceivableType({ invoice_kind: "surgery_balance" }), "surgery_balance");
    assert.equal(
      classifyReceivableType({ invoice_kind: "other", metadata: { source: "subscription" } }),
      "subscription"
    );
  });

  it("calculateDaysOverdue returns zero when not past due", () => {
    assert.equal(
      calculateDaysOverdue({
        due_date: "2026-06-25",
        outstanding_amount_cents: 1000,
        todayYmd: TODAY,
      }),
      0
    );
    assert.equal(
      calculateDaysOverdue({
        due_date: "2026-06-15",
        outstanding_amount_cents: 0,
        todayYmd: TODAY,
      }),
      0
    );
  });

  it("overdue invoice derive creates AR case payload", () => {
    const derived = deriveArCaseFromInvoice({
      tenant_id: TENANT_A,
      todayYmd: TODAY,
      invoice: {
        id: INVOICE,
        patient_id: null,
        case_id: null,
        lead_id: null,
        clinic_id: null,
        invoice_kind: "consultation_quote",
        total_cents: 120_000,
        amount_paid_cents: 0,
        due_date: "2026-06-10",
        title: "Consultation quote",
      },
      trigger: "invoice_overdue",
    });
    assert.ok(derived);
    assert.equal(derived!.receivable_type, "consultation_invoice");
    assert.equal(derived!.outstanding_amount_cents, 120_000);
    assert.equal(derived!.days_overdue, 10);
    assert.equal(derived!.status, "open");
  });

  it("duplicate AR case prevented via dedupe key for same invoice/type", () => {
    const key1 = arCaseDedupeKey(TENANT_A, INVOICE, "consultation_invoice");
    const key2 = arCaseDedupeKey(TENANT_A, INVOICE, "consultation_invoice");
    const key3 = arCaseDedupeKey(TENANT_A, INVOICE, "surgery_deposit");
    assert.equal(key1, key2);
    assert.notEqual(key1, key3);
  });

  it("partial payment reduces outstanding", () => {
    const result = applyPaymentToArCase({
      case: { outstanding_amount_cents: 50_000, status: "open", original_amount_cents: 100_000 },
      payment_amount_cents: 20_000,
      todayYmd: TODAY,
      receivable_type: "consultation_invoice",
      days_overdue: 5,
    });
    assert.equal(result.outstanding_amount_cents, 30_000);
    assert.equal(result.resolved, false);
    assert.equal(result.status, "open");
  });

  it("full payment resolves AR case", () => {
    const result = applyPaymentToArCase({
      case: {
        outstanding_amount_cents: 15_000,
        status: "call_required",
        original_amount_cents: 15_000,
      },
      payment_amount_cents: 15_000,
      todayYmd: TODAY,
      receivable_type: "surgery_balance",
      days_overdue: 8,
    });
    assert.equal(result.outstanding_amount_cents, 0);
    assert.equal(result.resolved, true);
    assert.equal(result.status, "resolved");
  });

  it("deposit missed creates surgery_deposit AR case", () => {
    const derived = deriveArCaseFromInvoice({
      tenant_id: TENANT_A,
      todayYmd: TODAY,
      invoice: {
        id: INVOICE,
        patient_id: null,
        case_id: null,
        lead_id: null,
        clinic_id: null,
        invoice_kind: "surgery_deposit",
        total_cents: 80_000,
        amount_paid_cents: 0,
        due_date: "2026-06-19",
        title: "Surgery deposit",
      },
      trigger: "deposit_deadline_missed",
    });
    assert.ok(derived);
    assert.equal(derived!.receivable_type, "surgery_deposit");
    assert.equal(derived!.days_overdue, 1);
    assert.equal(derived!.risk_level, "medium");
  });

  it("high-value overdue invoice risk classification", () => {
    const highValue = FI_AR_HIGH_VALUE_THRESHOLD_CENTS + 1;
    const risk = calculateReceivableRiskLevel({
      receivable_type: "consultation_invoice",
      days_overdue: 3,
      outstanding_amount_cents: highValue,
    });
    assert.equal(risk, "high");

    const critical = calculateReceivableRiskLevel({
      receivable_type: "surgery_balance",
      days_overdue: 15,
      outstanding_amount_cents: highValue,
    });
    assert.equal(critical, "critical");
  });

  it("manual call log appends event payload", () => {
    const event = buildAccountsReceivableEvent({
      tenant_id: TENANT_A,
      ar_case_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      event_kind: "call_logged",
      actor_fi_user_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      detail: { notes: "Left voicemail" },
    });
    assert.equal(event.event_kind, "call_logged");
    assert.equal(event.detail.notes, "Left voicemail");
  });

  it("written off preserves audit history via append-only event", () => {
    const event = buildAccountsReceivableEvent({
      tenant_id: TENANT_A,
      ar_case_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      event_kind: "written_off",
      detail: { reason: "Uncollectable after 90 days" },
    });
    assert.equal(event.event_kind, "written_off");
    assert.equal(event.detail.reason, "Uncollectable after 90 days");
  });

  it("tenant isolation — mapped row preserves tenant_id", () => {
    const row = mapAccountsReceivableCaseRow({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      tenant_id: TENANT_A,
      patient_id: null,
      case_id: null,
      invoice_id: INVOICE,
      lead_id: null,
      clinic_id: null,
      assigned_fi_user_id: null,
      receivable_type: "consultation_invoice",
      original_amount_cents: 1000,
      outstanding_amount_cents: 1000,
      days_overdue: 2,
      risk_level: "medium",
      status: "open",
      next_action_at: null,
      last_contacted_at: null,
      source_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      resolved_at: null,
    });
    assert.equal(row.tenant_id, TENANT_A);
    assert.notEqual(row.tenant_id, TENANT_B);
  });

  it("reminder drafts do not send real messages", () => {
    const draft = buildReminderDraft({
      receivable_type: "surgery_balance",
      channel: "email",
      patient_name: "Alex",
      outstanding_amount_cents: 250_000,
      currency: "AUD",
      days_overdue: 9,
      invoice_title: "Surgery balance",
    });
    assert.equal(draft.delivery_mode, "draft_only");
    assert.match(draft.reminder_body_preview, /DRAFT/i);
    assert.equal(draft.reminder_channel, "email");
    assert.ok(draft.reminder_template_key.length > 0);
  });

  it("buildCaseArDisplayStatus reflects payment plan and high risk", () => {
    assert.equal(buildCaseArDisplayStatus([]), "no_ar_issue");
    assert.equal(
      buildCaseArDisplayStatus([
        { status: "payment_plan", risk_level: "medium", outstanding_amount_cents: 1000 },
      ]),
      "payment_plan_active"
    );
    assert.equal(
      buildCaseArDisplayStatus([
        { status: "open", risk_level: "critical", outstanding_amount_cents: 5000 },
      ]),
      "high_risk_overdue"
    );
    assert.equal(
      buildCaseArDisplayStatus([
        { status: "resolved", risk_level: "low", outstanding_amount_cents: 0 },
      ]),
      "resolved"
    );
  });

  it("buildAccountsReceivableCase sets next action for open cases", () => {
    const built = buildAccountsReceivableCase({
      tenant_id: TENANT_A,
      receivable_type: "surgery_balance",
      original_amount_cents: 200_000,
      outstanding_amount_cents: 200_000,
      days_overdue: 10,
      risk_level: "high",
      todayYmd: TODAY,
    });
    assert.equal(built.status, "open");
    assert.ok(built.next_action_at);
    assert.equal(built.resolved_at, null);
  });
});
