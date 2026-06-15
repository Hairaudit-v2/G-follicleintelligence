/**
 * User-facing copy for email delivery failures. Keep in sync with support runbooks.
 * Do not embed secrets, tokens, or raw third-party error payloads here.
 */
export const FI_RESEND_PUBLIC_SEND_FAILED_MESSAGE =
  "We could not send the email right now. Please try again in a few minutes, or contact support if this continues.";

export const FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE =
  "We could not send the invitation email. Check that authentication email (SMTP or Auth provider) is configured in Supabase, then try again or contact support.";
