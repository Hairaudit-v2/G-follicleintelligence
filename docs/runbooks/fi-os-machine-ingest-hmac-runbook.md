# FI OS — Machine ingest (signed HMAC) runbook

**Scope:** Production operations for **signed machine ingest**: per-tenant HMAC keys, canonical request signing, replay protection, and audit.  
**Code:** [`src/lib/fi/machineIngest/`](../../src/lib/fi/machineIngest/), [`app/api/ingest/[tenantId]/partners/route.ts`](../../app/api/ingest/[tenantId]/partners/route.ts).  
**Schema:** [`supabase/migrations/20260820120001_fi_machine_ingest_hmac.sql`](../../supabase/migrations/20260820120001_fi_machine_ingest_hmac.sql).  
**Product / security context:** [`docs/security/legacy-fi-api-replacement-plan.md`](../security/legacy-fi-api-replacement-plan.md).

---

## 1. Purpose of signed machine ingest

Signed machine ingest lets **integrations, workers, and trusted backends** call specific FI HTTP APIs **without** a global cross-tenant Bearer secret. Each tenant has its own HMAC secret (identified by `kid`). The server:

- Verifies an **HMAC-SHA256** over a **canonical string** that binds **method**, **pathname** (including tenant id), **timestamp**, **nonce**, and **raw body hash**.
- Enforces **clock skew** and **nonce replay** protection.
- Requires **body `tenant_id`** to match the **path** tenant after verification.
- Writes **audit rows** (and structured logs on reject) without storing raw bodies or PHI.

The first shipped route is **`POST /api/ingest/[tenantId]/partners`**. Additional `/api/ingest/[tenantId]/…` routes are planned per the replacement plan; this runbook focuses on patterns that apply to all signed ingest routes unless noted otherwise.

---

## 2. Required environment variables

### `FI_MACHINE_INGEST_MASTER_KEY`

| Attribute | Detail |
|-----------|--------|
| **Role** | Application-only secret used to **derive** a 32-byte AES key (`SHA-256` of the UTF-8 string) and **encrypt** per-tenant HMAC secrets at rest in `fi_machine_ingest_hmac_keys.secret_encrypted` (AES-256-GCM; see [`machineIngestSecretCrypto.server.ts`](../../src/lib/fi/machineIngest/machineIngestSecretCrypto.server.ts)). |
| **Where set** | Vercel / deployment env for the Next.js app (server-only; never `NEXT_PUBLIC_*`). |
| **Unset behaviour** | Signed ingest returns **503** with audit / reason `missing_master_key` and generic client message “Service unavailable.” |

### Production minimum length

When **`NODE_ENV=production`** or **`VERCEL_ENV=production`** (see [`isMachineIngestProductionDeploy`](../../src/lib/fi/machineIngest/machineIngestCanonical.ts)):

- The trimmed master key must be **at least 32 UTF-8 characters**.
- If shorter: **503**, audit / reason `master_key_weak`, structured log `machine_ingest_master_key_production_length_invalid` (logs **length** and **min_length** only — **never** the secret).

**Operational guidance:** generate a long random string (for example 32+ bytes from a CSPRNG, base64url-encoded, or a password manager random string). **All** app instances that verify or encrypt tenant secrets must use the **same** value, or decryption of `secret_encrypted` will fail (`decrypt_failed`).

### Other env (route availability)

`POST /api/ingest/[tenantId]/partners` also requires normal Supabase server env (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) as documented in [`fi-os-env-vars-production-audit.md`](fi-os-env-vars-production-audit.md).

---

## 3. How to create a tenant HMAC key

1. **Choose identifiers**
   - **`tenant_id`:** UUID of the tenant (`fi_tenants.id`).
   - **`kid`:** Opaque key id (1–64 chars: `[a-zA-Z0-9_-]`). Example: `prod-hli-2026-01`.

