# FI-PATIENT-APP-2H.1 — Patient web gateway production proof (FiOS)

**Ticket:** FI-PATIENT-APP-2H.1 (FiOS half)  
**Date:** 2026-07-28  
**Repo:** `G:\follicleintelligence`  
**Verdict:** **GREEN** for gateway CORS / web return-URL support on production FiOS

## Shipped

| Item | Value |
|------|--------|
| Branch | `feature/fi-patient-gateway-web-origin` (merged to `main`) |
| Commit | `14b490b042c7d3843d01a57d4c2c56706a63efb2` |
| Production deployment | `dpl_6Cgv6rUvD5E187fXTF5voB3esj77` READY |
| Aliases | `follicleintelligence.ai`, `www.follicleintelligence.ai` |

## Changes

- Explicit CORS allowlist for `https://app.follicleintelligence.ai` on `/api/patient/v1/*`
- Preflight OPTIONS → 204 with Allow-Origin / Methods / Headers; unapproved Origin → 403
- Payment-session accepts `platform: "web"` and returns Stripe Checkout to `https://app.follicleintelligence.ai/payment/return`
- Env schema: `FI_PATIENT_WEB_APP_URL`, optional `FI_PATIENT_WEB_CORS_ORIGINS`

## Live CORS proof

```
OPTIONS https://follicleintelligence.ai/api/patient/v1/me
Origin: https://app.follicleintelligence.ai
→ 204
Access-Control-Allow-Origin: https://app.follicleintelligence.ai
Access-Control-Allow-Methods: GET,POST,PATCH,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept

Origin: https://evil.example
→ 403 Forbidden
```

## Notes

- Staff FiOS webapp routes unchanged.
- Patient PWA hosting / DNS / Supabase redirects tracked in patient-app evidence (`evidence-fi-patient-app-2h1-web-pwa.md`).
- Recommend setting `FI_PATIENT_WEB_APP_URL=https://app.follicleintelligence.ai` explicitly on FiOS Vercel (code already defaults to this URL).

## Evidence hygiene

No secrets, tokens, or PHI.
