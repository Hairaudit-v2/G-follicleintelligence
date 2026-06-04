/**
 * Booking foundation — types and pure helpers safe to import from any context.
 * Service-role data access: `./server` (server-only).
 */

export type { FiBookingRow, JsonObject } from "./types";
export {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  assertAllowedBookingStatus,
  assertAllowedBookingType,
  assertAtLeastOneBookingAnchor,
  assertBookingTypeAllowedForLeadConversion,
  assertEndAfterStart,
  assertMetadataJsonObject,
  assertNonCancelledBookingMutable,
  isAllowedBookingStatus,
  isAllowedBookingType,
  isBookingCancelled,
  isBookingRowForTenant,
  type BookingStatus,
  type BookingType,
} from "./bookingPolicy";
export {
  bookingDetailSnapshotFromRowLike,
  collectChangedBookingDetailKeys,
  type BookingDetailComparableSnapshot,
} from "./bookingChangedFields";
export { isBookingUpcoming, sortBookingsByStartAt } from "./bookingTime";