2. **Generate a random HMAC secret** (UTF-8 string; store only in a secrets manager until encrypted — **never** paste plaintext into tickets or chat).

3. **Encrypt the secret for DB storage**
   - Use the same algorithm as the app: `encryptMachineIngestSecret(plaintext, masterKey)` where `masterKey = deriveMachineIngestMasterKey(FI_MACHINE_INGEST_MASTER_KEY)` (see [`machineIngestSecretCrypto.server.ts`](../../src/lib/fi/machineIngest/machineIngestSecretCrypto.server.ts)).
   - Output is **base64url** encoding of `iv (12 bytes) || authTag (16 bytes) || ciphertext`.

4. **Insert the row** (service role / SQL editor with appropriate access only):

```sql
insert into public.fi_machine_ingest_hmac_keys (tenant_id, kid, secret_encrypted)
values (
  '<tenant-uuid>'::uuid,
  '<kid>',
  '<base64url ciphertext from step 3>'
);
```

5. **Distribute to the integrator** the **plaintext HMAC secret** and **`kid`** over a secure channel. The DB must **only** hold `secret_encrypted`.

---

## 4. How to rotate keys using `kid` + `revoked_at`

**Overlap rotation (recommended):**

1. Insert a **new** row with a **new** `kid` and a newly generated `secret_encrypted` (same `tenant_id`).
2. Ask the producer to switch to the new `kid` + new secret on a defined cutover window.
3. After traffic has moved, **revoke** the old key:

```sql
update public.fi_machine_ingest_hmac_keys
set revoked_at = now()
where tenant_id = '<tenant-uuid>'::uuid
  and kid = '<old-kid>';
```

**Verification:** Active keys are those with `revoked_at is null`. Revoked keys no longer verify (`unknown_kid` from the client’s perspective).

**Multiple active keys:** The unique constraint is `(tenant_id, kid)`. Several non-revoked `kid` values may exist per tenant during rotation.

**Emergency:** Revoke immediately (`revoked_at = now()`). Requests using that `kid` fail until the producer uses a still-active `kid`.

---

## 5. Client signing contract

Implementations must match the server’s [`buildMachineIngestCanonicalString`](../../src/lib/fi/machineIngest/machineIngestCanonical.ts) and header validation in [`machineIngestHmacVerify.server.ts`](../../src/lib/fi/machineIngest/machineIngestHmacVerify.server.ts).

### HTTP method

- Use the **actual** request method (e.g. `POST`).
- Canonical form: `method.trim().toUpperCase()` or empty trim → `POST`.

### Exact pathname

- Use **`pathname` only** from the request URL the server will see — **no** scheme, host, or query string.
- Example: `/api/ingest/aaaaaaaa-bbbb-442c-8aaa-eeeeeeeeeeee/partners`
- Must match deployment path shape (no accidental double slashes, wrong `basePath`, or trailing-slash mismatch between signer and server).

### Timestamp (`x-fi-timestamp`)

- **Header value:** string of **12–16 decimal digits** only (Unix time in **milliseconds**).
- No decimals, no scientific notation, no leading-only garbage; must parse as a **safe integer** for skew math.
- Server allows skew **`±5 minutes`** (`MACHINE_INGEST_TIMESTAMP_SKEW_MS` = 300_000 ms) relative to server `Date.now()`.

### Nonce (`x-fi-nonce`)

- After trim: **8–128** characters, regex `[a-zA-Z0-9._-]+`.
- Must be **unique per** `(tenant_id, kid, nonce)` while the nonce row exists (see §7).

### Raw body SHA-256

- Compute **SHA-256** over the **raw request body bytes** (the exact octets sent as the body).
- Use **lowercase hex** (64 hex chars). Node’s `createHash('sha256').digest('hex')` is lowercase; clients must match.

### Canonical string format

Single string, **newline-separated** (Unix `\n` only), **exactly five lines**:

```text
{METHOD}\n{pathname}\n{timestampMs}\n{nonce}\n{bodySha256Hex}
```

