/**
 * ReceptionOS Phase 4 — tenant-scoped communication templates (pure model).
 * Variables: patient_first_name, appointment_date, surgery_date, quote_amount,
 * deposit_amount, payment_link, clinic_name
 */

export const RECEPTION_COMMUNICATION_TEMPLATE_KEYS = [
  "quote_follow_up",
  "deposit_reminder",
  "surgery_readiness",
  "consultation_no_show",
  "cold_lead_reactivation",
  "payment_link_follow_up",
  "appointment_reminder",
  "invoice_payment_reminder",
  "invoice_overdue",
  "balance_due_reminder",
  "sales_terms_send",
  "booking_confirmation",
  "booking_cancellation",
  "post_payment_thank_you",
] as const;

export type ReceptionCommunicationTemplateKey =
  (typeof RECEPTION_COMMUNICATION_TEMPLATE_KEYS)[number];

export const RECEPTION_COMMUNICATION_TEMPLATE_LABELS: Record<
  ReceptionCommunicationTemplateKey,
  string
> = {
  quote_follow_up: "Quote follow-up",
  deposit_reminder: "Deposit reminder",
  surgery_readiness: "Surgery readiness",
  consultation_no_show: "Consultation no-show",
  cold_lead_reactivation: "Cold lead reactivation",
  payment_link_follow_up: "Payment link follow-up",
  appointment_reminder: "Appointment reminder",
  invoice_payment_reminder: "Invoice payment reminder",
  invoice_overdue: "Invoice overdue",
  balance_due_reminder: "Balance due reminder",
  sales_terms_send: "Sales terms & conditions",
  booking_confirmation: "Booking confirmation",
  booking_cancellation: "Booking cancellation",
  post_payment_thank_you: "Post-payment thank you",
};

export const RECEPTION_COMMUNICATION_TEMPLATE_VARIABLES = [
  "patient_first_name",
  "appointment_date",
  "surgery_date",
  "quote_amount",
  "deposit_amount",
  "payment_link",
  "clinic_name",
] as const;

export type ReceptionCommunicationTemplateVariable =
  (typeof RECEPTION_COMMUNICATION_TEMPLATE_VARIABLES)[number];

export type ReceptionCommunicationTemplateVariables = Partial<
  Record<ReceptionCommunicationTemplateVariable, string>
>;

export type ReceptionCommunicationTemplateContent = {
  templateKey: ReceptionCommunicationTemplateKey;
  smsBody: string | null;
  emailSubject: string | null;
  emailBody: string | null;
};

export type ReceptionCommunicationRenderedMessage = {
  templateKey: ReceptionCommunicationTemplateKey;
  smsBody: string | null;
  emailSubject: string | null;
  emailBody: string | null;
};

/** Built-in defaults — tenants may override via fi_reception_communication_templates. */
export const RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES: Record<
  ReceptionCommunicationTemplateKey,
  ReceptionCommunicationTemplateContent
