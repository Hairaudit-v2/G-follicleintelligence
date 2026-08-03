# FI Trichoscopy — Event Contract

## Endpoint

`POST /api/integrations/hli/trichoscopy/events`

## Authentication order

1. Platform flag `FI_ENABLE_HLI_TRICHOSCOPY`
2. Headers: `x-fi-tenant-id`, `x-fi-request-id`, `x-fi-timestamp`, `x-fi-signature-version`, `x-fi-signature`
3. Timestamp skew check
4. HMAC signature verify (canonical: `timestamp.requestId.tenantId.bodySha256`)
5. Replay nonce reservation
6. Envelope validation + tenant header match
7. **Then** service-role clinical processing

## Envelope

See `HliTrichoscopyEventEnvelope` in `src/lib/integrations/hliTrichoscopy/types.ts`.

## Supported events (1A)

Listed in `SUPPORTED_HLI_TRICHOSCOPY_EVENTS`. Unknown forward-compatible types are recorded and ignored without failing the endpoint.

## Post-downgrade / cancellation

Inbound confirmed evidence, withdrawals, and lifecycle corrections continue to persist for clinical consistency. New billable workflows are not opened when entitlement is inactive.
