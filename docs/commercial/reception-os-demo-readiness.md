# ReceptionOS — Commercial Demo Readiness

This checklist prepares ReceptionOS for external clinic demonstrations and buyer conversations. It complements the [production readiness runbook](../runbooks/reception-os-production-readiness.md).

## Pre-demo setup

- [ ] Confirm `RECEPTION_OS_COMMUNICATION_DRY_RUN=true` (default) — **no live SMS/email**
- [ ] Do **not** enable `RECEPTION_OS_EMAIL_SEND_ENABLED` or `RECEPTION_OS_SMS_SEND_ENABLED` for demos
- [ ] Enable demo presentation:
  - **URL toggle:** `/fi-admin/{tenantId}/reception-os?demo=1` (admin / clinic manager only)
  - **Deployment flag:** `RECEPTION_OS_DEMO_MODE=true` forces demo mode for all viewers
  - **Optional:** `RECEPTION_OS_DEMO_MASK_AMOUNTS=true` masks dollar values
- [ ] Verify the blue **Demo Mode** banner appears
- [ ] Confirm patient names are anonymised and contact details hidden
- [ ] If the tenant has no live operational data, sample records are shown automatically

## Demo script (15–20 minutes)

### 1. Opening — pain framing (2 min)

> “Reception teams lose revenue when deposits slip, follow-ups stall, and surgery readiness issues surface too late. ReceptionOS gives your front desk one command centre instead of five tabs.”

### 2. Morning prep mode (3 min)

- Open **Daily brief** — today’s patient count, deposits, surgery risks
- Switch to **Morning prep** operating mode
- Highlight prioritised widgets (patients, deposits, surgery)

### 3. Live clinic mode (5 min)

- Switch to **Live clinic**
- Walk through **Today’s patients** and **Communication timeline**
- Show **Action alerts** → create a task from an alert
- Open **Task inbox** — assign, progress, resolve
- Emphasise: communications are **dry-run only** during pilot/demo

### 4. Revenue & conversion (4 min)

- Show **Conversion scoreboard** and **Revenue intelligence** (admin view)
- Point out at-risk revenue alerts and recommended next actions
- Explain weighted revenue is directional, not accounting

### 5. End of day & owner value (4 min)

- Switch to **End of day** — closeout checklist
- Scroll to **Owner value dashboard** and **Pilot review report**
- Export JSON/CSV for follow-up (no patient content in exports)

### 6. Close (2 min)

- Reiterate live-send safety defaults
- Discuss pilot → production path and pricing (see below)

## Buyer pain points to emphasise

| Pain | ReceptionOS answer |
|------|-------------------|
| Deposits overdue before surgery | Outstanding deposits widget + deposit reminder templates + tasks |
| Consultation follow-up gaps | Pipeline + revenue risk alerts + quote follow-up actions |
| Surgery readiness surprises | Upcoming surgery widget + readiness checklist |
| Staff working across tools | Single command centre with role-based views |
| Owner lacks visibility | Owner value dashboard + pilot review export |
| Fear of accidental patient messages | Dry-run default + demo anonymisation |

## Key feature walkthrough checklist

- [ ] Operating mode tabs (morning / live / end of day)
- [ ] Daily brief summary lines
- [ ] Task inbox create-from-alert flow
- [ ] Communication composer preview (dry-run)
- [ ] Consultation pipeline columns
- [ ] Revenue intelligence top opportunities
- [ ] End-of-day closeout checklist
- [ ] Pilot manager metrics (today)
- [ ] Owner value dashboard (14-day)
- [ ] Pilot review report + export
- [ ] Demo mode toggle and banner
- [ ] System status panel (provider mode, env checklist)

## Screenshots checklist

Capture these for sales collateral (use demo mode):

1. Full dashboard header with **Demo Mode** banner
2. Daily brief + action alerts side by side
3. Task inbox with an open critical task
4. Communication timeline (anonymised)
5. Outstanding deposits with masked amounts (if enabled)
6. Revenue intelligence / conversion scoreboard
7. End-of-day closeout widget
8. Owner value dashboard
9. Pilot review report with export buttons
10. System status showing dry-run / pilot mode

## Live-send safety explanation

Use this wording with buyers and clinic IT:

> “ReceptionOS defaults to dry-run. Outbound SMS and email are logged to the CRM timeline and delivery table but are **not** sent externally unless an administrator explicitly enables live channel flags **and** provider credentials are configured. Demo mode additionally anonymises patient data. Exports contain operational metrics only — never message bodies or patient identifiers.”

**Environment controls:**

| Variable | Demo / pilot | Production (later) |
|----------|--------------|-------------------|
| `RECEPTION_OS_COMMUNICATION_DRY_RUN` | `true` | `false` when ready |
| `RECEPTION_OS_EMAIL_SEND_ENABLED` | unset / `false` | `true` with Resend configured |
| `RECEPTION_OS_SMS_SEND_ENABLED` | unset / `false` | `true` with Twilio configured |
| `RECEPTION_OS_DEMO_MODE` | `true` for external demos | `false` |

## Pricing positioning notes

Position ReceptionOS as **front-desk revenue protection**, not a generic CRM add-on:

- **Value anchor:** estimated revenue protected + risks closed (from owner dashboard)
- **Seat model:** reception + clinic manager users on the command centre
- **Pilot offer:** 2–4 week pilot with pilot review export and adoption scoring
- **Upsell path:** live communications, multi-site roll-up, FI intelligence hints
- **Comparison:** replaces manual spreadsheet tracking + ad-hoc follow-up lists

Suggested narrative:

> “Most clinics discover five-figure revenue at risk in the first pilot fortnight. ReceptionOS pays for itself when one deposit is recovered or one surgery readiness issue is caught early.”

## Post-demo follow-up

- [ ] Send pilot review JSON export (no patient content)
- [ ] Share screenshot pack from demo mode session
- [ ] Confirm pilot tenant env vars remain dry-run
- [ ] Schedule week-2 check-in using owner value metrics

## Related commands

```bash
npm run validate:reception-os
npm run smoke:reception-os
```

Export endpoints (admin / clinic manager):

```
GET /api/tenants/{tenantId}/reception-os/export?format=json
GET /api/tenants/{tenantId}/reception-os/export?format=csv
```
