/**
 * Structured HLI trichoscopy integration errors.
 */

export class HliTrichoscopyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "HliTrichoscopyError";
    this.code = code;
  }
}

export class HliTrichoscopyConfigurationError extends HliTrichoscopyError {
  constructor(message: string) {
    super("configuration", message);
    this.name = "HliTrichoscopyConfigurationError";
  }
}

export class HliTrichoscopyAuthenticationError extends HliTrichoscopyError {
  constructor(message: string) {
    super("authentication", message);
    this.name = "HliTrichoscopyAuthenticationError";
  }
}

export class HliTrichoscopyTimeoutError extends HliTrichoscopyError {
  constructor(message: string) {
    super("timeout", message);
    this.name = "HliTrichoscopyTimeoutError";
  }
}

export class HliTrichoscopyValidationError extends HliTrichoscopyError {
  constructor(message: string) {
    super("validation", message);
    this.name = "HliTrichoscopyValidationError";
  }
}

export class HliTrichoscopyTenantMismatchError extends HliTrichoscopyError {
  constructor(message: string) {
    super("tenant_mismatch", message);
    this.name = "HliTrichoscopyTenantMismatchError";
  }
}

export class HliTrichoscopyNotFoundError extends HliTrichoscopyError {
  constructor(message: string) {
    super("not_found", message);
    this.name = "HliTrichoscopyNotFoundError";
  }
}

export class HliTrichoscopyConflictError extends HliTrichoscopyError {
  constructor(message: string) {
    super("conflict", message);
    this.name = "HliTrichoscopyConflictError";
  }
}

export class HliTrichoscopyUnavailableError extends HliTrichoscopyError {
  constructor(message: string) {
    super("unavailable", message);
    this.name = "HliTrichoscopyUnavailableError";
  }
}

export class HliTrichoscopyEvidenceIntegrityError extends HliTrichoscopyError {
  constructor(message: string) {
    super("evidence_integrity", message);
    this.name = "HliTrichoscopyEvidenceIntegrityError";
  }
}
