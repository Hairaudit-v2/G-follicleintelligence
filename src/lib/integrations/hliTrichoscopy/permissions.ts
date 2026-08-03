/**
 * Trichoscopy permission helpers — wraps platform entitlement capabilities.
 */

export const TRICHOSCOPY_PERMISSIONS = {
  request: "trichoscopy.request",
  viewStatus: "trichoscopy.view",
  viewConfirmedEvidence: "trichoscopy.confirmed_evidence",
  openHliReview: "trichoscopy.review",
  retrySync: "trichoscopy.fios_integration",
  cancelRequest: "trichoscopy.request",
  viewIntegrationErrors: "trichoscopy.fios_integration",
} as const;
