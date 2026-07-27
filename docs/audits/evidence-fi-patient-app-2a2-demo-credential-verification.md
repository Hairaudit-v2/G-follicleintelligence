# FI-PATIENT-APP-2A.2 — Demo Credential Verification

**Verdict: GREEN**  
**Date:** 2026-07-27  
**Branch:** `feature/fi-patient-app-2a1-gateway-auth-parity`

## Steps executed

1. `npm run seed:patient-gateway-mobile-demo` — idempotent re-seed succeeded (`created.authUser/patient/person = false`; existing fixture reused/relinked).
2. Credentials captured locally to `.env.patient-gateway-mobile.local` (matched by `.gitignore` `.env*.local`) — **password not committed**.
3. Direct Supabase Auth `signInWithPassword` against configured project host `iqqvzgxoimxchhcnbzxl.supabase.co`.
4. Sign-in succeeded → bearer session present (`expiresIn=3600`, email confirmed).
5. Same bearer → `GET https://follicleintelligence.ai/api/patient/v1/me` → **200** `ok:true`.

## Auth failure branches

Not applicable — sign-in and `/me` both succeeded. No environment mismatch, password drift, confirmation block, or silent seed failure observed.

## Explicit non-changes

- Production auth not weakened
- Golden SMOKETEST patient not modified
- Synthetic fixture only (email `e2e-patient-gateway-mobile@fi-demo.example`)

## Operator note

Mobile app local login: use email above; password from FiOS seed stdout or `.env.patient-gateway-mobile.local` / patient-app gitignored `.env` `DEMO_PATIENT_PASSWORD`.