- `{timestampMs}`: same integer as parsed from `x-fi-timestamp`; canonical line uses `String(timestampMs)` (no zero-padding beyond what the integer string is).
- `{nonce}`: trimmed header value (must satisfy nonce rules before signing).

### Signature (`x-fi-signature`)

- **HMAC-SHA256** over the canonical string UTF-8, using the tenant’s **plaintext** HMAC secret.
- Output: **64-character lowercase hex** (trim allowed on verify).

### Key id (`x-fi-key-id`)

- Must match a row in `fi_machine_ingest_hmac_keys` for the path tenant with `revoked_at is null`, and match `[a-zA-Z0-9_-]{1,64}`.

### Required headers (summary)

| Header | Purpose |
|--------|---------|
| `x-fi-timestamp` | Strict integer ms (12–16 digits) |
| `x-fi-nonce` | Replay guard |
| `x-fi-key-id` | Selects tenant HMAC row (`kid`) |
| `x-fi-signature` | HMAC-SHA256 hex |

---

## 6. Example signed request for `POST /api/ingest/[tenantId]/partners`

**URL:** `https://<your-deploy-host>/api/ingest/<tenant-uuid>/partners`  
**Method:** `POST`  
**Body (JSON, UTF-8):** must include `"tenant_id"` equal to the path `<tenant-uuid>`, plus `name`, `reference_code` per [`createFiPartnerFromBody`](../../src/lib/fi/partners/fiPartnerCreate.server.ts).

**Pseudocode (language-agnostic):**

```text
bodyUtf8 = minimal stable JSON for the payload (stable key order not required by server,
  but the signer MUST hash the exact bytes sent on the wire)
bodySha256Hex = lowercase_hex( SHA256( utf8_bytes(bodyUtf8) ) )
canonical = "POST\n" + pathname + "\n" + timestampMsString + "\n" + nonce + "\n" + bodySha256Hex
signatureHex = lowercase_hex( HMAC_SHA256( hmacSecretUtf8, utf8_bytes(canonical) ) )
```

**`curl` shape (signature must be precomputed — `curl` does not HMAC):**

```bash
# Illustration only: compute BODY_HASH and SIGNATURE with your toolchain (OpenSSL, Node, etc.)
export TENANT_ID="<tenant-uuid>"
export BODY='{"tenant_id":"'"$TENANT_ID"'","name":"Example Partner","reference_code":"ref_example_1"}'
export PATHNAME="/api/ingest/${TENANT_ID}/partners"
export TS="<13-digit-ms-since-epoch>"   # must be within ±5m of server clock
export NONCE="<unique-8-to-128-chars>"
export KID="<kid>"
# BODY_HASH=$( … sha256 of BODY bytes, lowercase hex … )
# SIGNATURE=$( … hmac-sha256 of canonical, lowercase hex … )
curl -sS -X POST "https://<host>${PATHNAME}" \
  -H "Content-Type: application/json" \
  -H "x-fi-timestamp: ${TS}" \
  -H "x-fi-nonce: ${NONCE}" \
  -H "x-fi-key-id: ${KID}" \
  -H "x-fi-signature: ${SIGNATURE}" \
  --data-binary "$BODY"
```

Reference tests: [`machineIngestCanonical.test.ts`](../../src/lib/fi/machineIngest/machineIngestCanonical.test.ts), [`machineIngestHmacVerify.test.ts`](../../src/lib/fi/machineIngest/machineIngestHmacVerify.test.ts).

---

## 7. Replay / nonce behaviour

- After a successful **HMAC** and **JSON** validation (and path/body tenant match), the server inserts a row into **`fi_machine_ingest_nonce`** with primary key `(tenant_id, kid, nonce)` and `expires_at` set to **approximately 24 hours** from insert time.
- A **duplicate** insert (same triple) yields **409** with reason **`replay_nonce`**.
- Failed authentication attempts **do not** consume a nonce row (reduces nonce-table noise from attackers).
- **Clock skew** is ±5 minutes: replays of the same body/signature with an old timestamp fail **`timestamp_skew`** once outside the window, even if a nonce row were absent.

