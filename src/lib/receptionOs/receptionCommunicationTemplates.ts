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
] as const;

export type ReceptionCommunicationTemplateKey =
  (typeof RECEPTION_COMMUNICATION_TEMPLATE_KEYS)[number];

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