> = {
  quote_follow_up: {
    templateKey: "quote_follow_up",
    smsBody:
      "Hi {{patient_first_name}}, this is {{clinic_name}}. We wanted to follow up on the treatment quote we sent. Do you have any questions or would you like to book your next step?",
    emailSubject: "Following up on your quote — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nThank you again for your consultation with {{clinic_name}}. We wanted to check whether you had any questions about your quote{{quote_amount}}.\n\nPlease reply to this email or call us when you are ready to take the next step.\n\nKind regards,\n{{clinic_name}}",
  },
  deposit_reminder: {
    templateKey: "deposit_reminder",
    smsBody:
      "Hi {{patient_first_name}}, friendly reminder from {{clinic_name}}: your deposit{{deposit_amount}} is outstanding. Please let us know if you need help completing payment.",
    emailSubject: "Deposit reminder — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nThis is a reminder that your deposit{{deposit_amount}} with {{clinic_name}} is still outstanding.\n\nIf you have already paid, please disregard this message. Otherwise, reply and we can assist.\n\nKind regards,\n{{clinic_name}}",
  },
  surgery_readiness: {
    templateKey: "surgery_readiness",
    smsBody:
      "Hi {{patient_first_name}}, {{clinic_name}} here. Your surgery is scheduled for {{surgery_date}}. Please confirm you have completed pre-op forms and payment steps.",
    emailSubject: "Surgery readiness check — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nYour procedure with {{clinic_name}} is scheduled for {{surgery_date}}.\n\nPlease confirm pre-operative forms, consent, and any outstanding payments are complete. Reply if you need assistance.\n\nKind regards,\n{{clinic_name}}",
  },
  consultation_no_show: {
    templateKey: "consultation_no_show",
    smsBody:
      "Hi {{patient_first_name}}, we missed you at your consultation with {{clinic_name}} on {{appointment_date}}. Would you like to reschedule?",
    emailSubject: "Reschedule your consultation — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nWe noticed you were unable to attend your consultation on {{appointment_date}}.\n\nWe would love to help you reschedule at a time that suits you. Please reply or call {{clinic_name}}.\n\nKind regards,\n{{clinic_name}}",
  },
  cold_lead_reactivation: {
    templateKey: "cold_lead_reactivation",
    smsBody:
      "Hi {{patient_first_name}}, {{clinic_name}} checking in. We are here if you would like to continue exploring your hair restoration options.",
    emailSubject: "Still thinking about your options? — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nWe have not heard from you in a little while and wanted to check whether you still have questions about treatment with {{clinic_name}}.\n\nWe are happy to help when you are ready.\n\nKind regards,\n{{clinic_name}}",
  },
  payment_link_follow_up: {
    templateKey: "payment_link_follow_up",
    smsBody:
      "Hi {{patient_first_name}}, here is your secure payment link from {{clinic_name}}: {{payment_link}}",
    emailSubject: "Your payment link — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nPlease use the link below to complete your payment with {{clinic_name}}:\n\n{{payment_link}}\n\nIf you need help, reply to this email.\n\nKind regards,\n{{clinic_name}}",
  },
  appointment_reminder: {
    templateKey: "appointment_reminder",
    smsBody:
      "Hi {{patient_first_name}}, reminder: your appointment with {{clinic_name}} is on {{appointment_date}}. Reply if you need to reschedule.",
    emailSubject: "Appointment reminder — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nThis is a reminder that your appointment with {{clinic_name}} is scheduled for {{appointment_date}}.\n\nPlease contact us if you need to change your booking.\n\nKind regards,\n{{clinic_name}}",
  },
  invoice_payment_reminder: {
    templateKey: "invoice_payment_reminder",
    smsBody:
      "Hi {{patient_first_name}}, friendly reminder from {{clinic_name}}: payment{{deposit_amount}} is due. Pay securely: {{payment_link}}",
    emailSubject: "Payment reminder — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nThis is a reminder that a payment{{deposit_amount}} with {{clinic_name}} is due.\n\nYou can pay securely here:\n{{payment_link}}\n\nIf you have already paid, please disregard this message.\n\nKind regards,\n{{clinic_name}}",
  },
  invoice_overdue: {
    templateKey: "invoice_overdue",
    smsBody:
      "Hi {{patient_first_name}}, your account with {{clinic_name}} is overdue{{deposit_amount}}. Please pay or contact us: {{payment_link}}",
    emailSubject: "Overdue payment notice — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nOur records show an overdue balance{{deposit_amount}} with {{clinic_name}}.\n\nPlease complete payment using the link below, or contact us if you need a payment plan:\n{{payment_link}}\n\nKind regards,\n{{clinic_name}}",
  },
  balance_due_reminder: {
    templateKey: "balance_due_reminder",
    smsBody:
      "Hi {{patient_first_name}}, your remaining balance{{deposit_amount}} with {{clinic_name}} is due before treatment. {{payment_link}}",
    emailSubject: "Balance due before treatment — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nThis is a reminder that your remaining balance{{deposit_amount}} with {{clinic_name}} is due before your scheduled treatment.\n\nPay securely:\n{{payment_link}}\n\nKind regards,\n{{clinic_name}}",
  },
  sales_terms_send: {
    templateKey: "sales_terms_send",
    smsBody:
      "Hi {{patient_first_name}}, please review the sales terms from {{clinic_name}} before confirming your booking. Reply if you have questions.",
    emailSubject: "Sales terms & conditions — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nPlease review our sales terms and conditions from {{clinic_name}} before confirming your booking or treatment.\n\nIf anything is unclear, reply to this email and we will help.\n\nKind regards,\n{{clinic_name}}",
  },
  booking_confirmation: {
    templateKey: "booking_confirmation",
    smsBody:
      "Hi {{patient_first_name}}, your booking with {{clinic_name}} on {{appointment_date}} is confirmed. See you then.",
    emailSubject: "Booking confirmed — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nYour booking with {{clinic_name}} on {{appointment_date}} is confirmed.\n\nPlease arrive a few minutes early and bring any requested documents. Reply if you need to reschedule.\n\nKind regards,\n{{clinic_name}}",
  },
  booking_cancellation: {
    templateKey: "booking_cancellation",
    smsBody:
      "Hi {{patient_first_name}}, your appointment with {{clinic_name}} on {{appointment_date}} has been cancelled. Reply to rebook.",
    emailSubject: "Appointment cancelled — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nYour appointment with {{clinic_name}} scheduled for {{appointment_date}} has been cancelled.\n\nReply to this email or call us when you are ready to rebook.\n\nKind regards,\n{{clinic_name}}",
  },
  post_payment_thank_you: {
    templateKey: "post_payment_thank_you",
    smsBody:
      "Hi {{patient_first_name}}, thank you for your payment to {{clinic_name}}. We appreciate your trust.",
    emailSubject: "Thank you for your payment — {{clinic_name}}",
    emailBody:
      "Hi {{patient_first_name}},\n\nThank you for your payment to {{clinic_name}}. We have received it and appreciate your trust in our care.\n\nIf you need a receipt or have any questions, reply to this email.\n\nKind regards,\n{{clinic_name}}",
  },
};