Operators should plan **nonce row retention** (§11); the table can grow without purge.

---

## 8. Audit tables and useful SQL queries

### Tables (public)

| Table | Purpose |
|-------|---------|
| `fi_machine_ingest_hmac_keys` | Encrypted per-tenant HMAC secrets + `kid` + `revoked_at` |
| `fi_machine_ingest_nonce` | Replay window rows `(tenant_id, kid, nonce, expires_at)` |
| `fi_machine_ingest_audit` | One row per accept/reject decision (no raw body) |

Access is intended for **service role** application paths only (see migration grants).

### Audit columns (high level)

- `tenant_id`, `kid`, `route`, `outcome` (`accepted` | `rejected`), `reason_code`, `http_status`, `body_sha256` (hex of raw body), `created_at`.

### Example queries

**Recent rejects for a tenant:**

```sql
select created_at, route, outcome, reason_code, http_status, kid, body_sha256
from public.fi_machine_ingest_audit
where tenant_id = '<tenant-uuid>'::uuid
  and outcome = 'rejected'
order by created_at desc
limit 100;
```

**Replay / auth noise rate (last 24h):**

```sql
select reason_code, count(*) as n
from public.fi_machine_ingest_audit
where created_at > now() - interval '24 hours'
  and outcome = 'rejected'
group by reason_code
order by n desc;
```

**Nonce table size / oldest expiry:**

```sql
select count(*) as nonce_rows, min(expires_at) as min_expires, max(expires_at) as max_expires
from public.fi_machine_ingest_nonce;
```

**Active keys per tenant:**

```sql
select tenant_id, kid, created_at, revoked_at
from public.fi_machine_ingest_hmac_keys
where tenant_id = '<tenant-uuid>'::uuid
order by created_at desc;
```

---

## 9. Reject reason codes

Values appear in **`fi_machine_ingest_audit.reason_code`** and structured logs (`machine_ingest_rejected` includes a `reason` field aligned with verification).

| `reason_code` | Typical HTTP | Meaning |
|---------------|--------------|---------|
| `malformed_headers` | 400 | Missing/invalid signing headers, invalid path tenant UUID, invalid `kid`/nonce shape, or invalid timestamp format |
| `missing_master_key` | 503 | `FI_MACHINE_INGEST_MASTER_KEY` empty / unset |
| `master_key_weak` | 503 | Production deploy and master key shorter than 32 chars (after trim) |
| `unknown_kid` | 401 | No active key row for `(tenant_id, kid)` |
| `decrypt_failed` | 503 | `secret_encrypted` cannot be decrypted (wrong master key, corrupt ciphertext, etc.) |
| `signature_invalid` | 401 | HMAC mismatch |
| `timestamp_skew` | 401 | Outside ±5 minutes |
| `tenant_mismatch` | 400 | JSON `tenant_id` does not match path tenant |
| `invalid_json` | 400 | Body is not a JSON object after MAC verification |
| `replay_nonce` | 409 | Duplicate `(tenant_id, kid, nonce)` |
| `nonce_reserve_failed` | 500 | Nonce insert failed for non-duplicate reason |
| `partner_create_failed` | varies | Business logic rejected after verify (see handler) |
| `accepted` | 200 | Successful accept audit row |

---

## 10. Monitoring checklist

- **Structured logs (Vercel / log drain):** filter events `machine_ingest_rejected`, `machine_ingest_master_key_production_length_invalid`, `machine_ingest_audit_insert_failed`, `machine_ingest_partners_route_unhandled`.
- **Rates:** spikes in `signature_invalid`, `timestamp_skew`, or `replay_nonce` for one `tenant_id` / `kid` may indicate clock drift, buggy client, or abuse.
- **503 clusters:** `missing_master_key`, `master_key_weak`, `decrypt_failed` — config or master-key rotation issue.
- **DB:** periodic check on `fi_machine_ingest_nonce` row count and `fi_machine_ingest_audit` growth (§8 queries).
- **Smoke:** after deploy, one signed **staging** request per critical integrator `kid` (no secrets in monitoring tickets — use throwaway test tenant where possible).

