# ReceptionOS — production readiness & Evolved Hair clinic pilot

Use this runbook before enabling ReceptionOS for front-desk testing at **Evolved Hair** (or any tenant). ReceptionOS **defaults to dry-run communication** — outbound SMS/email are logged, not sent externally, unless env flags explicitly enable live delivery.

**Related docs**

- Legacy reception kanban: `/fi-admin/[tenantId]/reception` (unchanged — do not regress)
- Command centre: `/fi-admin/[tenantId]/reception-os`
- Resend/Twilio: `docs/runbooks/resend-and-transactional-email.md`
- FI production smoke: `scripts/fi-production-smoke-test.ts`
- FI env audit: `docs/runbooks/fi-os-production-env-and-cron.md`

---

## 1. Required migrations

Apply in order on the target Supabase project **before** clinic pilot:

| Migration | Purpose |
|-----------|---------|
| `20260919120001_fi_reception_tasks.sql` | Phase 2 task inbox + audit |
| `20260919120002_fi_reception_communication_phase4.sql` | Communication templates + audit `communication_sent` |
| `20260919120003_fi_reception_phase5_delivery_closeout.sql` | Delivery tracking + daily closeout tables |
| `20260919120004_fi_reception_phase7_pilot_metrics.sql` | Usage events + pilot feedback (Phase 7 metrics) |

**Verify**

```bash
npx supabase migration up
```

**Pilot validation (DB + loaders)**

```bash
RECEPTION_OS_PILOT_TENANT_ID=<uuid> npm run validate:reception-os
```

---

## 2. Communication flags (dry-run by default)

| Variable | Default | Purpose |
|----------|---------|---------|
| `RECEPTION_OS_COMMUNICATION_DRY_RUN` | **On** (unset = dry-run) | When on, SMS/email never hit Resend/Twilio |
| `RECEPTION_OS_EMAIL_SEND_ENABLED` | Off | Must be `true`/`1`/`on` for live email (only when dry-run off) |
| `RECEPTION_OS_SMS_SEND_ENABLED` | Off | Must be `true`/`1`/`on` for live SMS (only when dry-run off) |

**Safe Evolved pilot (recommended)**

```env
RECEPTION_OS_COMMUNICATION_DRY_RUN=true
```

Do not set `RECEPTION_OS_EMAIL_SEND_ENABLED` or `RECEPTION_OS_SMS_SEND_ENABLED` for the initial pilot.

---

## 3. Resend / Twilio prerequisites (live send only)

| Channel | Required env |
|---------|----------------|
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |

See `docs/runbooks/resend-and-transactional-email.md`.

The **System status** panel on `/reception-os` shows dry-run, channel flags, provider mode, provider configured (boolean only), failed sends today, and closeout status.

---

## 4. Deployment checklist

- [ ] Migrations applied (section 1)
- [ ] `RECEPTION_OS_COMMUNICATION_DRY_RUN` confirmed on for pilot
- [ ] Live send flags unset or false
- [ ] Evolved tenant UUID confirmed
- [ ] `npm run validate:reception-os` passes (warnings OK for empty clinic days)
- [ ] `npm run smoke:reception-os` passes against deployed host
- [ ] Pilot banner visible on command centre
- [ ] Legacy `/reception` board still loads

---

## 5. Smoke test checklist

**Deployed host (read-only)**

```bash
FI_BASE_URL=https://<your-host> \
FI_SMOKE_TENANT_ID=<tenant-uuid> \
FI_ADMIN_API_KEY=<server-key> \
npm run smoke:reception-os
```

| Check | Verifies |
|-------|----------|
| A | `/reception-os` denies unauthenticated access |
| B | Legacy `/reception` denies unauthenticated access |
| C | Reception OS API denies unauthenticated access |
| D | API payload matches command centre schema |
| E | `endOfDayCloseout` + `systemStatus` present |
| F | Dry-run / pilot mode active unless intentionally live |

**Manual mutation checks (test lead/patient only)**

- [ ] Create task from action alert
- [ ] Send SMS from composer → CRM log + delivery row with `dry_run`
- [ ] End-of-day closeout loads; manager closes day with notes

---

## 6. Rollback steps

1. Set `RECEPTION_OS_COMMUNICATION_DRY_RUN=true` and disable live channel flags. Redeploy.
2. Route staff to legacy `/reception` if needed.
3. Migrations are additive — do not drop Phase 2–5 tables without backup.
4. Re-run `npm run smoke:reception-os`.

See `docs/runbooks/fi-os-rollback-playbook.md`.

---

## 7. Pilot QA checklist (manual)

### Role views

- [ ] **Receptionist** — tasks, log call/note; outbound send restricted by policy
- [ ] **Consultant** — limited send templates only
- [ ] **Clinic manager** — close day on end-of-day tab
- [ ] **Admin** — full widgets + system status panel

### UX

- [ ] Mobile/tablet readability at 768px
- [ ] Dark-mode contrast on banner, badges, failed comm list
- [ ] Empty states (no patients, no tasks, no failed comms)

### Data safety

- [ ] Payload `tenantId` matches URL — no cross-tenant patient names
- [ ] Pilot banner + system status show dry-run **On** before any live flag change

### Phase 1–5 regression

- [ ] Legacy `/reception` kanban unchanged
- [ ] Communication timeline reads CRM contact log
- [ ] Operating modes filter widgets correctly

---

## 8. Source files (Phase 6)

| Area | Path |
|------|------|
| System status model | `src/lib/receptionOs/receptionOsPilotStatusModel.ts` |
| Pilot validation | `src/lib/receptionOs/receptionOsPilotValidation.server.ts` |
| Status panel UI | `src/components/fi-admin/reception-os/ReceptionOsSystemStatusPanel.tsx` |
| Pilot banner UI | `src/components/fi-admin/reception-os/ReceptionOsPilotBanner.tsx` |
| Smoke script | `scripts/reception-os-smoke-test.ts` |
| Validation script | `scripts/reception-os-pilot-validation.ts` |