const VARIABLE_PATTERN = /\{\{([a-z_]+)\}\}/g;

export function isReceptionCommunicationTemplateKey(
  v: string
): v is ReceptionCommunicationTemplateKey {
  return (RECEPTION_COMMUNICATION_TEMPLATE_KEYS as readonly string[]).includes(v.trim());
}

/** Replace {{variable}} tokens; unknown tokens are left unchanged. */
export function renderReceptionCommunicationTemplate(
  template: string,
  variables: ReceptionCommunicationTemplateVariables
): string {
  return template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    const val = variables[key as ReceptionCommunicationTemplateVariable];
    return val != null && String(val).trim() ? String(val).trim() : "";
  });
}

/** Format optional amount fields for natural insertion in copy. */
export function formatTemplateAmountField(
  amount: string | number | null | undefined,
  currency?: string | null
): string {
  if (amount == null || amount === "") return "";
  const n = typeof amount === "number" ? amount : Number(String(amount).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  const cur = currency?.trim() || "AUD";
  return ` of ${cur} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function renderReceptionCommunicationTemplateContent(
  content: ReceptionCommunicationTemplateContent,
  variables: ReceptionCommunicationTemplateVariables
): ReceptionCommunicationRenderedMessage {
  const enriched: ReceptionCommunicationTemplateVariables = { ...variables };
  if (enriched.quote_amount && !String(enriched.quote_amount).startsWith(" of ")) {
    enriched.quote_amount = formatTemplateAmountField(enriched.quote_amount);
  }
  if (enriched.deposit_amount && !String(enriched.deposit_amount).startsWith(" of ")) {
    enriched.deposit_amount = formatTemplateAmountField(enriched.deposit_amount);
  }

  return {
    templateKey: content.templateKey,
    smsBody: content.smsBody
      ? renderReceptionCommunicationTemplate(content.smsBody, enriched)
      : null,
    emailSubject: content.emailSubject
      ? renderReceptionCommunicationTemplate(content.emailSubject, enriched)
      : null,
    emailBody: content.emailBody
      ? renderReceptionCommunicationTemplate(content.emailBody, enriched)
      : null,
  };
}

export function resolveReceptionCommunicationTemplate(
  templateKey: ReceptionCommunicationTemplateKey,
  tenantOverride?: ReceptionCommunicationTemplateContent | null
): ReceptionCommunicationTemplateContent {
  if (tenantOverride?.templateKey === templateKey) return tenantOverride;
  return RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES[templateKey];
}
