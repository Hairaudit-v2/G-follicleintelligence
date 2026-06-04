/** Row limits for FI Admin booking operator list (Stage 3B). Safe for client and server. */

export const DEFAULT_OPERATOR_BOOKINGS_LIMIT = 500;
export const MAX_OPERATOR_BOOKINGS_LIMIT = 2000;

/** Calendar visible-range loads only; capped to avoid unbounded reads (Stage 3C). */
export const CALENDAR_VIEW_BOOKINGS_LIMIT = 800;
