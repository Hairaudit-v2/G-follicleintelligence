# Resend, transactional email, and tenant admin invites

This runbook explains **two separate email paths** in Follicle Intelligence OS and how to configure them without leaking secrets to clients or logs inappropriately.

## 1) Application transactional email (Resend HTTP API)

**Used for:** appointment reminder emails (when live delivery is on), pathology PDF to patient, compound pharmacy order emails, and any other code paths that call the shared Resend sender (`src/lib/email/resendHttpSend.server.ts`).

**Environment variables (server-only — never prefix with `NEXT_PUBLIC_`):**

| Variable | Required when | Notes |
|----------|-----------------|--------|
| `RESEND_API_KEY` | Sending any of the above | Create in [Resend dashboard](https://resend.com/api-keys). Used only in server code and API routes. |
| `RESEND_FROM_EMAIL` | Same | Must be an address on a **verified sending domain** (or Resend’s test constraints in non-production). |
| `RESEND_FROM_NAME` | Optional | Display name; combined into the `From` header via `buildResendFromAddress` (`src/lib/reminders/reminderDeliveryConfig.ts`). |
| `RESEND_REPLY_TO` | Optional | Single address or comma-separated list; forwarded to Resend as `reply_to` when set. There is **no** `FI_EMAIL_FROM` variable — use `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME`. |

**Failure behaviour:** On non-2xx from Resend, the app logs a structured JSON line with event `fi_resend_email_send_failed` (HTTP status, Resend error name/message, optional `tenant_id` / `delivery_path` — **never** the API key or attachment payload). Callers throw or return a **generic user-facing message** from `src/lib/email/emailDeliveryPublicMessages.ts` so CRM/UI responses do not echo provider errors verbatim.

**Production env gate:** `validateFiServerEnv` (`src/lib/env/fiEnv.server.ts`) requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in **production** only when `FI_REMINDERS_LIVE_DELIVERY` is truthy. Other Resend-powered features (pathology, pharmacy) still need the variables at runtime when those features are used; the gate does not currently enforce Resend for every feature flag combination.

**Staging / preview:** Same variables as production if you send real mail from those deployments; use a separate Resend API key or restricted key where possible.

## 2) Supabase Auth invitation email (`inviteUserByEmail`)

**Used for:** first tenant admin during **platform tenant provisioning** (`provisionPlatformTenant` in `src/lib/fiOs/platformTenantProvision.server.ts`) and **tenant admin invites** from clinic settings (`inviteTenantAdminUserAction` in `lib/actions/fi-tenant-admin-actions.ts`).

**This path does not call Resend from the Next.js app.** Supabase Auth sends the message using the **Supabase project’s Auth email configuration** (built-in mail or **custom SMTP** — many teams connect Resend SMTP here, but that is configured in Supabase, not via `RESEND_API_KEY` in this repo).

**Failure behaviour:** On failure, the app logs `fi_auth_admin_invite_failed` with `source`, `tenant_id` or `tenant_slug`, `recipient_email_domain`, and Supabase error metadata (server logs only). The UI receives `FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE` from `emailDeliveryPublicMessages.ts` — not the raw Supabase error string.

## Operational checklist

1. **Transactional (in-app Resend):** Verify domain in Resend; set `RESEND_FROM_EMAIL` on that domain; deploy `RESEND_API_KEY` to Vercel **server** env.
2. **Auth invites:** In Supabase Dashboard → Authentication → Email templates / SMTP, ensure outbound mail works (rate limits, SPF, DKIM as per Supabase + provider docs).
3. **Log drain:** Search for `fi_resend_email_send_failed` and `fi_auth_admin_invite_failed` when debugging “email not received” reports.

## Related files

- `src/lib/email/resendHttpSend.server.ts` — single Resend HTTP integration + structured failure logs  
- `src/lib/email/emailDeliveryPublicMessages.ts` — safe UI strings  
- `src/lib/reminders/reminderDeliveryConfig.server.ts` — loads Resend env for reminders and shared email features  
- `docs/runbooks/fi-os-production-env-and-cron.md` — broader env + cron reference  
