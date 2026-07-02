# D6 Operational Bake Checklist

FI-UX-REBUILD **D6F** — manual validation steps for a real tenant before moving to prediction (D7).

Operational safety only. No new automation. No patient-identifying data should appear in revision, workspace sync, or learning exports.

## A. Today refresh

1. Open **Today** for the bake tenant.
2. Trigger a safe state change (for example, reception board phase change or a non-destructive test booking update).
3. Confirm Today refreshes without full page navigation.
4. Confirm there is no full-page spinner — only quiet in-place refresh.

## B. QR arrival

1. Generate an arrival token for a same-day booking.
2. Open `/arrival?token=...`.
3. Confirm **"says they're here"** appears on Today for reception.
4. Confirm reception check-in clears the intent.
5. Confirm the item dissolves or moves bucket as expected.

## C. Priority scoring

1. Confirm arrival intent outranks a stale lead for reception.
2. Confirm a surgery payment/readiness blocker ranks **critical** when surgery is tomorrow.
3. Confirm pathology review ranks higher for doctor/surgeon profiles than reception.

## D. Learning

1. Enable learning for the test tenant (`FI_TODAY_SIGNAL_LEARNING_ENABLED` or tenant allowlist).
2. Confirm observations are created in `fi_today_signal_observations`.
3. Confirm metadata contains no PHI (no names, amounts, pathology text, or free-text notes).
4. Confirm the Signal Learning admin surface renders aggregate-only summaries.

## E. Workspace sync

1. Open patient, payment, or surgery workspace panels.
2. Trigger a relevant operational signal (arrival intent, payment blocker, pathology pending).
3. Confirm the panel remains open.
4. Confirm **Updated just now** (or equivalent) appears.
5. Confirm stack/order of open workspaces is preserved.

## F. Presence

1. Trigger arrival intent with no confirmed reception signal.
2. Confirm careful wording only:
   - **not confirmed**
   - **needs confirmation**
   - **appears unattended**
3. Confirm banned wording does **not** appear:
   - absent
   - late
   - failed
   - not working
   - no-show

## G. Privacy

1. Inspect the revision endpoint: `/api/tenants/{tenantId}/today-signal/revision`.
2. Inspect `workspaceSignals` in the revision response.
3. Inspect the learning summary payload (D6C route/API if applicable).
4. Confirm no names, payment amounts, pathology text, clinical notes, or consultation notes.

## H. Rollback

1. Disable D6 flags (Today surface, Realtime, revision poll, learning, workspace sync as needed).
2. Confirm legacy / non-live behaviour still works.
3. Confirm Today does not crash when learning, sync, or presence sub-flags are off.

## I. D6F bake surface

1. Open `/fi-admin/{tenantId}/intelligence/d6-bake` as platform admin or clinic manager.
2. Confirm overall status is **Pass**, **Watch**, or **Fail** — not an error page.
3. Confirm rollout flags render without secrets or raw tenant allowlists.
4. Confirm validation domains list feed integrity, privacy, presence, workspace sync, and performance budget.
5. Review warnings and recommended next action before enabling broader rollout.

## Internal automation

Unit tests:

```bash
FI_TEST_ROOTS=src/lib/fiOs npm run test:unit
npm run typecheck
```

Optional E2E (opt-in):

```bash
FI_E2E_D6_BAKE=true FI_E2E_TODAY_SURFACE_ENABLED=true npx playwright test e2e/fi-ux-d6f-intelligence-bake.spec.ts --project=chromium-authenticated
```

## Ready for D7?

Proceed only when:

- D6F bake surface shows **Pass** or acceptable **Watch** items only.
- No **Fail** checks remain for privacy, tenant isolation, or feed integrity.
- Manual checklist sections A–H are signed off for at least one live clinic tenant.
