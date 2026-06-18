# Timely direct API probe

Read-only validation of Timely API access, run **before** building any Timely → FI OS cron sync.

## 1. Purpose

The probe confirms FI OS can authenticate to the Timely REST API and read appointments/services,
and it captures the **field shape** (names + types only) needed to map Timely records to FI OS
bookings. It is a prerequisite gate: do **not** build the cron sync until the probe succeeds and the
field/endpoint contract is confirmed.

This is investigation-only. It does not touch the existing Timely **webhook** routes
(`/api/tenants/[tenantId]/integrations/timely/*`), which remain the live ingestion path.

## 2. Required env vars

Set these in `.env.local` (see [`.env.example`](../../.env.example)). All are server-only.

| Variable | Purpose |
|----------|---------|
| `TIMELY_API_KEY` | Secret used to authenticate FI → Timely API calls. Sent as `Authorization: Bearer <key>`. Never logged, never `NEXT_PUBLIC_*`. |
| `TIMELY_API_BASE_URL` | Base URL of the Timely REST API, no trailing slash. |
| `FI_TIMELY_SYNC_CRON_SECRET` | Bearer secret reserved for the **future** direct-sync cron route (≥16 chars when set). Not yet wired to a route; not needed to run the probe. |

## 3. Recommended base URL

- **Start with** `https://api.gettimely.com/v1`.
- `https://api.gettimely.com` (without `/v1`) may fail if the API expects the versioned path —
  endpoints will 404 even though auth/DNS look fine. If you see 404s, add `/v1` first.

## 4. How to run

```bash
npx tsx scripts/timely-api-probe.ts
```

`tsx` does not auto-load `.env.local` (Next.js does), so the script loads repo-root `.env.local`
then `.env` itself before running.

## 5. Expected successful output

A successful run prints, in order:

- **Auth verified** — `✓ Authentication succeeded.`
- **Services endpoint reachable** — a sanitized field-shape list for one service record.
- **Bookings/appointments endpoint reachable** — a sanitized field-shape list for one appointment
  in a small (7-day) date range.
- **Sanitized field-shape output only** — field **names + value types**, plus a canonical mapping
  (appointment id, customer id, service name, staff name, start/end, status → detected Timely field
  name).
- **No patient values printed** — no names, emails, phone numbers, or other PII; the API key is
  never printed either.

If a record is reached but a canonical field shows `‹not detected›`, map it manually from the shape
list and update `detectTimelyCanonicalFields` /
[`TIMELY_API_ENDPOINTS`](../../src/lib/integrations/timely/timelyApiClient.server.ts) as needed.

## 6. TLS troubleshooting

If the probe reports `Timely API network error (UNABLE_TO_VERIFY_LEAF_SIGNATURE)` (or a similar
`CERT`/`SELF_SIGNED` cause), the network is intercepting HTTPS with a proxy whose certificate Node
does not trust. DNS and the code are fine; the TLS handshake is being MITM'd.

Fix one of:

- Run the probe from a **network without TLS interception**, or
- Point `NODE_EXTRA_CA_CERTS` at your corporate/root CA bundle:
  ```bash
  NODE_EXTRA_CA_CERTS=/path/to/corporate-root-ca.pem npx tsx scripts/timely-api-probe.ts
  ```

> **Do NOT** set `NODE_TLS_REJECT_UNAUTHORIZED=0` with a real `TIMELY_API_KEY`. That disables
> certificate verification globally and would send your live key over an unverified, potentially
> intercepted connection.

## 7. Things to confirm before building the cron sync

The probe is the means to confirm each of these. Do not start the sync until all are settled:

- [ ] **Correct base URL** (likely `…/v1`).
- [ ] **Auth scheme** — the client sends `Authorization: Bearer <TIMELY_API_KEY>`. Confirm Timely
      doesn't instead require an OAuth2 access token or a custom header; adjust `buildAuthHeaders()`.
- [ ] **Services endpoint** path and response envelope.
- [ ] **Bookings/appointments endpoint** path and response envelope.
- [ ] **Date range query params** — `start_date`/`end_date` vs `since`/`until` vs other.
- [ ] **Status field** names and the values used for **cancelled** / **completed** (and no-show).
- [ ] **Customer ID** field name (maps to FI external patient id).
- [ ] **Staff** and **service** field names.
- [ ] **Pagination** — how the list endpoint pages (page number, cursor, link header) and page size.
- [ ] **Rate limits** — documented limits / headers, so the sync can throttle and back off.

## 8. Safety

- **GET-only.** The client's single transport (`timelyApiGet`) hard-codes the HTTP method to GET, so
  it cannot mutate Timely.
- **Never logs `TIMELY_API_KEY`.** The key is read from `process.env` only; it is never returned,
  never embedded in error messages, and never printed.
- **Does not mutate Timely.** No create/update/delete calls exist in the client.
- **Does not write FI OS records.** The probe only reads from Timely and prints to stdout — no
  database writes, no FI OS booking/patient mutations.

## Related

- Client: [`src/lib/integrations/timely/timelyApiClient.server.ts`](../../src/lib/integrations/timely/timelyApiClient.server.ts)
- Script: [`scripts/timely-api-probe.ts`](../../scripts/timely-api-probe.ts)
- Webhook ingestion (separate, live path): [`fi-os-webhook-production-audit.md`](fi-os-webhook-production-audit.md)
- Env architecture: [`environment-architecture.md`](environment-architecture.md)