---

## 11. Nonce cleanup operator procedure

There is **no** in-app cron for nonce purge at the time of this runbook; operators should schedule maintenance.

**Safe delete (expired rows only):**

```sql
-- Preview
select count(*) from public.fi_machine_ingest_nonce
where expires_at < now();

-- Delete in batches if the table is large (adjust batch size / loop in your job runner)
delete from public.fi_machine_ingest_nonce
where ctid in (
  select ctid from public.fi_machine_ingest_nonce
  where expires_at < now()
  limit 10000
);
```

**Notes:**

- Deleting expired rows **does not** weaken replay protection for **old** requests outside the timestamp skew window (signatures with stale `x-fi-timestamp` already fail).
- Run during low traffic if the table is huge; **VACUUM** / autovacuum will follow your usual Postgres ops.
- Consider a **weekly** or **daily** scheduled job in Supabase `pg_cron`, GitLab pipeline, or external worker with **service role** credentials — follow least privilege and change-management policy.

---

## 12. Incident response if a tenant key is compromised

1. **Revoke immediately:** `update fi_machine_ingest_hmac_keys set revoked_at = now() where tenant_id = … and kid = …`.
2. **Issue new credentials:** new `kid` + new random secret + new `secret_encrypted` row (§3). Notify the integrator via secure channel.
3. **Review audit:** `fi_machine_ingest_audit` for that `tenant_id` / `kid` and time window; correlate with Vercel edge logs / IP if available.
4. **Assess blast radius:** partners route creates `fi_partners` rows — identify suspicious `reference_code` / names; coordinate with clinical/commercial owners.
5. **Do not rotate `FI_MACHINE_INGEST_MASTER_KEY` casually:** rotation requires **re-encrypting every** `secret_encrypted` (or dual-read period). Prefer revoking a **single tenant `kid`** first. Full master rotation is a **planned** migration with downtime risk if not coordinated.

---

## 13. Migration path from legacy `/api/fi/*` routes

High-level sequence (see [`legacy-fi-api-replacement-plan.md`](../security/legacy-fi-api-replacement-plan.md) for full matrix):

| Phase | Action |
|-------|--------|
| **Coexist** | Ship `/api/ingest/[tenantId]/…` beside legacy `/api/fi/…`; legacy remains gated by `FI_LEGACY_FI_API_*` where applicable. |
| **Move producers** | Each integration switches URL, obtains per-tenant `kid` + HMAC secret, implements signing (§5–§6). |
| **Verify** | Monitor audit + error rates; use staging cutover per tenant. |
| **Disable legacy** | Remove or unset legacy env flags in production so old paths **404** when no longer needed. |
| **Decommission** | Remove legacy route handlers and env branches only after traffic and smoke tests confirm zero producers on legacy URLs. |

**Partners today:** `POST /api/ingest/[tenantId]/partners` (signed) vs `POST /api/fi/partners` (legacy bearer when enabled). Same body handler conceptually; different auth. Other `/api/fi/*` writes remain on the legacy plan until individually migrated.

---

## Related documents

- [`fi-os-env-vars-production-audit.md`](fi-os-env-vars-production-audit.md) — env inventory including `FI_MACHINE_INGEST_MASTER_KEY`
- [`legacy-fi-api-replacement-plan.md`](../security/legacy-fi-api-replacement-plan.md) — route roadmap and reason codes
- [`scripts/fi-production-smoke-test.ts`](../../scripts/fi-production-smoke-test.ts) — production smoke expectations during legacy transition
