# OpenAPI — FI-PATIENT-APP-P1 Journey Control (additive paths)

Supplement to `fi-patient-app-1a-openapi.yaml`. Full merge into the primary OpenAPI file follows ticket closeout.

## Extended journey

`GET /api/patient/v1/journey` now returns additive `milestones[]` and may enrich `nextAction` with `actionId`, `deepLinkKey`, `resourceId`. New `nextAction.type` values: `review_quote`, `pay_deposit`, `complete_blood_tests`, `sign_document`.

## New paths

| Method | Path |
|--------|------|
| GET | `/api/patient/v1/actions` |
| GET | `/api/patient/v1/actions/{actionId}` |
| GET | `/api/patient/v1/notifications` |
| PATCH | `/api/patient/v1/notifications/{notificationId}/read` |
| GET | `/api/patient/v1/quotes` |
| GET | `/api/patient/v1/quotes/{quoteId}` |
| POST | `/api/patient/v1/quotes/{quoteId}/accept` |
| POST | `/api/patient/v1/quotes/{quoteId}/decline` |
| POST | `/api/patient/v1/quotes/{quoteId}/questions` |
| GET | `/api/patient/v1/quotes/{quoteId}/pdf` |
| GET | `/api/patient/v1/documents` |
| GET | `/api/patient/v1/documents/{packetId}` |
| PATCH | `/api/patient/v1/documents/{packetId}/sections/{sectionKey}` |
| POST | `/api/patient/v1/documents/{packetId}/sign` |
| GET | `/api/patient/v1/pathology` |
| POST | `/api/patient/v1/pathology/results-upload` |

Contracts: `src/lib/patientJourneyControl/patientJourneyControlContracts.ts`
