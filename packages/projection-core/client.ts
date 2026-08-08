/**
 * @follicle/projection-core/client — browser-safe contracts and presentation only.
 * Never imports node:crypto or server/idempotency.
 */

export * from "./shared/artifactTypes";
export * from "./shared/lifecycle";
export * from "./shared/requestContract";
export * from "./shared/responseContract";
export * from "./shared/failureCategories";
export * from "./shared/providerBoundary";
