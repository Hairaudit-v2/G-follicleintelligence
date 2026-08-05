/**
 * Identity resolution errors — thrown only for hard programming mistakes
 * (ambiguous input shape), not for missing/partial staff links.
 */

export class IdentityResolutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "IdentityResolutionError";
    this.code = code;
  }
}

export class IdentityCrossTenantError extends IdentityResolutionError {
  readonly tenantId: string;
  readonly staffId: string | null;
  readonly staffMemberId: string | null;

  constructor(input: {
    tenantId: string;
    staffId: string | null;
    staffMemberId: string | null;
    message?: string;
  }) {
    super(
      "cross_tenant_mismatch",
      input.message ??
        "Staff identity links fi_staff and fi_staff_members across different tenants."
    );
    this.name = "IdentityCrossTenantError";
    this.tenantId = input.tenantId;
    this.staffId = input.staffId;
    this.staffMemberId = input.staffMemberId;
  }
}
